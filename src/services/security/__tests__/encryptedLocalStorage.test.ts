import AsyncStorage from '@react-native-async-storage/async-storage';
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
