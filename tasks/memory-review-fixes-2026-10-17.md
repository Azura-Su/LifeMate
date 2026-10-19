# Memory review fixes — 17/10/2026

## Changes
- shareMemory serializes current-content validation, publication and local visibility persistence in the existing UID queue. Both create/edit save and card visibility use it. Changed/deleted snapshots reject before publishing. The helper does not nest queued storage calls.
- Publication or local-persistence failures attempt unshare while still holding the queue. Failed rollback keeps a typed uncertain result, even if the conservative cache write also fails. That error carries the actual persisted entry (or unchanged original if write failed), so editor retries do not use an invented timestamp.
- Editor/delete checks compare content, immutable photo filename, normalized visibility, timestamps and deletion state. Sync acknowledgements and verified backup bookkeeping alone no longer invalidate open forms. Conflict-choice checks still use strict revision snapshots.
- New-memory privacy description now says account sync rather than device-only storage.

## Verification
- RED: acknowledgement editor and new serialized sharing regressions failed before implementation (5 failed,26 passed).
- Focused storage/UI/editor:56 tests passed, including deferred cloud replacement, sharing queue ordering, acknowledged edit/share, publication errors, disk errors and failed rollback.
- Independent plan and final review: no remaining actionable findings. Reviewer did not rerun tests.
- Full Jest:98 suites,595 tests passed. Typecheck, affected ESLint and git diff --check passed.
- No backend/rules/migration/dependency changes or deployment. No real memories were shared, edited or deleted for validation. Native network timing and concurrent writes on another real device remain unverified.
