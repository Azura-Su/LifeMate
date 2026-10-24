# Preserve Phỏm options against legacy rule edits

## Defect

Protocol 6 can submit ten-rate `set-phom-rules` against a room with current or pending protocol 7 options. The old SQL RPC persists the edit before the Edge snapshot capability check, silently removing pending Tái/Gửi/Ù đền.

## Plan

- [x] Inspect the handler, deployed RPC, migrations and existing database tests.
- [x] Independent read-only plan review: approved; preserve receipt recovery and service-only access.
- [x] Add regressions proving rejected edits leave room state, version, readiness, leases, receipts and broadcasts unchanged.
- [x] Add a mandatory client-version RPC overload; check current, pending and incoming options under the room lock before mutation. Pass the actual client version from Edge.
- [x] Keep the nine-argument RPC as a conservative compatibility wrapper: explicit options payload uses capability 7, ten-rate payload uses 6. Existing Edge validates incoming options require 7.
- [x] Verify legacy rooms, valid v7 edits, replay, stale requests, both signatures and privileges; run function regression suite.
- [x] Independent final diff review, then deploy migration and Edge with source readback and rollback-only database verification.

No current match configuration, score, frontend or data normalization changes are required.

## Evidence

- RED: current-options request returned409 but changed state/version/lease/receipt; pending-options request returned200 and removed options. Both now deny before mutation.
- Targeted3 tests passed, full263 backend tests passed. Node syntax, affected ESLint and diff whitespace passed.
- Read-only reviewer approved plan and final diff, no remaining P1/P2.
- Production migration `20261023163323_phom_rules_capability_guard` applied before game-accessv15, ACTIVE. Source readback matches all18 payload files; only handler changed fromv14.
- Unauthenticated HTTP probe returns401 `invalid-session`. Sandbox DNS failed initially; the same probe outside the sandbox succeeded.
- PostgreSQL rollback fixture tested current/pending/incoming denials, unchanged room/seats/receipts, legacyv6 and validv7 writes, old signature compatibility, cross-capability receipt recovery and service-only ACL. Probe rooms/seats/receipts all0; modeopen and deadline cronactive.
- Advisors unchanged:19 INFO service-only RLS tables without policies;1 WARN intentional authenticated subscribe security-definer. No new advisory. Existing advisory reference: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Backups, payload, RED/GREEN logs and rollback SQL: `/private/tmp/lifemate-phom-capability-fix-20261023`. CLI draft renamed to connector timestamp; SQL identical. No frontend release, commit or push.
