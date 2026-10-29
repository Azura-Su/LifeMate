"""Join the exact glide terminal pose to the generated landing sequence."""

from pathlib import Path

from PIL import Image


CELL = 320
FLIGHT = Path("assets/pixelPet/animations/celestial_stag_flight.png")
LANDING = Path("assets/pixelPet/animations/celestial_stag_landing.png")
OUTPUT = LANDING
GLIDE_FRAME = 7


def main() -> None:
    flight = Image.open(FLIGHT).convert("RGBA")
    landing = Image.open(LANDING).convert("RGBA")
    expected = (CELL * 4, CELL * 4)
    if flight.size != expected:
        raise RuntimeError(f"Expected 4×4 flight atlas {expected}; found {flight.size}")
    if landing.size != (CELL * 4, CELL * 3):
        raise RuntimeError("Expected a 4×3 landing atlas before assembly")

    output = Image.new("RGBA", (CELL * 4, CELL * 3), (0, 0, 0, 0))
    glide_row, glide_column = divmod(GLIDE_FRAME, 4)
    terminal = flight.crop(
        (
            glide_column * CELL,
            glide_row * CELL,
            (glide_column + 1) * CELL,
            (glide_row + 1) * CELL,
        )
    )
    output.alpha_composite(terminal, (0, 0))

    for source_index in range(11):
        row, column = divmod(source_index, 4)
        frame = landing.crop(
            (
                column * CELL,
                row * CELL,
                (column + 1) * CELL,
                (row + 1) * CELL,
            )
        )
        target_index = source_index + 1
        target_row, target_column = divmod(target_index, 4)
        output.alpha_composite(
            frame, (target_column * CELL, target_row * CELL)
        )

    output.save(OUTPUT, optimize=True)
    print(f"saved {OUTPUT} ({output.width}×{output.height}); frame 0 matches flight {GLIDE_FRAME}")


if __name__ == "__main__":
    main()
