import { createFirebaseVerifier } from './firebaseAuth.mjs';
import { createHandler } from './handler.mjs';
import { createStorageSigner } from './storage.mjs';
import { createAudioQuota } from './quota.mjs';

const quota = createAudioQuota(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
);

Deno.serve(
  createHandler({
    verifyToken: createFirebaseVerifier('baseapp-dd227'),
    ...quota,
    signObject: createStorageSigner(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    ),
  }),
);
