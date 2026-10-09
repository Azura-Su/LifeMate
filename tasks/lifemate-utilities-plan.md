# Implementation Plan: LifeMate daily utilities

## Overview

Deliver four user-visible areas in dependency order: complete finance editing/search/templates/categories, add learning controls to the existing MP3 queue, add private notes, then add dated tasks with local reminders/calendar handoff and a Home Today section. Preserve the current four completed domains and UID isolation. The new tab brings the total to five.

## Design decisions

- Use the existing finance ledger, audio queue, Firestore, AsyncStorage, theme, and screen/component patterns; avoid parallel implementations of playback or account state.
- Keep screen behavior intuitive: search applies across all ledger transactions; editing reuses the current transaction form; the Coffee quick template is immediately usable; built-in and custom categories appear together by transaction type.
- Put note CRUD in one new tab. Put the task list and create/edit flow on Home to avoid crowding the tab bar with a second organizational tab.
- Scope local preferences, reminders, and caches to Firebase UID. Keep notes and agenda records in owner-protected Firestore paths.
- For calendar integration, open the operating-system event editor with the task prefilled. The user confirms or cancels there; LifeMate does not request broad calendar read access.
- Use Expo Calendar's SDK 55-compatible package/API, installed through `npx expo install`. Its system event editor handles the explicit user handoff without granting LifeMate access to read the calendar.

## Task list

### Phase 1: Finance quick entry

1. Extend transaction service/store with owner-checked edit; add UID-scoped custom category/template preference storage and transaction filtering helpers.
2. Update Finance UI for search, edit, template selection/management, and custom category creation/removal with clear validation and empty states.

### Checkpoint: Finance

- Editing updates the same transaction, search spans all months, and preferences remain isolated by UID.
- The existing finance summary/report flow remains intact.

### Phase 2: MP3 learning controls

3. Add UID-scoped resume/bookmark persistence and throttled progress checkpoints to the queue player.
4. Add speed selection and sleep timer controls to the player; cancel timer and clear account state safely on stop/sign-out.

### Checkpoint: MP3

- Resume/bookmarks seek to valid positions, speed is applied to queue transitions, and an expired sleep timer pauses playback.

### Phase 3: Notes

5. Add note model, validation, UID-scoped cache and Firestore service/store with owner-only rules.
6. Add Ghi chú tab and create/edit/delete/search UI with loading, error, and empty states.

### Checkpoint: Notes

- A note survives app reload and only its owner can read or write it.

### Phase 4: Agenda and Home

7. Add agenda model, cache/Firestore service/store, task CRUD, completion and local reminder scheduling/cancellation.
8. Add the Home Today section and task form; add explicit “Tạo sự kiện trong lịch” handoff to the OS event editor.
9. Add the fifth Notes tab; verify logout/account switching resets account-bound UI state.

### Final checkpoint

- All feature acceptance criteria in `SPEC-life-utilities.md` are met; native calendar and audio behavior are checked on supported development builds when available.
- Update README, capability docs and setup notes; inspect the final diff without touching the pre-existing finance/cloud work.

## Risks and mitigations

| Risk                                                               | Impact                                    | Mitigation                                                                                                      |
| ------------------------------------------------------------------ | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Existing workspace already contains broad uncommitted finance work | Overwriting or mixing work                | Keep all current changes; add isolated files and make narrow edits only where the feature requires integration. |
| Calendar/audio native APIs differ across platforms                 | Feature may typecheck but fail at runtime | Follow SDK 55 docs and check a development build on iOS/Android if available.                                   |
| Large feature scope causes tangled UI state                        | Regressions across tabs                   | Implement in the vertical slices and checkpoints above.                                                         |
| Firestore rules could expose personal records                      | Privacy breach                            | Use UID path checks and validate the data owner at service boundaries.                                          |

## Open questions

- None block the implementation. Scope assumes tasks/notes sync to the signed-in account, while reminders and learning playback preferences remain device-local.
