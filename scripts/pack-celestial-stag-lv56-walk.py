#!/usr/bin/env python3
"""Align lv5–6 stag poses and build atlas, contact sheet, and GIF previews."""

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
PREVIEWS = ROOT / "tasks/previews"
CELL = 320
CHARACTER_HEIGHT = 192
HOOF_LINE = 288
BODY_CENTER_RATIO = 0.43
# These run beats have all four hooves clear of the ground; keep the canvas
# ground line fixed while lifting the whole pose so the leap reads clearly.
RUN_AIRBORNE_OFFSETS = {3: -14, 4: -22, 7: -14, 8: -22}


def alpha_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    # Ignore nearly invisible generated edge noise, while retaining antialiasing.
    mask = alpha.point(lambda value: 255 if value > 8 else 0)
    bounds = mask.getbbox()
    if bounds is None:
        raise ValueError("Generated pose has no visible pixels")
    return bounds


def align(
    source: Path, vertical_offset: int = 0, character_height: int = CHARACTER_HEIGHT
) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    left, top, right, bottom = alpha_bounds(image)
    crop = image.crop((left, top, right, bottom))
    scale = character_height / crop.height
    size = (round(crop.width * scale), character_height)
    crop = crop.resize(size, Image.Resampling.LANCZOS)

    # The torso sits left of the full silhouette center because of the long tail.
    body_x = round(size[0] * BODY_CENTER_RATIO)
    x = CELL // 2 - body_x
    y = HOOF_LINE - character_height + vertical_offset
    if x < 0 or x + size[0] > CELL:
        raise ValueError(f"Pose exceeds cell width after alignment: {source.name}")
    frame = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    frame.alpha_composite(crop, (x, y))
    return frame


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("kind", choices=("walk", "run", "flight", "sleep"))
    args = parser.parse_args()
    kind = args.kind
    source_dir = ROOT / f"assets/pixelPet/sourceFrames/celestial_stag_lv56/{kind}"
    atlas_out = ROOT / f"assets/pixelPet/animations/celestial_stag_lv56_{kind}_candidate.png"
    contact_out = PREVIEWS / f"celestial-stag-lv56-{kind}-contact.png"
    gif_out = PREVIEWS / f"celestial-stag-lv56-{kind}.gif"
    frame_count = 8 if kind in ("walk", "run") else 16

    PREVIEWS.mkdir(parents=True, exist_ok=True)
    frames = []
    for index in range(1, frame_count + 1):
        source = source_dir / f"{kind}-{index:02d}-source.png"
        if not source.is_file():
            raise FileNotFoundError(source)
        vertical_offset = (
            RUN_AIRBORNE_OFFSETS.get(index, 0) if kind == "run" else 0
        )
        frame = align(source, vertical_offset, 154 if kind == "flight" else CHARACTER_HEIGHT)
        frame.save(source_dir / f"{kind}-{index:02d}-aligned.png", optimize=True)
        frames.append(frame)

    atlas = Image.new("RGBA", (CELL * 4, CELL * 4), (0, 0, 0, 0))
    for index in range(16):
        cell = frames[index % frame_count]
        atlas.alpha_composite(cell, ((index % 4) * CELL, (index // 4) * CELL))
    indexed_atlas = atlas.quantize(
        colors=256,
        method=Image.Quantize.FASTOCTREE,
        dither=Image.Dither.FLOYDSTEINBERG,
    )
    indexed_atlas.save(atlas_out, optimize=True)

    sheet = Image.new("RGBA", (CELL * 4, CELL * 4), (244, 239, 229, 255))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index in range(16):
        x, y = (index % 4) * CELL, (index // 4) * CELL
        sheet.alpha_composite(frames[index % frame_count], (x, y))
        draw.rounded_rectangle((x + 7, y + 7, x + 34, y + 31), radius=5, fill=(255, 255, 255, 220))
        draw.text((x + 13, y + 12), f"{index % 8 + 1}", fill=(65, 51, 42), font=font)
    sheet.convert("RGB").save(contact_out, optimize=True)

    gif_frames = []
    for frame in frames:
        preview = Image.new("RGBA", frame.size, (244, 239, 229, 255))
        preview.alpha_composite(frame)
        gif_frames.append(preview.convert("RGB"))
    if kind in ("walk", "run"):
        duration = 100 if kind == "walk" else [60, 70] * 4
    elif kind == "flight":
        duration = [350] * 4 + [180] * 4 + [825] * 4 + [350] * 4
    else:
        duration = [200] * 12 + [500] * 4
    gif_frames[0].save(
        gif_out,
        save_all=True,
        append_images=gif_frames[1:],
        duration=duration,
        loop=0,
        optimize=True,
    )
    print(f"Wrote {atlas_out.relative_to(ROOT)} ({atlas_out.stat().st_size} bytes)")
    print(f"Wrote {contact_out.relative_to(ROOT)} and {gif_out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
