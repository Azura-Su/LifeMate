import AsyncStorage from '@react-native-async-storage/async-storage';
import { AESEncryptionKey, AESSealedData, aesDecryptAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import {
  getEncryptedItem,
  setEncryptedItem,
  recoverEncryptedItems,
  hasEncryptedItemRecovery,
} from '../encryptedLocalStorage';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);

beforeEach(async () => {
  await AsyncStorage.clear();
});

it('refuses to replace a missing key while another encrypted cache of the account remains', async () => {
  const original = 'lifemate:finance:v1:missing-key-owner';
  const target = 'lifemate:finance:pending:v1:missing-key-owner';
  await setEncryptedItem(
    'missing-key-owner',
    original,
    'Offline financial record',
  );
  const preserved = await AsyncStorage.getItem(original);
  const generate = jest.spyOn(AESEncryptionKey, 'generate');
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);
  try {
    await expect(
      setEncryptedItem('missing-key-owner', target, '[]'),
    ).rejects.toThrow('Không tìm thấy khóa bảo vệ dữ liệu trên thiết bị.');
    expect(generate).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(original)).toBe(preserved);
    expect(await AsyncStorage.getItem(target)).toBeNull();
  } finally {
    generate.mockRestore();
  }
});

const recoveryKeys = (uid: string) =>
  [
    'finance',
    'finance:pending',
    'finance:pending-base',
    'finance:cloud-migration',
  ].map((name) => `lifemate:${name}:v1:${uid}`);

it('preserves the exact old bytes in an encrypted archive before rebuilding the live cache', async () => {
  const uid = 'recovery-owner';
  const keys = recoveryKeys(uid);
  await setEncryptedItem(uid, keys[0], 'Initial data');
  await AsyncStorage.setItem(keys[0], 'lifemate:aes-gcm:v1:corrupted');
  await AsyncStorage.setItem(keys[1], '["legacy offline draft"]');
  const originals = await Promise.all(
    keys.map((key) => AsyncStorage.getItem(key)),
  );
  const values = Object.fromEntries(
    keys.map((key, index) => [key, `cloud-${index}`]),
  );
  await recoverEncryptedItems(uid, 'finance', keys, values, () => undefined);

  const backups = (await AsyncStorage.getAllKeys()).filter((key) =>
    key.startsWith('lifemate:cache-recovery-backup:'),
  );
  expect(backups).toHaveLength(1);
  expect(await AsyncStorage.getItem(backups[0])).toMatch(
    /^lifemate:aes-gcm:v1:/,
  );
  const backup = JSON.parse((await getEncryptedItem(uid, backups[0]))!);
  expect(
    Object.fromEntries(
      backup.map((entry: { storageKey: string; previous: string | null }) => [
        entry.storageKey,
        entry.previous,
      ]),
    ),
  ).toEqual(
    Object.fromEntries(keys.map((key, index) => [key, originals[index]])),
  );
  for (const key of keys)
    expect(await getEncryptedItem(uid, key)).toBe(values[key]);
  expect(await hasEncryptedItemRecovery(uid, 'finance')).toBe(false);
});

it.each([0, 1, 2, 3])(
  'keeps a marker after live write %s fails and resumes the approved snapshot',
  async (failedIndex) => {
    const uid = `recovery-interrupted-${failedIndex}`;
    const keys = recoveryKeys(uid);
    await setEncryptedItem(uid, keys[0], 'Old data');
    const initial = await AsyncStorage.getItem(keys[0]);
    const values = Object.fromEntries(
      keys.map((key, index) => [key, `approved-${index}`]),
    );
    const write = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
    const setItem = jest
      .mocked(AsyncStorage.setItem)
      .mockImplementation(async (key, value) => {
        if (key === keys[failedIndex]) throw new Error('Disk full');
        return write(key, value);
      });
    try {
      await expect(
        recoverEncryptedItems(uid, 'finance', keys, values, () => undefined),
      ).rejects.toThrow('Disk full');
    } finally {
      setItem.mockImplementation(write);
    }
    expect(await hasEncryptedItemRecovery(uid, 'finance')).toBe(true);
    const backups = (await AsyncStorage.getAllKeys()).filter((key) =>
      key.startsWith('lifemate:cache-recovery-backup:'),
    );
    const backup = JSON.parse((await getEncryptedItem(uid, backups[0]))!);
    expect(
      backup.find(
        (entry: { storageKey: string }) => entry.storageKey === keys[0],
      ).previous,
    ).toBe(initial);
    await recoverEncryptedItems(
      uid,
      'finance',
      keys,
      Object.fromEntries(keys.map((key) => [key, 'not-approved'])),
      () => undefined,
    );
    for (const key of keys)
      expect(await getEncryptedItem(uid, key)).toBe(values[key]);
    expect(await hasEncryptedItemRecovery(uid, 'finance')).toBe(false);
    expect(
      (await AsyncStorage.getAllKeys()).filter((key) =>
        key.startsWith('lifemate:cache-recovery-backup:'),
      ),
    ).toEqual(backups);
  },
);

