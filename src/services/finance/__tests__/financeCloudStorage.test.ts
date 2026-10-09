import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  deleteDoc,
  getDocsFromServer,
  setDoc,
  updateDoc,
} from '@react-native-firebase/firestore';
import {
  addFinanceTransaction,
  deleteFinanceTransaction,
  financeStorageKey,
  readFinanceData,
  readFinanceTransactions,
  resetFinanceCloudState,
  updateFinanceTransaction,
} from '../financeStorage';
import type { FinanceTransaction } from '../../../types/finance';
import { setEncryptedItem } from '../../security/encryptedLocalStorage';
import {
  getFirestoreMockRows,
  resetFirestoreMock,
  seedFirestoreMock,
} from '../../../testing/firestoreMock';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);
jest.mock('@react-native-firebase/firestore', () =>
  jest.requireActual('../../../testing/firestoreMock'),
);

const row: FinanceTransaction = {
  id: 'salary-1',
  ownerId: 'u1',
  type: 'income',
  amount: 25000000,
  category: 'Lương',
  note: 'Tháng 10',
  createdAt: 1791432000000,
};

beforeEach(async () => {
  resetFinanceCloudState();
  await AsyncStorage.clear();
  resetFirestoreMock();
  jest.clearAllMocks();
});

afterEach(() => jest.useRealTimers());

it('restores account transactions from Firestore without a device cache', async () => {
  seedFirestoreMock('u1', row);

  const result = await readFinanceData('u1');

  expect(result).toEqual({ transactions: [row], synced: true });
  expect(await readFinanceTransactions('u1')).toEqual([row]);
});

it('never reads another account path', async () => {
  seedFirestoreMock('u2', { ...row, id: 'other', ownerId: 'u2' });

  await expect(readFinanceData('u1')).resolves.toEqual({
    transactions: [],
    synced: true,
  });
  await expect(readFinanceData('u2')).resolves.toMatchObject({
    transactions: [{ ownerId: 'u2', id: 'other' }],
    synced: true,
  });
});

it('migrates existing local transactions to the matching account once', async () => {
  await AsyncStorage.setItem(financeStorageKey('u1'), JSON.stringify([row]));

  const result = await readFinanceData('u1');

  expect(result).toEqual({ transactions: [row], synced: true });
  expect(getFirestoreMockRows('u1')).toEqual([row]);
  expect(getFirestoreMockRows('u2')).toEqual([]);

  const updated = { ...row, note: 'Cloud version' };
  seedFirestoreMock('u1', updated);
  await expect(readFinanceData('u1')).resolves.toEqual({
    transactions: [updated],
    synced: true,
  });
});

it('keeps local transactions visible and marks them unsynced when cloud is offline', async () => {
  await AsyncStorage.setItem(financeStorageKey('u1'), JSON.stringify([row]));
  jest.mocked(getDocsFromServer).mockRejectedValueOnce(new Error('Offline'));

  await expect(readFinanceData('u1')).resolves.toEqual({
    transactions: [row],
    synced: false,
  });
});

it('loads cloud transactions when the encrypted local cache cannot be read', async () => {
  const remote = { ...row, id: 'cloud-1', note: 'Cloud copy' };
  await setEncryptedItem('u1', financeStorageKey('u1'), JSON.stringify([row]));
  const encryptedCache = await AsyncStorage.getItem(financeStorageKey('u1'));
  seedFirestoreMock('u1', remote);
  jest
    .mocked(SecureStore.getItemAsync)
    .mockRejectedValueOnce(new Error('Keychain access failed'));

  await expect(readFinanceData('u1')).resolves.toEqual({
    transactions: [remote],
    synced: false,
    cacheNeedsRecovery: true,
  });
  expect(await AsyncStorage.getItem(financeStorageKey('u1'))).toBe(
    encryptedCache,
  );
  expect(getFirestoreMockRows('u1')).toEqual([remote]);
});

it('keeps online edits available while preserving an unreadable local cache', async () => {
  await setEncryptedItem('u1', financeStorageKey('u1'), JSON.stringify([row]));
  const encryptedCache = await AsyncStorage.getItem(financeStorageKey('u1'));
  seedFirestoreMock('u1', row);
  const getItem = jest.mocked(SecureStore.getItemAsync);
  const originalGetItem = getItem.getMockImplementation();
  getItem.mockRejectedValue(new Error('Keychain access failed'));
  try {
    await readFinanceData('u1');
    const edited = { ...row, amount: 30000000 };

    await expect(updateFinanceTransaction('u1', edited)).resolves.toEqual({
      transactions: [edited],
      synced: false,
      cacheNeedsRecovery: true,
    });
    expect(getFirestoreMockRows('u1')).toEqual([edited]);
    expect(await AsyncStorage.getItem(financeStorageKey('u1'))).toBe(
      encryptedCache,
    );
  } finally {
    if (originalGetItem) getItem.mockImplementation(originalGetItem);
  }
});

