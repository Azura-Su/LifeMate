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
  jest.useRealTimers();
});

it.each(['token', 'fetch', 'json'] as const)(
  'settles a stalled %s request and ignores its late response',
  async (stage) => {
    jest.useFakeTimers();
    let release!: () => void;
    if (stage === 'token')
      jest.mocked(getIdToken).mockReturnValueOnce(
        new Promise((resolve) => {
          release = () => resolve('late-token');
        }),
      );
    global.fetch = jest.fn().mockImplementation(() =>
      stage === 'fetch'
        ? new Promise((resolve) => {
            release = () => resolve({ ok: true, json: async () => owned });
          })
        : Promise.resolve({
            ok: true,
            json: () =>
              stage === 'json'
                ? new Promise((resolve) => {
                    release = () => resolve(owned);
                  })
                : Promise.resolve(owned),
          }),
    );
    const result = callPixelPet('u', {
      type: 'care',
      actionId: 'stable-action',
    }).catch((error: Error) => error.message);
    await jest.advanceTimersByTimeAsync(25001);
    expect(await Promise.race([result, Promise.resolve('still pending')])).toBe(
      'Yêu cầu linh thú quá lâu. Hãy tải lại để kiểm tra trạng thái.',
    );
    expect(readOwnedPixelPet('u')).toBeNull();
    const request = jest.mocked(global.fetch).mock.calls[0]?.[1];
    if (request) expect(request.signal?.aborted).toBe(true);
    release();
    await jest.advanceTimersByTimeAsync(0);
    expect(readOwnedPixelPet('u')).toBeNull();
  },
);

it('retries a transient network failure with the same action ID', async () => {
  global.fetch = jest
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ ok: true, json: async () => empty });
  await callPixelPet('u', { type: 'care', actionId: 'stable-action' });
  expect(
    jest
      .mocked(global.fetch)
      .mock.calls.map(([, input]) => JSON.parse(String(input?.body)).actionId),
  ).toEqual(['stable-action', 'stable-action']);
});
it('cancels a stalled request immediately on same-UID relogin', async () => {
  jest.useFakeTimers();
  let release!: (value: unknown) => void;
  global.fetch = jest.fn().mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const result = callPixelPet('u', { type: 'state' }).catch(
    (error: Error) => error.message,
  );
  await jest.advanceTimersByTimeAsync(0);
  useAuthStore.getState().setUser(null);
  useAuthStore.getState().setUser({ uid: 'u', email: null, displayName: null });
  await jest.advanceTimersByTimeAsync(0);
  expect(await Promise.race([result, Promise.resolve('still pending')])).toBe(
    'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.',
  );
  expect(jest.mocked(global.fetch).mock.calls[0][1]?.signal?.aborted).toBe(
    true,
  );
  release({ ok: true, json: async () => owned });
  await jest.advanceTimersByTimeAsync(0);
  expect(readOwnedPixelPet('u')).toBeNull();
  expect(jest.getTimerCount()).toBe(0);
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
