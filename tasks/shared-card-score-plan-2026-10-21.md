# Shared room scores and audit history

User chose synchronized room score edits/deletions/history for all participants.

- Keep manual tables offline and encrypted per UID; retain local edit/delete audit.
- Add one canonical shared score table per room. Server owns owner/member access,
  identities, versions, timestamps, automatic results and audit. Score adjustments
  do not rewrite gameplay results or balances.
- Only the current owner can mutate. Check ownership under the room lock before
  the score row lock; use independent score CAS and idempotency receipts.
- Retain soft-deleted tables and their audit, with explicit owner restore. Never
  replay a deleted round or overwrite an edited result from room heartbeats.
- Preserve legacy device-only copies read-only, visibly labelled. Earlier rounds
  cannot all be reconstructed from retained server data; do not silently import.
- Cache shared records per UID without cached write grants. Poll only while the
  score screen is focused/foreground, without overlaps. Ignore superseded reads.
- Freeze editor/confirmation target and revision. A conflict keeps the draft;
  reopening an editor is required to use a newer revision.
- Keep room re-entry visible using the known room code when status is unavailable;
  show retry feedback and keep privileged room actions gated on successful status.

Independent plan review completed by reviewer roles (read-only). Incorporated:
semantic trigger no-ops, independent score receipts, pre-erasure board capture,
fresh identity for safely recreated sanitized boards, editor revision capture,
and list/mutation ordering guards.

Validation: SQL integration authorization/CAS/audit/idempotency/result replay and
erasure tests; client parser/storage/hook/screen regressions; TypeScript, affected
ESLint, full functions suite and application tests. Final independent diff review.
Deployment and real two-device validation are separate from local checks.

## Result

- Added canonical server sheets, owner-only mutations, CAS/idempotency, shared
  audit pagination, soft delete/restore and account-erasure integration.
- Added per-table audit for manual sheets. Preserved older device-only linked
  copies read-only; earlier local corrections are not silently uploaded.
- Fixed re-entry from score/history when status is pending or unavailable.
- Removed creation of new legacy copies from the game screen. Cancelled matches
  cannot create phantom rounds; canonical sheets retain the server per-card rate.
- Editors retain their opening revision and player columns. Stale reads cannot
  undo newer mutations; offline/background/revoked sessions lose client grants.
- Shared polling stops when online games are disabled or the screen is inactive;
  unchanged revisions avoid encrypted cache rewrites.

Independent backend/client final reviews completed. All three P2 findings were
fixed and the reviewers confirmed the corrections. Reviewers did not execute
tests themselves; the main agent ran the checks below.

## Verification

- Full Jest suite: **126 suites, 894 tests passed**.
- Functions suite, including PGlite SQL integration: **193 tests passed**.
- SQL integration exercised actual `service_role` execution, owner/member/outsider
  access, transfer, CAS, receipts, immutable audit, pagination, result replay,
  cancellation, configured rate, room deletion and historical-account erasure.
- TypeScript and ESLint on affected paths: passed, no warnings.
- Offline Expo export: iOS and Android Hermes bundles passed, output
  `/private/tmp/lifemate-shared-score-export`.
- Reviewed scoped diff and whitespace. Existing unrelated working-tree edits
  preserved. Baseline and isolated patch are under
  `/private/tmp/lifemate-shared-score-20261021-v1` and
  `/private/tmp/lifemate-shared-score-delta.patch`.

## Rollout and limits

No production schema/function deployment or app installation was performed.
Apply `20261021130001_shared_card_scores.sql` after the existing room migrations,
deploy `game-access` including `scores.mjs`, then release the updated app. The
migration was created through the Supabase CLI and ordered after the repository's
already-future-dated room migration. It backfills retained rooms, not expired
unlinked historical results or private device edits.

Real two-device UI/network validation and hosted Postgres advisors were not run.
Local SQL tests verify permissions/transactions; PGlite does not establish
production lock-contention behavior. Data already retained on legacy devices
remains a separate, visibly labelled copy. Shared corrections do not change game
engine balances. After room deletion, its last owner retains score-sheet control.
