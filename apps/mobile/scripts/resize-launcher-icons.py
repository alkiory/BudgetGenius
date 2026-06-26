#!/usr/bin/env python3
"""
resize-launcher-icons.py
========================
Replaces the 1.4MB 1024×1024 source that lives in every mipmap-*
subdirectory with properly-sized Android launcher icons (48/72/96/144/192
for legacy, 108/162/216/324/432 for adaptive foreground).

Stdlib-only. Tries Pillow first (Lanczos, better quality) and falls back
to a from-scratch PNG decoder + nearest-neighbor resampler + minimal
encoder if Pillow is not installed. Either path strips non-standard
chunks (e.g., the `caBX` C2PA provenance block) so AAPT2 stays quiet.

Run from any CWD. Defaults target the BudgetGenius repo layout:
    SOURCE_PNG = repo-root/Logo_budgetgenius.png
    RES_DIR    = apps/mobile/android/app/src/main/res

Override with --source and --res-dir.

References:
  - PNG spec, §9 Filtering (Paeth, Sub, Up, Average):
      https://www.w3.org/TR/PNG/#9Filters
  - Android iconography densities:
      https://developer.android.com/training/multiscreen/screendensities
"""

from __future__ import annotations

import argparse
import math
import os
import struct
import sys
import zlib
from pathlib import Path
from typing import Callable, Dict, List, Tuple

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[3]  # apps/mobile/scripts/ -> <repo>
DEFAULT_SOURCE = REPO_ROOT / "Logo_budgetgenius.png"
DEFAULT_RES = (
    REPO_ROOT
    / "apps"
    / "mobile"
    / "android"
    / "app"
    / "src"
    / "main"
    / "res"
)

# Android convention:
#   legacy icon   = density × 48 px  (mdpi=48,hdpi=72,xhdpi=96,xxhdpi=144,xxxhdpi=192)
#   foreground    = density × 108 px (mdpi=108,hdpi=162,xhdpi=216,xxhdpi=324,xxxhdpi=432)
DENSITIES: Dict[str, Dict[str, int]] = {
    "mdpi":    {"legacy":  48, "fg": 108},
    "hdpi":    {"legacy":  72, "fg": 162},
    "xhdpi":   {"legacy":  96, "fg": 216},
    "xxhdpi":  {"legacy": 144, "fg": 324},
    "xxxhdpi": {"legacy": 192, "fg": 432},
}

PNG_SIG = b"\x89PNG\r\n\x1a\n"


# ---------------------------------------------------------------------------
# Paeth predictor (PNG §9.4.4)
# ---------------------------------------------------------------------------

def paeth_predictor(a: int, b: int, c: int) -> int:
    """PCM Paeth predictor with the spec's tie-break rule."""
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


# ---------------------------------------------------------------------------
# Pillow path (preferred — Lanczos resampling is high-quality)
# ---------------------------------------------------------------------------

def resize_pil(src_path: Path, dest_path: Path, width: int, height: int) -> None:
    from PIL import Image  # local import so Pillow is optional

    img = Image.open(src_path)
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    resized = img.resize((width, height), Image.LANCZOS)
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    resized.save(dest_path, format="PNG", optimize=True)


# ---------------------------------------------------------------------------
# Stdlib-only fallback: PNG decoder + nearest-neighbor + minimal PNG encoder
# ---------------------------------------------------------------------------

