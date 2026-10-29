"""Pack a 4x4 image-generated sleep-scene sheet into a stable RGBA atlas."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


CELL = 320
INNER = 288
BASELINE = 296


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--matte-low", type=float, default=10)
    parser.add_argument("--matte-high", type=float, default=34)
    parser.add_argument("--row-overlap", type=int, default=32)
    args = parser.parse_args()

    source = Image.open(args.source).convert("RGB")
    pixels = np.asarray(source, dtype=np.float32)
    width, height = source.size
    global_matte = np.median(pixels[: min(40, height), : min(40, width)].reshape(-1, 3), axis=0)
    bounds = []
    for row in range(4):
        for column in range(4):
            bounds.append(
                (
                    round(column * width / 4),
                    round(row * height / 4) + (args.row_overlap if row else 0),
                    round((column + 1) * width / 4),
                    round((row + 1) * height / 4),
                )
            )

    frames: list[tuple[np.ndarray, np.ndarray]] = []
    largest_dimension = 0
    for index, (left, top, right, bottom) in enumerate(bounds):
        frame = pixels[top:bottom, left:right]
        matte = global_matte
        distance = np.sqrt(np.sum(np.square(frame - matte), axis=2))
        alpha = np.clip(
            (distance - args.matte_low)
            * (255 / max(1, args.matte_high - args.matte_low)),
            0,
            255,
        ).astype(np.uint8)
        bounds_mask = alpha >= 128
        ys, xs = np.nonzero(bounds_mask)
        if len(xs) < 100:
            raise RuntimeError(f"Frame {index} has too little scene content")
        box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        largest_dimension = max(largest_dimension, box[2] - box[0], box[3] - box[1])
        frames.append((frame, alpha))
        print(f"frame {index:02}: content={box}")

    scale = INNER / largest_dimension
    atlas = Image.new("RGBA", (CELL * 4, CELL * 4), (0, 0, 0, 0))
    for index, ((left, top, right, bottom), (frame, alpha)) in enumerate(
        zip(bounds, frames)
    ):
        ys, xs = np.nonzero(alpha >= 128)
        box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        crop = frame[box[1] : box[3], box[0] : box[2]]
        crop_alpha = alpha[box[1] : box[3], box[0] : box[2]]
        rgba = Image.fromarray(np.dstack((crop.clip(0, 255).astype(np.uint8), crop_alpha)))
        target_size = (
            max(1, round(rgba.width * scale)),
            max(1, round(rgba.height * scale)),
        )
        rgba = rgba.resize(target_size, Image.Resampling.LANCZOS)
        row, column = divmod(index, 4)
        x = column * CELL + (CELL - rgba.width) // 2
        y = row * CELL + BASELINE - rgba.height
        if x < column * CELL + 8 or x + rgba.width > (column + 1) * CELL - 8:
            raise RuntimeError(f"Frame {index} violates horizontal atlas gutters")
        if y < row * CELL + 8 or y + rgba.height > (row + 1) * CELL - 8:
            raise RuntimeError(f"Frame {index} violates vertical atlas gutters")
        atlas.alpha_composite(rgba, (x, y))
        print(f"packed {index:02}: size={rgba.size}, origin=({x}, {y})")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(args.output, optimize=True)
    print(f"saved {args.output} ({atlas.width}x{atlas.height}, scale={scale:.4f})")


if __name__ == "__main__":
    main()
