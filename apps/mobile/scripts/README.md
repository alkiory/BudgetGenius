# Launcher icons

The 15 Android mipmap launcher icons under
`apps/mobile/android/app/src/main/res/mipmap-*/` are generated from
`Logo_budgetgenius.png` (1024×1024 RGBA at the repo root) by
`resize-launcher-icons.py`.

Run `pnpm icons:regenerate` (or `python3 resize-launcher-icons.py`
directly) to refresh them. Optional deps: Pillow will be picked up for
Lanczos resampling; if missing, the script falls back to a stdlib-only
PNG decoder + nearest-neighbor resampler + minimal PNG encoder.
