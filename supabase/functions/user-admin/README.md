# LifeMate user administration

Admin: `su.azura99@gmail.com` and pinned Firebase UID `CQmmT9iJvKPP79UZqYbvmZ3gXZQ2`. Both signed token claims and live Firebase user must match, be verified/enabled, and pass the session revocation cutoff. Update frontend config and backend constants together if the account is deliberately replaced.

## Deployment

1. Apply `supabase/migrations/202610160001_user_management.sql` using the authenticated Management API/SQL editor. Tables and claim RPC are service-role only. Never expose them through a client policy.
2. Google service account `lifemate-user-admin@baseapp-dd227.iam.gserviceaccount.com` has custom role `projects/baseapp-dd227/roles/lifeMateUserAdmin`: `firebaseauth.users.get/update/delete`, `datastore.entities.get/list/create/update/delete`, `storage.objects.list/delete`. It cannot create Auth users or upload Storage objects. Do not grant Owner/Editor.
3. Set server secrets `FIREBASE_ADMIN_SERVICE_ACCOUNT` (JSON), `FIREBASE_STORAGE_BUCKET=baseapp-dd227.appspot.com`, `USER_CLEANUP_SECRET` (random 32 bytes). Reuse existing Supabase service role and R2 secrets. Put the same cleanup secret in Vault named `lifemate_user_cleanup_secret`. Secret files stay outside Git with mode 0600 and are removed after installation.
4. Deploy `user-admin`, `audio-access`, `memory-access`. Firebase JWT verification is inside each handler; Supabase gateway verification is disabled in config because these are Firebase tokens.
5. Deploy Firestore and Storage rules together. Cross-service Storage rules require the Firebase Storage service agent to read Firestore; check this if legacy Storage requests fail after deployment.

## Operations and deletion

`list`, exact-email/UID `search`, `detail`, `disable`, `enable`, `delete`, `jobs` require admin. Public `status` reveals only active/disabled/deleting/deleted for a supplied UID, for recovery after invalidation of offline sessions. `sweep` requires the separate cron secret, not an admin token.

Persist intent before touching providers. `blocking` means the provider mirror/Auth revocation still needs reconciliation; do not report it as completed. Five-minute atomic leases serialize transitions. Deleted/deleting states cannot be enabled. Failed jobs back off five minutes; a cron checks due work each minute. No UI needs to remain open for cleanup to continue.

Deletion blocks immediately, sweeps objects, waits eight days for legacy GCS resumable sessions, then sweeps again before deleting owned Firestore leaf collections, Supabase profile/cascaded social data, addressed email invites, upload reservations, and finally Auth. Completed tombstones retain only UID/status/cutoff/timing; daily sweeps remove late orphans. Do not remove deny tombstones. See `SPEC-user-management.md` for the exact device-copy limitation.

When adding a persisted feature, update the deletion inventory in `google.mjs`, `objects.mjs`, and client cleanup before shipping it. Current Firestore descendants are known leaf collections, including children of nonexistent UID parents.

Inspect `lifemate_account_access.phase/next_run` and cron execution history to investigate retries. Do not log secrets, tokens, user document bodies, or raw upstream responses. Rotate the Google key by installing the new server secret before deleting the old IAM key; rotate Vault/Edge cron secrets together. Disable the cron and remove the service-account role binding to stop background destructive operations during an incident.

## Verification 2026-10-16

- 453 app tests passed; 46 function tests passed; TypeScript and affected-file ESLint passed.
- Firestore and Storage emulator tests passed, including disabled/deleting/deleted access and the active-account revocation cutoff.
- Plan and final independent review completed; findings fixed.
- Live deployment completed. Read-only probes verified service-account Auth lookup/list, status 200, unauthenticated list 401, one active cron and matching Vault secret presence. No real user was locked/deleted as a test.
- The existing Firebase Storage service agent has `roles/firebaserules.firestoreServiceAgent` (`datastore.entities.get`) for the cross-service status check. Firebase CLI skips this setup in noninteractive mode; it was configured and verified separately.
- Simulator with the real admin session loaded both users, searched email successfully, and showed the protected-admin detail state. Mutating actions were verified in automated tests.
