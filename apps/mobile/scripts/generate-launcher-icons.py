#!/usr/bin/env python3
"""Generate Android launcher icon PNGs for BudgetGenius APK.

Outputs 15 PNGs into `apps/mobile/android/app/src/main/res/mipmap-*`:
  - ic_launcher.png           (legacy, full-bleed RGB, 48/72/96/144/192)
  - ic_launcher_round.png     (legacy, full-bleed RGB, same sizes)
  - ic_launcher_foreground.png (adaptive-icon foreground RGBA, 108/162/216/324/432)

Visual: the same brand mark shown by the React splash page
(`apps/webClient/src/presentation/pages/splash.tsx`):
  - Purple→fuchsia radial gradient circle (purple at centre, fuchsia at rim)
  - White, simplified "Wallet" outline shape centred inside the circle
  - Legacy PNGs are full-bleed with a deep branded fill outside the circle
  - Adaptive-icon foreground respects the 72x72/108x108 safe zone so
    Android's circular/squircle mask never clips the icon

Deliberately omitted: the "BudgetGenius" wordmark + tagline. Launcher icons
(48–192 px) are too small for readable text, and rendering crisp bitmap
fonts in pure stdlib (no Pillow / no fontconfig) would require either
bundling a TTF (large binary, licensing concerns) or hand-rolling a
pixel font (visual quality + maintenance burden). If you ever need
text-capable icons, install Pillow and call `ImageFont.truetype` — but
for now the mark alone scales cleanly across every launcher size.

Stack: Python 3 stdlib only (zlib + struct + math + binascii). No Pillow,
no ImageMagick, no librsvg — because those aren't installed in this env.

Re-run whenever the brand palette or composition changes:
    python3 apps/mobile/scripts/generate-launcher-icons.py
"""

from __future__ import annotations

import math
import os
import struct
import sys
import zlib
from typing import List, Tuple

# --------------------------------------------------------------------------
# Brand palette (Tailwind v3, mirrors splash.tsx: bg-purple-700/800/900 +
# halo from-purple-300 to-fuchsia-400)
# --------------------------------------------------------------------------
BG_DEEP: Tuple[int, int, int] = (76, 29, 149)       # #4C1D95  purple-900
GRADIENT_INNER: Tuple[int, int, int] = (192, 132, 252)  # #C084FC  purple-400
GRADIENT_OUTER: Tuple[int, int, int] = (232, 121, 249)  # #E879F9  fuchsia-400
ICON_WHITE: Tuple[int, int, int] = (255, 255, 255)

# Density table: (name, legacy_size_dp, adaptive_foreground_size_dp)
# Reference: https://developer.android.com/training/multiscreen/screendensities
DENSITIES: List[Tuple[str, int, int]] = [
    ("mdpi", 48, 108),
    ("hdpi", 72, 162),
    ("xhdpi", 96, 216),
    ("xxhdpi", 144, 324),
    ("xxxhdpi", 192, 432),
]

RES_ROOT = os.path.realpath(
    os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "..", "android", "app", "src", "main", "res",
    )
)


# --------------------------------------------------------------------------
# PNG encoder (8-bit RGBA, filter-byte 0, zlib level 9)
# --------------------------------------------------------------------------

def _png_chunk(tag: bytes, data: bytes) -> bytes:
    """Emit one PNG chunk: [length][tag+data][crc32]."""
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)
    )


def write_png_rgba(path: str, width: int, height: int, rgba: bytearray) -> None:
    """Write `rgba` (length = width*height*4, row-major top→bottom) as PNG."""
    if len(rgba) != width * height * 4:
        raise ValueError("rgba buffer length mismatch")

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = _png_chunk(
        b"IHDR",
        struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0),
    )

    # Each pixel row is prefixed by a filter byte. Filter 0 (None) is the
    # simplest and works fine because zlib still compresses repeated bytes
    # in our rendered icon (most rows have large flat regions).
    row_stride = width * 4
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        start = y * row_stride
        raw.extend(rgba[start : start + row_stride])

    idat = _png_chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    iend = _png_chunk(b"IEND", b"")

    with open(path, "wb") as f:
        f.write(sig + ihdr + idat + iend)


