#!/usr/bin/env python3
"""Segment, normalize and pack the Lv3–4 Celestial Stag motion atlases.

The generated contact sheets do not place poses on an exact 4×4 grid (row 1
hooves cross into row 2, for example), so slicing at fixed cell boundaries cut
neighbouring poses into each frame. Instead, every pose is separated from the
baked checker background as its own connected silhouette, then all four groups
share one scale, hoof line, and horizontal anchor like the other levels.
"""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/pixelPet/sourceFrames/celestial_stag_lv34"
ANIMATIONS = ROOT / "assets/pixelPet/animations"
KINDS = ("walk", "run", "flight", "sleep")
CELL = 320
HOOF_Y = 287
CENTER_X = 160
STANDING_HEIGHT = 224
MARGIN = 6
MIN_PART = 12
ATTACH_DISTANCE = 28
BORDER_BAND = 6
MIN_POCKET = 40


def background_mask(rgb: np.ndarray) -> np.ndarray:
    """Checker pixels reachable from the sheet border (grey/white, low chroma)."""
    lo = rgb.min(axis=2).astype(int)
    hi = rgb.max(axis=2).astype(int)
    avg = rgb.mean(axis=2)
    candidate = (hi - lo < 45) & (avg > 100)
    # The walk sheet draws dark cell dividers; treat them (and their
    # antialiased edges) as background too.
    dark = (avg < 100) & (hi - lo < 30)
    rows = np.convolve(dark.mean(axis=1) > 0.6, np.ones(3), "same") > 0
    cols = np.convolve(dark.mean(axis=0) > 0.6, np.ones(3), "same") > 0
    candidate |= rows[:, None] | cols[None, :]
    height, width = candidate.shape
    # Seed from a band, not just the outer pixel: some sheets carry a 1px frame.
    band = np.zeros_like(candidate)
    band[:BORDER_BAND] = band[-BORDER_BAND:] = True
    band[:, :BORDER_BAND] = band[:, -BORDER_BAND:] = True
    seen = candidate & band
    queue = deque(zip(*np.nonzero(seen)))
    while queue:
        y, x = queue.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < height and 0 <= nx < width and candidate[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                queue.append((ny, nx))
    # Checker trapped between legs/antlers: neutral grey/white pockets that the
    # border fill cannot reach. Sprite highlights are tinted, so stay opaque.
    checker = (hi - lo < 14) & (avg > 215) & ~seen
    for pocket in components(checker):
        if len(pocket) >= MIN_POCKET:
            seen[pocket[:, 0], pocket[:, 1]] = True
    return seen


def components(mask: np.ndarray) -> list[np.ndarray]:
    """8-connected foreground components as arrays of (y, x)."""
    height, width = mask.shape
    labels = np.zeros(mask.shape, dtype=np.int32)
    parts = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if labels[y0, x0]:
            continue
        label = len(parts) + 1
        labels[y0, x0] = label
        queue = deque([(y0, x0)])
        pixels = []
        while queue:
            y, x = queue.popleft()
            pixels.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < height and 0 <= nx < width and mask[ny, nx] and not labels[ny, nx]:
                        labels[ny, nx] = label
                        queue.append((ny, nx))
        parts.append(np.array(pixels))
    return parts


def bbox(pixels: np.ndarray) -> tuple[int, int, int, int]:
    return pixels[:, 1].min(), pixels[:, 0].min(), pixels[:, 1].max(), pixels[:, 0].max()


def box_distance(a, b) -> int:
    dx = max(0, b[0] - a[2], a[0] - b[2])
    dy = max(0, b[1] - a[3], a[1] - b[3])
    return max(dx, dy)


def segment(kind: str) -> list[Image.Image]:
    sheet = Image.open(SOURCE / kind / "contact-sheet-raw.png").convert("RGB")
    rgb = np.asarray(sheet)
    alpha = np.where(background_mask(rgb), 0, 255).astype(np.uint8)
    parts = sorted(components(alpha > 0), key=len, reverse=True)
    poses, extras = parts[:16], [part for part in parts[16:] if len(part) >= MIN_PART]
    # A merged or split pose shows up as a 16th "pose" no bigger than a wisp.
    if len(poses) < 16 or (extras and len(poses[15]) < 10 * len(extras[0])):
        raise ValueError(f"{kind}: expected 16 separate poses")

    boxes = [bbox(pose) for pose in poses]
    attached: list[list[np.ndarray]] = [[] for _ in range(16)]
    for part in extras:
        box = bbox(part)
        nearest = min(range(16), key=lambda index: box_distance(boxes[index], box))
        if box_distance(boxes[nearest], box) <= ATTACH_DISTANCE:
            attached[nearest].append(part)

    # Reading order: four rows by centroid y, then left to right.
    centroids = [pose.mean(axis=0) for pose in poses]
    by_y = sorted(range(16), key=lambda index: centroids[index][0])
    order = [index for row in range(4) for index in sorted(by_y[row * 4:row * 4 + 4], key=lambda i: centroids[i][1])]

    frames = []
    rgba = np.dstack([rgb, alpha])
    for index in order:
        pixels = np.concatenate([poses[index], *attached[index]])
        mask = np.zeros(alpha.shape, dtype=bool)
        mask[pixels[:, 0], pixels[:, 1]] = True
        x0, y0, x1, y1 = bbox(pixels)
        crop = rgba[y0:y1 + 1, x0:x1 + 1].copy()
        crop[..., 3] = np.where(mask[y0:y1 + 1, x0:x1 + 1], 255, 0)
        frames.append(Image.fromarray(crop, "RGBA"))
    return frames


def place(frame: Image.Image, scale: float) -> Image.Image:
    size = (round(frame.width * scale), round(frame.height * scale))
    subject = frame.resize(size, Image.Resampling.LANCZOS)
    weights = np.asarray(subject.getchannel("A"), dtype=float)
    mass_x = (weights.sum(axis=0) * np.arange(size[0])).sum() / weights.sum()
    x = round(CENTER_X - mass_x)
    x = min(CELL - MARGIN - size[0], max(MARGIN, x))
    y = HOOF_Y + 1 - size[1]
    if y < MARGIN or x < MARGIN:
        raise ValueError("pose does not fit inside its cell")
    cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    cell.alpha_composite(subject, (x, y))
    return cell


def main() -> None:
    poses = {kind: segment(kind) for kind in KINDS}
    walk_height = float(np.median([frame.height for frame in poses["walk"]]))
    scale = STANDING_HEIGHT / walk_height
    widest = max(frame.width for frames in poses.values() for frame in frames)
    tallest = max(frame.height for frames in poses.values() for frame in frames)
    scale = min(scale, (CELL - 2 * MARGIN) / widest, (HOOF_Y + 1 - MARGIN) / tallest)

    for kind, frames in poses.items():
        for index, frame in enumerate(frames):
            frame.save(SOURCE / kind / f"frame-{index:02d}.png", optimize=True)
        atlas = Image.new("RGBA", (CELL * 4, CELL * 4), (0, 0, 0, 0))
        for index, frame in enumerate(frames):
            atlas.alpha_composite(place(frame, scale), ((index % 4) * CELL, (index // 4) * CELL))
        output = ANIMATIONS / f"celestial_stag_lv34_{kind}.png"
        atlas.quantize(
            colors=256,
            method=Image.Quantize.FASTOCTREE,
            dither=Image.Dither.FLOYDSTEINBERG,
        ).save(output, optimize=True)
        if output.stat().st_size > 700_000:
            raise RuntimeError(f"{output.name} exceeds 700KB")
        print(f"{output.name}: scale {scale:.3f}, {output.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
