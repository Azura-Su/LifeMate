import { createFirebaseIdentityVerifier } from '../memory-access/firebaseIdentity.mjs';
import { createGoogleAdmin } from '../user-admin/google.mjs';
import { createPetBackend } from './backend.mjs';
import { createPetHandler } from './handler.mjs';

const google = createGoogleAdmin(
  Deno.env.get('FIREBASE_ADMIN_SERVICE_ACCOUNT'),
  Deno.env.get('FIREBASE_STORAGE_BUCKET'),
);
// RPCs re-check account status and auth_time inside their own transaction.
Deno.serve(
  createPetHandler({
    verifyIdentity: createFirebaseIdentityVerifier('baseapp-dd227'),
    rpc: createPetBackend(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    ),
    listTransactions: google.listFinanceTransactions,
  }),
);
