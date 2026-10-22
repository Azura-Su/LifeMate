# Card game reliability and create-room UX — 20/10/2026

## Goal

After tapping create, show the same table-first waiting surface used when rejoining, with a contained ready action. Fix the reported CardScore persistence races, room lifecycle, player validation, game-session recovery, and orientation cleanup without losing user-entered edits or changing server authority.

## Scope and assumptions

- All eight High/Medium findings supplied by the user are in scope.
- Investigate the three lower-priority findings. Fix them only where current rules/data prove the behavior is wrong; do not invent a house rule where the spec is silent.
- The existing `tasks/plan.md` and `tasks/todo.md` contain unrelated unfinished work; this change uses its own plan and checklist.
- No production deployment or account data mutation is authorized; verify through local tests and migration tests.

## Slices

1. **Create-room pending UI (UI, low data risk)**
   - Render the same green table/deck and bottom player/ready panel during create pending and after the lobby snapshot arrives.
   - Constrain the footer and ready button at narrow portrait widths; keep room code in the `?` popup.
   - Acceptance: create transitions directly to the table surface; the loading state stays inside the ready button; the button never clips at a narrow viewport; server lobby replaces the placeholder without an intermediate form/lobby page.

2. **CardScore storage concurrency and online table lifecycle (persistent-data risk)**
   - Merge an edited stale match onto the latest encrypted stored record inside the existing UID queue, preserving newly synced players and rounds and applying explicit round/player tombstones to metadata and score columns.
   - A finished online score table is immutable to room sync. Track the last synchronized online match ID so a later room match creates a new active score table, while repeated snapshots do not duplicate it. For older finished records without a watermark, treat IDs present in rounds or round tombstones as the same match; otherwise start a new table.
   - Normalize invalid online names and deltas at the server-data boundary so one malformed value does not poison future syncs.
   - Support more than eight players for online tables in both add/save validation. Persist removed online player IDs as tombstones so future sync does not restore them.
   - Acceptance: stale UI saves retain a concurrently synced round; an explicitly deleted round stays deleted; finished history does not change; a new match creates an active table once; invalid optional values are normalized safely; 9+ online players can be managed; intentionally removed players stay removed.

3. **Game-session convergence after network failure**
   - For the same room, use monotonically increasing room version as the ordering source before comparing server clocks.
   - Clear an uncertain pending command and its error once a newer room version or match transition proves the command is no longer pending; keep 4xx rejection behavior.
   - Acceptance: a newer-version snapshot with a lower server timestamp is accepted; a lost play response can recover from a later snapshot and subsequent play/pass actions are not silently ignored.

4. **Orientation lifecycle**
   - Keep portrait lock while a focused screen is outside an active match, but unlock on navigation blur and unmount so the retained CardGames tab returns to the app's configured default orientation. Remove the NativeScreen portrait override.
   - Acceptance: lobby/match behavior remains correct; blur and unmount call `unlockAsync` in sequence after pending orientation changes.

5. **Room activity lease and expiry (server/migration risk)**
   - Renew room expiry along with a valid current-session lease read, only while the room is still open and not past its expiry; retain closed/finished private-retention semantics and avoid stale sessions extending a room.
   - Acceptance: routine renewals extend an active lobby/results room beyond 30 minutes; expired rooms cannot be revived by renewal; stale sessions do not extend expiry; worker expiry remains effective.

6. **Leaving/ending and instant-win lower-priority checks**
   - Verify final departure while a match is being settled; preserve settlement/result recording if the last seat leaves after a result is produced. Closed transitions with a finished game must persist exactly once in both command and worker paths; simultaneous expiry cancels only when nobody had already finished.
   - Check whether four cards of a rank represent two pairs for the documented six-pairs instant win; current SPEC says six distinct ranks with pairs, so preserve the existing rule and cover it with a fixture.
   - Acceptance: completed result is scored/persisted exactly once even when the room closes; simultaneous all-player disconnect with no earlier finisher remains cancelled; six-pairs behavior has explicit fixture coverage.

7. **Final review and verification**
   - Reviewer checks the final diff, especially queue merge semantics, score settlement, SQL lease renewal, and pending-action reconciliation.
   - Run targeted Jest, full Supabase function tests, TypeScript, affected ESLint/Prettier, `git diff --check`, and available migration/database tests. Record simulator/runtime checks that are unavailable.

## Risks

| Risk | Mitigation |
|---|---|
| Merging storage can resurrect user-deleted rounds or overwrite a finished status | Merge only unseen latest rounds, union tombstones, preserve terminal status, and add interleaving tests |
| Same room can own multiple score tables after a manual finish | Persist last synced match ID, select active table explicitly, and test replay/new-match cases |
| Renewals can keep stale or closed rooms alive | Validate active seat/session in the database transaction and test expiry boundary/stale session |
| Exit settlement can double-apply money/wins | Preserve idempotent match ID/result insert and test repeat leave/worker calls |
| UI changes may still clip in compact layouts | Test styles at narrow width and inspect final JSX/style constraints |

## Verification commands

- Focused card score storage and screen tests with Jest.
- Focused game session and orientation tests with Jest.
- `npm run test:functions` for reducer, handler, worker, and SQL integration.
- `npm run typecheck`, ESLint on affected paths, Prettier check, and `git diff --check`.
