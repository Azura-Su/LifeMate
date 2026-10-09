# Spec: LifeMate daily utilities

## Objective

Make daily use of LifeMate faster by improving the finance ledger, adding study-oriented MP3 controls, adding a private Notes tab, and showing dated tasks on Home with a path to create a system-calendar event. The app remains Vietnamese-first and uses the existing React Native/Expo, Firebase, Zustand, and theme patterns.

## Assumptions

- These features are for the signed-in individual account already used by Finance and MP3.
- Finance templates/custom categories and MP3 learning controls are convenience preferences scoped to the device and UID; the underlying finance transactions remain in Firestore.
- Notes and agenda items are private Firestore data per UID so they survive reinstall and can be used across the account's devices.
- Agenda reminders are optional, device-local notifications. A task remains useful when notification permission is denied.
- Adding a calendar event opens the OS event editor with the task details prefilled. LifeMate does not read the user's calendar or create an event without the user's confirmation.
- Keep three bottom tabs: Home, Tài chính, MP3. Notes and Settings open from the Home menu (drawer); tasks live in the Home “Hôm nay” section rather than another tab.

## Existing stack and commands

- React Native 0.83, Expo SDK 55, TypeScript strict, React Navigation 7, Zustand 5, Firebase Auth/Firestore, AsyncStorage, Expo Audio and Expo Notifications.
- Install the SDK-compatible Expo Calendar package with `npx expo install expo-calendar`; use its system event-creation dialog API.
- Focused tests normally use Jest and React Native Testing Library. Existing project commands are `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, and `npm run bundle`.

## Architecture

- Keep transaction mutations in finance service/store; keep search and form drafts in Finance UI. Stable transaction ids are retained on edits.
- Store finance templates/categories and MP3 learning preferences in UID-keyed AsyncStorage. The native audio player remains the sole playback engine.
- Add UID-owned Firestore paths `noteAccounts/{uid}/notes/{noteId}` and `agendaAccounts/{uid}/items/{itemId}` with matching owner-only rules. Cache note and agenda snapshots per UID in AsyncStorage for offline viewing; write local cache and remote data through services.
- Store a note's title, body, and update timestamp. Store a task's title, optional details, due timestamp, completion state, optional reminder timestamp, and scheduled local-notification id.
- Schedule/cancel reminders from agenda actions; recreate a reminder when its task date changes. Do not request notification permission until the user enables a reminder.
- For external calendar handoff, use `expo-calendar/next` system UI with title, notes, start, and end; no calendar read/write permission is needed for that dialog.
- Home's Today section reads only the signed-in UID's agenda items and shows incomplete items due today, with a clear empty state and add action.

## User flows and acceptance criteria

### Finance quick entry

- User can edit an existing income or expense without changing its id/owner; save validates the amount/date/category and preserves the original until a successful update.
- User can search all transactions by note/category text or exact/partial formatted amount and clear the search. Empty results explain how to clear the filter.
- User can save, select, and remove a named transaction template containing type, amount, category, and note. A default “Cà phê 30.000đ” expense template is available.
- User can create and remove custom income/expense categories; built-in categories cannot be removed. A transaction with a category already in use remains readable if that category is removed.

### MP3 learning controls

- User can set/cancel a sleep timer; playback pauses when it expires, including when the app is backgrounded while the player remains active.
- The queue stores the current track and position periodically per UID, resumes from the saved position when that track is played again, and clears state on sign-out/account switch.
- User can create/remove named bookmarks at the current playback position and seek to a bookmark.
- User can select playback speed from 0.75×, 1×, 1.25×, 1.5×, and 2×; speed applies to the active player and the next track.

### Notes

- A new Ghi chú tab supports create, edit, delete, and search across title/body.
- Notes have an explicit title, editable body, updated time, loading/error/empty states, and UID isolation in Firestore rules and local cache.

### Agenda and calendar

- User can create, edit, complete, and delete a dated task with optional details and reminder time.
- User can add a saved task to the device calendar by opening a prefilled system calendar editor. Canceling the OS editor does not change the saved task.
- Home shows today's incomplete tasks, reminder time, completion action, and an add action; tasks remain usable if notifications/calendar access is unavailable.
- Task notifications are local to the device and are rescheduled/canceled when the task changes, completes, or is deleted.

## Testing strategy

- Existing Jest/RTL conventions cover pure filtering/validation, account-scoped storage/service/store behavior, and the Finance, MP3, Notes, and Home components.
- Verify native audio speed/sleep behavior and calendar editor launch on iOS and Android development builds; bundle/typecheck alone do not prove native behavior.
- Verify Firestore rules deny other UIDs access to notes and agenda data.

## Boundaries

- Always validate persisted/remote data and owner UID; keep reminder notifications free of sensitive note/task details on the lock screen; keep each user's records isolated.
- Do not read the system calendar, send remote reminders, add recurring tasks, or add full calendar browsing in this scope.
- A new native dependency is limited to Expo Calendar for the explicitly requested system-calendar handoff.

## Risks

| Risk                                                                  | Impact                                  | Mitigation                                                                   |
| --------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------- |
| Audio position writes too often                                       | Battery/storage overhead                | Throttle checkpoints and save on pause/track change/background.              |
| Native playback speed differs by platform                             | Learning controls behave inconsistently | Keep speed choices small and verify on both native engines.                  |
| Local notification permission is denied or OS drops a scheduled alert | Missed reminder                         | Keep agenda visible in Home and display permission/scheduling feedback.      |
| Cloud is unavailable during note/task edits                           | User could lose text                    | Keep a UID-scoped local cache and report pending sync clearly.               |
| Calendar permission design is too broad                               | Privacy friction                        | Launch the OS event editor only on explicit tap; do not enumerate calendars. |

## Platform references

- [Expo Calendar SDK 55](https://docs.expo.dev/versions/v55.0.0/sdk/calendar-next/) — system event editor API.
- [Expo Audio SDK 55](https://docs.expo.dev/versions/v55.0.0/sdk/audio/) — native playback controls and playback speed.
- [Expo Notifications SDK 55](https://docs.expo.dev/versions/v55.0.0/sdk/notifications/) — device-local scheduled reminders.

## Implementation plan

See [tasks/lifemate-utilities-plan.md](tasks/lifemate-utilities-plan.md) and [tasks/lifemate-utilities-todo.md](tasks/lifemate-utilities-todo.md).