def write_png_rgb(path: str, width: int, height: int, rgb: bytearray) -> None:
    """Write an opaque RGB PNG by stripping alpha."""
    if len(rgb) % 3 != 0:
        raise ValueError("rgb buffer length must be a multiple of 3")
    rgba = bytearray(len(rgb) // 3 * 4)
    for i in range(0, len(rgb), 3):
        rgba[i // 3 * 4] = rgb[i]
        rgba[i // 3 * 4 + 1] = rgb[i + 1]
        rgba[i // 3 * 4 + 2] = rgb[i + 2]
        rgba[i // 3 * 4 + 3] = 255
    write_png_rgba(path, width, height, rgba)


# --------------------------------------------------------------------------
# Drawing primitives — render at 2× (or arbitrary) supersampled resolution,
# then 2×2 block-average downsample for antialiased edges.
# --------------------------------------------------------------------------

# 4× supersample + 4×4 block-average downsample. mdpi (48×48) → 192×192 is
# still ≤37 k pixels, perfectly cheap. The extra factor matters: at 2×
# the simplified Wallet outline reads as a small abstract shape on mdpi
# launchers; at 4× the corners and clasp become legible.
SUPERSAMPLE = 4


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def _lerp_color(
    c0: Tuple[int, int, int],
    c1: Tuple[int, int, int],
    t: float,
) -> Tuple[int, int, int]:
    return (
        int(_lerp(c0[0], c1[0], t)),
        int(_lerp(c0[1], c1[1], t)),
        int(_lerp(c0[2], c1[2], t)),
    )


def _circle_filled(
    rgba: bytearray,
    sw: int,
    sh: int,
    cx: float,
    cy: float,
    radius: float,
    color: Tuple[int, int, int],
    alpha: int = 255,
) -> None:
    """Filled circle (no antialiasing — edges stay jaggy enough to look crisp
    when downsampled by the 2×2 block average)."""
    r2 = radius * radius
    x_min = max(0, int(math.floor(cx - radius - 1)))
    x_max = min(sw - 1, int(math.ceil(cx + radius + 1)))
    y_min = max(0, int(math.floor(cy - radius - 1)))
    y_max = min(sh - 1, int(math.ceil(cy + radius + 1)))
    cr, cg, cb = color
    for y in range(y_min, y_max + 1):
        dy = y - cy
        for x in range(x_min, x_max + 1):
            dx = x - cx
            if dx * dx + dy * dy <= r2:
                i = (y * sw + x) * 4
                rgba[i] = cr
                rgba[i + 1] = cg
                rgba[i + 2] = cb
                rgba[i + 3] = alpha


def _rounded_rect(
    rgba: bytearray,
    sw: int,
    sh: int,
    x0: float,
    y0: float,
    x1: float,
    y1: float,
    radius: float,
    color: Tuple[int, int, int],
    alpha: int = 255,
) -> None:
    """Filled rounded rectangle in pixel space."""
    if x1 < x0:
        x0, x1 = x1, x0
    if y1 < y0:
        y0, y1 = y1, y0
    # Straight rectangle first.
    ix0 = max(0, int(math.floor(x0)))
    ix1 = min(sw - 1, int(math.ceil(x1)))
    iy0 = max(0, int(math.floor(y0)))
    iy1 = min(sh - 1, int(math.ceil(y1)))
    cr, cg, cb = color

    # We approximate the corners by clipping the straight rect diagonally
    # against four circular cuts at each corner — fast and good enough at
    # 2× supersampled resolution.
    def in_corner(x: float, y: float) -> bool:
        # Top-left corner
        if x < x0 + radius and y < y0 + radius:
            dx = x - (x0 + radius)
            dy = y - (y0 + radius)
            return dx * dx + dy * dy <= radius * radius
        # Top-right
        if x > x1 - radius and y < y0 + radius:
            dx = x - (x1 - radius)
            dy = y - (y0 + radius)
            return dx * dx + dy * dy <= radius * radius
        # Bottom-right
        if x > x1 - radius and y > y1 - radius:
            dx = x - (x1 - radius)
            dy = y - (y1 - radius)
            return dx * dx + dy * dy <= radius * radius
        # Bottom-left
        if x < x0 + radius and y > y1 - radius:
            dx = x - (x0 + radius)
            dy = y - (y1 - radius)
            return dx * dx + dy * dy <= radius * radius
        return True

    for y in range(iy0, iy1 + 1):
        for x in range(ix0, ix1 + 1):
            # Sample the corner test at the pixel center.
            if in_corner(x + 0.5, y + 0.5):
                i = (y * sw + x) * 4
                rgba[i] = cr
                rgba[i + 1] = cg
                rgba[i + 2] = cb
                rgba[i + 3] = alpha


def _blend_rgba(
    rgba: bytearray,
    sw: int,
    sh: int,
    x: int,
    y: int,
    sr: int,
    sg: int,
    sb: int,
    sa: int,
) -> None:
    """Over-blend (sa) onto existing RGBA pixel at (x, y)."""
    if x < 0 or x >= sw or y < 0 or y >= sh:
        return
    i = (y * sw + x) * 4
    dr, dg, db, da = rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]
    a = sa / 255.0
    rgba[i] = int(dr * (1 - a) + sr * a)
    rgba[i + 1] = int(dg * (1 - a) + sg * a)
    rgba[i + 2] = int(db * (1 - a) + sb * a)
    rgba[i + 3] = max(da, sa)


def _stroke_rounded_rect(
    rgba: bytearray,
    sw: int,
    sh: int,
    x0: float,
    y0: float,
    x1: float,
    y1: float,
    radius: float,
    thickness: float,
    color: Tuple[int, int, int],
    alpha: int = 255,
) -> None:
    """Stroke (outline) a rounded rectangle by stroking a band around the
    centreline offset on each side. Approximated by carving out the inner
    rect from the outer rect — fast enough at small sizes."""
    half = thickness / 2.0
    # Outer filled.
    outer = bytearray(sw * sh * 4)  # local layer for proper alpha-over
    _rounded_rect(outer, sw, sh, x0 - half, y0 - half, x1 + half, y1 + half, radius + half, color, 255)
    # Inner cleared.
    _rounded_rect(outer, sw, sh, x0 + half, y0 + half, x1 - half, y1 - half, max(0.0, radius - half), (0, 0, 0), 0)

    # Composite outer (the stroke band) onto `rgba`.
    cr, cg, cb = color
    for y in range(sh):
        for x in range(sw):
            si = (y * sw + x) * 4
            if outer[si + 3] == 0:
                continue
            sa = outer[si + 3]
            _blend_rgba(rgba, sw, sh, x, y, cr, cg, cb, sa)


# --------------------------------------------------------------------------
# Brand mark
# --------------------------------------------------------------------------

def render_icon(
    width: int,
    height: int,
    *,
    full_bleed: bool,
) -> bytearray:
    """Return an RGBA pixel buffer.

    `full_bleed=False` → adaptive-icon foreground. Circle is contained
    within the 72/108 safe zone so launcher masks (circle/squircle/teardrop)
    never crop the icon body. Outside the circle is transparent so the
    background drawable (@color/ic_launcher_background) shows through.

    `full_bleed=True` → legacy launcher bitmap (ic_launcher.png /
    ic_launcher_round.png). Circle fills most of the canvas with the
    brand deep purple as the page background, so even launchers that
    don't apply a mask render a sensible icon.
    """
    sw, sh = width * SUPERSAMPLE, height * SUPERSAMPLE
    cx, cy = sw / 2.0, sh / 2.0

    # Circle footprint (in supersampled pixels).
    # - adaptive foreground: max radius = 36 (out of 108 viewport) → 72*2 = 144 super-px
    # - legacy full-bleed:  ~95% of half-canvas so the launcher mask clips
    #   to a smaller circle inside the bitmap but still reads as the mark
    icon_radius = (
        min(sw, sh) * (36.0 / 108.0) if not full_bleed else min(sw, sh) * 0.46
    )

    buf = bytearray(sw * sh * 4)  # alpha=0 (transparent) by default

    # Layer 1 (legacy only): the brand deep purple fills behind the launcher
    # mask so when the launcher applies its own circular shape, the result is
    # a clean disc on deep purple.
    if full_bleed:
        for y in range(sh):
            for x in range(sw):
                i = (y * sw + x) * 4
                buf[i] = BG_DEEP[0]
                buf[i + 1] = BG_DEEP[1]
                buf[i + 2] = BG_DEEP[2]
                buf[i + 3] = 255

    # Layer 2: radial gradient (purple → fuchsia, inner = lighter) THEN the
    # circle-mask. Render per-pixel with over-blending so transparent (outside
    # circle) pixels stay transparent and the gradient smoothly shades the
    # disc.
    inner = GRADIENT_INNER
    outer = GRADIENT_OUTER
    for y in range(sh):
        for x in range(sw):
            dx = x + 0.5 - cx
            dy = y + 0.5 - cy
            d = math.sqrt(dx * dx + dy * dy)
            t = d / icon_radius
            if t >= 1.0:
                continue  # outside the icon — leave as transparent
            # Ease the gradient toward the rim so the disc edge has the
            # lighter colour (more contrast with the deep background).
            t_grad = min(1.0, t * 1.05)
            r, g, b = _lerp_color(inner, outer, t_grad)
            _blend_rgba(buf, sw, sh, x, y, r, g, b, 255)

    # Layer 3: simplified Wallet outline (white). Coordinates are normalised
    # to the icon circle's bounding box so the same shape scales across
    # every density without manual tweaking.
    icon_box_left = cx - icon_radius
    icon_box_top = cy - icon_radius
    icon_w = icon_radius * 2

    # Wallet body (rounded rect, stroked)
    body_w = icon_w * 0.55
    body_h = icon_w * 0.35
    body_x0 = cx - body_w / 2
    body_y0 = cy - body_h / 2 + icon_w * 0.08  # shift slightly down to make
                                              # room for the top flap above
    body_x1 = cx + body_w / 2
    body_y1 = body_y0 + body_h
    stroke = icon_w * 0.075
    body_radius = stroke * 1.2
    _stroke_rounded_rect(
        buf, sw, sh,
        body_x0, body_y0, body_x1, body_y1,
        body_radius, stroke, ICON_WHITE, 255,
    )

    # Top "flap" / card-slot — a thinner, higher rounded rect that represents
    # the protruding wallet fold above the main body.
    flap_h = icon_w * 0.14
    flap_x0 = cx - body_w / 2 + icon_w * 0.03
    flap_y0 = body_y0 - flap_h + stroke * 1.5  # overlap on top
    flap_x1 = cx + body_w / 2 - icon_w * 0.06  # short of right side
    flap_y1 = body_y0 + stroke * 0.5
    _stroke_rounded_rect(
        buf, sw, sh,
        flap_x0, flap_y0, flap_x1, flap_y1,
        body_radius, stroke * 0.7, ICON_WHITE, 255,
    )

    # Right-edge "clasp" — small filled rect that signals the wallet clasp.
    clasp_w = icon_w * 0.10
    clasp_h = icon_w * 0.16
    clasp_x0 = body_x1 - stroke * 0.5
    clasp_y0 = cy - clasp_h / 2 + icon_w * 0.06
    clasp_x1 = clasp_x0 + clasp_w
    clasp_y1 = clasp_y0 + clasp_h
    _rounded_rect(
        buf, sw, sh,
        clasp_x0, clasp_y0, clasp_x1, clasp_y1,
        stroke * 0.4, ICON_WHITE, 255,
    )

    # === downsample by SUPERSAMPLE×SUPERSAMPLE block average ===
    out = bytearray(width * height * 4)
    for oy in range(height):
        for ox in range(width):
            r_acc = g_acc = b_acc = a_acc = 0
            for dy in range(SUPERSAMPLE):
                for dx in range(SUPERSAMPLE):
                    sx = ox * SUPERSAMPLE + dx
                    sy = oy * SUPERSAMPLE + dy
                    si = (sy * sw + sx) * 4
                    r_acc += buf[si]
                    g_acc += buf[si + 1]
                    b_acc += buf[si + 2]
                    a_acc += buf[si + 3]
            count = SUPERSAMPLE * SUPERSAMPLE
            oi = (oy * width + ox) * 4
            out[oi] = r_acc // count
            out[oi + 1] = g_acc // count
            out[oi + 2] = b_acc // count
            out[oi + 3] = a_acc // count
    return out


# --------------------------------------------------------------------------
# Driver
# --------------------------------------------------------------------------

def main() -> int:
    # NOTE: don't `os.chdir` here — that mutates the caller's CWD on
    # import. RES_ROOT is already an absolute path resolved at module
    # load time below the import section.
    res_root = os.path.normpath(RES_ROOT)
    if not os.path.isdir(res_root):
        print(f"ERROR: res/ root not found at {res_root}", file=sys.stderr)
        return 1

    written: List[str] = []
    for name, legacy_px, fg_px in DENSITIES:
        legacy_dir = os.path.join(res_root, f"mipmap-{name}")
        os.makedirs(legacy_dir, exist_ok=True)

        # Legacy ic_launcher.png (RGB, full-bleed brand mark)
        legacy_pixels = render_icon(legacy_px, legacy_px, full_bleed=True)
        legacy_rgb = bytearray(legacy_px * legacy_px * 3)
        for i in range(legacy_px * legacy_px):
            legacy_rgb[i * 3] = legacy_pixels[i * 4]
            legacy_rgb[i * 3 + 1] = legacy_pixels[i * 4 + 1]
            legacy_rgb[i * 3 + 2] = legacy_pixels[i * 4 + 2]
        legacy_path = os.path.join(legacy_dir, "ic_launcher.png")
        write_png_rgb(legacy_path, legacy_px, legacy_px, legacy_rgb)
        written.append(legacy_path)

        # Legacy ic_launcher_round.png — same bitmap as ic_launcher.png.
        # Android 8+ adaptive icons apply the round mask at compose time, so
        # the round PNG is essentially redundant for modern launchers. It
        # exists to satisfy icon selectors that explicitly request
        # `@mipmap/ic_launcher_round` (e.g. some pre-Android-8 launchers and
        # third-party icon pickers). The deep-purple background fill at the
        # canvas edges means the system-applied round mask reveals a clean
        # branded disc, not a blank corner.
        round_path = os.path.join(legacy_dir, "ic_launcher_round.png")
        write_png_rgb(round_path, legacy_px, legacy_px, legacy_rgb)
        written.append(round_path)

        # Adaptive-icon foreground (RGBA, safe-zone-contained)
        fg_pixels = render_icon(fg_px, fg_px, full_bleed=False)
        fg_path = os.path.join(legacy_dir, "ic_launcher_foreground.png")
        write_png_rgba(fg_path, fg_px, fg_px, fg_pixels)
        written.append(fg_path)

    print(f"Wrote {len(written)} PNGs:")
    for p in written:
        size = os.path.getsize(p)
        print(f"  {os.path.relpath(p)}  ({size} bytes)")

    # Quick sanity check: re-read one to ensure the files parse as PNG.
    with open(written[0], "rb") as f:
        head = f.read(8)
    if head != b"\x89PNG\r\n\x1a\n":
        print("ERROR: generated file does not look like a PNG", file=sys.stderr)
        return 2
    print("PNG signature verified ✓")
    return 0


if __name__ == "__main__":
    sys.exit(main())