it('does not rewrite live data when verifying the backup fails', async () => {
  const uid = 'recovery-backup-error';
  const keys = recoveryKeys(uid);
  await setEncryptedItem(uid, keys[0], 'Local data');
  const original = await AsyncStorage.getItem(keys[0]);
  const read = jest.mocked(AsyncStorage.getItem).getMockImplementation()!;
  const getItem = jest
    .mocked(AsyncStorage.getItem)
    .mockImplementation(async (key) =>
      key.startsWith('lifemate:cache-recovery-backup:')
        ? 'wrong-backup'
        : read(key),
    );
  try {
    await expect(
      recoverEncryptedItems(
        uid,
        'finance',
        keys,
        Object.fromEntries(keys.map((key) => [key, 'Cloud'])),
        () => undefined,
      ),
    ).rejects.toThrow();
  } finally {
    getItem.mockImplementation(read);
  }
  expect(await AsyncStorage.getItem(keys[0])).toBe(original);
  expect(await hasEncryptedItemRecovery(uid, 'finance')).toBe(false);
});

it('keeps the marker when the account changes during live writes, then safely resumes', async () => {
  const uid = 'recovery-session-change';
  const keys = recoveryKeys(uid);
  await setEncryptedItem(uid, keys[0], 'Original');
  let active = true;
  const write = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
    await write(key, value);
    if (keys.includes(key)) active = false;
  });
  const assertCurrent = () => {
    if (!active) throw new Error('Session changed');
  };
  const values = Object.fromEntries(keys.map((key) => [key, 'Cloud']));
  try {
    await expect(
      recoverEncryptedItems(uid, 'finance', keys, values, assertCurrent),
    ).rejects.toThrow('Session changed');
  } finally {
    jest.mocked(AsyncStorage.setItem).mockImplementation(write);
  }
  expect(await hasEncryptedItemRecovery(uid, 'finance')).toBe(true);
  await recoverEncryptedItems(uid, 'finance', keys, values, () => undefined);
  expect(await hasEncryptedItemRecovery(uid, 'finance')).toBe(false);
});

it('refuses recovery without the existing key and leaves live bytes untouched', async () => {
  const uid = 'recovery-no-key';
  const keys = recoveryKeys(uid);
  await setEncryptedItem(uid, keys[0], 'Original');
  const original = await AsyncStorage.getItem(keys[0]);
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);
  await expect(
    recoverEncryptedItems(
      uid,
      'finance',
      keys,
      Object.fromEntries(keys.map((key) => [key, 'Cloud'])),
      () => undefined,
    ),
  ).rejects.toThrow('Không tìm thấy khóa');
  expect(await AsyncStorage.getItem(keys[0])).toBe(original);
  expect(await hasEncryptedItemRecovery(uid, 'finance')).toBe(false);
});

it('refuses a changed namespace whitelist when resuming a recovery', async () => {
  const uid = 'recovery-scope-change';
  const keys = recoveryKeys(uid);
  await setEncryptedItem(uid, keys[0], 'Original');
  const original = await AsyncStorage.getItem(keys[0]);
  const write = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
    if (key === [...keys].sort()[0]) throw new Error('Interrupted');
    return write(key, value);
  });
  try {
    await expect(
      recoverEncryptedItems(
        uid,
        'finance',
        keys,
        Object.fromEntries(keys.map((key) => [key, 'Cloud'])),
        () => undefined,
      ),
    ).rejects.toThrow('Interrupted');
  } finally {
    jest.mocked(AsyncStorage.setItem).mockImplementation(write);
  }
  const changedKeys = [keys[0], 'lifemate:notes:v1:' + uid, ...keys.slice(2)];
  await expect(
    recoverEncryptedItems(
      uid,
      'finance',
      changedKeys,
      Object.fromEntries(changedKeys.map((key) => [key, 'Cloud'])),
      () => undefined,
    ),
  ).rejects.toThrow('chưa hợp lệ');
  expect(await AsyncStorage.getItem(keys[0])).toBe(original);
  expect(await AsyncStorage.getItem(changedKeys[1])).toBeNull();
  expect(await hasEncryptedItemRecovery(uid, 'finance')).toBe(true);
});

