"""Pack an imagegen 4x4 rest-pose sheet into the runtime 1024px atlas."""

from __future__ import annotations

import argparse
from pathlib import Path
import subprocess
import sys
import tempfile

from PIL import Image


GRID = 4
CELL = 256


def pack(source_path: Path, output_path: Path) -> None:
    source = Image.open(source_path).convert("RGBA")
    if abs(source.width - source.height) > 2:
        raise ValueError(f"Expected a square 4x4 sheet, got {source.size}")
    source_path = source_path.resolve()
    packer = Path(__file__).with_name("pack-celestial-stag-atlas.py").resolve()
    with tempfile.TemporaryDirectory(prefix="pet-rest-atlas-") as temporary:
        intermediate = Path(temporary) / "packed-1280.png"
        subprocess.run(
            [
                sys.executable,
                str(packer),
                str(source_path),
                "--output",
                str(intermediate),
                "--input-columns",
                str(GRID),
                "--input-rows",
                str(GRID),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
        )
        atlas = Image.open(intermediate).convert("RGBA").resize(
            (CELL * GRID, CELL * GRID), Image.Resampling.LANCZOS
        )
    atlas = atlas.quantize(
        colors=256,
        method=Image.Quantize.FASTOCTREE,
        dither=Image.Dither.NONE,
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(output_path, optimize=True)
    print(f"{output_path}: {atlas.width}x{atlas.height}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    pack(args.source, args.output)


if __name__ == "__main__":
    main()
