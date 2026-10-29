"""Repack complete Stag poses from a generated sheet into a padded atlas."""

from __future__ import annotations

import argparse
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


OUTPUT = Path("assets/pixelPet/animations/celestial_stag_flight.png")
CELL = 320
INNER = 288
MIN_COMPONENT_AREA = 10_000


def head_anchors(
    source: Image.Image,
    columns: int,
    rows: int,
    box: list[int],
) -> list[tuple[float, float]]:
    """Register complete poses by a small face template, independent of wing extent."""
    thumbs = []
    for row in range(rows):
        for column in range(columns):
            thumbs.append(
                source.crop(
                    (
                        round(column * source.width / columns),
                        round(row * source.height / rows),
                        round((column + 1) * source.width / columns),
                        round((row + 1) * source.height / rows),
                    )
                ).resize((160, 160), Image.Resampling.LANCZOS)
            )
    template_box = tuple(round(value / 2) for value in box)
    template = np.asarray(thumbs[0].crop(template_box), dtype=np.float32) / 255
    template_rgb = template[:, :, :3]
    weights = (template[:, :, 3] >= 0.5).astype(np.float32)[:, :, None]
    height, width = template_rgb.shape[:2]
    anchors = []
    for index, thumb in enumerate(thumbs):
        rgb = np.asarray(thumb, dtype=np.float32)[:, :, :3] / 255
        windows = np.lib.stride_tricks.sliding_window_view(
            rgb, (height, width), axis=(0, 1)
        ).transpose(0, 1, 3, 4, 2)
        # Faces remain in the left half; exclude tail and feather lookalikes.
        search = windows[20:135, :70]
        scores = np.sum((search - template_rgb) ** 2 * weights, axis=(2, 3, 4))
        scores /= max(1, weights.sum() * 3)
        y, x = np.unravel_index(np.argmin(scores), scores.shape)
        y += 20
        row, column = divmod(index, columns)
        anchors.append(
            (
                (column + (x + width / 2) / 160) * source.width / columns,
                (row + (y + height / 2) / 160) * source.height / rows,
            )
        )
    return anchors


