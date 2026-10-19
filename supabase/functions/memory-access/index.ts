import { createMemoryBackend } from './backend.mjs';
import { createFirebaseIdentityVerifier } from './firebaseIdentity.mjs';
import { createHandler } from './handler.mjs';
import { createR2Storage } from './r2.mjs';
import { withAccountAccess } from '../_shared/accountAccess.mjs';

const backend = createMemoryBackend(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
);

Deno.serve(
  createHandler({
    verifyIdentity: withAccountAccess(
      createFirebaseIdentityVerifier('baseapp-dd227'),
      backend.database,
      true,
    ),
    ...backend,
    r2: createR2Storage({
      accountId: Deno.env.get('R2_ACCOUNT_ID'),
      bucket: Deno.env.get('R2_BUCKET'),
      accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID'),
      secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY'),
    }),
  }),
);
