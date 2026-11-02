import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  deleteDoc,
  getDocsFromServer,
  runTransaction,
  setDoc,
} from '@react-native-firebase/firestore';
import {
  addFinanceTransaction,
  deleteFinanceTransaction,
  financeStorageKey,
  financePendingKey,
  financePendingBaseKey,
  financeMigrationKey,
  recoverFinanceCache,
  readFinanceData,
  readFinanceTransactions,
  resetFinanceCloudState,
  resolveFinanceConflict,
  updateFinanceTransaction,
} from '../financeStorage';
import type { FinanceTransaction } from '../../../types/finance';
import {
  getEncryptedItem,
  setEncryptedItem,
  recoverEncryptedItems,
} from '../../security/encryptedLocalStorage';
import { useAuthStore } from '../../../store/authStore';
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

  expect(result).toEqual({ transactions: [row], synced: true, conflicts: [] });
  expect(await readFinanceTransactions('u1')).toEqual([row]);
});

it('never reads another account path', async () => {
  seedFirestoreMock('u2', { ...row, id: 'other', ownerId: 'u2' });

  await expect(readFinanceData('u1')).resolves.toEqual({
    transactions: [],
    synced: true,
    conflicts: [],
  });
  await expect(readFinanceData('u2')).resolves.toMatchObject({
    transactions: [{ ownerId: 'u2', id: 'other' }],
    synced: true,
  });
});

