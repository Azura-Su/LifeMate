# LifeMate daily utilities

## Phase 1: Finance quick entry

- [x] Add owner-checked transaction update and per-UID category/template persistence.
- [x] Add all-history search, transaction editing, custom categories and templates, including “Cà phê 30.000đ”.
- [x] Checkpoint: ensure edit/search/category/template state composes with reports and remains UID isolated.

## Phase 2: MP3 learning controls

- [x] Persist queue position and bookmarks per UID; checkpoint position writes.
- [x] Add playback speed and sleep timer controls; clear/cancel state on account change and stop.
- [x] Checkpoint: validate resume, seek, speed carry-over and timer pause behavior through static review.

## Phase 3: Notes

- [x] Add note types, validation, cache/Firestore service/store and owner-only rules.
- [x] Add Notes tab with create/edit/delete/search and loading/error/empty states.
- [x] Checkpoint: confirm UID isolation and persistence through static review.

## Phase 4: Agenda and Home

- [x] Add task types, cache/Firestore service/store and CRUD.
- [x] Add optional local reminders and cancel/reschedule lifecycle.
- [x] Add Home Today task list and form, with system-calendar event handoff.
- [x] Checkpoint: confirm today filtering, completion, reminder failure handling and calendar cancellation through static review.

## Final

- [x] Update README, capabilities and verification notes.
- [x] Inspect final diff and run permitted static checks; note any native runtime limits.

## Runtime follow-up

- [ ] Rebuild and exercise the native iOS/Android development clients for Expo Calendar's event editor, local notifications, audio playback speed, background sleep timer, and resume behavior.
- [x] Deploy `firebase/firestore.rules` to `baseapp-dd227`; Firebase CLI confirmed the rules compiled and were released on 2026-10-09.
