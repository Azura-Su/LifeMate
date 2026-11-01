#!/usr/bin/env python3
"""Pack one Celestial Stag level's walk/run/flight/sleep atlases at one size.

Usage: pack-celestial-stag-level.py lv56|lv1112   (needs Pillow, numpy, opencv)

Each source pose was generated to fill its own canvas, so pose bounds say
nothing about character size. Sizes are measured instead:
1. within a group, every pair of poses gets a SIFT similarity fit (RANSAC,
   10+ inliers) and a log least-squares solve gives each pose's relative size;
2. the group is tied to the approved standing frame by the median of the poses
   that match it directly (SIFT, else a confident head template match);
3. GROUP_CALIBRATION corrects groups whose direct match is unreliable (wings
   or closed eyes), set by comparing head sizes against the walk loop. The approved standing pose is 224px tall in a
320px cell; every pose stands on the y=287 hoof line with its alpha centroid at
x=160, quantized to 256 colours.
"""

import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ANIMATIONS = ROOT / "assets/pixelPet/animations"
GROUPS = {"walk": 8, "run": 8, "flight": 16, "sleep": 16}
CELL = 320
HOOF_Y = 287
CENTER_X = 160
STANDING_HEIGHT = 224
# Lv5–6 flight spreads its wings wider than a cell at 224px; the app draws this
# level at a larger look scale so it still matches its neighbours on screen.
LEVEL_STANDING_HEIGHT = {"lv56": 180}
# Lv5–6 flight heads read ~10% larger than the walk loop after measuring.
GROUP_CALIBRATION: dict[tuple[str, str], float] = {("lv56", "flight"): 1.1}
MARGIN = 6
MATCH_SCALE = 0.25
MIN_CONFIDENCE = 0.6
SIFT_SCALE = 0.5
MIN_INLIERS = 10
SIFT = cv2.SIFT_create(nfeatures=4000)


def visible(image: Image.Image) -> Image.Image:
    bounds = image.getchannel("A").point(lambda value: 255 if value > 16 else 0).getbbox()
    if bounds is None:
        raise ValueError("pose has no visible pixels")
    return image.crop(bounds)


def grey(image: Image.Image) -> np.ndarray:
    small = image.resize(
        (max(1, round(image.width * MATCH_SCALE)), max(1, round(image.height * MATCH_SCALE))),
        Image.Resampling.LANCZOS,
    )
    rgba = np.asarray(small).astype(float)
    alpha = rgba[..., 3:4] / 255
    flat = rgba[..., :3] * alpha + 240 * (1 - alpha)
    return cv2.cvtColor(flat.astype(np.uint8), cv2.COLOR_RGB2GRAY)


def head_scale(head: np.ndarray, pose: np.ndarray) -> tuple[float, float]:
    """Size of the character in `pose` relative to the standing reference."""
    best = (-1.0, 1.0)
    for scale in np.arange(0.35, 2.0, 0.01):
        template = cv2.resize(head, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
        if template.shape[0] >= pose.shape[0] or template.shape[1] >= pose.shape[1]:
            continue
        score = float(cv2.matchTemplate(pose, template, cv2.TM_CCOEFF_NORMED).max())
        if score > best[0]:
            best = (score, float(scale))
    return best


def features(image: Image.Image):
    small = image.resize(
        (round(image.width * SIFT_SCALE), round(image.height * SIFT_SCALE)),
        Image.Resampling.LANCZOS,
    )
    rgba = np.asarray(small).astype(float)
    alpha = rgba[..., 3:4] / 255
    flat = cv2.cvtColor((rgba[..., :3] * alpha + 255 * (1 - alpha)).astype(np.uint8), cv2.COLOR_RGB2GRAY)
    return SIFT.detectAndCompute(flat, (rgba[..., 3] > 40).astype(np.uint8) * 255)


def sift_scale(reference, pose) -> float | None:
    (ref_points, ref_desc), (points, desc) = reference, pose
    if ref_desc is None or desc is None or len(desc) < 2:
        return None
    pairs = cv2.BFMatcher(cv2.NORM_L2).knnMatch(ref_desc, desc, k=2)
    good = [a for a, b in (p for p in pairs if len(p) == 2) if a.distance < 0.75 * b.distance]
    if len(good) < MIN_INLIERS:
        return None
    src = np.float32([ref_points[m.queryIdx].pt for m in good])
    dst = np.float32([points[m.trainIdx].pt for m in good])
    fit, inliers = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=4)
    if fit is None or int(inliers.sum()) < MIN_INLIERS:
        return None
    return float(np.hypot(fit[0, 0], fit[1, 0]))