it('falls back to local transactions when the cloud read stays pending', async () => {
  await AsyncStorage.setItem(financeStorageKey('u1'), JSON.stringify([row]));
  jest
    .mocked(getDocsFromServer)
    .mockImplementationOnce(() => new Promise(() => undefined));
  jest.useFakeTimers();

  const reading = readFinanceData('u1');
  await jest.advanceTimersByTimeAsync(15_000);

  await expect(reading).resolves.toEqual({
    transactions: [row],
    synced: false,
  });
});

it('uploads local-only additions after cloud connectivity returns', async () => {
  jest.mocked(setDoc).mockRejectedValueOnce(new Error('Offline'));
  const saved = await addFinanceTransaction('u1', row);
  expect(saved).toEqual({ transactions: [row], synced: false });
  expect(getFirestoreMockRows('u1')).toEqual([]);

  await expect(readFinanceData('u1')).resolves.toEqual({
    transactions: [row],
    synced: true,
  });
  expect(getFirestoreMockRows('u1')).toEqual([row]);
});

it('writes new transactions to Firestore and the local cache', async () => {
  const result = await addFinanceTransaction('u1', row);

  expect(result).toEqual({ transactions: [row], synced: true });
  expect(getFirestoreMockRows('u1')).toEqual([row]);
});

it('does not remove a transaction locally before its cloud deletion succeeds', async () => {
  seedFirestoreMock('u1', row);
  await readFinanceData('u1');
  jest.mocked(deleteDoc).mockRejectedValueOnce(new Error('Offline'));

  await expect(deleteFinanceTransaction('u1', row.id)).rejects.toThrow(
    'Offline',
  );
  expect(await readFinanceTransactions('u1')).toEqual([row]);
  expect(getFirestoreMockRows('u1')).toEqual([row]);
});

it('keeps an offline edit and pushes it when the cloud is reachable again', async () => {
  seedFirestoreMock('u1', row);
  await readFinanceData('u1');
  jest.mocked(updateDoc).mockRejectedValueOnce(new Error('Offline'));
  const edited = { ...row, amount: 30000000 };

  await expect(updateFinanceTransaction('u1', edited)).resolves.toEqual({
    transactions: [edited],
    synced: false,
  });
  await expect(readFinanceData('u1')).resolves.toEqual({
    transactions: [edited],
    synced: true,
  });
  expect(getFirestoreMockRows('u1')).toEqual([edited]);
});

it('does not re-create a transaction that was deleted on another device', async () => {
  const other = { ...row, id: 'coffee-1', amount: 30000 };
  seedFirestoreMock('u1', row);
  seedFirestoreMock('u1', other);
  await readFinanceData('u1');
  // A failed add on this device leaves unconfirmed changes behind.
  jest.mocked(setDoc).mockRejectedValueOnce(new Error('Offline'));
  const added = { ...row, id: 'bonus-1', amount: 1000000 };
  await addFinanceTransaction('u1', added);
  resetFirestoreMock();
  seedFirestoreMock('u1', row);

  const result = await readFinanceData('u1');

  expect(result.transactions.map(({ id }) => id).sort()).toEqual([
    'bonus-1',
    'salary-1',
  ]);
  expect(
    getFirestoreMockRows('u1')
      .map(({ id }) => id)
      .sort(),
  ).toEqual(['bonus-1', 'salary-1']);
});

it('drops an unsynced edit when the transaction was deleted on another device', async () => {
  seedFirestoreMock('u1', row);
  await readFinanceData('u1');
  jest.mocked(updateDoc).mockRejectedValueOnce(new Error('Offline'));
  await updateFinanceTransaction('u1', { ...row, amount: 1 });
  resetFirestoreMock();

  await expect(readFinanceData('u1')).resolves.toEqual({
    transactions: [],
    synced: true,
  });
  expect(getFirestoreMockRows('u1')).toEqual([]);
});

it('saves locally at once without re-reading the ledger when offline', async () => {
  seedFirestoreMock('u1', row);
  jest.mocked(getDocsFromServer).mockRejectedValueOnce(new Error('Offline'));
  await readFinanceData('u1');
  jest.mocked(getDocsFromServer).mockClear();
  jest.mocked(setDoc).mockClear();

  const added = { ...row, id: 'bonus-1', amount: 1000000 };
  await expect(addFinanceTransaction('u1', added)).resolves.toMatchObject({
    synced: false,
  });
  expect(getDocsFromServer).not.toHaveBeenCalled();
  expect(setDoc).not.toHaveBeenCalled();
});
