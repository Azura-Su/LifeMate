import { createFirebaseVerifier } from '../audio-access/firebaseAuth.mjs';
import { withAccountAccess } from '../_shared/accountAccess.mjs';
import { createMemoryBackend } from '../memory-access/backend.mjs';
import { createProfileHandler } from './handler.mjs';
import { createAvatarStorage } from './storage.mjs';
const url = Deno.env.get('SUPABASE_URL'),
  serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
Deno.serve(
  createProfileHandler({
    verifyIdentity: withAccountAccess(
      createFirebaseVerifier('baseapp-dd227', undefined, true),
      createMemoryBackend(url, serviceKey).database,
      true,
    ),
    storage: createAvatarStorage({ url, serviceKey }),
  }),
);