def decode_png(path: Path) -> Tuple[int, int, bytearray]:
    """Return (width, height, RGBA bytes) — supports 8-bit RGBA only.

    Pure stdlib. Validates CRCs and reverses PNG row filters 0..4.
    """
    data = path.read_bytes()
    if data[:8] != PNG_SIG:
        raise ValueError(f"bad PNG signature: {path}")

    cursor = 8
    ihdr: bytes | None = None
    idat = bytearray()
    while cursor < len(data):
        (length,) = struct.unpack(">I", data[cursor : cursor + 4])
        ctype = data[cursor + 4 : cursor + 8]
        cdata = data[cursor + 8 : cursor + 8 + length]
        (crc_actual,) = struct.unpack(
            ">I", data[cursor + 8 + length : cursor + 12 + length]
        )
        crc_expected = zlib.crc32(ctype + cdata) & 0xFFFFFFFF
        if crc_expected != crc_actual:
            raise ValueError(
                f"CRC mismatch in chunk {ctype.decode('ascii', 'ignore')} at offset {cursor}"
            )
        if ctype == b"IHDR":
            ihdr = cdata
        elif ctype == b"IDAT":
            idat.extend(cdata)
        elif ctype == b"IEND":
            break
        cursor += 12 + length

    if ihdr is None:
        raise ValueError("missing IHDR chunk")
    width, height, bit_depth, color_type, _comp, _filter, _interlace = struct.unpack(
        ">IIBBBBB", ihdr
    )
    if bit_depth != 8 or color_type != 6:
        raise NotImplementedError(
            f"only 8-bit RGBA (color_type=6) supported; got bit_depth={bit_depth} color_type={color_type}"
        )

    bpp = 4  # RGBA
    stride = width * bpp
    raw = zlib.decompress(bytes(idat))

    pixels = bytearray(height * stride)
    idx = 0
    for y in range(height):
        ftype = raw[idx]
        idx += 1
        row = raw[idx : idx + stride]
        idx += stride
        base = y * stride
        for x in range(stride):
            fil = row[x]
            a = pixels[base + x - bpp] if x >= bpp else 0
            b = pixels[base - stride + x] if y > 0 else 0
            c_val = pixels[base - stride + x - bpp] if y > 0 and x >= bpp else 0
            if ftype == 0:
                recon = fil
            elif ftype == 1:
                recon = fil + a
            elif ftype == 2:
                recon = fil + b
            elif ftype == 3:
                recon = fil + ((a + b) // 2)
            elif ftype == 4:
                recon = fil + paeth_predictor(a, b, c_val)
            else:
                raise ValueError(f"invalid filter type {ftype} at row {y}")
            pixels[base + x] = recon & 0xFF

    return width, height, pixels


def resize_nearest(
    src_w: int, src_h: int, src_pixels: bytearray, dst_w: int, dst_h: int
) -> bytearray:
    """Half-pixel-center nearest-neighbor sampling. Preserves alpha."""
    bpp = 4
    out = bytearray(dst_w * dst_h * bpp)
    for dy in range(dst_h):
        sy = min(max(int(math.floor((dy + 0.5) * src_h / dst_h)), 0), src_h - 1)
        for dx in range(dst_w):
            sx = min(max(int(math.floor((dx + 0.5) * src_w / dst_w)), 0), src_w - 1)
            src_off = (sy * src_w + sx) * bpp
            dst_off = (dy * dst_w + dx) * bpp
            out[dst_off : dst_off + bpp] = src_pixels[src_off : src_off + bpp]
    return out


def _png_chunk(ctype: bytes, cdata: bytes) -> bytes:
    return (
        struct.pack(">I", len(cdata))
        + ctype
        + cdata
        + struct.pack(">I", zlib.crc32(ctype + cdata) & 0xFFFFFFFF)
    )


def encode_png(width: int, height: int, pixels: bytearray) -> bytes:
    """Minimal PNG encoder: filter type 0 on every scanline, zlib level 9.

    Strips non-standard chunks because we never re-emit anything except
    IHDR / IDAT / IEND.
    """
    bpp = 4
    stride = width * bpp
    filtered = bytearray()
    for y in range(height):
        filtered.append(0)
        base = y * stride
        filtered.extend(pixels[base : base + stride])

    co = zlib.compressobj(level=9, strategy=zlib.Z_DEFAULT_STRATEGY)
    idat = co.compress(filtered) + co.flush()

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    out = bytearray(PNG_SIG)
    out.extend(_png_chunk(b"IHDR", ihdr))
    out.extend(_png_chunk(b"IDAT", idat))
    out.extend(_png_chunk(b"IEND", b""))
    return bytes(out)


def resize_stdlib(src_path: Path, dest_path: Path, width: int, height: int) -> None:
    sw, sh, pixels = decode_png(src_path)
    resized = resize_nearest(sw, sh, pixels, width, height)
    encoded = encode_png(width, height, resized)
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    dest_path.write_bytes(encoded)


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------

def pick_resizer() -> Callable[[Path, Path, int, int], None]:
    """Return resize_pil if Pillow is importable, else resize_stdlib."""
    try:
        import PIL  # noqa: F401

        print("[info] Pillow detected -> Lanczos resampling")
        return resize_pil
    except ImportError:
        print("[info] Pillow missing -> stdlib nearest-neighbor fallback")
        return resize_stdlib


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help=f"source PNG (default: {DEFAULT_SOURCE})",
    )
    parser.add_argument(
        "--res-dir",
        type=Path,
        default=DEFAULT_RES,
        help=f"Android res/ directory (default: {DEFAULT_RES})",
    )
    args = parser.parse_args(argv)

    if not args.source.is_file():
        print(f"[fatal] source PNG not found: {args.source}", file=sys.stderr)
        return 2
    if not args.res_dir.is_dir():
        print(f"[fatal] res dir not found: {args.res_dir}", file=sys.stderr)
        return 2

    resize = pick_resizer()

    print(f"[info] source: {args.source}")
    print(f"[info] res:    {args.res_dir}")

    total_bytes = 0
    sizes_per_file: list[tuple[str, int, int]] = []
    for density, sizes in DENSITIES.items():
        out_dir = args.res_dir / f"mipmap-{density}"
        out_dir.mkdir(parents=True, exist_ok=True)

        legacy = sizes["legacy"]
        fg = sizes["fg"]

        # Legacy + round get the SAME bytes (round shape comes from the OS launcher).
        legacy_path = out_dir / "ic_launcher.png"
        resize(args.source, legacy_path, legacy, legacy)
        round_path = out_dir / "ic_launcher_round.png"
        round_path.write_bytes(legacy_path.read_bytes())

        # Adaptive-icon foreground at twice the per-density size.
        fg_path = out_dir / "ic_launcher_foreground.png"
        resize(args.source, fg_path, fg, fg)

        for label, path, w, h in [
            (f"{density}/legacy",   legacy_path, legacy, legacy),
            (f"{density}/foreground", fg_path,    fg,    fg),
        ]:
            data = path.read_bytes()
            sizes_per_file.append((label, w, h))
            total_bytes += len(data)
            print(f"  {label:32s} {w}x{h}  -> {len(data):>7,d} B  ({path.relative_to(args.res_dir)})")

    print()
    print(f"[ok] wrote {len(sizes_per_file)} files, total {total_bytes:,d} B "
          f"({total_bytes / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
