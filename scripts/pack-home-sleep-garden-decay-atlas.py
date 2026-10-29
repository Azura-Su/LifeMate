"""Key and register all withering scenes, retaining detached falling leaves/dust."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


CELL = 320
BASELINE = 296


def separators(mask: np.ndarray, axis: int) -> list[int]:
    length = mask.shape[axis]
    density = mask.sum(axis=1 - axis)
    cuts = [0]
    for index in range(1, 4):
        expected = round(index * length / 4)
        candidates = range(max(1, expected - 48), min(length, expected + 49))
        cut = min(candidates, key=lambda value: (density[value], abs(value - expected)))
        cuts.append(cut)
    return [*cuts, length]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument(
        "--growth",
        type=Path,
        default=Path("assets/pixelPet/animations/home_sleep_garden.png"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("assets/pixelPet/animations/home_sleep_garden_decay.png"),
    )
    args = parser.parse_args()

    source = Image.open(args.source).convert("RGB")
    pixels = np.asarray(source, dtype=np.float32)
    matte = np.median(pixels[:12, :12].reshape(-1, 3), axis=0)
    distance = np.sqrt(np.sum((pixels - matte) ** 2, axis=2))
    alpha = np.clip((distance - 8) * (255 / 12), 0, 255).astype(np.uint8)
    mask = alpha >= 64
    columns = separators(mask, 1)
    rows = separators(mask, 0)
    keyed = source.convert("RGBA")
    keyed.putalpha(Image.fromarray(alpha))
    growth = Image.open(args.growth).convert("RGBA")
    mature = growth.crop((3 * CELL, 3 * CELL, 4 * CELL, 4 * CELL))
    mature_box = mature.getchannel("A").getbbox()
    first_mask = mask[rows[0] : rows[1], columns[0] : columns[1]]
    first_y, first_x = np.where(first_mask)
    scale = min(
        (mature_box[2] - mature_box[0]) / (first_x.max() - first_x.min() + 1),
        (mature_box[3] - mature_box[1]) / (first_y.max() - first_y.min() + 1),
    )
    atlas = Image.new("RGBA", (CELL * 4, CELL * 4))
    for row in range(4):
        row_y, _ = np.where(mask[rows[row] : rows[row + 1]])
        source_baseline = rows[row] + row_y.max() + 1
        for column in range(4):
            index = row * 4 + column
            left, right = columns[column : column + 2]
            top, bottom = rows[row : row + 2]
            y, x = np.where(mask[top:bottom, left:right])
            if not len(x):
                raise RuntimeError(f"Missing decay scene {index}")
            box = (left + x.min(), top + y.min(), left + x.max() + 1, top + y.max() + 1)
            frame = keyed.crop(box)
            size = (round(frame.width * scale), round(frame.height * scale))
            frame = frame.resize(size, Image.Resampling.LANCZOS)
            local_x = round(CELL / 2 - ((left + right) / 2 - box[0]) * scale)
            local_y = round(BASELINE - (source_baseline - box[1]) * scale)
            if not (0 <= local_x <= CELL - size[0] and 0 <= local_y <= CELL - size[1]):
                raise RuntimeError(f"Decay scene {index} extends beyond its cell")
            atlas.alpha_composite(frame, (column * CELL + local_x, row * CELL + local_y))
            print(f"frame {index:02}: {box} -> {size}, anchor=({local_x},{local_y})")
    # The tree must not change shape or position on the first wake-up frame.
    atlas.paste(mature, (0, 0))
    atlas.save(args.output, optimize=True)
    print(f"saved {args.output}; scale={scale:.3f}, cuts={columns}/{rows}")


if __name__ == "__main__":
    main()
