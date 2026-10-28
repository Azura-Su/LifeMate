import { getAuth, getIdToken } from '@react-native-firebase/auth';
import {
  callPixelPet,
  invalidateOwnedPixelPet,
  readOwnedPixelPet,
} from '../pixelPetApi';
import { useAuthStore } from '../../../store/authStore';
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(),
  getIdToken: jest.fn(),
}));
jest.mock('../../../config/audioCloud', () => ({
  audioCloudUrl: () => 'https://example.test',
  audioCloudApiKey: () => 'key',
}));
const originalFetch = global.fetch;
const empty = {
  status: 'none',
  rollsLeft: 2,
  restoresLeft: 0,
  pet: null,
  reservation: null,
  availability: { total: 15, owned: 0, reserved: 0 },
  now: 1,
};
const owned = {
  ...empty,
  status: 'owned',
  pet: {
    speciesId: 'phoenix',
    adoptionId: 'old',
    totalExp: 5,
    level: 1,
    stage: 'hatchling',
  },
};
beforeEach(() => {
  useAuthStore.getState().setUser({ uid: 'u', email: null, displayName: null });
  jest
    .mocked(getAuth)
    .mockImplementation(
      () => ({ currentUser: useAuthStore.getState().user }) as never,
    );
  jest.mocked(getIdToken).mockResolvedValue('token');
  invalidateOwnedPixelPet('u');
});
afterEach(() => {
  global.fetch = originalFetch;
});
it('a delayed owned response cannot overwrite a newer revoked state in shared cache', async () => {
  let release!: (value: unknown) => void;
  global.fetch = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          release = r;
        }),
    )
    .mockResolvedValueOnce({ ok: true, json: async () => empty });
  const old = callPixelPet('u', { type: 'state' });
  await Promise.resolve();
  await Promise.resolve();
  await callPixelPet('u', { type: 'state' });
  release({ ok: true, json: async () => owned });
  await old;
  expect(readOwnedPixelPet('u')).toBeNull();
});
it('self-revoke invalidates in-flight cache writes and same-UID relogin rejects the old session', async () => {
  let release!: (value: unknown) => void;
  global.fetch = jest.fn().mockImplementation(
    () =>
      new Promise((r) => {
        release = r;
      }),
  );
  const old = callPixelPet('u', { type: 'state' });
  await Promise.resolve();
  await Promise.resolve();
  invalidateOwnedPixelPet('u');
  useAuthStore.getState().setUser(null);
  useAuthStore.getState().setUser({ uid: 'u', email: null, displayName: null });
  const rejected = expect(old).rejects.toThrow('Phiên đăng nhập');
  release({ ok: true, json: async () => owned });
  await rejected;
  expect(readOwnedPixelPet('u')).toBeNull();
});
