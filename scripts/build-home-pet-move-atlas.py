"""Extend one Home movement atlas with four separately authored key poses.

The existing species atlas supplies four original gait poses. Four additional
transparent full-body poses are normalized to the same cell size and hoof
baseline, then interleaved into a 4x4 runtime-compatible atlas. Unused cells are
left transparent; pose images are never duplicated or synthesized by scaling.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


CELL = 256
ATLAS = CELL * 4
GENERATED_ORDER = ("contact", "extension", "landing", "tuck")
GENERATED_BASELINE = {
    "contact": 229,
    "extension": 211,
    "landing": 229,
    "tuck": 211,
}


def crop_transparent_edges(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    mask = alpha.point(lambda value: 255 if value > 8 else 0)
    bounds = mask.getbbox()
    if bounds is None:
        raise ValueError("A generated pose has no visible pixels")
    result = image.crop(bounds)
    result.putalpha(mask.crop(bounds))
    return result


def normalize_pose(image: Image.Image, name: str) -> Image.Image:
    image = crop_transparent_edges(image.convert("RGBA"))
    scale = min(228 / image.width, 205 / image.height)
    image = image.resize(
        (round(image.width * scale), round(image.height * scale)),
        Image.Resampling.LANCZOS,
    )
    tile = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    x = (CELL - image.width) // 2
    y = GENERATED_BASELINE[name] - image.height
    tile.alpha_composite(image, (x, y))
    return tile


def pack(source_path: Path, generated_dir: Path, output_path: Path) -> None:
    source = Image.open(source_path).convert("RGBA")
    if source.size != (ATLAS, ATLAS):
        raise ValueError(f"Expected a 1024x1024 source atlas, got {source.size}")

    atlas = Image.new("RGBA", (ATLAS, ATLAS), (0, 0, 0, 0))
    source_indices = (4, 6, 5, 7)
    for step, (source_index, pose_name) in enumerate(
        zip(source_indices, GENERATED_ORDER)
    ):
        existing_x = (source_index % 4) * CELL
        existing_y = (source_index // 4) * CELL
        existing = source.crop(
            (existing_x, existing_y, existing_x + CELL, existing_y + CELL)
        )
        generated_path = generated_dir / f"move-{pose_name}.png"
        generated = normalize_pose(Image.open(generated_path), pose_name)

        for frame_index, frame in (
            (step * 2, existing),
            (step * 2 + 1, generated),
        ):
            x = (frame_index % 4) * CELL
            y = (frame_index // 4) * CELL
            atlas.alpha_composite(frame, (x, y))
            print(f"frame {frame_index:02}: {frame_index // 4},{frame_index % 4}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    indexed = atlas.quantize(
        colors=256,
        method=Image.Quantize.FASTOCTREE,
        dither=Image.Dither.NONE,
    )
    indexed.save(output_path, optimize=True)
    print(f"saved {output_path} ({ATLAS}x{ATLAS}, 8 poses)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-atlas", type=Path, required=True)
    parser.add_argument("--generated-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    pack(args.source_atlas, args.generated_dir, args.output)


if __name__ == "__main__":
    main()
