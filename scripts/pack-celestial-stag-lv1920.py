#!/usr/bin/env python3
"""Package the completed Lv 19–20 pose atlases and review previews."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/pixelPet/sourceFrames/celestial_stag_lv1920"
ANIMATIONS = ROOT / "assets/pixelPet/animations"
PREVIEWS = ROOT / "tasks/previews"
CELL = 320
HOOF_LINE = 288
MAX_HEIGHT = 224
MAX_WIDTH = 288
BODY_CENTER_RATIO = 0.43


def visible_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    bounds = image.getchannel("A").point(lambda value: 255 if value > 8 else 0).getbbox()
    if bounds is None:
        raise ValueError("Frame contains no visible subject")
    return bounds


def load_frames(kind: str) -> list[Image.Image]:
    frames = []
    frame_count = 16 if kind in ("flight", "sleep") else 8
    for index in range(1, frame_count + 1):
        path = SOURCE / f"{kind}-{index:02d}-source.png"
        if not path.is_file():
            raise FileNotFoundError(path)
        frames.append(Image.open(path).convert("RGBA"))
    return frames


def align(frames: list[Image.Image]) -> list[Image.Image]:
    crops = [image.crop(visible_bounds(image)) for image in frames]
    max_width = max(image.width for image in crops)
    max_height = max(image.height for image in crops)
    scale = min(MAX_HEIGHT / max_height, MAX_WIDTH / max_width)
    output = []

    for crop in crops:
        size = (round(crop.width * scale), round(crop.height * scale))
        subject = crop.resize(size, Image.Resampling.LANCZOS)
        x = round(CELL / 2 - size[0] * BODY_CENTER_RATIO)
        x = min(CELL - size[0] - 16, max(16, x))
        y = HOOF_LINE - size[1]
        cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
        cell.alpha_composite(subject, (x, y))
        output.append(cell)
    return output


def write_group(kind: str, frames: list[Image.Image]) -> None:
    atlas = Image.new("RGBA", (CELL * 4, CELL * 4), (0, 0, 0, 0))
    contact = Image.new("RGBA", atlas.size, (244, 239, 229, 255))
    draw = ImageDraw.Draw(contact)
    font = ImageFont.load_default()
    cycle = frames + frames if len(frames) == 8 else frames

    for index, frame in enumerate(cycle):
        xy = ((index % 4) * CELL, (index // 4) * CELL)
        atlas.alpha_composite(frame, xy)
        contact.alpha_composite(frame, xy)
        draw.rounded_rectangle(
            (xy[0] + 7, xy[1] + 7, xy[0] + 38, xy[1] + 32),
            radius=5,
            fill=(255, 255, 255, 230),
        )
        draw.text((xy[0] + 15, xy[1] + 11), str(index + 1), fill=(65, 51, 42), font=font)

    atlas_path = ANIMATIONS / f"celestial_stag_lv1920_{kind}.png"
    atlas.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG).save(atlas_path, optimize=True)
    if atlas_path.stat().st_size > 700_000:
        raise ValueError(f"{atlas_path.name} exceeds 700 KB")

    PREVIEWS.mkdir(parents=True, exist_ok=True)
    contact_path = PREVIEWS / f"celestial-stag-lv1920-{kind}-contact.png"
    contact.convert("RGB").save(contact_path, optimize=True)

    duration = 100 if kind == "walk" else 60
    preview_frames = []
    for frame in frames:
        preview = Image.new("RGBA", frame.size, (244, 239, 229, 255))
        preview.alpha_composite(frame)
        preview_frames.append(preview.convert("P", palette=Image.Palette.ADAPTIVE, colors=256))
    gif_path = PREVIEWS / f"celestial-stag-lv1920-{kind}.gif"
    preview_frames[0].save(
        gif_path,
        save_all=True,
        append_images=preview_frames[1:],
        duration=(
            ([350] * 4 + [180] * 4 + [825] * 4 + [350] * 4)
            if kind == "flight"
            else ([200] * 12 + [500] * 4 if kind == "sleep" else duration)
        ),
        loop=0,
        optimize=True,
        disposal=2,
    )
    print(f"{kind}: {atlas_path.stat().st_size} bytes; contact sheet and GIF saved")


def main() -> None:
    for kind in ("walk", "run", "flight", "sleep"):
        write_group(kind, align(load_frames(kind)))


if __name__ == "__main__":
    main()