it('migrates existing local transactions to the matching account once', async () => {
  await AsyncStorage.setItem(financeStorageKey('u1'), JSON.stringify([row]));

  const result = await readFinanceData('u1');

  expect(result).toEqual({ transactions: [row], synced: true, conflicts: [] });
  expect(getFirestoreMockRows('u1')).toEqual([row]);
  expect(getFirestoreMockRows('u2')).toEqual([]);

  const updated = { ...row, note: 'Cloud version' };
  seedFirestoreMock('u1', updated);
  await expect(readFinanceData('u1')).resolves.toEqual({
    transactions: [updated],
    synced: true,
    conflicts: [],
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

it.each([financePendingKey, financePendingBaseKey, financeMigrationKey])(
  'preserves all cache bytes and prevents uploads when a secondary cache cannot authenticate',
  async (brokenKey) => {
    await setEncryptedItem(
      'u1',
      financeStorageKey('u1'),
      JSON.stringify([row]),
    );
    await setEncryptedItem(
      'u1',
      financePendingKey('u1'),
      JSON.stringify({ [row.id]: 'add' }),
    );
    await setEncryptedItem('u1', financePendingBaseKey('u1'), '{}');
    await setEncryptedItem('u1', financeMigrationKey('u1'), 'complete');
    if (brokenKey === financePendingBaseKey)
      await AsyncStorage.setItem(
        financeStorageKey('u1'),
        JSON.stringify([row]),
      );
    await AsyncStorage.setItem(brokenKey('u1'), 'lifemate:aes-gcm:v1:damaged');
    const keys = [
      financeStorageKey('u1'),
      financePendingKey('u1'),
      financePendingBaseKey('u1'),
      financeMigrationKey('u1'),
    ];
    const originals = await Promise.all(
      keys.map((key) => AsyncStorage.getItem(key)),
    );
    expect(await readFinanceData('u1')).toMatchObject({
      transactions: [],
      cacheNeedsRecovery: true,
    });
    await expect(
      addFinanceTransaction('u1', { ...row, id: 'new' }),
    ).rejects.toThrow('khôi phục');
    expect(
      await Promise.all(keys.map((key) => AsyncStorage.getItem(key))),
    ).toEqual(originals);
    expect(getFirestoreMockRows('u1')).toEqual([]);
  },
);

it('rebuilds finance from a fresh cloud snapshot only after preserving all old cache bytes', async () => {
  useAuthStore
    .getState()
    .setUser({ uid: 'u1', email: null, displayName: null });
  const keys = [
    financeStorageKey('u1'),
    financePendingKey('u1'),
    financePendingBaseKey('u1'),
    financeMigrationKey('u1'),
  ];
  await setEncryptedItem('u1', keys[0], JSON.stringify([row]));
  await AsyncStorage.setItem(keys[0], 'lifemate:aes-gcm:v1:unreadable');
  await setEncryptedItem('u1', keys[1], '["offline-row"]');
  const originals = await Promise.all(
    keys.map((key) => AsyncStorage.getItem(key)),
  );
  const cloud = { ...row, note: 'Authoritative cloud copy' };
  seedFirestoreMock('u1', cloud);
  await readFinanceData('u1');

  expect(await recoverFinanceCache('u1')).toMatchObject({
    transactions: [cloud],
    synced: true,
  });
  expect(await readFinanceTransactions('u1')).toEqual([cloud]);
  expect(getFirestoreMockRows('u1')).toEqual([cloud]);
  const backupKey = (await AsyncStorage.getAllKeys()).find((key) =>
    key.startsWith('lifemate:cache-recovery-backup:finance:'),
  )!;
  const backup = JSON.parse((await getEncryptedItem('u1', backupKey))!);
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
});

it('does not merge partial recovery data or allow edits after an interrupted rebuild', async () => {
  const keys = [
    financeStorageKey('u1'),
    financePendingKey('u1'),
    financePendingBaseKey('u1'),
    financeMigrationKey('u1'),
  ];
  await setEncryptedItem('u1', keys[0], JSON.stringify([row]));
  seedFirestoreMock('u1', row);
  const write = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
    if (key === keys[0]) throw new Error('Disk full');
    return write(key, value);
  });
  try {
    await expect(
      recoverEncryptedItems(
        'u1',
        'finance',
        keys,
        Object.fromEntries(keys.map((key) => [key, '[]'])),
        () => undefined,
      ),
    ).rejects.toThrow();
  } finally {
    jest.mocked(AsyncStorage.setItem).mockImplementation(write);
  }
  await expect(
    addFinanceTransaction('u1', { ...row, id: 'new-offline-row' }),
  ).rejects.toThrow('khôi phục');
  expect(await readFinanceData('u1')).toMatchObject({
    transactions: [row],
    cacheNeedsRecovery: true,
  });
  expect(getFirestoreMockRows('u1')).toEqual([row]);
});

it('blocks edits while preserving an unreadable local cache until it becomes readable', async () => {
  await setEncryptedItem('u1', financeStorageKey('u1'), JSON.stringify([row]));
  const encryptedCache = await AsyncStorage.getItem(financeStorageKey('u1'));
  seedFirestoreMock('u1', row);
  const getItem = jest.mocked(SecureStore.getItemAsync);
  const originalGetItem = getItem.getMockImplementation();
  getItem.mockRejectedValue(new Error('Keychain access failed'));
  try {
    await readFinanceData('u1');
    const edited = { ...row, amount: 30000000 };

    await expect(updateFinanceTransaction('u1', edited)).rejects.toThrow(
      'khôi phục',
    );
    expect(getFirestoreMockRows('u1')).toEqual([row]);
    expect(await AsyncStorage.getItem(financeStorageKey('u1'))).toBe(
      encryptedCache,
    );
  } finally {
    if (originalGetItem) getItem.mockImplementation(originalGetItem);
  }

  await expect(readFinanceData('u1')).resolves.toEqual({
    transactions: [row],
    synced: true,
    conflicts: [],
  });
  expect(await readFinanceTransactions('u1')).toEqual([row]);
});

it('blocks writes while still loading changes made on another device during cache recovery', async () => {
  await setEncryptedItem('u1', financeStorageKey('u1'), JSON.stringify([row]));
  const encryptedCache = await AsyncStorage.getItem(financeStorageKey('u1'));
  seedFirestoreMock('u1', row);
  const getItem = jest.mocked(SecureStore.getItemAsync);
  const originalGetItem = getItem.getMockImplementation();
  getItem.mockRejectedValue(new Error('Keychain access failed'));
  const added = { ...row, id: 'bonus-1', createdAt: row.createdAt + 1 };
  try {
    await readFinanceData('u1');
    await expect(addFinanceTransaction('u1', added)).rejects.toThrow(
      'khôi phục',
    );
    await expect(deleteFinanceTransaction('u1', row.id)).rejects.toThrow(
      'khôi phục',
    );
    expect(getFirestoreMockRows('u1')).toEqual([row]);
    // Another device changes the authoritative cloud while local writes are blocked.
    resetFirestoreMock();
    seedFirestoreMock('u1', added);
    expect(await readFinanceData('u1')).toMatchObject({
      transactions: [added],
      cacheNeedsRecovery: true,
    });
    expect(getFirestoreMockRows('u1')).toEqual([added]);
    expect(await AsyncStorage.getItem(financeStorageKey('u1'))).toBe(
      encryptedCache,
    );
  } finally {
    if (originalGetItem) getItem.mockImplementation(originalGetItem);
  }

  const recovered = await readFinanceData('u1');
  expect(recovered).toMatchObject({
    synced: false,
    conflicts: [{ id: row.id, local: row, remote: null }],
  });
  expect(getFirestoreMockRows('u1')).toEqual([added]);
  await expect(
    resolveFinanceConflict('u1', recovered.conflicts![0], 'server'),
  ).resolves.toEqual({
    transactions: [added],
    synced: true,
    conflicts: [],
  });
});

it('does not overwrite an unreconciled cache when the cloud is offline', async () => {
  await setEncryptedItem('u1', financeStorageKey('u1'), JSON.stringify([row]));
  const encryptedCache = await AsyncStorage.getItem(financeStorageKey('u1'));
  seedFirestoreMock('u1', row);
  jest
    .mocked(SecureStore.getItemAsync)
    .mockRejectedValueOnce(new Error('Keychain access failed'));
  await readFinanceData('u1');
  jest.mocked(getDocsFromServer).mockRejectedValueOnce(new Error('Offline'));

  await expect(
    addFinanceTransaction('u1', { ...row, id: 'bonus-1' }),
  ).rejects.toThrow('Cần kết nối mạng để khôi phục sổ thu chi');
  expect(await AsyncStorage.getItem(financeStorageKey('u1'))).toBe(
    encryptedCache,
  );
  expect(getFirestoreMockRows('u1')).toEqual([row]);
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
    conflicts: [],
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
  jest.mocked(runTransaction).mockRejectedValueOnce(new Error('Offline'));
  const edited = { ...row, amount: 30000000 };

  await expect(updateFinanceTransaction('u1', edited)).resolves.toEqual({
    transactions: [edited],
    synced: false,
  });
  await expect(readFinanceData('u1')).resolves.toEqual({
    transactions: [edited],
    synced: true,
    conflicts: [],
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

it('keeps an unsynced edit for review when the transaction was deleted on another device', async () => {
  seedFirestoreMock('u1', row);
  await readFinanceData('u1');
  jest.mocked(runTransaction).mockRejectedValueOnce(new Error('Offline'));
  const edited = { ...row, amount: 1 };
  await updateFinanceTransaction('u1', edited);
  resetFirestoreMock();

  await expect(readFinanceData('u1')).resolves.toEqual({
    transactions: [edited],
    synced: false,
    conflicts: [{ id: row.id, local: edited, remote: null }],
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

it('turns an income into an expense without leaving its income source', async () => {
  seedFirestoreMock('u1', { ...row, incomeSource: 'other' });
  await readFinanceData('u1');
  const { incomeSource: _source, ...base } = { ...row, incomeSource: 'other' };
  void _source;
  const expense = { ...base, type: 'expense' as const, category: 'Ăn uống' };

  await expect(updateFinanceTransaction('u1', expense)).resolves.toEqual({
    transactions: [expense],
    synced: true,
  });
  expect(getFirestoreMockRows('u1')).toEqual([expense]);
});
