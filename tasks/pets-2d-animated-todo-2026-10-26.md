# Pet 2D animation TODO

- [x] Independent reviewer approves plan and flags data/architecture risks.
- [x] Install Expo SDK 55-compatible SVG and Reanimated/Worklets versions.
- [x] Replace PetStage renderer with deterministic SVG parts driven by existing DNA.
- [x] Add idle, flight, cloud-ride, fire-breath, wind-swirl and matching skill animations.
- [x] Keep Reduced Motion, inactive lifecycle and horizontal/vertical gesture behavior.
- [x] Remove 3D renderer, GLB assets/builders/tests, Three/GL dependencies and native patch code.
- [x] Update SPEC-pets while retaining legacy DNA/wire/rules semantics.
- [x] Run focused renderer/presentation/gesture tests, typecheck/lint, iOS/Android export and native builds.
- [x] Check removed 3D assets/dependencies, bundle footprint and final independent review.
- [ ] Run the full pet data/rules suite; genetics/storage/rules are unchanged and the broader run was stopped after the long diversity suite.
- [ ] Inspect the pet screen and measure animation cadence on a simulator/device; dev-client opened but waits at its server confirmation prompt.
