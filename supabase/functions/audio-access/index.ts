import { createFirebaseVerifier } from './firebaseAuth.mjs';
import { createHandler } from './handler.mjs';
import { createStorageSigner } from './storage.mjs';
import { createAudioQuota } from './quota.mjs';
import { withAccountAccess } from '../_shared/accountAccess.mjs';
import { createMemoryBackend } from '../memory-access/backend.mjs';

const quota = createAudioQuota(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
);

Deno.serve(
  createHandler({
    verifyToken: withAccountAccess(
      createFirebaseVerifier('baseapp-dd227', undefined, true),
      createMemoryBackend(
        Deno.env.get('SUPABASE_URL'),
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      ).database,
      true,
      true,
    ),
    ...quota,
    signObject: createStorageSigner(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    ),
  }),
);