it('rejects another account ciphertext even when copied into the current account cache', async () => {
  const aliceKey = 'lifemate:notes:v1:alice';
  const bobKey = 'lifemate:notes:v1:bob';
  await setEncryptedItem('alice', aliceKey, 'Alice private notes');
  await setEncryptedItem('bob', bobKey, 'Bob private notes');
  expect(await getEncryptedItem('alice', aliceKey)).toBe('Alice private notes');
  expect(await getEncryptedItem('bob', bobKey)).toBe('Bob private notes');
  await AsyncStorage.setItem(bobKey, (await AsyncStorage.getItem(aliceKey))!);
  await expect(getEncryptedItem('bob', bobKey)).rejects.toThrow();
  await expect(getEncryptedItem('bob', aliceKey)).rejects.toThrow();
  expect(await getEncryptedItem('alice', aliceKey)).toBe('Alice private notes');
});

it('binds encrypted data to its cache namespace as well as its owner', async () => {
  const source = 'lifemate:notes:v1:alice';
  const target = 'lifemate:finance:v1:alice';
  await setEncryptedItem('alice', source, 'Private note');
  await AsyncStorage.setItem(target, (await AsyncStorage.getItem(source))!);
  await expect(getEncryptedItem('alice', target)).rejects.toThrow();
});

it('reads existing Base64 ciphertext through the Android byte boundary without rewriting it', async () => {
  const key = 'lifemate:memories:v1:alice';
  const content = 'Ký ức 🌿 với gia đình';
  await setEncryptedItem('alice', key, content);
  const stored = await AsyncStorage.getItem(key);
  expect(stored).toMatch(/^lifemate:aes-gcm:v1:/);
  expect(await getEncryptedItem('alice', key)).toBe(content);
  expect(await AsyncStorage.getItem(key)).toBe(stored);
});

it('hides native payload errors and preserves unreadable ciphertext for recovery', async () => {
  const key = 'lifemate:memories:v1:alice';
  await setEncryptedItem('alice', key, 'Private memory');
  const stored = await AsyncStorage.getItem(key);
  jest
    .mocked(aesDecryptAsync)
    .mockRejectedValueOnce(new Error(`[decrypt] Cannot convert '${stored}'`));
  await expect(getEncryptedItem('alice', key)).rejects.toThrow(
    'Không đọc được dữ liệu đã mã hóa trên thiết bị.',
  );
  expect(await AsyncStorage.getItem(key)).toBe(stored);
  expect(await getEncryptedItem('alice', key)).toBe('Private memory');
});

it.each([
  ['AA==', [0]],
  ['/w==', [255]],
  ['+/8=', [251, 255]],
  ['AAECAwQF', [0, 1, 2, 3, 4, 5]],
])(
  'decodes binary Base64 %s exactly for native crypto',
  async (payload, bytes) => {
    const key = 'lifemate:memories:v1:alice';
    await setEncryptedItem('alice', key, 'Initialize key');
    await AsyncStorage.setItem(key, `lifemate:aes-gcm:v1:${payload}`);
    const parse = jest.spyOn(AESSealedData, 'fromCombined');
    jest
      .mocked(aesDecryptAsync)
      .mockResolvedValueOnce(new TextEncoder().encode('Read'));
    try {
      expect(await getEncryptedItem('alice', key)).toBe('Read');
      expect(parse).toHaveBeenCalledWith(Uint8Array.from(bytes));
    } finally {
      parse.mockRestore();
    }
  },
);

it.each(['', 'not-base64!', 'AA=', 'AAAA='])(
  'preserves malformed cache %s with a safe error',
  async (payload) => {
    const key = 'lifemate:memories:v1:alice';
    await setEncryptedItem('alice', key, 'Initialize key');
    const stored = `lifemate:aes-gcm:v1:${payload}`;
    await AsyncStorage.setItem(key, stored);
    await expect(getEncryptedItem('alice', key)).rejects.toThrow(
      'Không đọc được dữ liệu đã mã hóa trên thiết bị.',
    );
    expect(await AsyncStorage.getItem(key)).toBe(stored);
  },
);
