# Capability Map: LifeMate daily utilities

| Module id | Responsibility | Depends on |
|---|---|---|
| `finance-quick-entry` | Edit/search transactions; per-account transaction templates and custom categories | `finance-ledger`, identity |
| `audio-learning` | Sleep timer, per-account resume position, bookmarks, playback speed | `audio-library`, identity |
| `notes` | Create, edit, search, and delete private notes | identity, Firestore |
| `agenda` | Dated tasks, optional local reminder, and handoff to the system calendar | identity, local notifications, Expo Calendar |
| `home-today` | Show due tasks and provide the entry point to add one | `agenda`, shell |

Build order: `finance-quick-entry` → `audio-learning` → `notes` → `agenda` → `home-today` → integration and documentation.

All user-owned data is scoped by Firebase UID. Finance categories and templates, audio resume/bookmark state, notes, and agenda items must never be shared between accounts. Phone calendar events are created only after the user taps the calendar action and confirms in the operating-system calendar UI.
