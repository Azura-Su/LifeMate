import { createAvatarStorage } from '../profile-access/storage.mjs';
import { createMemoryBackend } from '../memory-access/backend.mjs';
import { createFirebaseIdentityVerifier } from '../memory-access/firebaseIdentity.mjs';
import { createAccounts } from './accounts.mjs';
import { createGoogleAdmin } from './google.mjs';
import { createAdminHandler } from './handler.mjs';
import { createObjectCleanup } from './objects.mjs';
import { createR2Cleanup } from './r2Cleanup.mjs';
import { createGameBackend } from '../game-access/backend.mjs';
import { createPetBackend } from '../pet-access/backend.mjs';
import { createPetAdmin } from './pets.mjs';

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const google = createGoogleAdmin(
  Deno.env.get('FIREBASE_ADMIN_SERVICE_ACCOUNT'),
  Deno.env.get('FIREBASE_STORAGE_BUCKET'),
);
const { database } = createMemoryBackend(url, serviceKey);
const accounts = createAccounts({
  database,
  google,
  clearGames: (uid: string) =>
    createGameBackend(url, serviceKey)('lifemate_game_erase_account', {
      p_uid: uid,
    }),
  clearPets: (uid: string) =>
    createPetBackend(url, serviceKey)('lifemate_pet_erase_account', {
      p_uid: uid,
    }),
  clearObjects: createObjectCleanup({
    url,
    serviceKey,
    r2: createR2Cleanup({
      accountId: Deno.env.get('R2_ACCOUNT_ID'),
      bucket: Deno.env.get('R2_BUCKET'),
      accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID'),
      secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY'),
    }),
  }),
});
Deno.serve(
  createAdminHandler({
    verifyIdentity: createFirebaseIdentityVerifier('baseapp-dd227'),
    google,
    pets: createPetAdmin({
      rpc: createPetBackend(url, serviceKey),
      lookupMany: google.lookupMany,
    }),
    accounts,
    sweep: accounts.sweep,
    readAvatar: (path: string) =>
      createAvatarStorage({ url, serviceKey })('read', path),
    workerSecret: Deno.env.get('USER_CLEANUP_SECRET'),
  }),
);
