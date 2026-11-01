#!/usr/bin/env python3
"""Normalize the eight authored Lv 11–12 walk poses and create review previews."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets/pixelPet/sourceFrames/celestial_stag_lv1112/walk"
PREVIEW_DIR = ROOT / "tasks/previews"
CELL = 320
ATLAS_SIZE = CELL * 4
CHARACTER_HEIGHT = 224
HOOF_LINE = 288
FRAME_NAMES = tuple(f"walk-{index:02d}-source.png" for index in range(1, 9))


def visible_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    bounds = alpha.point(lambda value: 255 if value >= 16 else 0).getbbox()
    if bounds is None:
        raise ValueError("Frame has no visible pixels")
    return bounds


def body_center_x(image: Image.Image, bounds: tuple[int, int, int, int]) -> float:
    pixels = image.load()
    left, top, right, bottom = bounds
    y_start = top + round((bottom - top) * 0.48)
    y_end = top + round((bottom - top) * 0.74)
    x_start = left + round((right - left) * 0.18)
    x_end = left + round((right - left) * 0.76)
    weighted_x = total_weight = 0.0

    for y in range(y_start, min(y_end, image.height)):
        for x in range(x_start, min(x_end, image.width)):
            red, green, blue, alpha = pixels[x, y]
            if alpha >= 24 and red > 110 and green > 38 and red > green * 1.22 and blue < 155:
                weight = alpha / 255
                weighted_x += x * weight
                total_weight += weight

    if total_weight == 0:
        return (left + right) / 2
    return weighted_x / total_weight


def hoof_baseline_y(image: Image.Image, bounds: tuple[int, int, int, int]) -> int:
    pixels = image.load()
    left, top, right, bottom = bounds
    y_start = top + round((bottom - top) * 0.72)
    # Blue hoof flames are brighter than the dark hooves; use the hoof pixels
    # themselves so every pose lands on the same y=288 ground line.
    for y in range(bottom - 1, y_start - 1, -1):
        for x in range(left, min(right, round(image.width * 0.84))):
            red, green, blue, alpha = pixels[x, y]
            if alpha >= 80 and red < 78 and green < 78 and blue < 88:
                return y
    return bottom - 1


def normalize(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    bounds = visible_bounds(image)
    left, top, right, bottom = bounds
    body_x = body_center_x(image, bounds)
    ground_y = hoof_baseline_y(image, bounds)
    crop = image.crop(bounds)

    scale = CHARACTER_HEIGHT / crop.height
    if crop.width * scale > CELL - 2 * 22:
        scale = (CELL - 2 * 22) / crop.width
    size = (round(crop.width * scale), round(crop.height * scale))
    sprite = crop.resize(size, Image.Resampling.LANCZOS)

    x = round(CELL / 2 - (body_x - left) * scale)
    y = round(HOOF_LINE - (ground_y - top) * scale)
    x = min(max(22, x), CELL - 22 - sprite.width)
    y = min(max(22, y), CELL - 22 - sprite.height)

    tile = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    tile.alpha_composite(sprite, (x, y))
    return tile


def main() -> None:
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    frames = []

    for name in FRAME_NAMES:
        source = SOURCE_DIR / name
        if not source.is_file():
            raise FileNotFoundError(source)
        tile = normalize(source)
        aligned = source.with_name(source.name.replace("-source", "-aligned"))
        tile.save(aligned, optimize=True)
        frames.append(tile)

    atlas = Image.new("RGBA", (ATLAS_SIZE, ATLAS_SIZE), (0, 0, 0, 0))
    contact = Image.new("RGBA", (ATLAS_SIZE, ATLAS_SIZE), (255, 247, 225, 255))
    cycle = frames + frames
    for index, frame in enumerate(cycle):
        x = (index % 4) * CELL
        y = (index // 4) * CELL
        atlas.alpha_composite(frame, (x, y))
        contact.alpha_composite(frame, (x, y))

    candidate_atlas = PREVIEW_DIR / "celestial-stag-lv1112-walk-atlas-candidate.png"
    contact_sheet = PREVIEW_DIR / "celestial-stag-lv1112-walk-contact.png"
    preview_gif = PREVIEW_DIR / "celestial-stag-lv1112-walk.gif"
    atlas.quantize(
        colors=256,
        method=Image.Quantize.FASTOCTREE,
        dither=Image.Dither.FLOYDSTEINBERG,
    ).save(candidate_atlas, optimize=True)
    contact.convert("RGB").save(contact_sheet, optimize=True)

    gif_frames = []
    for frame in frames:
        preview = Image.new("RGBA", (CELL, CELL), (255, 247, 225, 255))
        preview.alpha_composite(frame)
        gif_frames.append(preview.convert("P", palette=Image.Palette.ADAPTIVE, colors=256))
    gif_frames[0].save(
        preview_gif,
        save_all=True,
        append_images=gif_frames[1:],
        duration=100,
        loop=0,
        optimize=True,
        disposal=2,
    )

    print(f"Wrote {len(frames)} aligned frames at {CELL}x{CELL}")
    for path in (candidate_atlas, contact_sheet, preview_gif):
        print(f"{path.relative_to(ROOT)}: {path.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
