# Bảng điểm bài dùng chung

## Objective

Provide one reusable, offline-first scorekeeper for any card game or casual tabletop game. Manual tables are offline-first; online room tables are shared with room participants. The manual scorekeeper is not tied to Tiến lên or to a particular scoring system: users name the game/table if useful and enter each player's signed score manually.

## User and success

One person keeps score for a group around one phone. A clear round-by-round matrix makes the score history easy to check and correct. A numeric keypad makes entering a round fast, while totals update from the saved round records.

## Scope and assumptions

- Support 2–8 players, four blank player rows by default, with unique non-empty names.
- Linked online tables may retain more than eight historical participants as seats change; only 2–4 are in the online room at once. Past columns and rounds remain in the same table and totals remain comparable.
- A table can have an optional title such as a game name or gathering; the generic default is `Bàn chơi`.
- Manual tables record a signed integer score for every player. Online Tiến lên miền Nam rooms have one canonical server score table, created even while the owner waits alone in the lobby. Record each completed, non-cancelled result once by match ID. Only the current room owner may add/correct/delete rounds, manage players, finish or delete that shared table. All recorded room participants can read the same scores and audit. Score corrections do not rewrite the game engine’s results or accumulated balances.
- Canonical shared player management accepts at least one player, names up to 30 characters and no control/hidden format characters, matching server validation. Manual and legacy player management keep their two-player minimum and 32-character input limit. Removing a player with recorded points still requires confirmation.
- Display players as columns and rounds as rows, with a total row. Users can tap a round/cell to edit it or remove the whole round.
- Calculate every round's sum internally. Balanced rounds sum to zero; show an unbalanced row with a red background, without adding a separate sum column.
- A quick-entry keypad selects one player at a time, with each player's entered score visible before saving the round.
- Allow several active tables at once and provide a compact selector to switch between them.
- Keep the `Tính điểm` / `Chơi online` tabs fixed below the screen header; only their body scrolls. Pulling down on `Tính điểm` refreshes shared scores and local history with a native loading indicator, preserving visible content and the selected table. Stop loading on success/failure and discard delayed reads after blur or an account-session change. The static online catalog only scrolls, with no pull refresh or automatic room connection.
- A table can be finished and stays in history. If saving fails, show the error inside the finish confirmation and allow retry without closing the table.
- Finish closes its confirmation before applying deferred local view changes
  (`onDismiss`, with a 350 ms fallback). The pending change belongs to its
  UID/session and table; account reset or unmount discards it. Preserve newer
  shared revisions, edits, deleted/missing tables and unrelated score content.
  A local finish merges only archive metadata; explicitly reopening the same
  table cancels its pending finish. Dismiss and fallback consume the change once.
- Put a clear `×` close control in the create-table dialog.
- Randomize seats and select the first person to deal; this is a casual draw, not a gambling feature.
- Manual history and shared read caches are encrypted locally and scoped to the signed-in UID. Manual tables remain offline-only. Shared content, access, revisions and audit are authoritative on the server. Offline shared caches are read-only. Older device-only online copies remain in history until explicitly resumed with `Mở lại bàn`; then their retained scores may be edited locally, with a clear device-storage hint. The 2026-10-22 history reset purges old archived local entries and copies of the rooms removed from the server the next time this storage is read. It preserves active tables and later edits, and rejects stale server responses before returning or caching them. Do not silently import private corrections or claim all expired server rounds can be reconstructed. Payment and Finance transactions are out of scope.
- Every table has an on-demand edit/delete history showing actor, time, changed settings and old/new round scores. Deleting a table permanently removes its card from active/history lists for all participants, with no restore action. Internal tombstones and audit remain for synchronization, replay suppression and accountability. Audit from before this version is not fabricated.
- Migrate prior mode-specific records into the shared format with their rounds and players intact.

## User flows

