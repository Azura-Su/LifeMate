"""Extract and pack growing garden scenes from an image-generated matte sheet."""

from __future__ import annotations

import argparse
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


CELL = 320
INNER = 288
MIN_COMPONENT_AREA = 4_000
FRAME_CENTERS_X = (167, 474, 786, 1100)
FRAME_CENTERS_Y = (328, 600, 820, 1075)


def label_runs(mask: np.ndarray) -> tuple[list[int], list[tuple[int, int, int, int]]]:
    parents: list[int] = []

    def make_node() -> int:
        node = len(parents)
        parents.append(node)
        return node

    def find(node: int) -> int:
        while parents[node] != node:
            parents[node] = parents[parents[node]]
            node = parents[node]
        return node

    def union(left: int, right: int) -> None:
        left, right = find(left), find(right)
        if left != right:
            parents[right] = left

    runs: list[tuple[int, int, int, int]] = []
    previous: list[tuple[int, int, int]] = []
    for y, row in enumerate(mask):
        edges = np.diff(np.r_[False, row, False].astype(np.int8))
        starts = np.flatnonzero(edges == 1)
        ends = np.flatnonzero(edges == -1)
        current: list[tuple[int, int, int]] = []
        previous_index = 0
        for start, end in zip(starts, ends):
            start, end = int(start), int(end)
            node = make_node()
            while previous_index < len(previous) and previous[previous_index][1] < start:
                previous_index += 1
            cursor = previous_index
            while cursor < len(previous) and previous[cursor][0] <= end:
                union(node, previous[cursor][2])
                cursor += 1
            current.append((start, end, node))
            runs.append((y, start, end, node))
        previous = current
    return parents, runs


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Generated garden sheet on a flat matte")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("assets/pixelPet/animations/home_sleep_garden.png"),
    )
    parser.add_argument(
        "--background-distance",
        type=float,
        default=20,
        help="RGB distance at which the matte becomes fully opaque",
    )
    parser.add_argument("--baseline-y", type=int, default=296)
    args = parser.parse_args()

    source = Image.open(args.source).convert("RGB")
    pixels = np.asarray(source, dtype=np.float32)
    matte = np.median(pixels[:80, :80].reshape(-1, 3), axis=0)
    distance = np.sqrt(np.sum((pixels - matte) ** 2, axis=2))
    alpha = np.clip((distance - 8) * (255 / max(1, args.background_distance - 8)), 0, 255)
    mask = alpha >= 64
    parents, runs = label_runs(mask)

    area: dict[int, int] = defaultdict(int)
    bounds: dict[int, list[int]] = {}
    sums: dict[int, list[float]] = {}
    for y, start, end, node in runs:
        root = node
        while parents[root] != root:
            parents[root] = parents[parents[root]]
            root = parents[root]
        count = end - start
        area[root] += count
        if root not in bounds:
            bounds[root] = [start, y, end, y + 1]
            sums[root] = [((start + end - 1) / 2) * count, y * count]
        else:
            box = bounds[root]
            box[0] = min(box[0], start)
            box[1] = min(box[1], y)
            box[2] = max(box[2], end)
            box[3] = max(box[3], y + 1)
            sums[root][0] += ((start + end - 1) / 2) * count
            sums[root][1] += y * count

    components: dict[int, tuple[list[int], float, float]] = {}
    for root, box in bounds.items():
        if area[root] < MIN_COMPONENT_AREA:
            continue
        components[root] = (
            box,
            sums[root][0] / area[root],
            sums[root][1] / area[root],
        )
    if len(components) != 15:
        raise RuntimeError(f"Expected 15 garden frames plus one empty first cell; found {len(components)}")

    source_index_by_root: dict[int, int] = {}
    for root, (_, center_x, center_y) in components.items():
        column = min(range(4), key=lambda index: abs(center_x - FRAME_CENTERS_X[index]))
        row = min(range(4), key=lambda index: abs(center_y - FRAME_CENTERS_Y[index]))
        source_index = row * 4 + column
        if source_index == 0 or source_index in source_index_by_root.values():
            raise RuntimeError(f"Garden frames do not map cleanly to row-major cells: {source_index}")
        source_index_by_root[root] = source_index
    if set(source_index_by_root.values()) != set(range(1, 16)):
        raise RuntimeError("Garden sheet is missing or duplicates one of its 15 growth frames")

    masks = {root: Image.new("L", source.size, 0) for root in components}
    draws = {root: ImageDraw.Draw(mask_image) for root, mask_image in masks.items()}
    for y, start, end, node in runs:
        root = node
        while parents[root] != root:
            parents[root] = parents[parents[root]]
            root = parents[root]
        if root in draws:
            draws[root].line((start, y, end - 1, y), fill=255)

    atlas = Image.new("RGBA", (CELL * 4, CELL * 4), (0, 0, 0, 0))
    largest_dimension = max(
        max(box[2] - box[0], box[3] - box[1])
        for box, _, _ in components.values()
    )
    common_scale = INNER / (largest_dimension + 4)
    rgba_source = source.convert("RGBA")
    for root, (box, _, _) in components.items():
        index = source_index_by_root[root]
        row, column = divmod(index, 4)
        silhouette = masks[root].filter(ImageFilter.MaxFilter(5))
        isolated = Image.new("RGBA", source.size, (0, 0, 0, 0))
        keyed_alpha = Image.fromarray(alpha.astype(np.uint8), mode="L")
        silhouette_alpha = Image.fromarray(
            np.minimum(np.asarray(silhouette), np.asarray(keyed_alpha)), mode="L"
        )
        isolated.paste(rgba_source, (0, 0))
        isolated.putalpha(silhouette_alpha)
        frame = isolated.crop(silhouette.getbbox())
        size = (round(frame.width * common_scale), round(frame.height * common_scale))
        frame = frame.resize(size, Image.Resampling.LANCZOS)
        x = column * CELL + (CELL - size[0]) // 2
        y = row * CELL + args.baseline_y - size[1]
        atlas.alpha_composite(frame, (x, y))
        print(f"frame {index:02}: source={box}, packed={size}")

    atlas.save(args.output, optimize=True)
    print(f"saved {args.output} ({atlas.width}×{atlas.height})")


if __name__ == "__main__":
    main()
