# Permanent score history deletion — 2026-10-22

User requirement: deleting a score sheet removes it from the history list; no restore action. This applies to old deleted cards too. Finished but undeleted sheets retain their existing reopen action.

Implementation:
- Filter deleted sheets before active/history selection and room lookups. Hide deleted cards defensively and remove restore controls/branches.
- Reject local stale saves/resume after deletion. Preserve internal audit and replay-suppression tombstones.
- Shared writes accept only save/delete. The database makes deletion terminal while preserving idempotent receipt replay, current-owner checks, room-before-table locking and CAS.
- Keep tombstones in authorized sync responses so a fresh device cannot recreate a deleted sheet from an old game result.

Deployment: apply `20261021184438_permanent_score_deletion.sql`, deploy `game-access`, and release the updated app. No cloud deployment is part of this change.

Validation:
- New regression cases failed before the implementation (UI visibility, local stale restore, HTTP restore and SQL restore rejection), then passed.
- 5 targeted Jest suites: 76 tests passed, including deletion/reload, old cached tombstones, shared permissions, local finish/reopen and replay suppression.
- Full Supabase function suite: 193 tests passed, including SQL mutation queries against PGlite with the new migration.
- TypeScript, affected-file ESLint and scoped `git diff --check` passed.
- Independent read-only review found no actionable issues in the deletion paths.
- No physical-device verification or cloud deployment performed.

An existing history layout assertion also surfaced missing explicit column/stretch defaults; those defaults are now stated in the existing history card style without changing its layout. Running the UI suite alongside the CPU-heavy database suite exceeded its normal asynchronous wait timeout; the final complete targeted UI run passed separately.
