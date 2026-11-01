#!/usr/bin/env python3
"""Match a Celestial Stag atlas track's character scale to its sibling tracks.

Each level's walk/run/flight/sleep poses were generated separately, and some
packers normalized every track to the same bounding box. Poses with a lower or
wider silhouette therefore ended up drawn larger or smaller than the walk loop,
so the stag visibly grew or shrank when Home switched tracks. This rescales the
listed cells about their hoof line and horizontal centre. Enlarged cells are
redrawn from the full-resolution source frame instead of the packed pixels.

Not idempotent: run it once, right after re-running a level's packer.
"""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ANIMATIONS = ROOT / "assets/pixelPet/animations"
SOURCE = ROOT / "assets/pixelPet/sourceFrames"
CELL = 320
MARGIN = 4

# (atlas, slots, factor, source pattern for slot n or None)
ADJUSTMENTS = (
    # Run and hop poses were stretched to the walk's bbox height (~10% larger).
    ("celestial_stag_lv12_run.png", range(16), 0.9, None),
    ("celestial_stag_lv12_hop.png", range(16), 0.9, None),
    # The walk loop is drawn ~12% larger than the run, flight and sleep tracks.
    ("celestial_stag_lv78_walk.png", range(16), 0.88, None),
    # Standing/kneeling settle poses are ~20% smaller than the lying poses.
    (
        "celestial_stag_lv1718_sleep.png",
        range(4),
        1.2,
        "celestial_stag_lv1718/sleep/sleep-{:02d}-source.png",
    ),
)


def visible(image: Image.Image) -> tuple[int, int, int, int]:
    bounds = image.getchannel("A").point(lambda value: 255 if value > 8 else 0).getbbox()
    if bounds is None:
        raise ValueError("cell has no visible pose")
    return bounds


def rescale(atlas: Image.Image, slot: int, factor: float, source: str | None) -> None:
    origin = ((slot % 4) * CELL, (slot // 4) * CELL)
    cell = atlas.crop((*origin, origin[0] + CELL, origin[1] + CELL))
    left, top, right, bottom = visible(cell)
    if source:
        art = Image.open(SOURCE / source.format(slot + 1)).convert("RGBA")
        pose = art.crop(visible(art))
    else:
        pose = cell.crop((left, top, right, bottom))
    size = (round((right - left) * factor), round((bottom - top) * factor))
    pose = pose.resize(size, Image.Resampling.LANCZOS)
    x = round((left + right) / 2 - size[0] / 2)
    x = min(CELL - MARGIN - size[0], max(MARGIN, x))
    y = bottom - size[1]
    if x < MARGIN or y < MARGIN:
        raise ValueError(f"slot {slot} no longer fits its cell at x{factor}")
    redrawn = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    redrawn.alpha_composite(pose, (x, y))
    atlas.paste(redrawn, origin)


def main() -> None:
    for name, slots, factor, source in ADJUSTMENTS:
        path = ANIMATIONS / name
        atlas = Image.open(path).convert("RGBA")
        for slot in slots:
            rescale(atlas, slot, factor, source)
        atlas.quantize(
            colors=256,
            method=Image.Quantize.FASTOCTREE,
            dither=Image.Dither.FLOYDSTEINBERG,
        ).save(path, optimize=True)
        if path.stat().st_size > 700_000:
            raise RuntimeError(f"{name} exceeds 700KB")
        print(f"{name}: x{factor} on {len(slots)} cells, {path.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
