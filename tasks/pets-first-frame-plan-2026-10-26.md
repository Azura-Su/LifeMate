# Pet floor-only first frame —26/10/2026

User screenshot: after create(cat+dog), loading stops, pet absent, floor shadow
visible. Fix this separately from the CPU skin performance improvement; preserve
art, DNA/persistence, inputs and other pending changes. Main owns implementation.

## Evidence and diagnostic work

QA `/private/tmp/lifemate-pet-first-frame-20261026` backs up production baseline
PetViewport and optimized petScene. Temporary `.pet-first-frame-debug.tsx` entry
reproduces with exact catdog seed b76628eea0e6b0c8b00fb192d477aefe, real PetStage,
GLB, renderer; no cloud/save/delete/user data. Restore package main index.ts and
remove harness before final checks. Final verification must use actual app route.

- Baseline cold opening reproduces floor-only. HMR or reroll often shows model;
  neither is accepted as validation of first load. Context remains alive:
  getError0, viewport1200×1050 after120 frames.6 selected surfaces, finite bounds,
  Three onAfterRender called. Captured outgoing GPU projection/modelView/color/
  opacity values are valid. getUniform/getFramebufferBinding are unavailable in
  ExpoGL; removed those probes after they raised errors in diagnostic-only code.
- Docs source review: ExpoGL queues GPU commands asynchronously. JS draw callback
  is not a GPU completion signal. No specific framework bug established.
- Independent own-app audit: no confirmed transform/mixer/visibility error.
  Cleanup/Suspense disposal remains a diagnostic hypothesis, not a finding.
- Experiments tried and not retained: preloading before Canvas, explicit default
  framebuffer bind each frame, disable depth/cull, force transparent surfaces,
  simpler shader, replacement primitive geometry, keep native wrappers from
  collapsing. No reliable cold-load fix from those. renderer.resetState raises
  native width error; discarded. Readback after present is transparent but is
  not treated as proof of pre-present draw contents. MSAA experiment in progress.

## Completion gates

1. Isolate root cause with baseline→fix cold open A/B, not HMR-only evidence.
2. Add regression at the actual faulty lifecycle/render boundary; observe RED
   before fix and GREEN afterward. Loading must reflect usable renderer; surface
   failures offer retry rather than silently leaving floor-only view.
3. Verify several first opens and rerolls via actual app route, active/background
   lifecycle, no user pet mutations; retain the CPU performance improvement.
4. Independent final reviewer for nontrivial render/lifecycle changes. Run actual
   GLB skin/effect tests, targeted Jest, typecheck/lint and iOS+Android export.
   No rules/backend deploy unless task scope changes. Remove all diagnostics and
   record evidence accurately, including unavailable physical-device checks.
