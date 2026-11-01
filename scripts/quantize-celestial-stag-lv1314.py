#!/usr/bin/env python3
"""Quantize a Lv13–14 Stag atlas to 256 colors with Floyd–Steinberg dithering."""

from __future__ import annotations

import struct
import sys
import zlib
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ATLAS = ROOT / "assets/pixelPet/animations/celestial_stag_lv1314_walk.png"
MAX_COLORS = 256


def read_rgba_png(path: Path) -> tuple[int, int, bytes]:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"Not a PNG: {path}")
    offset = 8
    chunks: list[bytes] = []
    width = height = bit_depth = color_type = None
    while offset < len(data):
        length = struct.unpack_from(">I", data, offset)[0]
        kind = data[offset + 4 : offset + 8]
        chunk = data[offset + 8 : offset + 8 + length]
        offset += length + 12
        if kind == b"IHDR":
            width, height, bit_depth, color_type, _, _, _ = struct.unpack(
                ">IIBBBBB", chunk
            )
        elif kind == b"IDAT":
            chunks.append(chunk)
        elif kind == b"IEND":
            break
    if bit_depth != 8 or color_type != 6:
        raise ValueError("Expected an 8-bit RGBA atlas")
    packed = zlib.decompress(b"".join(chunks))
    stride = width * 4
    rows: list[bytearray] = []
    prev = bytearray(stride)
    cursor = 0
    for _ in range(height):
        filter_type = packed[cursor]
        cursor += 1
        row = bytearray(packed[cursor : cursor + stride])
        cursor += stride
        for i in range(stride):
            left = row[i - 4] if i >= 4 else 0
            up = prev[i]
            upper_left = prev[i - 4] if i >= 4 else 0
            if filter_type == 1:
                row[i] = (row[i] + left) & 255
            elif filter_type == 2:
                row[i] = (row[i] + up) & 255
            elif filter_type == 3:
                row[i] = (row[i] + ((left + up) >> 1)) & 255
            elif filter_type == 4:
                p = left + up - upper_left
                pa, pb, pc = abs(p - left), abs(p - up), abs(p - upper_left)
                predictor = left if pa <= pb and pa <= pc else up if pb <= pc else upper_left
                row[i] = (row[i] + predictor) & 255
            elif filter_type != 0:
                raise ValueError(f"Unsupported PNG filter {filter_type}")
        rows.append(row)
        prev = row
    return width, height, b"".join(rows)


def color_palette(rgba: bytes) -> list[tuple[int, int, int]]:
    histogram: dict[int, list[int]] = defaultdict(lambda: [0, 0, 0, 0])
    for i in range(0, len(rgba), 4):
        r, g, b, a = rgba[i : i + 4]
        if a < 4:
            continue
        key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
        item = histogram[key]
        item[0] += 1
        item[1] += r
        item[2] += g
        item[3] += b
    bins = list(histogram)
    boxes = [bins]
    while len(boxes) < MAX_COLORS:
        candidate = max(
            (box for box in boxes if len(box) > 1),
            key=lambda box: max(
                max((key >> 10) for key in box) - min((key >> 10) for key in box),
                max(((key >> 5) & 31) for key in box) - min(((key >> 5) & 31) for key in box),
                max((key & 31) for key in box) - min((key & 31) for key in box),
            ) * sum(histogram[key][0] for key in box),
            default=None,
        )
        if candidate is None:
            break
        ranges = [
            max((key >> 10) for key in candidate) - min((key >> 10) for key in candidate),
            max(((key >> 5) & 31) for key in candidate) - min(((key >> 5) & 31) for key in candidate),
            max((key & 31) for key in candidate) - min((key & 31) for key in candidate),
        ]
        axis = max(range(3), key=ranges.__getitem__)
        candidate.sort(
            key=lambda key: ((key >> 10), ((key >> 5) & 31), (key & 31))[axis]
        )
        midpoint = sum(histogram[key][0] for key in candidate) // 2
        seen = 0
        split = 1
        for index, key in enumerate(candidate[:-1], 1):
            seen += histogram[key][0]
            if seen >= midpoint:
                split = index
                break
        boxes.remove(candidate)
        boxes.extend((candidate[:split], candidate[split:]))
    palette = []
    for box in boxes:
        count = sum(histogram[key][0] for key in box)
        sums = [sum(histogram[key][channel] for key in box) for channel in (1, 2, 3)]
        palette.append(tuple((total + count // 2) // count for total in sums))
    return palette


def nearest_lookup(palette: list[tuple[int, int, int]]) -> list[int]:
    lookup = []
    for r5 in range(32):
        for g5 in range(32):
            for b5 in range(32):
                rgb = (r5 * 8 + 4, g5 * 8 + 4, b5 * 8 + 4)
                lookup.append(
                    min(
                        range(len(palette)),
                        key=lambda idx: sum(
                            (rgb[c] - palette[idx][c]) ** 2 for c in range(3)
                        ),
                    )
                )
    return lookup


def quantize(rgba: bytes, width: int, height: int, palette: list[tuple[int, int, int]]) -> bytes:
    lookup = nearest_lookup(palette)
    output = bytearray(rgba)
    current = [[0.0, 0.0, 0.0] for _ in range(width + 2)]
    following = [[0.0, 0.0, 0.0] for _ in range(width + 2)]
    for y in range(height):
        for x in range(width):
            pos = (y * width + x) * 4
            r, g, b, a = rgba[pos : pos + 4]
            if a < 4:
                output[pos : pos + 4] = b"\0\0\0\0"
                continue
            error = current[x + 1]
            adjusted = [max(0, min(255, round(v + error[c]))) for c, v in enumerate((r, g, b))]
            key = ((adjusted[0] >> 3) << 10) | ((adjusted[1] >> 3) << 5) | (adjusted[2] >> 3)
            color = palette[lookup[key]]
            output[pos : pos + 3] = bytes(color)
            delta = [adjusted[c] - color[c] for c in range(3)]
            for c in range(3):
                current[x + 2][c] += delta[c] * 7 / 16
                following[x][c] += delta[c] * 3 / 16
                following[x + 1][c] += delta[c] * 5 / 16
                following[x + 2][c] += delta[c] / 16
        current, following = following, [[0.0, 0.0, 0.0] for _ in range(width + 2)]
    return bytes(output)


def write_rgba_png(path: Path, width: int, height: int, rgba: bytes) -> None:
    def chunk(kind: bytes, payload: bytes) -> bytes:
        checksum = zlib.crc32(kind + payload) & 0xFFFFFFFF
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", checksum)

    stride = width * 4
    raw = b"".join(b"\0" + rgba[y * stride : (y + 1) * stride] for y in range(height))
    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    encoded = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header)
    encoded += chunk(b"sRGB", b"\0") + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.write_bytes(encoded)


def main() -> None:
    atlas = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_ATLAS
    if not atlas.is_relative_to(ROOT):
        raise ValueError("Atlas path must be inside the project")
    width, height, rgba = read_rgba_png(atlas)
    palette = color_palette(rgba)
    if len(palette) > MAX_COLORS:
        raise AssertionError("Palette exceeds 256 colors")
    processed = quantize(rgba, width, height, palette)
    write_rgba_png(atlas, width, height, processed)
    print(f"Quantized {width}×{height} to {len(palette)} colors with dithering: {atlas.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
