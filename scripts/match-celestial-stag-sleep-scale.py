#!/usr/bin/env python3
"""Shrink or grow each Celestial Stag sleep pose to its level's walk size.

Usage: match-celestial-stag-sleep-scale.py [lv12 lv34 ...]   (needs Pillow, numpy, opencv)

Most sleep atlases were packed so the lying stag fills its cell, which draws
the curled body 1.2–1.5× larger than the same level's walk loop; the details
screen ("Nghỉ ngơi") and the Home bed then show a different-sized pet. Sizes
are measured with SIFT similarity fits: every pair of sleep poses (log least
squares, anchored on frame 1) and frame 1 against the eight walk poses. Each
pose is then resized about its hoof line and centre by 1 / its measured size.
Re-running is safe: already matched poses measure ~1.0 and are left alone.
"""

import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ANIMATIONS = ROOT / "assets/pixelPet/animations"
LEVELS = ("lv12", "lv34", "lv56", "lv78", "lv910", "lv1112", "lv1314", "lv1516", "lv1718", "lv1920")
CELL = 320
MARGIN = 4
TOLERANCE = 0.04
MIN_INLIERS = 10
SIFT = cv2.SIFT_create(nfeatures=3000)


def cell(atlas: Image.Image, frame: int) -> Image.Image:
    x, y = (frame % 4) * CELL, (frame // 4) * CELL
    return atlas.crop((x, y, x + CELL, y + CELL))


def features(image: Image.Image):
    big = image.resize((CELL * 2, CELL * 2), Image.Resampling.LANCZOS)
    rgba = np.asarray(big).astype(float)
    alpha = rgba[..., 3:4] / 255
    flat = cv2.cvtColor((rgba[..., :3] * alpha + 255 * (1 - alpha)).astype(np.uint8), cv2.COLOR_RGB2GRAY)
    return SIFT.detectAndCompute(flat, (rgba[..., 3] > 40).astype(np.uint8) * 255)


def similarity(a, b) -> tuple[float | None, int]:
    (points_a, desc_a), (points_b, desc_b) = a, b
    if desc_a is None or desc_b is None:
        return None, 0
    pairs = cv2.BFMatcher().knnMatch(desc_a, desc_b, k=2)
    good = [m for m, n in (p for p in pairs if len(p) == 2) if m.distance < 0.75 * n.distance]
    if len(good) < MIN_INLIERS:
        return None, 0
    src = np.float32([points_a[m.queryIdx].pt for m in good])
    dst = np.float32([points_b[m.trainIdx].pt for m in good])
    fit, inliers = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=5)
    if fit is None or int(inliers.sum()) < MIN_INLIERS:
        return None, 0
    return float(np.hypot(fit[0, 0], fit[1, 0])), int(inliers.sum())


def chain(poses) -> np.ndarray:
    """Size of each pose relative to the first, weighted by inlier count."""
    rows, logs = [], []
    for i in range(len(poses)):
        for j in range(i + 1, len(poses)):
            ratio, inliers = similarity(poses[i], poses[j])
            if ratio is not None and 0.6 < ratio < 1.7:
                row = np.zeros(len(poses))
                row[j], row[i] = 1, -1
                weight = np.sqrt(inliers)
                rows.append(row * weight)
                logs.append(np.log(ratio) * weight)
    anchor = np.zeros(len(poses))
    anchor[0] = 100
    rows.append(anchor)
    logs.append(0.0)
    return np.exp(np.linalg.lstsq(np.array(rows), np.array(logs), rcond=None)[0])


def resize_pose(pose: Image.Image, factor: float) -> Image.Image:
    left, top, right, bottom = pose.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    subject = pose.crop((left, top, right, bottom))
    size = (round(subject.width * factor), round(subject.height * factor))
    subject = subject.resize(size, Image.Resampling.LANCZOS)
    x = min(CELL - MARGIN - size[0], max(MARGIN, round((left + right) / 2 - size[0] / 2)))
    y = bottom - size[1]
    if y < MARGIN or x < MARGIN:
        raise ValueError("resized pose no longer fits its cell")
    out = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    out.alpha_composite(subject, (x, y))
    return out


def main(levels: list[str]) -> None:
    for level in levels:
        walk = Image.open(ANIMATIONS / f"celestial_stag_{level}_walk.png").convert("RGBA")
        path = ANIMATIONS / f"celestial_stag_{level}_sleep.png"
        sleep = Image.open(path).convert("RGBA")
        poses = [features(cell(sleep, frame)) for frame in range(16)]
        walk_poses = [features(cell(walk, frame)) for frame in range(8)]
        to_walk = [similarity(w, poses[0]) for w in walk_poses]
        best = sorted(((n, s) for s, n in to_walk if s is not None), reverse=True)[:4]
        if not best:
            raise RuntimeError(f"{level}: sleep frame 1 does not match the walk loop")
        sizes = float(np.median([s for _, s in best])) * chain(poses)
        changed = 0
        for frame, size in enumerate(sizes):
            if abs(size - 1) > TOLERANCE:
                sleep.paste(resize_pose(cell(sleep, frame), 1 / size), ((frame % 4) * CELL, (frame // 4) * CELL))
                changed += 1
        if changed:
            sleep.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG).save(
                path, optimize=True
            )
        print(f"{path.name}: sizes vs walk " + " ".join(f"{s:.2f}" for s in sizes) + f"; {changed} poses resized")


if __name__ == "__main__":
    main(sys.argv[1:] or list(LEVELS))
