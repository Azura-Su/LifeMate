import { createHash } from 'node:crypto';
import { digestStringAsync } from 'expo-crypto';
import { useAuthStore } from '../../../store/authStore';
import { generatePetDNA, petAppearanceHash, petDNAHash } from '../petGenetics';
import {
  readPetCache,
  enqueuePetMutation,
  reconcilePetSlot,
} from '../petStorage';
import { applyPetMutation } from '../petSlot';
import type { PetRecord } from '../../../types/pet';
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);
beforeEach(() => {
  useAuthStore.getState().setUser({
    uid: 'pet-storage',
    email: 'pet@example.invalid',
    displayName: 'Pet',
  });
  jest
    .mocked(digestStringAsync)
    .mockImplementation(async (_a, v) =>
      createHash('sha256').update(v).digest('hex'),
    );
});
it('durably queues one offline draft, acknowledges it, deletes and fences old actions', async () => {
  const uid = 'pet-storage',
    epoch = useAuthStore.getState().sessionEpoch;
  const dna = await generatePetDNA(['rabbit'], '1'.repeat(32));
  const pet: PetRecord = {
    petId: 'rabbit-1',
    ownerId: uid,
    name: 'Mây',
    dna,
    dnaHash: await petDNAHash(dna),
    appearanceHash: await petAppearanceHash(dna),
    createdAt: 1,
    updatedAt: 1,
  };
  const queued = await enqueuePetMutation(uid, epoch, {
    type: 'create',
    pet,
    operationId: 'create-1',
  });
  expect((await readPetCache(uid, epoch)).pending).toEqual(queued.pending);
  await expect(
    enqueuePetMutation(uid, epoch, {
      type: 'create',
      pet,
      operationId: 'create-2',
    }),
  ).rejects.toThrow();
  const committed = applyPetMutation(uid, null, queued.pending!, 2);
  const synced = await reconcilePetSlot(uid, epoch, committed);
  expect(synced.pending).toBeNull();
  expect(synced.draft).toBeNull();
  const deleting = await enqueuePetMutation(uid, epoch, {
    type: 'delete',
    targetPetId: pet.petId,
    operationId: 'delete-1',
  });
  const empty = applyPetMutation(uid, committed, deleting.pending!, 3);
  const cleared = await reconcilePetSlot(uid, epoch, empty);
  expect(cleared.slot!.pet).toBeNull();
  expect(cleared.pending).toBeNull();
  // An older listener response cannot restore the deleted pet.
  expect((await reconcilePetSlot(uid, epoch, committed)).slot).toEqual(empty);
});
it('discards a potentially committed draft when another device already deleted it after a lost create ACK', async () => {
  const uid = 'lost-create',
    dna = await generatePetDNA(['cat'], '2'.repeat(32));
  useAuthStore
    .getState()
    .setUser({ uid, email: 'lost@example.invalid', displayName: 'Lost' });
  const epoch = useAuthStore.getState().sessionEpoch;
  const pet: PetRecord = {
    petId: 'lost-pet',
    ownerId: uid,
    name: 'Mây',
    dna,
    dnaHash: await petDNAHash(dna),
    appearanceHash: await petAppearanceHash(dna),
    createdAt: 1,
    updatedAt: 1,
  };
  const queued = await enqueuePetMutation(uid, epoch, {
    type: 'create',
    pet,
    operationId: 'lost-create',
  });
  const committed = applyPetMutation(uid, null, queued.pending!, 2);
  const deleted = applyPetMutation(
    uid,
    committed,
    {
      type: 'delete',
      operationId: 'other-device-delete',
      targetPetId: pet.petId,
      baseRevision: 1,
      nextRevision: 2,
      pet: null,
    },
    3,
  );
  const result = await reconcilePetSlot(uid, epoch, deleted);
  expect(result.pending).toBeNull();
  expect(result.slot?.pet).toBeNull();
  expect(result.draft).toBeNull();
});
it('rejects callbacks from an earlier account epoch even after signing into the same UID', async () => {
  const epoch = useAuthStore.getState().sessionEpoch;
  useAuthStore.getState().setUser(null);
  useAuthStore.getState().setUser({
    uid: 'pet-storage',
    email: 'pet@example.invalid',
    displayName: 'Pet',
  });
  await expect(readPetCache('pet-storage', epoch)).rejects.toThrow();
});
