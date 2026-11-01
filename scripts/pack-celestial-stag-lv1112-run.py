#!/usr/bin/env python3
"""Normalize Lv 11–12 full-body gallop poses and make candidate previews."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets/pixelPet/sourceFrames/celestial_stag_lv1112/run"
PREVIEW_DIR = ROOT / "tasks/previews"
CELL = 320
ATLAS_SIZE = CELL * 4
CHARACTER_HEIGHT = 224
BODY_WIDTH = 160
HOOF_LINE = 288
FRAME_NAMES = tuple(f"run-{index:02d}-source.png" for index in range(1, 9))


def bounds_of(image: Image.Image) -> tuple[int, int, int, int]:
    bounds = image.getchannel("A").point(lambda value: 255 if value >= 16 else 0).getbbox()
    if bounds is None:
        raise ValueError("Frame has no visible pixels")
    return bounds


def body_center_x(image: Image.Image, bounds: tuple[int, int, int, int]) -> float:
    pixels = image.load()
    left, top, right, bottom = bounds
    x_min, x_max = left + round((right - left) * 0.18), left + round((right - left) * 0.76)
    y_min, y_max = top + round((bottom - top) * 0.48), top + round((bottom - top) * 0.74)
    weighted_x = weight_sum = 0.0
    for y in range(y_min, min(y_max, image.height)):
        for x in range(x_min, min(x_max, image.width)):
            red, green, blue, alpha = pixels[x, y]
            if alpha >= 24 and red > 110 and green > 38 and red > green * 1.22 and blue < 155:
                weight = alpha / 255
                weighted_x += x * weight
                weight_sum += weight
    return weighted_x / weight_sum if weight_sum else (left + right) / 2


def body_width(image: Image.Image, bounds: tuple[int, int, int, int]) -> int:
    pixels = image.load()
    left, top, right, bottom = bounds
    x_min, x_max = left + round((right - left) * 0.1), left + round((right - left) * 0.82)
    y_min, y_max = top + round((bottom - top) * 0.35), top + round((bottom - top) * 0.8)
    orange_x = []
    for y in range(y_min, min(y_max, image.height)):
        for x in range(x_min, min(x_max, image.width)):
            red, green, blue, alpha = pixels[x, y]
            if alpha >= 32 and red > 110 and green > 38 and red > green * 1.22 and blue < 155:
                orange_x.append(x)
    if not orange_x:
        raise ValueError("Could not locate orange body pixels")
    return max(orange_x) - min(orange_x) + 1


def normalize(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    left, top, right, bottom = bounds_of(image)
    body_x = body_center_x(image, (left, top, right, bottom))
    crop = image.crop((left, top, right, bottom))
    # Calibrate on the orange body instead of the whole silhouette: gallop
    # poses vary greatly in height as legs tuck/extend, but body size must not.
    scale = min(BODY_WIDTH / body_width(image, (left, top, right, bottom)), (CELL - 44) / crop.width)
    size = (round(crop.width * scale), round(crop.height * scale))
    sprite = crop.resize(size, Image.Resampling.LANCZOS)
    x = round(CELL / 2 - (body_x - left) * scale)
    y = HOOF_LINE - size[1]
    x = min(max(22, x), CELL - 22 - size[0])
    y = min(max(22, y), CELL - 22 - size[1])
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
        tile.save(source.with_name(name.replace("-source", "-aligned")), optimize=True)
        frames.append(tile)

    atlas = Image.new("RGBA", (ATLAS_SIZE, ATLAS_SIZE), (0, 0, 0, 0))
    contact = Image.new("RGBA", (ATLAS_SIZE, ATLAS_SIZE), (255, 247, 225, 255))
    for index, frame in enumerate(frames + frames):
        x, y = index % 4 * CELL, index // 4 * CELL
        atlas.alpha_composite(frame, (x, y))
        contact.alpha_composite(frame, (x, y))

    outputs = (
        PREVIEW_DIR / "celestial-stag-lv1112-run-atlas-candidate.png",
        PREVIEW_DIR / "celestial-stag-lv1112-run-contact.png",
        PREVIEW_DIR / "celestial-stag-lv1112-run.gif",
    )
    atlas.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG).save(outputs[0], optimize=True)
    contact.convert("RGB").save(outputs[1], optimize=True)
    gif_frames = []
    for frame in frames:
        preview = Image.new("RGBA", (CELL, CELL), (255, 247, 225, 255))
        preview.alpha_composite(frame)
        gif_frames.append(preview.convert("P", palette=Image.Palette.ADAPTIVE, colors=256))
    gif_frames[0].save(outputs[2], save_all=True, append_images=gif_frames[1:], duration=60, loop=0, optimize=True, disposal=2)

    print("Wrote 8 aligned run poses.")
    for path in outputs:
        print(f"{path.relative_to(ROOT)}: {path.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
