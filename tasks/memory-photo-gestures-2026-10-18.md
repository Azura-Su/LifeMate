# Timeline photo gestures — 2026-10-18

## Result

- Central fullscreen gallery opens the selected photo from the current Mine/Friends list. It skips entries without photos, preserves list order and stops at the ends. The open gallery keeps its snapshot during background list refreshes.
- Two-finger pinch zooms1–4× around the touch focal point. Zoomed dragging stays within the fitted image. A pinch or zoomed pan cannot dismiss or page the viewer; returning to1× requires a separate swipe.
- At original scale, downward swipe closes; horizontal swipe selects previous/next. Page changes reset zoom and loading state. Accessible close, paging and zoom actions remain available.
- Friend photo errors renew the signed URL once through the existing authorized service; stale results after unmount/account changes are ignored.
- No dependencies, backend contracts, stored data or deployment changes.

## Verification

- TypeScript and affected-file ESLint passed; `git diff --check` passed.
- Full Jest run:99 suites,616 tests passed. After the final multitouch-start guard, targeted viewer/screen regression run:29 tests passed.
- Read-only independent review found expired friend URLs and a stationary multitouch release edge case; both fixed and re-reviewed with no remaining actionable findings.
- iOS26.3 Simulator: opening photos, left/right swipes1/7→2/7→1/7, downward dismissal, accessible zoom, blocking dismissal while zoomed, reset then dismissal observed.
- Simulator native drag coalesced move events (gestureState displacement0 despite different final touch position); release now uses final native coordinates with gestureState fallback. Regression covers this and stationary two-finger taps.
- Temporary gesture diagnostics removed. Physical two-finger pinch on an iPhone was not available; pinch/focal geometry and actual responder transitions are covered by tests. No TestFlight build published.

## Follow-up — 2026-10-19

- Added photo captions below the fullscreen image, bounded to20% of the viewer with independent scrolling for long notes. Both Mine and Friends gallery snapshots carry their original text; empty notes omit the footer.
- Double-tap within300ms at nearby points zooms2.5× around the second touch position; double-tapping while zoomed resets to1×. Existing image bounds constrain edge positions. Drag, hold and multitouch gestures do not count as taps; responder termination clears tap history.
- Regression tests verify focal translation, reset, subsequent swipe dismissal, distant/delayed taps and a drag returning to its starting point. Typecheck and affected-file ESLint passed.
