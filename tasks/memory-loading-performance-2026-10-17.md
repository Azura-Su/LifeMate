# Memory opening/sharing latency and loading — 17/10/2026

## Diagnosis and measured request counts

- downloadMemoryPhoto checked/uploaded every intact local original on every sync. Same cached-original test across five files:5 private R2 verification calls before →0 with a matching confirmed local proof after. Unmarked legacy originals still verify/migrate once; missing files still download and mismatches still verify. This is a request-count measurement, not measured production network milliseconds.
- Initial account load, timeline entry and two listener notifications started4 separate sync calls under a deferred baseline. They now share1 active request and retain1 trailing refresh so server changes are not discarded.
- changeVisibility awaited a full-library load after server confirmation and local persistence. A deferred-sync regression now proves the dialog closes after confirmed publication/local cache update while unrelated background sync remains unresolved. First-time sharing still resizes/uploads a separate shareable JPEG and waits for server confirmation.

## Implementation

- Optional encrypted-cache-only r2Photo filename/size proof, set only after confirmed R2 backup/restore. Remote metadata cannot supply the proof; commit explicitly excludes it. Reuse checks owner/item identity at the caller, filename/size and actual local file. Replacing a photo clears it. Missing/old proofs retain migration/recovery behavior. Proof-only changes do not invalidate editors/conflict choices; top-level snapshot key ordering is canonicalized, other fields/revisions remain compared.
- Same-account screen loads coalesced with trailing refresh, per-run generations and UID guards. All cloud-state callers fetch friend feed only on the friends tab; default state-only loading prevents future accidental mine-feed fetches.
- Visibility dialog shows spinner on the selected action, progress text and disabled controls. Waits for server-confirmed publish/unshare plus serialized cache persistence, patches confirmed sharing result, then refreshes own sync in background. Existing rollback remains. Older state reads invalidated; state cleared during a concurrent refresh uses the captured known state or triggers a fresh guarded check when unknown.
- Timeline tap shows inline sync feedback immediately; each image shows a spinner until native load/decode or error. Private description now correctly says account sync instead of device-only storage.

## Validation

- Red tests reproduced repeated R2 checks,4 overlapping sync calls, unnecessary mine feed, absent image/action loading and dialog depending on full-library completion.
- Full Jest:96 suites,568 tests passed. Additional five-distinct-original proof test rerun after fixture clarification.
- Typecheck, affected-file ESLint, git diff --check passed.
- iOS/Android Expo export passed: /tmp/lifemate-memory-speed-export.
- Read-only reviewer plan/final review and scoped follow-ups completed; fixed all actionable findings (proof-only snapshots, stale/unknown sharing state and mine-feed call sites). Reviewer did not execute tests.
- iOS Simulator smoke: opened timeline with5 existing memories, saw cached images and account-synced status; opened/closed permission dialog with corrected private description. No real private memory was shared/unshared, edited or deleted. Selected-action spinners and slow/failing transfers verified by deferred automated tests rather than publishing real data. Screenshot: /tmp/lifemate-memory-visibility-speed.png.

## Remaining limits

UID queue serialization is retained. An already-running first legacy migration/transfer can still delay queued local visibility persistence; no raw concurrent cache writes or mutation-priority queue redesign. No measured physical-device wall-clock latency or live sharing timing claim. Cache without the new proof incurs one verification pass. No backend/rules/dependency changes or deployment; TestFlight requires a new app release. Existing working-tree changes preserved; no commit/push.
