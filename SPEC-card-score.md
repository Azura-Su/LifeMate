# Bảng điểm bài dùng chung

## Objective

Provide one reusable, offline-first scorekeeper for any card game or casual tabletop game. It is not tied to Tiến lên or to a particular scoring system: users name the game/table if useful and enter each player's signed score manually.

## User and success

One person keeps score for a group around one phone. A clear round-by-round matrix makes the score history easy to check and correct. A numeric keypad makes entering a round fast, while totals update from the saved round records.

## Scope and assumptions

- Support 2–8 players, four blank player rows by default, with unique non-empty names.
- A table can have an optional title such as a game name or gathering; the generic default is `Bàn chơi`.
- Each round records a signed integer score for every player. The app does not apply a game's scoring rules automatically.
- Display players as columns and rounds as rows, with a total row. Users can tap a round/cell to edit it or remove the whole round.
- Calculate every round's sum internally. Balanced rounds sum to zero; show an unbalanced row with a red background, without adding a separate sum column.
- A quick-entry keypad selects one player at a time, with each player's entered score visible before saving the round.
- Allow several active tables at once and provide a compact selector to switch between them.
- A table can be finished and stays in history.
- Put a clear `×` close control in the create-table dialog.
- Randomize seats and select the first person to deal; this is a casual draw, not a gambling feature.
- History is encrypted in local storage and scoped to the signed-in UID. Cross-device sync, betting/payment, and automatic game-rule scoring are out of scope.
- Migrate prior mode-specific records into the shared format with their rounds and players intact.

## User flows

1. Open Home menu → choose `Ghi điểm bài` → create a shared table, optionally name the game/table, enter player names, and optionally draw seats/dealer.
2. View the score matrix. Tap `Thêm ván`, select each player, enter scores on the keypad, then save.
3. Tap a round or score to edit it. Delete a round only after confirmation; totals are recalculated from the remaining history.
4. Finish a table to retain it in history, then create another without replacing older tables.
5. Delete a saved table only after confirmation.

## Data and architecture

- Keep player, table, and round records in `src/types/cardScore.ts` and score validation/derived totals/shuffling in `src/utils/cardScore.ts`.
- Persist in an encrypted UID-keyed record using the existing local-storage service. Preserve prior records by mapping their old mode to the generic `Bàn chơi` title.
- Add a hidden React Navigation route reachable from the Home drawer; keep the three visible bottom tabs unchanged.
- Keep the score feature offline-first and independent of Firebase/Supabase.

## Acceptance criteria

- Drawer action is labeled `Ghi điểm bài` and describes a tool shared by all games.
- Table setup does not ask users to choose a Tiến lên variant. It accepts an optional game/table title.
- The active view presents a readable player-by-round score matrix with totals and edit/delete affordances.
- Keypad entry supports positive, negative, and zero integer scores for each player before saving a round.
- Adding, editing, and deleting rounds updates totals and survives reload.
- Multiple tables can remain active and switching between them keeps their separate players and scores.
- A non-zero round sum highlights the full row in red; no separate round-sum column is shown.
- The create-table dialog can be dismissed with a visible `×` control.
- Finishing a table preserves the entire table in history. Previous mode-specific records migrate without losing their score history.
- Data for one UID is never read under another UID's storage key.
- Unit, storage, navigation, and screen tests cover validation, score entry/editing, history preservation, migration, and UID isolation.

## Reference

The user's reference image demonstrates two useful patterns: a dense but readable matrix of player scores by round, and a fast-entry screen with players visible above a numeric keypad. The shared feature adopts those interaction patterns without copying game-specific scoring rules.
