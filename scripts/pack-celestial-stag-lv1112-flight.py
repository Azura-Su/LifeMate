#!/usr/bin/env python3
"""Align and package the 16 individually authored Lv 11–12 flight poses."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets/pixelPet/sourceFrames/celestial_stag_lv1112/flight"
PREVIEW_DIR = ROOT / "tasks/previews"
CELL = 320
ATLAS_SIZE = CELL * 4
SCALE = 0.2  # keeps the approved folded-wing standing height near 70% of a cell
BODY_ANCHOR = (160, 219)
MARGIN = 25
FRAME_NAMES = tuple(f"flight-{index:02d}-source.png" for index in range(1, 17))


def bounds_of(image: Image.Image) -> tuple[int, int, int, int]:
    bounds = image.getchannel("A").point(lambda value: 255 if value >= 16 else 0).getbbox()
    if bounds is None:
        raise ValueError("Frame has no visible pixels")
    return bounds


def body_center(image: Image.Image, bounds: tuple[int, int, int, int]) -> tuple[float, float]:
    pixels = image.load()
    left, top, right, bottom = bounds
    x_min, x_max = left + round((right - left) * 0.2), left + round((right - left) * 0.78)
    y_min, y_max = top + round((bottom - top) * 0.5), top + round((bottom - top) * 0.82)
    weighted_x = weighted_y = weight_sum = 0.0
    for y in range(y_min, min(y_max, image.height)):
        for x in range(x_min, min(x_max, image.width)):
            red, green, blue, alpha = pixels[x, y]
            if alpha >= 32 and red > 110 and green > 38 and red > green * 1.22 and blue < 155:
                weight = alpha / 255
                weighted_x += x * weight
                weighted_y += y * weight
                weight_sum += weight
    if weight_sum == 0:
        raise ValueError("Could not locate the orange body anchor")
    return weighted_x / weight_sum, weighted_y / weight_sum


def prepare(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    left, top, right, bottom = bounds_of(image)
    center_x, center_y = body_center(image, (left, top, right, bottom))
    crop = image.crop((left, top, right, bottom))
    size = (round(crop.width * SCALE), round(crop.height * SCALE))
    sprite = crop.resize(size, Image.Resampling.LANCZOS)
    x = round(BODY_ANCHOR[0] - (center_x - left) * SCALE)
    y = round(BODY_ANCHOR[1] - (center_y - top) * SCALE)

    if x < MARGIN or y < MARGIN or x + size[0] > CELL - MARGIN or y + size[1] > CELL - MARGIN:
        raise ValueError(f"{path.name} exceeds the required {MARGIN}px cell margin after fixed-scale alignment")

    tile = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    tile.alpha_composite(sprite, (x, y))
    return tile


def save_gif(frames: list[Image.Image], path: Path, duration_ms: int) -> None:
    previews = []
    for frame in frames:
        preview = Image.new("RGBA", (CELL, CELL), (255, 247, 225, 255))
        preview.alpha_composite(frame)
        previews.append(preview.convert("P", palette=Image.Palette.ADAPTIVE, colors=256))
    previews[0].save(path, save_all=True, append_images=previews[1:], duration=duration_ms, loop=0, optimize=True, disposal=2)


def main() -> None:
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    frames = []
    for name in FRAME_NAMES:
        source = SOURCE_DIR / name
        if not source.is_file():
            raise FileNotFoundError(source)
        tile = prepare(source)
        tile.save(source.with_name(name.replace("-source", "-aligned")), optimize=True)
        frames.append(tile)

    atlas = Image.new("RGBA", (ATLAS_SIZE, ATLAS_SIZE), (0, 0, 0, 0))
    contact = Image.new("RGBA", (ATLAS_SIZE, ATLAS_SIZE), (255, 247, 225, 255))
    for index, frame in enumerate(frames):
        x, y = index % 4 * CELL, index // 4 * CELL
        atlas.alpha_composite(frame, (x, y))
        contact.alpha_composite(frame, (x, y))

    atlas_path = PREVIEW_DIR / "celestial-stag-lv1112-flight-atlas-candidate.png"
    contact_path = PREVIEW_DIR / "celestial-stag-lv1112-flight-contact.png"
    atlas.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG).save(atlas_path, optimize=True)
    contact.convert("RGB").save(contact_path, optimize=True)

    segments = (("takeoff", 0, 4, 350), ("flap", 4, 8, 180), ("glide", 8, 12, 350), ("landing", 12, 16, 350))
    gif_paths = []
    for name, start, end, duration in segments:
        path = PREVIEW_DIR / f"celestial-stag-lv1112-flight-{name}.gif"
        save_gif(frames[start:end], path, duration)
        gif_paths.append(path)

    for path in (atlas_path, contact_path, *gif_paths):
        print(f"{path.relative_to(ROOT)}: {path.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
