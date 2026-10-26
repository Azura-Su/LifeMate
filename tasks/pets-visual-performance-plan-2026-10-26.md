# Pet 3D: visuals, first frame, performance

User asks to continue from the floor-only creation result and make the pet rounder,
cuter and closer in spirit to the supplied chibi art, while remaining interactive
3D. Requested magic actions include fire breath, wind and riding a cloud. Avoid
changing account sync, the one-pet limit, DNA contracts, or unrelated work.

## Stack investigation

Pinned app stack: Expo ~55.0.31, React Native 0.83.10, `expo-gl` 55.0.18,
Three.js 0.186.1 and React Three Fiber 9.8.2. Expo's SDK 55 `GLView` docs describe
its context as the presented contents of that native view and require
`endFrameEXP()` to mark the current frame ready to present. R3F documents its
native entry point as using Expo GL and Expo Asset. Babylon React Native's own
repository says Expo frameworks are not officially supported or tested. The
ReactVision Viro v2.54 documents Expo 54/55 support and animated GLB/skinning;
current releases continue the native engine. It remains a viable comparison
candidate, but would replace the renderer and add native pods/binaries plus a
different scene/input lifecycle. Rive is for vector art and does not replace
the requested rotatable 3D model.

Decision: keep the installed Three/R3F/Expo GL stack while finding the native
root cause. Compare Viro in a minimal proof of concept only if the Expo GL
presentation issue remains after a targeted lifecycle fix; do not port the pet
screen or add its native dependency based on feature lists alone.

## Evidence and uncertainty

- The report was a cold first load, then loading disappears and only the floor
  appears. A minimal direct Expo GL + Three renderer loads the actual V2 GLB/DNA,
  replaces an initial red sphere with the pet and reports valid renderer state,
  but the displayed native surface continues to show the first red-sphere frame.
  This points toward frame presentation/lifecycle, not proven bad pet DNA or skin.
- The earlier CPU skin optimization improves measured CPU pose cost on the
  Simulator; it does not prove that the native view presents subsequent frames.
- Do not interpret an `onAfterRender` callback, valid matrices, or JS callback FPS
  as proof that pixels were presented. Expo GL queues native GPU work.
- A prior read-only audit found the viewport gesture competes with its parent
  ScrollView; test capture/termination handling independently so vertical scroll
  remains usable.
- Direct Expo GL + Three renders the correct pet into `takeSnapshotAsync`'s
  framebuffer on iOS 18.6, while the visible Simulator layer remains on its first
  red-sphere frame. A static red-sphere snapshot precedes it; changing the scene
  to green and hiding every mesh changes the snapshot to solid green but does not
  change the visible layer. This isolates the defect to frame presentation.
- In installed `expo-gl` 55.0.18 `ios/GLView.swift`, `isRenderbufferPresented`
  is read/written by main-thread `drawGL()` and reset from GL-queue
  `blitFramebuffers()` without synchronization. This is a concrete cross-queue
  data race consistent with the stale visible layer. It is a root-cause hypothesis
  until the controlled patch produces a visible changing frame.
- Visual asset V2 has 222 selectable skinned part meshes and is 11,156,332 bytes.
  The current screen uses a tiny subset of those meshes, but GLTFLoader parses the
  bundled kit. Profile asset parse/scene assembly separately from pose and GPU
  presentation before choosing a split/compression strategy.

## Implementation slices

### 0. Restore normal app entry and baseline

- Keep the temporary renderer only while collecting diagnostic evidence; restore
  `package.json` main to `index.ts`, remove `.pet-first-frame-debug.tsx`, and stop
  debug Metro before final app checks.
- Preserve existing edits. Record the currently visible baseline and exact native
  simulator/device/runtime used.

### 1. Fix first-frame presentation before art changes

- Trace `GLView` attach/layout/detach, render loop scheduling, and Expo GL
  `endFrameEXP` lifecycle on a cold actual-app route. Compare iOS 26.3 with iOS 18.6
  if the installed app binary supports both; check Android when available.
- First patch experiment: marshal the `isRenderbufferPresented = false` update
  after each GL-thread blit onto `DispatchQueue.main`, where `drawGL()` reads and
  sets it. Keep the patch guarded to the exact installed Expo GL source version;
  fail prebuild if its expected source context changes. Keep only if the same
  red-frame regression becomes GREEN on both runtimes and no repeated presents
  or lifecycle regressions appear. If not, revert the experiment and continue the
  native trace.
