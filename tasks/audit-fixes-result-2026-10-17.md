# Audit fixes — 17/10/2026

Implemented all six reported issues, preserving pre-existing working-tree changes.

- Renamed preserve_memory_invites to202610140003; SHA256 matches the former file exactly. R2140001 still precedes cleanup140002 and private-deletions160004. Added migration uniqueness/order regression to functions suite.
- CardScore opens four blank rows each time, still supports removing seats for two-player games. Finish persistence error is inside the confirmation, remains active on failure and supports retry.
- HeldMoneyLedger receives suspension and a distinct UID key. Lock resets/unmounts forms, menus and controlled delete confirmations; Android native date picker dismisses. Generation/owner and mounted guards reject stale saves/deletes/onClose, including lock/unlock and account changes. Native delete alerts replaced so private text follows the lock.
- Memory applies each successful remote item durably; catches upload/download errors per item while keeping failed pending intent/old originals. Lost-ack branch no longer removes an entry before its photo succeeds. Remaining items continue and status stays incomplete.
- Local orphan cleanup reads validated durable references in the UID queue, accepts only photo filenames, skips directories and all still-referenced files (including pending/conflict). Checks session before deletes; failures retry on subsequent sync. Remote objects and tombstones are unchanged.

## Verification

- Red reproductions: migration version collision; default-four/finish-error; photo isolation and orphan deletion. New finance suite initially needed native-module mocks corrected before behavioral checks.
- Final full Jest:96 suites,547 tests passed (`--watchman=false`). Includes FinanceScreen wiring, modal lock/reset, stale confirmation across lock/UID/unmount, delete-error retry under StrictMode, Android date dismissal, failed-photo isolation/retry, lost acknowledgement, durable cleanup, shared filename protection and account switch during pruning.
- Functions:84 tests passed, including migration filename uniqueness/order.
- Typecheck, ESLint affected TS/test files and migration test, git diff --check: passed.
- iOS/Android Expo export: passed, output `/tmp/lifemate-audit-export`.
- iOS Simulator: create-table form shows4/8 with four empty fields; closed without creating a match. Held-money blank creation form opened, app backgrounded and reopened: system authentication covers the screen and form is absent. No financial record was saved/deleted. Post-authentication unlock restoration was not manually verified. Screenshots `/tmp/lifemate-four-player-default.png`, `/tmp/lifemate-held-lock-after-background.png`.
- Read-only reviewer plan and final review completed. Follow-up verified distinct held component key after integration caught a sibling key collision; no remaining actionable findings. Reviewer did not run tests.

## Database and release limits

Production SQL Editor read-only `to_regclass('supabase_migrations.schema_migrations')` returned NULL. No existing row required repair; no history/schema mutation was made. CLI adoption still requires comparing all manually applied migrations to the real schema and baselining verified versions. See `docs/supabase-migration-history.md`.

Fresh PostgreSQL `db reset` unavailable: no Docker/psql and no local stack configuration. Filename/order tests do not substitute for a fresh database replay. No Firebase rules, Edge Function behavior or dependencies changed in this audit. No new TestFlight release, commit or push performed. Real-device filesystem cleanup failures remain covered by mocks rather than a physical-device test.
