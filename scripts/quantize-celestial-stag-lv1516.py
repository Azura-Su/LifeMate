#!/usr/bin/env python3
"""Apply the shared 256-color RGB dither and a compact 16-step alpha to Lv15–16 atlases."""

from pathlib import Path
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
ATLAS_PATHS = (
    ROOT / "assets/pixelPet/animations/celestial_stag_lv1516_walk.png",
    ROOT / "assets/pixelPet/animations/celestial_stag_lv1516_run.png",
    ROOT / "assets/pixelPet/animations/celestial_stag_lv1516_flight.png",
    ROOT / "assets/pixelPet/animations/celestial_stag_lv1516_sleep.png",
)

spec = importlib.util.spec_from_file_location(
    "shared_quantizer", ROOT / "scripts/quantize-celestial-stag-lv1314.py"
)
if spec is None or spec.loader is None:
    raise RuntimeError("Could not load the shared atlas quantizer")
quantizer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(quantizer)

for atlas in ATLAS_PATHS:
    width, height, rgba = quantizer.read_rgba_png(atlas)
    palette = quantizer.color_palette(rgba)
    processed = bytearray(quantizer.quantize(rgba, width, height, palette))
    for alpha_index in range(3, len(processed), 4):
        alpha = processed[alpha_index]
        processed[alpha_index] = 0 if alpha < 8 else min(255, round(alpha / 17) * 17)
    quantizer.write_rgba_png(atlas, width, height, bytes(processed))
    print(
        f"{atlas.name}: {len(palette)} RGB colors, "
        f"{atlas.stat().st_size:,} bytes"
    )