The optional `Chơi online` entry opens a separate online-game route, guarded by `EXPO_PUBLIC_CARD_GAMES_ENABLED`. Online Tiến lên miền Nam rooms create an automatically updated shared score table on the server, with a UID-scoped encrypted read cache. The current owner can correct rows and add manual rounds for everyone, and finish the shared table into history without ending the room. Later game results remain recorded on that room’s same table; its owner can resume it. See [SPEC-card-games.md](SPEC-card-games.md).

1. Open Home menu → choose `Trò chơi & điểm số` → choose `Tính điểm` → create a shared table, optionally name the game/table, enter player names, and optionally draw seats/dealer. The sibling `Chơi online` path opens the online game catalog described in [SPEC-card-games.md](SPEC-card-games.md).
2. View the score matrix. Tap `Thêm ván`, select each player, enter scores on the keypad, then save.
3. Tap a round or score to edit it. Delete a round only after confirmation; totals are recalculated from the remaining history.
4. Finish a table to retain it in history, then create another without replacing older tables.
5. Delete a saved table only after confirmation. Remove its card from the list immediately after a successful delete, including previously deleted cached cards. There is no restore action. Shared deletion affects all participants and permanently blocks automatic result replay; internal audit remains intact. Room deletion is separate and retains the score sheet.
6. Keep history cards compact: title, date/round count, player totals and labeled open/audit actions. Collapsed history has no room re-entry or room management controls. The title/chevron expands a read-only matrix. `Mở lại bàn` moves that same table out of history into the active table area, selects it and enables adding/editing scores. Preserve its ID, players, existing rounds and audit, including after reload; finishing returns it to history. Canonical shared tables still require current owner permission. A legacy device-only online table resumes through a persisted local-only flag (`localScoreEditable`), without creating or changing a shared table. Local deletion removes the card permanently, preserves its internal audit and does not delete the room or alter shared scores. Only finished, undeleted tables may be reopened.
7. Active linked score boards show one `Vào lại phòng` icon and do not query room status while viewing the board. On tap, fetch current status: enter an active room; if expired and reopening is permitted, reopen it with the fresh version/match ID, then enter. Expired nonowners wait for the owner; deleted/missing rooms show an entry error. Lookup/network failures can be retried with the same icon. Prevent duplicate requests and cancel status/reopen/navigation on blur, unmount or account-session change. Do not show a separate room-status warning/retry panel. Explicitly expanding historical details may inspect room status to offer authorized reopen/delete management independently of score completion/deletion; reopening also refreshes status on tap. Shared score-sync errors and retry remain within the affected opened board, and canonical shared writes still require a fresh owner grant.
8. Edit/delete history uses a quiet clock link and a compact dialog: actor and timestamp form the event heading, each change has a title and separate old/new player scores. Preserve all tombstones, revisions and audit values while changing presentation.

## Data and architecture

- Keep player, table, and round records in `src/types/cardScore.ts` and score validation/derived totals/shuffling in `src/utils/cardScore.ts`.
- Persist in an encrypted UID-keyed record using the existing local-storage service. Preserve prior records by mapping their old mode to the generic `Bàn chơi` title.
- Add a hidden React Navigation route reachable from the Home drawer; keep the three visible bottom tabs unchanged.
- Keep manual scoring offline-first. Shared scores use Firebase-verified `game-access` requests and service-only RLS tables/RPCs in Supabase. Use independent score revisions and idempotency receipts. Lock room before score row when checking current ownership. Automatic room updates only advance score revisions for semantic changes.
- Save mutations and append server-computed immutable audit in one transaction. Retain read access from trusted room membership, never from client-edited score player IDs. Account erasure purges associated boards, receipts and audit before any future sanitized room can create a fresh board identity.
- Poll only while focused/foreground, without overlap; unchanged revisions skip cache rewrites. Invalidate stale list responses during mutations. Capture editor/confirmation table IDs and revisions when opened; conflicts retain drafts and require reopening before saving a newer revision.

