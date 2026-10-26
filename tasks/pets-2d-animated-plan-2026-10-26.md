# Pet 2D vector renderer with animation

User direction: replace the pet's 3D presentation with cute 2D art and keep the
existing pet creation/collection rules. Animations should include flying, cloud
riding, fire breath and wind. The 12-species genetics, one pet per account,
name, delete, deterministic seed, offline cache, sync, and Firestore authorization
remain unchanged.

## Library review

Installed app stack is Expo ~55.0.31, React Native 0.83.10, React 19.2.0. The
pet renderer currently brings in Three/R3F/Expo GL and an 11,156,332-byte GLB.

| Option                               | Fit                                                                                                                                          | Cost / limitation                                                                                                                        | Decision                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `react-native-svg`                   | SDK 55 officially supports SVG primitives and animation; ideal for assembling seeded head/ears/muzzle/body/feet/tail/wings from vector paths | Adds one native SVG dependency and rebuild; works as bundled vector data                                                                 | Use for the pet illustration and effect shapes                       |
| `react-native-reanimated` + Worklets | SDK 55 documents Reanimated 4.2.1; UI-thread shared-value animations fit idle/fly/cloud/effect transforms                                    | Two native packages and a native rebuild; avoid animating every SVG path independently                                                   | Use for a few outer-group transforms and reusable animation presets  |
| React Native core `Animated`         | No dependency                                                                                                                                | Less convenient for coordinating repeated interaction/effect timelines                                                                   | Not selected after comparing the installed RN/Expo-supported options |
| Rive                                 | Strong artist-authored state machines                                                                                                        | Native runtime and preauthored assets make seed-driven assembly of arbitrary species parts cumbersome; current runtime is moving quickly | Not selected                                                         |
| Lottie                               | Efficient for authored fixed clips                                                                                                           | Fixed compositions are a poor fit for compositing randomized body parts and reacting to DNA                                              | Not selected                                                         |
| React Native Skia                    | Capable custom canvas and effects, SDK 55 support                                                                                            | Extra renderer and more custom drawing work than the vector scene needs                                                                  | Not selected unless SVG is measured to be insufficient               |

Official versioned sources:

- Expo SDK 55 `react-native-svg`: https://docs.expo.dev/versions/v55.0.0/sdk/svg/
- Expo SDK 55 Reanimated: https://docs.expo.dev/versions/v55.0.0/sdk/reanimated/
- Expo SDK 55 Skia: https://docs.expo.dev/versions/v55.0.0/sdk/skia/
- Reanimated compatibility: https://docs.swmansion.com/react-native-reanimated/docs/guides/compatibility/
- Reanimated accessibility/reduced motion: https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility/
- Rive React Native runtime and Expo/native setup: https://github.com/rive-app/rive-react-native
- Lottie React Native version / RN support: https://github.com/lottie-react-native/lottie-react-native

## Implementation slices

1. **Contract and plan gate**
   - Preserve pet DNA schema/wire version, species allowlists and ordering, seeds,
     deterministic hashes, singleton save/delete semantics and rules.
   - Keep existing `hybrid-3d-v1/v2` identifiers readable as historical generator
     IDs for old saved DNA; renderer selection is not a persisted migration.
   - Independent reviewer checks this plan before implementation.

2. **Replace only presentation**
   - Keep `PetStage` as the boundary. Replace its GL/Three viewport with an SVG
     renderer that maps existing DNA slots, variants, palettes, pattern, eyes,
     tail, wings and motion into visible traits.
   - Use soft outlined plush forms, round head/body, expressive glossy eyes,
     cheek/chest tufts, species-specific ear/muzzle/tail/beak/antler details, soft
     palette, restrained freckles/markings and a compact grounding shadow.
   - Create a 2D facing treatment for horizontal gestures while preserving the
     current horizontal-capture/vertical-scroll arbitration.
   - Random variation remains derived from the existing DNA/seed; never use a new
     unseeded random choice at render time. Every visible species-specific part
     must come from a selected species.

3. **Animation and effects**
   - Use Reanimated shared values with `useNativeDriver`-equivalent UI-thread worklets
     for DNA-selected idle `breathe`/`curious`/`sway` clips and interaction groups.
     Let DNA variants tune cadence, respect Reduced Motion, and stop animations
     when the screen is inactive.
   - Map existing interaction clips deterministically: `greet` -> short buoyant
     flight, `bounce` -> ride a small moving cloud, `happy` -> playful hop/spin.
   - Keep existing skill IDs: fire uses a mouth-origin flame puff; wind uses a
     curved swirl; other effects use matching simple low-particle vector motifs.
     No new persisted skill, clip, backend field, or Firestore rule.
   - Animate only a few grouped vector nodes, keep effects bounded in count/duration,
     and avoid per-frame React state updates or continuous work while inactive.

4. **Remove 3D-only runtime**
   - Remove PetViewport's Three/GL/R3F renderer and its CPU skinning utility.
   - Remove GLB assets, `.pet-first-frame-debug.tsx`, `src/types/assets.d.ts`, and
     3D asset builders/benchmarks/tests once no 2D code references them. Remove
     3D-only packages and Metro resolver configuration.
   - Remove the experimental Expo GL patch/config plugin/postinstall hook added in
     this interrupted attempt. Do not hand-edit generated native projects.
   - Retain the 2D species/vector source and licenses/attribution where applicable.

5. **Documents and verification**
   - Update `SPEC-pets.md` to describe 2D presentation and explicitly retain the
     unchanged persistence/genetics/rules contract.
   - Add focused renderer tests for unmount cancellation, swipe-driven facing,
     and returning to the front before a fire cast. Presentation tests cover
     flight/cloud/hop mapping, inactive/Reduced Motion suppression and repeat
     action consumption.
     Run pet UI/genetics/storage/cloud tests and Firestore pet rules; typecheck,
     lint changed files and validate Expo's iOS/Android exports.
   - SVG/Reanimated/Worklets add native modules, so validate Expo config, build both
     native apps where toolchains allow, and smoke-test pet preview/animation. Report
     unavailable platforms; JavaScript exports alone are not enough.
   - Compare package/app asset footprint before/after and measure animation cadence
     on both simulators if available; do not infer smooth device FPS from JS timing.
   - Independent final review checks no 3D runtime/dependency references remain in
     application paths, all species rules hold, and Reduced Motion/inactive cleanup work.

## Acceptance

- Pet screen contains no GL/Three/R3F path and no GLB parsing at runtime.
- The same stored DNA reconstructs the same 2D hybrid; all prior sync, offline,
  singleton, rename, delete and security behaviors still pass their tests.
- Pet is recognizable and polished 2D chibi with visible chosen-species traits.
- Idle, flying, cloud-ride, fire/wind and remaining skill effects animate without
  unnecessary work while inactive and honor Reduced Motion.
- Horizontal pet gesture still works without blocking vertical scrolling.
- Old 3D-only files/dependencies/config are removed; bundle exports/typecheck/tests pass.
