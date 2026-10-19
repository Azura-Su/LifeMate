import { createFirebaseIdentityVerifier } from '../memory-access/firebaseIdentity.mjs';
import { createGoogleAdmin } from '../user-admin/google.mjs';
import { createGameBackend } from './backend.mjs';
import { createGameHandler } from './handler.mjs';
import { ensureRealtimeRole } from './realtimeIdentity.mjs';
import { createGameWorker } from './worker.mjs';

const rpc = createGameBackend(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
);
const google = createGoogleAdmin(
  Deno.env.get('FIREBASE_ADMIN_SERVICE_ACCOUNT'),
  Deno.env.get('FIREBASE_STORAGE_BUCKET'),
);
// RPCs perform the live account/status/auth_time check inside their transaction;
// a preflight-only access check would leave an administrative revocation race.
Deno.serve(
  createGameHandler({
    verifyIdentity: createFirebaseIdentityVerifier('baseapp-dd227'),
    rpc,
    grantRealtime: (identity: { uid: string; authTime: number }) =>
      ensureRealtimeRole(identity, google),
    tick: createGameWorker(rpc),
    workerSecret: Deno.env.get('GAME_WORKER_SECRET'),
  }),
);