def label_runs(mask: np.ndarray) -> tuple[list[int], list[tuple[int, int, int, int]]]:
    """Label 4-connected opaque runs, retaining objects across nominal cell edges."""
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
    parser.add_argument("source", type=Path, help="The raw generated pose sheet")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--columns", type=int, default=4)
    parser.add_argument("--rows", type=int, default=4)
    parser.add_argument("--input-columns", type=int, default=4)
    parser.add_argument("--input-rows", type=int, default=4)
    parser.add_argument(
        "--frame-indices",
        type=lambda value: [int(index) for index in value.split(",")],
        help="Optional comma-separated source-cell indices to pack in this order",
    )
    parser.add_argument("--scale-factor", type=float, default=1.0)
    parser.add_argument("--pixel-scale", type=float, help="Use one explicit pixel scale across related sheets")
    parser.add_argument(
        "--head-box",
        type=lambda value: [int(item) for item in value.split(",")],
        help="Face template rectangle in a normalized 320px first source cell",
    )
    parser.add_argument("--anchor-x", type=int, default=80)
    parser.add_argument("--anchor-y", type=int, default=155)
    parser.add_argument("--end-offset-x", type=int, default=0)
    parser.add_argument("--end-offset-y", type=int, default=0)
    parser.add_argument(
        "--baseline-y",
        type=int,
        help="Optional shared bottom anchor in output-cell pixels",
    )
    args = parser.parse_args()
    if min(args.columns, args.rows, args.input_columns, args.input_rows) < 1:
        parser.error("Grid dimensions must be positive")
    if args.scale_factor <= 0:
        parser.error("--scale-factor must be positive")
    if args.pixel_scale is not None and args.pixel_scale <= 0:
        parser.error("--pixel-scale must be positive")
    if args.head_box and (
        len(args.head_box) != 4
        or not (0 <= args.head_box[0] < args.head_box[2] <= 320)
        or not (0 <= args.head_box[1] < args.head_box[3] <= 320)
    ):
        parser.error("--head-box must be a valid rectangle in the normalized first cell")
    expected_source_poses = args.input_columns * args.input_rows
    selected_indices = args.frame_indices or list(range(expected_source_poses))
    if len(set(selected_indices)) != len(selected_indices) or any(
        index < 0 or index >= expected_source_poses for index in selected_indices
    ):
        parser.error("--frame-indices must contain unique, valid source-cell indices")
    expected_poses = len(selected_indices)
    output_capacity = args.columns * args.rows
    if expected_poses > output_capacity:
        parser.error("The output grid does not have enough cells for the selected poses")
    output_index_by_source = {
        source_index: output_index
        for output_index, source_index in enumerate(selected_indices)
    }

    source = Image.open(args.source).convert("RGBA")
    anchors = (
        head_anchors(source, args.input_columns, args.input_rows, args.head_box)
        if args.head_box
        else None
    )
    pixels = np.asarray(source)
    height, width = pixels.shape[:2]
    parents, runs = label_runs(pixels[:, :, 3] >= 64)

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

    components = {
        root: (box, (sums[root][0] / area[root], sums[root][1] / area[root]))
        for root, box in bounds.items()
        if area[root] >= MIN_COMPONENT_AREA
    }
    if len(components) != expected_source_poses:
        raise RuntimeError(
            f"Expected {expected_source_poses} complete Stag poses; found {len(components)}"
        )

    masks = {root: Image.new("L", source.size, 0) for root in components}
    draws = {root: ImageDraw.Draw(mask) for root, mask in masks.items()}
    for y, start, end, node in runs:
        root = node
        while parents[root] != root:
            parents[root] = parents[parents[root]]
            root = parents[root]
        if root in draws:
            draws[root].line((start, y, end - 1, y), fill=255)

    atlas = Image.new(
        "RGBA", (CELL * args.columns, CELL * args.rows), (0, 0, 0, 0)
    )
    occupied: set[int] = set()
    largest_dimension = max(
        max(box[2] - box[0], box[3] - box[1])
        for box, _ in components.values()
    )
    common_scale = args.pixel_scale or (INNER / (largest_dimension + 4)) * args.scale_factor
    for root, (box, (center_x, center_y)) in components.items():
        source_column = min(
            args.input_columns - 1, int(center_x / (width / args.input_columns))
        )
        source_row = min(
            args.input_rows - 1, int(center_y / (height / args.input_rows))
        )
        source_index = source_row * args.input_columns + source_column
        if source_index not in output_index_by_source:
            continue
        index = output_index_by_source[source_index]
        row, column = divmod(index, args.columns)
        if index in occupied:
            raise RuntimeError(f"Multiple Stag poses assigned to cell {index}")
        occupied.add(index)

        silhouette = masks[root].filter(ImageFilter.MaxFilter(5))
        isolated = Image.new("RGBA", source.size, (0, 0, 0, 0))
        isolated.paste(source, (0, 0), silhouette)
        crop_box = silhouette.getbbox()
        frame = isolated.crop(crop_box)
        size = (round(frame.width * common_scale), round(frame.height * common_scale))
        frame = frame.resize(size, Image.Resampling.LANCZOS)
        end_progress = index / max(1, expected_poses - 1)
        x = (
            column * CELL
            + (CELL - size[0]) // 2
            + round(args.end_offset_x * end_progress)
        )
        y = (
            row * CELL
            + (
                args.baseline_y - size[1]
                if args.baseline_y is not None
                else (CELL - size[1]) // 2
            )
            + round(args.end_offset_y * end_progress)
        )
        if anchors is not None:
            anchor_x, anchor_y = anchors[source_index]
            x = column * CELL + round(args.anchor_x - (anchor_x - crop_box[0]) * common_scale)
            y = row * CELL + round(args.anchor_y - (anchor_y - crop_box[1]) * common_scale)
        if not (
            column * CELL <= x
            and row * CELL <= y
            and x + size[0] <= (column + 1) * CELL
            and y + size[1] <= (row + 1) * CELL
        ):
            raise RuntimeError(
                f"Frame {index} exceeds its cell: local=({x - column * CELL}, {y - row * CELL}), size={size}, head={anchors[source_index] if anchors else None}"
            )
        atlas.alpha_composite(frame, (x, y))
        print(f"frame {index:02}: source={box}, packed={size}, scale={common_scale:.3f}")

    if len(occupied) != expected_poses:
        raise RuntimeError(f"Only packed {len(occupied)} frames")
    atlas.save(args.output, optimize=True)
    print(f"saved {args.output} ({atlas.width}×{atlas.height})")


if __name__ == "__main__":
    main()
