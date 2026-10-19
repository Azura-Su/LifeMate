import AsyncStorage from '@react-native-async-storage/async-storage';
import { AESSealedData, aesDecryptAsync } from 'expo-crypto';
import { getEncryptedItem, setEncryptedItem } from '../encryptedLocalStorage';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);

beforeEach(async () => {
  await AsyncStorage.clear();
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
