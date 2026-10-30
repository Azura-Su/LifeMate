#!/usr/bin/env python3
"""Remove Gemini's baked checker matte and crop full-body stag poses.

Usage: python scripts/key-celestial-stag-ground-frames.py <pose-0.png> ...
Supply the six reviewed, single-pose Gemini downloads in walk-cycle order.
"""

from collections import Counter, deque
from pathlib import Path
import sys

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "assets/pixelPet/sourceFrames/celestial_stag_ground_v3"
EXPECTED_POSES = 6


def edge_background_mask(rgb: np.ndarray) -> tuple[np.ndarray, list[int]]:
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    luminance = rgb.mean(axis=2)
    neutral = (chroma <= 18) & (luminance >= 85)
    height, width = neutral.shape
    visited = np.zeros_like(neutral)
    queue: deque[tuple[int, int]] = deque()
    for x in range(width):
        for y in (0, height - 1):
            if neutral[y, x] and not visited[y, x]:
                visited[y, x] = True
                queue.append((y, x))
    for y in range(height):
        for x in (0, width - 1):
            if neutral[y, x] and not visited[y, x]:
                visited[y, x] = True
                queue.append((y, x))
    while queue:
        y, x = queue.popleft()
        for next_y, next_x in (
            (y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)
        ):
            if (
                0 <= next_y < height
                and 0 <= next_x < width
                and neutral[next_y, next_x]
                and not visited[next_y, next_x]
            ):
                visited[next_y, next_x] = True
                queue.append((next_y, next_x))

    border = np.concatenate((rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]))
    border_neutral = border[(border.max(axis=1) - border.min(axis=1)) <= 8]
    gray_modes = np.rint(border_neutral.mean(axis=1)).astype(np.uint8)
    counts = Counter(gray_modes.tolist())
    modes: list[int] = []
    for value, _ in counts.most_common():
        if all(abs(value - existing) >= 35 for existing in modes):
            modes.append(value)
        if len(modes) == 2:
            break
    if len(modes) < 2:
        raise ValueError("Could not identify both checkerboard gray tones")
    return visited, modes


def key_pose(source: Path, destination: Path) -> None:
    rgb = np.asarray(Image.open(source).convert("RGB"))
    edge_mask, gray_modes = edge_background_mask(rgb)
    channel_range = rgb.max(axis=2) - rgb.min(axis=2)
    luminance = rgb.mean(axis=2)
    checker = np.zeros(luminance.shape, dtype=bool)
    for tone in gray_modes:
        # Gemini's checker is resampled, so its cell edges vary by several
        # gray levels. Keep the gamut neutral to protect the stag's cream and
        # silver details while removing those antialiased checker pixels.
        checker |= (channel_range <= 18) & (np.abs(luminance - tone) <= 22)
    alpha = np.where(edge_mask | checker, 0, 255).astype(np.uint8)
    keyed = Image.fromarray(np.dstack((rgb, alpha)), "RGBA")
    bounds = keyed.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError(f"No character pixels remain after matte removal: {source}")
    keyed.crop(bounds).save(destination, optimize=True)
    print(f"{source.name}: checker tones {gray_modes}, crop {bounds}")


def main() -> None:
    sources = [Path(path).expanduser() for path in sys.argv[1:]]
    if len(sources) != EXPECTED_POSES:
        raise SystemExit(f"Pass exactly {EXPECTED_POSES} pose images in cycle order")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for index, source in enumerate(sources):
        if not source.is_file():
            raise FileNotFoundError(source)
        key_pose(source, OUTPUT_DIR / f"pose_{index:02d}.png")


if __name__ == "__main__":
    main()
