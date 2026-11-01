# Lv7–8 Celestial Stag Home motion — review result

## Art and packing

- The approved side-facing standing frame is saved as `assets/pixelPet/sourceFrames/celestial_stag_lv78/frame-00-standing-review.png`.
- Walk: 8 individually generated poses, repeated across the 4×4 sheet. Contact sheet: `tasks/previews/celestial-stag-lv78-walk-contact.png`; loop GIF: 800 ms.
- Run: 8 individually generated gallop poses, repeated across the sheet. Contact sheet: `tasks/previews/celestial-stag-lv78-run-contact.png`; loop GIF: 480 ms (rounded to 10 ms GIF units, about 0.5 s).
- Flight: 16 full-body poses. Frames 1–4 takeoff, 5–8 flap, 9–12 glide, and 13–16 landing. Contact sheet: `tasks/previews/celestial-stag-lv78-flight-contact.png`; preview GIF timings are 1.4 s takeoff, 0.72 s flap, 3.3 s glide, and 1.4 s landing.
- Sleep: 16 full-body poses, with the first 12 lowering into rest and the last 4 forming a subtle breathing loop. The first contact-sheet review found generated standing poses in the sleep sequence; those images were rejected and replaced with lying poses. Contact sheet: `tasks/previews/celestial-stag-lv78-sleep-contact.png`; preview plays the settle frames for 2.4 s and breathing frames for 2 s.
- All atlases are 1280×1280, use 320px cells, transparent backgrounds, and are under 700KB. The packer aligns all frames to a shared scale and hoof line and centers using the torso estimate.

## App review

- Lv7 and Lv8 select their own walk, run, flight, and sleep atlases by level, independent of stage; both use the same display scale.
- A full Home cycle was viewed in the iPhone 16 Pro simulator for Lv6, Lv7, Lv8, and Lv9. Lv7/8 completed the flight sequence, walked into the garden, and slept. Lv6 and Lv9 completed their existing paths without selecting the Lv7–8 atlases. The preview uses local admin controls and did not change pet data.
- The simulator app was rebuilt from the current workspace with `xcodebuild`, installed and launched with `simctl`. `expo run:ios` itself could not locate a standalone Simulator app, so the direct Xcode/simctl path was used.

## Verification

- `npm run typecheck` — passed.
- Targeted ESLint on the changed TypeScript files — passed.
- Requested Jest paths — 3 suites, 99 tests passed.
- `git diff --check` — passed.

The contact sheets and GIFs are the visual review artifacts. No source images were sent to or published for anyone else.