def relative_sizes(pose_features) -> list[float]:
    """Each pose's size relative to the first, from all pairwise SIFT fits."""
    count = len(pose_features)
    rows, logs = [], []
    for i in range(count):
        for j in range(count):
            if i == j:
                continue
            ratio = sift_scale(pose_features[i], pose_features[j])
            if ratio is not None and 0.6 < ratio < 1.6:
                row = np.zeros(count)
                row[j], row[i] = 1, -1
                rows.append(row)
                logs.append(np.log(ratio))
    anchor = np.zeros(count)
    anchor[0] = 1
    rows.append(anchor)
    logs.append(0.0)
    solved = np.linalg.lstsq(np.array(rows), np.array(logs), rcond=None)[0]
    return [float(np.exp(value)) for value in solved]


def place(pose: Image.Image, scale: float) -> Image.Image:
    size = (round(pose.width * scale), round(pose.height * scale))
    fit = min(1.0, (CELL - 2 * MARGIN) / size[0], (HOOF_Y + 1 - MARGIN) / size[1])
    if fit < 1:
        print(f"  shrinking an oversized pose by {fit:.3f} to fit its cell")
        size = (round(size[0] * fit), round(size[1] * fit))
    subject = pose.resize(size, Image.Resampling.LANCZOS)
    weights = np.asarray(subject.getchannel("A"), dtype=float)
    mass_x = (weights.sum(axis=0) * np.arange(size[0])).sum() / weights.sum()
    x = min(CELL - MARGIN - size[0], max(MARGIN, round(CENTER_X - mass_x)))
    cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    cell.alpha_composite(subject, (x, HOOF_Y + 1 - size[1]))
    return cell


def main(level: str) -> None:
    source = ROOT / f"assets/pixelPet/sourceFrames/celestial_stag_{level}"
    reference = visible(Image.open(source / "standing-frame-00-approved.png").convert("RGBA"))
    reference_features = features(reference)
    reference_grey = grey(reference)
    height, width = reference_grey.shape
    head = reference_grey[: int(height * 0.42), : int(width * 0.42)]
    base = LEVEL_STANDING_HEIGHT.get(level, STANDING_HEIGHT) / reference.height

    for group, count in GROUPS.items():
        poses = [
            visible(Image.open(source / group / f"{group}-{index:02d}-source.png").convert("RGBA"))
            for index in range(1, count + 1)
        ]
        pose_features = [features(pose) for pose in poses]
        within = relative_sizes(pose_features)
        direct = []
        for index, pose in enumerate(poses):
            measured = sift_scale(reference_features, pose_features[index])
            if measured is None:
                score, head_match = head_scale(head, grey(pose))
                measured = head_match if score >= MIN_CONFIDENCE else None
            if measured is not None:
                direct.append(measured / within[index])
        if not direct:
            raise RuntimeError(f"{level} {group}: no pose matches the standing frame")
        anchor = float(np.median(direct)) * GROUP_CALIBRATION.get((level, group), 1.0)
        relative = [anchor * value for value in within]
        known = direct
        atlas = Image.new("RGBA", (CELL * 4, CELL * 4), (0, 0, 0, 0))
        for slot in range(16):
            atlas.alpha_composite(
                place(poses[slot % count], base / relative[slot % count]),
                ((slot % 4) * CELL, (slot // 4) * CELL),
            )
        output = ANIMATIONS / f"celestial_stag_{level}_{group}.png"
        atlas.quantize(
            colors=256,
            method=Image.Quantize.FASTOCTREE,
            dither=Image.Dither.FLOYDSTEINBERG,
        ).save(output, optimize=True)
        if output.stat().st_size > 700_000:
            raise RuntimeError(f"{output.name} exceeds 700KB")
        print(
            f"{output.name}: {len(known)}/{count} direct matches, size vs standing "
            + " ".join(f"{value:.2f}" for value in relative)
            + f", {output.stat().st_size:,} bytes"
        )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
