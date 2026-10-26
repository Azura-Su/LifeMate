import { createHash } from 'node:crypto';
import { digestStringAsync } from 'expo-crypto';
import {
  getDocFromServer,
  onSnapshot,
  runTransaction,
} from '@react-native-firebase/firestore';
import { useAuthStore } from '../../../store/authStore';
import { readCloudPet, commitCloudPet, subscribeCloudPet } from '../petCloud';
import { generatePetDNA, petDNAHash, petAppearanceHash } from '../petGenetics';
import type { PetMutation } from '../../../types/pet';
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);
const mockAuth = {
  currentUser: { uid: 'cloud-pet' } as { uid: string } | null,
};
jest.mock('@react-native-firebase/auth', () => ({ getAuth: () => mockAuth }));
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: jest.fn((_db, ...path) => path.join('/')),
  getDocFromServer: jest.fn(),
  runTransaction: jest.fn(),
  onSnapshot: jest.fn(),
}));
beforeEach(() => {
  mockAuth.currentUser = { uid: 'cloud-pet' };
  useAuthStore.getState().setUser({
    uid: 'cloud-pet',
    email: 'pet@example.invalid',
    displayName: 'Pet',
  });
  jest
    .mocked(digestStringAsync)
    .mockImplementation(async (_algorithm, value) =>
      createHash('sha256').update(value).digest('hex'),
    );
});
it('encodes transactions at the fixed singleton path and retries an acknowledged operation without another write', async () => {
  const uid = 'cloud-pet',
    epoch = useAuthStore.getState().sessionEpoch;
  const dna = await generatePetDNA(['cat', 'owl'], '1'.repeat(32));
  const input: PetMutation = {
    type: 'create',
    operationId: 'create-one',
    baseRevision: 0,
    nextRevision: 1,
    targetPetId: 'one',
    pet: {
      petId: 'one',
      ownerId: uid,
      name: 'Mây',
      dna,
      dnaHash: await petDNAHash(dna),
      appearanceHash: await petAppearanceHash(dna),
      createdAt: 1,
      updatedAt: 1,
    },
  };
  let wire: unknown = null;
  const get = jest.fn(async () => ({
    exists: () => wire !== null,
    data: () => wire,
  }));
  const set = jest.fn((_ref, data) => {
    wire = data;
  });
  jest
    .mocked(runTransaction)
    .mockImplementation(async (_db, callback) =>
      callback({ get, set } as never),
    );
  const first = await commitCloudPet(uid, epoch, input);
  expect(get).toHaveBeenCalledWith('petAccounts/cloud-pet/state/current');
  expect(wire).toMatchObject({
    wireVersion: 1,
    revision: 1,
    pet: {
      dna: {
        parts: { wings: expect.stringMatching(/^owl:[012]$/) },
        shape: expect.any(Number),
      },
    },
  });
  expect(await commitCloudPet(uid, epoch, input)).toEqual(first);
  expect(set).toHaveBeenCalledTimes(1);
});
it('fences a server read and transaction after an account switch', async () => {
  const uid = 'cloud-pet',
    epoch = useAuthStore.getState().sessionEpoch;
  let finish!: (value: never) => void;
  jest.mocked(getDocFromServer).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = readCloudPet(uid, epoch);
  useAuthStore.getState().setUser(null);
  await Promise.resolve();
  finish({ exists: () => false } as never);
  await expect(pending).rejects.toThrow(/Phiên/);
  await expect(commitCloudPet(uid, epoch, {} as never)).rejects.toThrow(
    /Phiên/,
  );
});
it('does not interpret cached absence or local writes as an authoritative free slot', () => {
  const values = jest.fn(),
    errors = jest.fn();
  let receive!: (snapshot: unknown) => void;
  jest
    .mocked(onSnapshot)
    .mockImplementationOnce(
      (_ref: unknown, _options: unknown, callback: unknown) => {
        receive = callback as typeof receive;
        return jest.fn();
      },
    );
  subscribeCloudPet(
    'cloud-pet',
    useAuthStore.getState().sessionEpoch,
    values,
    errors,
  );
  const snapshot = (fromCache: boolean, hasPendingWrites: boolean) => ({
    metadata: { fromCache, hasPendingWrites },
    exists: () => false,
  });
  receive(snapshot(true, false));
  receive(snapshot(false, true));
  expect(values).not.toHaveBeenCalled();
  receive(snapshot(false, false));
  expect(values).toHaveBeenCalledWith(null);
  mockAuth.currentUser = null;
  receive(snapshot(false, false));
  expect(values).toHaveBeenCalledTimes(1);
  expect(errors).toHaveBeenCalledTimes(1);
});
