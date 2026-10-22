import { createGameDeviceSessionIdLoader } from '../gameDeviceSession';

const id = '11111111-1111-4111-8111-111111111111';

function memoryStore(initial: string | null = null) {
  let value = initial;
  return {
    getItemAsync: jest.fn(async () => value),
    setItemAsync: jest.fn(async (_key: string, next: string) => {
      value = next;
    }),
    get value() {
      return value;
    },
  };
}

it('reuses one device ID concurrently and after a new loader is created', async () => {
  const storage = memoryStore();
  const createId = jest.fn(() => id);
  const load = createGameDeviceSessionIdLoader(storage, createId);

  const [first, concurrent] = await Promise.all([load(), load()]);
  expect(first).toBe(id);
  expect(concurrent).toBe(id);
  expect(storage.value).toBe(id);
  expect(createId).toHaveBeenCalledTimes(1);
  expect(storage.setItemAsync).toHaveBeenCalledWith(
    'lifemate.card-games.device-session.v1',
    id,
    expect.objectContaining({
      keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    }),
  );

  const afterRestart = createGameDeviceSessionIdLoader(
    storage,
    jest.fn(() => '22222222-2222-4222-8222-222222222222'),
  );
  expect(await afterRestart()).toBe(id);
});

it('replaces malformed persisted IDs', async () => {
  const storage = memoryStore('not-a-uuid');
  const load = createGameDeviceSessionIdLoader(storage, () => id);

  expect(await load()).toBe(id);
  expect(storage.value).toBe(id);
});

it('can retry when secure storage temporarily fails', async () => {
  const storage = memoryStore();
  storage.getItemAsync
    .mockRejectedValueOnce(new Error('storage unavailable'))
    .mockResolvedValueOnce(null);
  const load = createGameDeviceSessionIdLoader(storage, () => id);

  await expect(load()).rejects.toThrow('storage unavailable');
  expect(await load()).toBe(id);
});

it('does not use an ID that could not be persisted', async () => {
  const storage = memoryStore();
  storage.setItemAsync
    .mockRejectedValueOnce(new Error('storage unavailable'))
    .mockResolvedValueOnce(undefined);
  const load = createGameDeviceSessionIdLoader(storage, () => id);

  await expect(load()).rejects.toThrow('storage unavailable');
  expect(await load()).toBe(id);
  expect(storage.setItemAsync).toHaveBeenCalledTimes(2);
});
