#!/usr/bin/env python3
"""Quantize completed level 17–18 Stag atlases to 256 colors with dithering."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ANIMATIONS = ROOT / "assets/pixelPet/animations"
ATLASES = ("walk", "run", "flight", "sleep")
MAX_BYTES = 700_000


def quantize(path: Path) -> None:
    image = Image.open(path).convert("RGBA")
    indexed = image.quantize(
        colors=256,
        method=Image.Quantize.FASTOCTREE,
        dither=Image.Dither.FLOYDSTEINBERG,
    )
    indexed.save(path, optimize=True)
    size = path.stat().st_size
    if size > MAX_BYTES:
        raise RuntimeError(f"{path.name} is {size:,} bytes (limit {MAX_BYTES:,})")
    print(f"{path.name}: {size:,} bytes")


def main() -> None:
    for name in ATLASES:
        path = ANIMATIONS / f"celestial_stag_lv1718_{name}.png"
        if path.is_file():
            quantize(path)


if __name__ == "__main__":
    main()
