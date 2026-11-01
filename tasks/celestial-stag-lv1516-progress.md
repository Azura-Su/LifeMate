# Thiên Dực Linh Lộc Lv15–16 progress

Updated 2026-11-01.

## Done

- Used the supplied reference and approved side-view standing frame to create all 40 unique poses: 8 walk, 8 run, 16 flight and 16 sleep.
- Rejected the portrait sleep frame 09 and saved a square replacement; the rejected source remains documented for provenance.
- Packed four 4×4 atlases with 320px cells, common ground alignment, preserved source aspect ratios, 256-color RGB dithering and 16-level alpha. All atlas PNGs are under 700KB.
- Wired walk, run, flight, 12-frame settle and four-frame looping sleep to Home motion for levels 15–16. Levels 14 and 17 are excluded from this selector.
- Updated `SPEC-pixel-pet.md` and `assets/pixelPet/animations/provenance.json`.
- Generated contact sheets and GIF previews for all groups under `tasks/previews/` and self-reviewed the sleep contact sheet.

## Verification

- `npm run typecheck` passes.
- The requested Home roamer, sprite and celestial atlas suites pass: 119 tests total.
- ESLint passes on the changed TypeScript files.
- The brief's live “Xem trên Home” visual check could not be performed: iOS Simulator is booted and the app is installed, but the Mac is locked and the computer-use layer could not open Xcode/Simulator for inspection.
