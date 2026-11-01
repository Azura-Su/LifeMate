#!/usr/bin/env python3
"""Align and package the authored lv7–8 Celestial Stag motion frames."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/pixelPet/sourceFrames/celestial_stag_lv78"
ANIMATIONS = ROOT / "assets/pixelPet/animations"
PREVIEWS = ROOT / "tasks/previews"
CELL = 320
HOOVES_Y = 288
MAX_HEIGHT = 224
MAX_WIDTH = 288
BODY_CENTER_RATIO = 0.43


def alpha_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    bounds = image.getchannel("A").point(lambda value: 255 if value > 8 else 0).getbbox()
    if bounds is None:
        raise ValueError("Frame contains no visible subject")
    return bounds


def load_sources(kind: str, count: int) -> list[Image.Image]:
    frames = []
    for index in range(1, count + 1):
        path = SOURCE / f"{kind}-{index:02d}.png"
        if not path.is_file():
            raise FileNotFoundError(path)
        frames.append(Image.open(path).convert("RGBA"))
    return frames


def pack(kind: str, poses: list[Image.Image]) -> list[Image.Image]:
    crops = [image.crop(alpha_bounds(image)) for image in poses]
    max_width = max(image.width for image in crops)
    max_height = max(image.height for image in crops)
    scale = min(MAX_HEIGHT / max_height, MAX_WIDTH / max_width)
    aligned = []

    for crop in crops:
        size = (round(crop.width * scale), round(crop.height * scale))
        subject = crop.resize(size, Image.Resampling.LANCZOS)
        desired_x = round(CELL / 2 - size[0] * BODY_CENTER_RATIO)
        x = min(CELL - size[0] - 16, max(16, desired_x))
        y = HOOVES_Y - size[1]
        if x < 0 or x + size[0] > CELL:
            raise ValueError(f"{kind}: frame exceeds cell width")
        cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
        cell.alpha_composite(subject, (x, y))
        aligned.append(cell)
    return aligned


def write_group(kind: str, source_count: int, output_frames: list[Image.Image]) -> None:
    atlas = Image.new("RGBA", (CELL * 4, CELL * 4), (0, 0, 0, 0))
    contact = Image.new("RGBA", (CELL * 4, CELL * 4), (244, 239, 229, 255))
    draw = ImageDraw.Draw(contact)
    font = ImageFont.load_default()

    for index in range(16):
        frame = output_frames[index % source_count]
        xy = ((index % 4) * CELL, (index // 4) * CELL)
        atlas.alpha_composite(frame, xy)
        contact.alpha_composite(frame, xy)
        draw.rounded_rectangle((xy[0] + 7, xy[1] + 7, xy[0] + 38, xy[1] + 32), radius=5, fill=(255, 255, 255, 230))
        draw.text((xy[0] + 15, xy[1] + 11), str(index + 1), fill=(65, 51, 42), font=font)

    output = ANIMATIONS / f"celestial_stag_lv78_{kind}.png"
    indexed = atlas.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
    indexed.save(output, optimize=True)
    if output.stat().st_size > 700_000:
        raise ValueError(f"{output.name} exceeds 700 KB")

    contact_path = PREVIEWS / f"celestial-stag-lv78-{kind}-contact.png"
    contact.convert("RGB").save(contact_path, optimize=True)
    return_path = PREVIEWS / f"celestial-stag-lv78-{kind}.gif"

    if kind == "walk":
        durations = [100] * 8
        gif_frames = output_frames
    elif kind == "run":
        durations = [62] * 8
        gif_frames = output_frames
    elif kind == "flight":
        gif_frames = output_frames
        durations = [350] * 4 + [180] * 4 + [825] * 4 + [350] * 4
    else:
        gif_frames = output_frames
        durations = [200] * 12 + [500] * 4

    preview_frames = []
    for frame in gif_frames:
        preview = Image.new("RGBA", frame.size, (244, 239, 229, 255))
        preview.alpha_composite(frame)
        preview_frames.append(preview.convert("RGB"))
    preview_frames[0].save(
        return_path,
        save_all=True,
        append_images=preview_frames[1:],
        duration=durations,
        loop=0,
        optimize=True,
    )
    print(f"{kind}: {output.stat().st_size} bytes; contact and GIF saved")


def main() -> None:
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    for kind, count in (("walk", 8), ("run", 8), ("flight", 16), ("sleep", 16)):
        aligned = pack(kind, load_sources(kind, count))
        write_group(kind, count, aligned)


if __name__ == "__main__":
    main()
