# Implementation Plan: Bảng điểm bài dùng chung

## Overview

Make the scorekeeper useful across card games and casual tabletop games. The feature stays in the Home drawer, stores history locally with encryption, and uses manual score entry so each group can follow its own rules.

## Architecture decisions

- Keep the hidden `CardScore` route and the existing three visible bottom tabs.
- Store an optional game/table title; remove Tiến lên-specific mode selection.
- Present players in columns, rounds in rows, and totals at the bottom, matching the supplied reference pattern.
- Distribute player columns across the available width for small tables and scroll horizontally for larger tables.
- Show each round's sum and mark non-zero sums red so mistakes stand out.
- Allow multiple active tables and switch between their separate scoreboards.
- Use a numeric keypad for fast per-player score input. Save a complete round as one record.
- Derive totals from round history to prevent stale totals after edits/deletes.
- Migrate records from the initial mode-specific schema to the shared schema while preserving names, scores, and history.
- Keep records encrypted and account-scoped using the existing local encrypted-storage service.

## Work breakdown

### 1. Shared score model and persistence

- [x] Remove game-specific mode from the new data model.
- [x] Add signed-score validation, derived totals, and random seat/dealer selection.
- [x] Preserve encrypted UID-scoped persistence and migrate older table records.
- [x] Cover model, storage, migration, and UID isolation with tests.

### 2. Navigation and setup

- [x] Keep the existing hidden route and expose it as `Ghi điểm bài` in the Home drawer.
- [x] Allow a generic optional game/table title and 2–8 players.
- [x] Keep optional random seating/dealer selection.
- [x] Add a clear close control to the table-creation dialog.

### 3. Score entry and history

- [x] Show a player-by-round matrix and current totals.
- [x] Fill the available width for two-player tables and flag non-zero round sums in red.
- [x] Allow multiple active tables with a compact selector.
- [x] Add a numeric keypad with per-player selection for quick entry.
- [x] Support editing/deleting rounds and confirming destructive actions.
- [x] Preserve finished tables in history.

### 4. Verification

- [x] Run focused and full Jest suites, lint, typecheck, and Expo bundle after this UI update.
- [ ] Manually verify drawer → setup → matrix → keypad → edit/delete → history on a simulator.

The previous version passed automated checks, but the simulator could not be verified because CoreSimulatorService was unavailable (`simctl` could not connect). Re-run automated checks on the final shared UI before relying on that result.

## Risks

| Risk                                                      | Mitigation                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------- |
| People use different game rules                           | Store manually entered signed scores; never calculate house rules.  |
| Previous score history could be lost in the schema change | Migrate old records in place and assert every prior round survives. |
| Eight player columns do not fit a phone                   | Allow horizontal scrolling while keeping rounds/totals legible.     |

## Follow-up UI review — 2026-10-11

Keep the existing color system and scoring behavior. Refine the active-table hierarchy and make score entry resilient on short screens without hiding the save action.

### Task 1: Group table actions by context

- [x] Keep `Bàn mới` with the active-table selector.
- [x] Place `Thêm người` beside the selected table summary.
- [x] Test that the add-player control belongs to the selected-table section.

### Task 2: Make quick score entry fit short screens

- [x] Allow the player grid, score summary, and keypad to scroll vertically when needed.
- [x] Keep the dialog title and save/clear actions available while scrolling.
- [x] Test the eight-player layout structure and fixed save action.

### Task 3: Improve round-delete touch spacing

- [x] Give the round delete control a more comfortable hit area while preserving the compact matrix.
- [x] Verify the two-player table still fits the available width and player columns remain balanced.

### Checkpoint: UI review

- [x] Full Jest suite, typecheck, lint, and formatting pass.
- [ ] Verify the updated score screen and dialogs on the iOS simulator when the current bundle is available.

The Simulator window is open, but `simctl` cannot connect to CoreSimulatorService and the app is still showing the previous bundle. The UI changes export successfully; visual verification needs a working simulator service and a reload.
