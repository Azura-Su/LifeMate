# Background heat audit — 17/10/2026

## Report and limits
- User runs TestFlight, switches to another app from the camera screen, is not playing MP3, and has not checked whether the camera privacy indicator stays on.
- No online physical iPhone in Instruments device inventory. Temperature, energy use and actual TestFlight CPU/sensor activity were not measured. Simulator/mock results cannot establish the thermal cause.
- Local JS changes from this session have not been released through TestFlight; there is no configured OTA publication. Exact installed TestFlight build source has not been established.

## Evidence
- Earlier MemoryScreen camera caller used navigation focus without app-state gating. Current unshipped caller passes screenActive && !editorVisible. Navigation focus alone remains true when switching to another app.
- Installed Expo Camera iOS CameraView.onAppBackgrounded stops AVCaptureSession; removeFromSuperview additionally stops the session and motion/orientation work. Therefore mounted view alone does not prove a continuously running background sensor.
- Confirmed current hook defect: initial inactive/null was treated as active, while later events required active. Regression started with one mounted mock CameraView under initial inactive; strict initialization reduces this to zero.
- Camera tests exercise inactive initial→active→inactive/background→active and navigation blur/focus. Native-view mock exists only in focused foreground, and readiness must be reported anew after return. Actual MemoryScreen caller is also tested across AppState changes.
- MP3 UI visibility gates record/title animation and live progress in background. Added regression checks animations stop without pausing requested background music. No MP3 playback policy changed.
- Queue uses keepAudioSessionActive:true to retain sessions between background tracks; pause/stop can retain the session. This is a profiling candidate if audio was used earlier, not a proven cause of this camera-only report. No speculative audio change.
- Memory timeline listener is detached in background; already-started sync/transfer may finish. App bootstrap poll callbacks check active state; no unbounded background JS loop identified. Camera/capture and screen image viewer are foreground gated.

## Change
- useScreenActive initializes only when AppState.currentState === active. Inactive, background and unknown initial state no longer enable camera/UI work.
- Added lifecycle regressions; foreground MP3 test explicitly models active state rather than relying on React Native test default null.

## Validation
- Initial red test reproduced camera mounted during inactive; an additional test harness subscription stub was corrected (not a product failure).
- Focused camera/memory/MP3/player checks43 passed before adding the final caller-integration case.
- Final full Jest:98 suites,606 tests passed. Typecheck, affected ESLint and git diff --check passed.
- Independent plan and final review found no actionable issues; reviewer did not execute tests. No native source/dependency/build changes or release made.
