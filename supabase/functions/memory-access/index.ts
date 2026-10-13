import { createMemoryBackend } from './backend.mjs';
import { createFirebaseIdentityVerifier } from './firebaseIdentity.mjs';
import { createHandler } from './handler.mjs';

Deno.serve(
  createHandler({
    verifyIdentity: createFirebaseIdentityVerifier('baseapp-dd227'),
    ...createMemoryBackend(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    ),
  }),
);
