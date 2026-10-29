"""Close the corrected gait loops and share exact poses at motion boundaries."""

from pathlib import Path

from PIL import Image


CELL = 320
ROOT = Path("assets/pixelPet/animations")


def frame(atlas: Image.Image, index: int) -> Image.Image:
    row, column = divmod(index, 4)
    return atlas.crop((column * CELL, row * CELL, (column + 1) * CELL, (row + 1) * CELL))


def replace(atlas: Image.Image, index: int, pose: Image.Image) -> None:
    row, column = divmod(index, 4)
    atlas.paste(pose, (column * CELL, row * CELL))


def main() -> None:
    atlases = {
        name: Image.open(ROOT / f"celestial_stag_{name}_v2.png").convert("RGBA")
        for name in ("ground", "takeoff", "flight", "landing")
    }
    if any(atlas.size != (CELL * 4, CELL * 4) for atlas in atlases.values()):
        raise RuntimeError("All corrected motion atlases must have 16 square cells")
    ground, takeoff, flight, landing = (atlases[name] for name in atlases)
    replace(ground, 15, frame(ground, 0))
    replace(flight, 15, frame(flight, 3))
    replace(takeoff, 0, frame(ground, 0))
    replace(takeoff, 15, frame(flight, 3))
    replace(landing, 0, frame(flight, 7))
    replace(landing, 15, frame(ground, 0))
    for name, atlas in atlases.items():
        path = ROOT / f"celestial_stag_{name}_v2.png"
        atlas.save(path, optimize=True)
        print(f"saved {path}")


if __name__ == "__main__":
    main()
