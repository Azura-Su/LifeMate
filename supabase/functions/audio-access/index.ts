import { createFirebaseVerifier } from './firebaseAuth.mjs';
import { createHandler } from './handler.mjs';
import { createStorageSigner } from './storage.mjs';

Deno.serve(createHandler({
  verifyToken: createFirebaseVerifier('baseapp-dd227'),
  signObject: createStorageSigner(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  ),
}));
