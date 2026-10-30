#!/usr/bin/env python3
"""Pack eight aligned, full-body Celestial Stag walk poses into a 4x4 atlas."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets/pixelPet/sourceFrames/celestial_stag_ground_v3"
OUTPUT = ROOT / "assets/pixelPet/animations/celestial_stag_ground_v3.png"
CELL = 320
# Six Gemini-authored leg poses, with two natural contact holds to fill an
# eight-slot cycle without introducing the separate folded-wing poses.
CYCLE_SOURCE_INDICES = (0, 1, 2, 3, 4, 5, 4, 1)
CHARACTER_HEIGHT = 224
HOOF_LINE = 281


def pack() -> None:
    atlas = Image.new("RGBA", (CELL * 4, CELL * 4), (0, 0, 0, 0))
    for index in range(16):
        source_index = CYCLE_SOURCE_INDICES[index % len(CYCLE_SOURCE_INDICES)]
        source = SOURCE_DIR / f"pose_{source_index:02d}.png"
        if not source.is_file():
            raise FileNotFoundError(f"Missing authored pose: {source}")
        sprite = Image.open(source).convert("RGBA")
        alpha = sprite.getchannel("A")
        bounds = alpha.getbbox()
        if bounds is None:
            raise ValueError(f"Pose has no visible pixels: {source}")
        sprite = sprite.crop(bounds)
        scale = CHARACTER_HEIGHT / sprite.height
        size = (round(sprite.width * scale), CHARACTER_HEIGHT)
        sprite = sprite.resize(size, Image.Resampling.NEAREST)
        x = (CELL - size[0]) // 2
        y = HOOF_LINE - size[1]
        atlas.alpha_composite(sprite, (index % 4 * CELL + x, index // 4 * CELL + y))

    atlas.save(OUTPUT, optimize=True)
    print(f"Wrote {OUTPUT.relative_to(ROOT)} ({atlas.width}x{atlas.height})")


if __name__ == "__main__":
    pack()