- Use a deterministic diagnostic with a visibly changing color/shape and a real
  pet replacement. A fix is accepted only if changing frames reach the native
  surface on 3 consecutive cold mounts, after 3 rerolls, and after 3
  background/foreground cycles on each available iOS runtime. Record the exact
  platform/runtime. Do not substitute JS callback counts for displayed pixels.
- Keep the loading indicator until the first usable pet frame is actually visible;
  report/retry failures. If the UI framework exposes no presentation acknowledgement,
  use a bounded renderer lifecycle signal plus a failure timeout and verify on screen.
- Add a regression for the faulty lifecycle boundary. Separate renderer correctness
  from parent ScrollView horizontal swipe arbitration; prove vertical scroll still
  works.

### 2. Measure and bound runtime work

- Profile actual cold load/GLB parse, `createPetScene`, first visible frame, idle,
  effects and drag on the same simulator and on a physical iPhone if available.
  Targets after recording baseline: first usable frame <=3s on an installed
  asset, loading remains visible and offers retry by 10s, warm rendered frame
  p95 <=33ms, and horizontal drag's visual updates do not block vertical scroll.
  Report simulator and physical-device results separately.
- Compare reducing parsed asset data (e.g. per-species bundles or a smaller
  catalog-driven pack) against compression/decode cost. Keep only a measured win;
  preserve deterministic regeneration of old DNA and offline assets.
- Avoid new renderer dependencies, dense fur, per-frame allocations, excessive
  transparent overdraw, or always-running scenes while the pet page is inactive.
- Define acceptance from a measured baseline: no blank first frame, responsive
  drag, no sustained JS work while inactive, asset-load latency/memory improve or
  do not regress, and motion/effect cadence stays visibly smooth on the target phone.

### 3. Improve the 3D chibi look

- Inspect rendered views from front/side/back and the supplied references. Preserve
  the soft warm palette; improve silhouette (larger rounded head, compact belly,
  expressive eyes), species-specific ears/muzzle/tail, cheek/chest/forehead tufts,
  and subtle markings. Keep each chosen part's species provenance and DNA seed
  deterministic; do not mutate already-stored pet DNA.
- Use restrained lighting/materials and a simple soft ground shadow/background;
  avoid expensive real-time fur, excess lights, and texture-heavy art.
- Add readable, low-cost action sequences: fire breath at the mouth with warm
  sparks; wind swirl/leaf spiral; cloud-riding with a lightweight animated cloud
  prop and a buoyant pose. Keep cloud-riding as a transient view action selected
  deterministically from the existing interaction clip/seed; do not add an
  unversioned effect/clip to persisted DNA or Firestore rules. Use the existing
  “Chơi cùng” interaction and cancel/reset the prop on action end/unmount.
- Keep Reduced Motion and reduced-performance fallback behavior intact.

### 4. Verification and review

- Write a failing regression for every confirmed defect before its fix.
- Run actual GLB rig/animation/effect checks, targeted screen/gesture tests,
  typecheck, affected lint, iOS and Android bundle/export. Compare same-device
  before/after load and frame measurements; cold launch the actual app route.
- Independent review of plan before implementation, then final diff review because
  native rendering, animation and bundled asset lifecycle are cross-cutting.
- No backend/rules/deploy changes. Remove diagnostic code and report physical
  device/runtime checks that could not be performed.

## Acceptance

- The created pet appears on the first cold view, and reroll/background recovery
  do not leave a stale frame or a floor-only scene.
- Pet is recognizably cute 3D with a rounded plush silhouette, clear chosen-species
  traits, stable seed reconstruction, and the named fire/wind/cloud interactions.
- Drag is smooth and vertical scrolling remains available.
- Loading/performance is measured on the actual runtime; don't claim device FPS
  from JavaScript loop counts.
- No unrelated edits, no new renderer package without evidence, and no change to
  account sync/single-pet/delete semantics.

## Official sources consulted

- Expo SDK 55 GLView: https://docs.expo.dev/versions/v55.0.0/sdk/gl-view/
- React Three Fiber native installation: https://r3f.docs.pmnd.rs/getting-started/installation
- React Three Fiber scaling/performance: https://r3f.docs.pmnd.rs/advanced/scaling-performance
- Babylon React Native Expo support notice: https://github.com/BabylonJS/BabylonReactNative
- ReactVision Viro changelog / current Expo support: https://github.com/ReactVision/viro/blob/main/CHANGELOG.md
- Three.js GLTFLoader: https://threejs.org/docs/pages/GLTFLoader.html
- Expo GL iOS/New Architecture gesture flattening reproduction; maintainer points
  to `collapsable={false}` as workaround: https://github.com/expo/expo/issues/37725
