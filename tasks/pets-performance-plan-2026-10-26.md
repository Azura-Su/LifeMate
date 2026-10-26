# Pet3D performance —26/10/2026

User reports lag in latest pet feature. Assumption: keep3D, current art, DNA,
animations/skills, synchronization and singleton behavior. Preserve other edits.

## Baseline

QA folder: `/private/tmp/lifemate-pet-performance-20261026`.
`scripts/benchmark-pet-render.mjs` loads actual V2 GLB and production scene code:
three cases,3 assemblies,100 warmup+600 measured poses each. Node24.12 with CPU
profile: panda4923 vertices median1.28ms/p951.90ms; bear+fox6933 vertices
median1.74ms/p951.88ms; cat+rabbit+owl6381 vertices median1.64ms/p951.84ms.
CPU profile: applyBoneTransform self5.49s dominates; each vertex repeats bone
matrix multiplication/normalized weight decoding even though shipped kit is rigid
(one weight1, remaining0). It also allocates vector spread/morph intermediates.

Actual app, iOS26.3 Simulator, same panda: first8s window20.7FPS, pose median46.3ms,
p9550.0ms, render dispatch median0.50ms; DPR3, buffer1200×1050,7draw calls.
More baseline windows retained in native log. These are development/Simulator
measurements, not physical-device or release performance claims.

## Proposed bounded changes

1. Precompute a CPU skin function per selected private source/surface. Fast path
   only for non-interleaved Float32 xyz positions,0/1 supported position morph,
   and exact rigid weights (one influence1, all others0), valid bone indices.
2. Cache vertex groups by joint and compute bindInverse × boneWorld × boneInverse
   × bind once per group/pose. Apply affine xyz directly to reused output arrays;
   blend the current relative/absolute morph at live influence. No per-vertex
   allocations. Preserve generic getVertexPosition fallback for weighted or
   unsupported layouts. No GPU bone textures, new dependencies, asset/DNA changes.
3. Retain lifecycle/disposal,30Hz pose scheduling and60Hz drag/root rotation.
   Change no animation presets, rendering quality, pixel ratio or input policy
   unless a separate before/after measurement proves another bottleneck.
4. Before production edits add reference comparison tests against Three's actual
   getVertexPosition for all selected vertices, clips, blink states, scaling,
   root rotation and independent instances; explicit weighted/interleaved and
   multi-morph fallback fixtures. Guard fast path with reference call counter
   (shipped asset must not call generic per-vertex skin). RED→GREEN.
5. Run same benchmark/profile and native8s windows; keep only measured wins.
   Re-run real GLB structural/motion/effect checks, targeted Jest, typecheck,
   lint, iOS/Android export; full Jest if integration changes warrant it. No
   backend/rules changes or deploy. Final independent review of math/resource
   behavior; resolve actionable findings and rerun affected gates.
6. Remove temporary diagnostics. Record actual evidence/limits in this plan and
   SPEC-pets; no claim of real-device FPS or token savings.

Main owns implementation/verification. Read-only reviewer checks plan before
changes and final diff afterward; no further delegation or edits by subagents.

## Result

- Plan independently reviewed before code: no blocker; constraints on live eye
  arrays, per-pose bind transforms, normalized weights and absolute-morph fixture
  incorporated. Final code/test review: no actionable finding; reviewer did not
  run tests or independently reproduce performance.
- Production change limited to `src/screens/Pets/petScene.ts`: cached rigid
  groups, live base/morph typed arrays, per-joint matrices and reused output.
  Generic Three skin remains for unsupported layouts. PetViewport restored
  byte-for-byte to pre-instrumentation; no new dependency, art/DNA/wire/rules,
  pixel-ratio or animation-preset change. No backend deploy.
- RED: real GLB guard counted4068 generic per-vertex calls for first old rig.
  GREEN:1017 V1/V2 assemblies, all7 clips, every vertex within1e-5 of actual
  Three getVertexPosition, root rotation/translation/nonuniform scale/blink.
  Separate fixtures pass for absolute morph +nonidentity bind, rigid weight inW,
  normalized blended weights, interleaved body and multiple muzzle morphs.
  Existing bounds/framing/isolation/disposal and all8 effect tests pass.
- A fixture initially assumed muzzle already had a morph; corrected fixture to
  explicitly construct its two targets. Production math unchanged by this test
  correction; no assertions relaxed.
- Same Node24.12 CPU-profile benchmark,1800 samples/case:

| Case           | Vertices | Median before→after | p95 before→after |
| -------------- | -------: | ------------------: | ---------------: |
| Panda          |     4923 |       1.276→0.041ms |    1.895→0.091ms |
| Bear+fox       |     6933 |       1.739→0.053ms |    1.879→0.116ms |
| Cat+rabbit+owl |     6381 |       1.639→0.049ms |    1.840→0.113ms |

- Actual app native log, same panda4923 vertices, median of last3 completed8s
  baseline windows vs last3 optimized windows: **21.86→60.01FPS**,
  pose median **44.59→1.97ms**, pose p95 **46.86→2.19ms**, frame interval p95
  **48.23→16.83ms**. Render dispatch median0.44→0.41ms. DPR3, drawing buffer
  1200×1050,7 calls unchanged; improvement exceeds baseline window variance.
  No real-device/release or token-consumption savings claim.
- Profile/benchmark/validation evidence saved under QA folder above:
  baseline-cpu.json, optimized-cpu.json, Node *.cpuprofile,
  native-before-after.log, native-summary.json, rigid-fast-red.log,
  assets-final.log. Temporary native metrics removed after recording.

Final gates: targeted pet-screen/rotation/picker Jest, typecheck, full lint and
both-platform export results recorded below. No functions/rules tests repeated
because this change touches neither backend nor access/persisted contracts.
Full 500k-seed Jest generation suite was not repeated: no generator/service/UI
behavior changes; real asset/math reference tests exercise the changed path.

Physical iOS/Android performance remains unverified. The earlier intermittent
floor-only cold load and native input delivery limitations are not declared fixed
by an idle-FPS measurement; prior refresh report retains those observations.

Final verification completed:

- `npm run test:pets-assets`:1017 actual GLB assemblies/all7 clips/reference
  equivalence/explicit fallback fixtures/all8 effects passed.
- Targeted Jest:3 suites,8 tests passed (PetsScreen, petRotation, picker).
- `npm run typecheck`, `npm run lint`, `npm run bundle` iOS+Android passed.
- PetViewport matches baseline byte-for-byte after diagnostic removal; no perf
  log wrappers remain. `git diff --check` passed. Other pending edits preserved.