### Large shared boards and local history retention

- Shared edits use `score-write/patch`: complete table settings, at most 100
  round upserts and 100 round deletion IDs. Compute the delta against the editor's
  original revision. Keep the existing body limit and legacy `save` contract;
  settings, single-round edits and finish work after automatic history exceeds
  2,000 rounds or 262,144 bytes. Server merge retains untouched rounds, normalizes
  removed player scores, and uses the same ownership, CAS, receipts, audit and
  permanent round tombstones as legacy writes.
- Store the device archive time as `localFinishedAt`, preserving it across shared
  refreshes and clearing it on local resume. Never trust this field from server
  snapshots or alter the authoritative `updatedAt` for a local archive. The old
  history cutoff considers the latest server edit or local archive; explicitly
  purged room IDs remain excluded.
- Linked-room entry and reopen controls require the current `gameUsers` email
  allowlist grant. Revocation aborts pending entry and prevents late reopen or
  navigation. Scores remain readable under their existing access rules.

## Acceptance criteria

- Drawer action is labeled `Trò chơi & điểm số` and offers separate manual scoring and online play paths.
- Table setup does not ask users to choose a Tiến lên variant. It accepts an optional game/table title.
- The active view presents a readable player-by-round score matrix with totals and edit/delete affordances.
- Keypad entry supports positive, negative, and zero integer scores for each player before saving a round.
- Adding, editing, and deleting rounds updates totals and survives reload.
- Multiple tables can remain active and switching between them keeps their separate players and scores.
- A non-zero round sum highlights the full row in red; no separate round-sum column is shown.
- The create-table dialog can be dismissed with a visible `×` control.
- Finishing a table preserves the entire table in history. Previous mode-specific records migrate without losing their score history.
- `Mở lại bàn` removes the reopened table from history and selects its editable active view. Existing scores remain editable, new rounds can be added, and reopening survives reload. Untouched legacy records remain in history; a local reopen flag never bypasses canonical shared ownership checks.
- Data for one UID is never read under another UID's storage key.
- Members cannot mutate shared tables, including through forged API requests. Ownership transfer immediately fences the old owner on the server.
- Non-owners see no dealer draw, add-round, round-delete (`×`), or player-management controls on linked online boards. Apply this to reopened device-only copies too: require a current room-owner lookup for local edits, delete and resume. Clear this permission on blur/background, recheck on return and before local writes; pending/failed lookup remains read-only. Manual tables keep their existing controls.
- Every player retains `Kết thúc`. For a non-owner or an online board without a live write grant, confirmation archives only this UID’s device view, preserves scores/shared status/audit, and makes no shared mutation request. Preserve this local preference during cloud refresh and reload. `Mở lại bàn` reverses the local archive without granting edits. Freeze local/shared finish intent at confirmation open; the owner’s existing shared finish remains owner-checked. Explicit owner resume of an undeleted table clears any local archive flag.
- Corrections and deletions are visible to all participants; audit survives table/room deletion, and deleted/edited results are never overwritten by replay.
- Owner-alone rooms have a shared score entry and room re-entry action. New matches never manufacture additional legacy device-only copies.
- Unit, storage, navigation, and screen tests cover validation, score entry/editing, history preservation, migration, and UID isolation.

## Reference

The user's reference image demonstrates two useful patterns: a dense but readable matrix of player scores by round, and a fast-entry screen with players visible above a numeric keypad. The shared feature adopts those interaction patterns without copying game-specific scoring rules.

### Edit/delete history display

Only human owner actions appear in the edit/delete history dialog. System events
(`actorUid: null`) remain in stored/server audit but are hidden in the UI. Retain
past owners' actions after ownership transfer; do not filter by the current owner
or by display name. Preserve pagination even when a page contains only system
events, without implying the entire history has no edits. The dialog has a bounded
viewport, fixed heading/close control and a flexible scroll area for events/actions.
