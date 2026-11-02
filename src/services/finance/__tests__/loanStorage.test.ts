import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  clearRepaymentAttempt,
  deleteLoanData,
  getOrCreateAdvanceAttempt,
  recordLoanAdvanceAtomically,
  getPendingNewLoanAttempt,
  getOrCreateRepaymentAttempt,
  readLoanData,
  recordLoanRepaymentAtomically,
  removeLoanRepaymentAtomically,
  reserveNewLoanAttempt,
  saveLoanData,
  recoverLoanCache,
} from '../loanStorage';
import {
  getDocsFromServer,
  getFirestoreMockRows,
  seedFirestoreMock,
  resetFirestoreMock,
} from '../../../testing/firestoreMock';
import { useAuthStore } from '../../../store/authStore';
import {
  getEncryptedItem,
  hasEncryptedItemRecovery,
} from '../../security/encryptedLocalStorage';
import type { LoanRecord } from '../../../types/loan';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);
jest.mock('@react-native-firebase/firestore', () =>
  jest.requireActual('../../../testing/firestoreMock'),
);

const loan: LoanRecord = {
  id: 'loan-1',
  ownerId: 'u1',
  borrowerName: 'An',
  principalAmount: 1000,
  lentAt: 1791432000000,
  dueAt: null,
  remindOnDueDate: false,
  note: '',
  repayments: [],
  cancelledAt: null,
  updatedAt: 1791432000000,
};

beforeEach(async () => {
  await AsyncStorage.clear();
  resetFirestoreMock();
  useAuthStore
    .getState()
    .setUser({ uid: 'u1', email: null, displayName: null });
});

it('loads loans read-only from cloud when the local cache is unreadable, without replacing it', async () => {
  await saveLoanData('u1', loan);
  const key = 'lifemate:finance-loans:v1:u1';
  const original = await AsyncStorage.getItem(key);
  const readKey = jest
    .mocked(SecureStore.getItemAsync)
    .getMockImplementation()!;
  jest
    .mocked(SecureStore.getItemAsync)
    .mockRejectedValue(new Error('Keychain unavailable'));
  try {
    expect(await readLoanData('u1')).toMatchObject({
      loans: [loan],
      synced: false,
      cacheNeedsRecovery: true,
      committedTransactions: [],
    });
    await expect(
      recordLoanRepaymentAtomically('u1', loan.id, {
        id: 'blocked',
        amount: 100,
        receivedAt: loan.lentAt,
        financeTransactionId: `loan-${loan.id}-blocked`,
        status: 'pending',
      }),
    ).rejects.toThrow('khôi phục');
    expect(await AsyncStorage.getItem(key)).toBe(original);
  } finally {
    jest.mocked(SecureStore.getItemAsync).mockImplementation(readKey);
  }
  expect((await readLoanData('u1')).cacheNeedsRecovery).toBeUndefined();
});

it('keeps cloud loans visible when an absent cache cannot be written because Keychain is unavailable', async () => {
  await saveLoanData('u1', loan);
  await AsyncStorage.removeItem('lifemate:finance-loans:v1:u1');
  const readKey = jest
    .mocked(SecureStore.getItemAsync)
    .getMockImplementation()!;
  jest
    .mocked(SecureStore.getItemAsync)
    .mockRejectedValue(new Error('Keychain unavailable'));
  try {
    expect(await readLoanData('u1')).toMatchObject({
      loans: [loan],
      synced: false,
      cacheNeedsRecovery: true,
    });
    await expect(
      recordLoanRepaymentAtomically('u1', loan.id, {
        id: 'blocked',
        amount: 100,
        receivedAt: loan.lentAt,
        financeTransactionId: `loan-${loan.id}-blocked`,
        status: 'pending',
      }),
    ).rejects.toThrow('khôi phục');
  } finally {
    jest.mocked(SecureStore.getItemAsync).mockImplementation(readKey);
    await readLoanData('u1');
  }
});

it('preserves retry attempts when writing the downloaded cloud loans fails and unblocks after retry', async () => {
  await saveLoanData('u1', loan);
  await reserveNewLoanAttempt('u1', loan);
  const attemptKey = 'lifemate:loan-create-attempt:v1:u1';
  const originalAttempt = await AsyncStorage.getItem(attemptKey);
  const key = 'lifemate:finance-loans:v1:u1';
  const originalCache = await AsyncStorage.getItem(key);
  const write = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
  jest
    .mocked(AsyncStorage.setItem)
    .mockImplementation(async (target, value) => {
      if (target === key) throw new Error('Disk full');
      return write(target, value);
    });
  try {
    expect(await readLoanData('u1')).toMatchObject({
      loans: [loan],
      cacheNeedsRecovery: true,
    });
    expect(await AsyncStorage.getItem(attemptKey)).toBe(originalAttempt);
    expect(await AsyncStorage.getItem(key)).toBe(originalCache);
    await expect(clearRepaymentAttempt('u1', loan.id)).rejects.toThrow(
      'khôi phục',
    );
  } finally {
    jest.mocked(AsyncStorage.setItem).mockImplementation(write);
  }
  expect(await readLoanData('u1')).toMatchObject({
    loans: [loan],
    synced: true,
  });
  expect(await AsyncStorage.getItem(attemptKey)).toBeNull();
  await expect(
    getOrCreateRepaymentAttempt('u1', loan.id, 100, []),
  ).resolves.toMatchObject({ amount: 100 });
});

it('checks unreadable cache before a direct atomic write, even before the first load', async () => {
  const uid = 'direct-owner';
  await saveLoanData(uid, { ...loan, ownerId: uid });
  const key = `lifemate:finance-loans:v1:${uid}`;
  await AsyncStorage.setItem(key, 'lifemate:aes-gcm:v1:damaged');
  const before = getFirestoreMockRows(uid);
  await expect(
    recordLoanRepaymentAtomically(uid, loan.id, {
      id: 'blocked',
      amount: 100,
      receivedAt: loan.lentAt,
      financeTransactionId: `loan-${loan.id}-blocked`,
      status: 'pending',
    }),
  ).rejects.toThrow('khôi phục');
  expect(getFirestoreMockRows(uid)).toEqual(before);
});

it('archives unreadable loan and attempt caches, excludes another owner, and restores from cloud', async () => {
  await saveLoanData('u1', loan);
  const keys = [
    'lifemate:finance-loans:v1:u1',
    'lifemate:loan-create-attempt:v1:u1',
    'lifemate:loan-repayment-attempt:v1:u1:loan-1',
    'lifemate:loan-advance-attempt:v1:u1:loan-1',
  ];
  for (const key of keys)
    await AsyncStorage.setItem(key, 'lifemate:aes-gcm:v1:damaged');
  const otherKey = 'lifemate:loan-repayment-attempt:v1:u2:loan-1';
  await AsyncStorage.setItem(otherKey, 'other-owner');
  await recoverLoanCache('u1');
  expect(await readLoanData('u1')).toMatchObject({
    loans: [loan],
    synced: true,
  });
  for (const key of keys.slice(1))
    expect(await getEncryptedItem('u1', key)).toBe('null');
  expect(await AsyncStorage.getItem(otherKey)).toBe('other-owner');
  const backupKeys = (await AsyncStorage.getAllKeys()).filter((key) =>
    key.startsWith('lifemate:cache-recovery-backup:loans:'),
  );
  const backup = JSON.parse((await getEncryptedItem('u1', backupKeys[0]))!);
  expect(backup).toHaveLength(keys.length);
  expect(
    backup.every(
      (entry: { previous: string }) =>
        entry.previous === 'lifemate:aes-gcm:v1:damaged',
    ),
  ).toBe(true);
});

it('resumes an interrupted loan recovery without resurrecting loans deleted from cloud', async () => {
  await saveLoanData('u1', loan);
  await getOrCreateRepaymentAttempt('u1', loan.id, 100, []);
  await getOrCreateAdvanceAttempt(
    'u1',
    loan.id,
    100,
    { lentAt: loan.lentAt, note: 'More' },
    [],
  );
  const key = 'lifemate:finance-loans:v1:u1';
  const original = await AsyncStorage.getItem(key);
  const write = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
  jest
    .mocked(AsyncStorage.setItem)
    .mockImplementation(async (target, value) => {
      if (target === key) throw new Error('Disk full');
      return write(target, value);
    });
  try {
    await expect(recoverLoanCache('u1')).rejects.toThrow('Disk full');
  } finally {
    jest.mocked(AsyncStorage.setItem).mockImplementation(write);
  }
  expect(await hasEncryptedItemRecovery('u1', 'loans')).toBe(true);
  await expect(clearRepaymentAttempt('u1', loan.id)).rejects.toThrow(
    'khôi phục',
  );
  await expect(
    recordLoanRepaymentAtomically('u1', loan.id, {
      id: 'blocked',
      amount: 100,
      receivedAt: loan.lentAt,
      financeTransactionId: `loan-${loan.id}-blocked`,
      status: 'pending',
    }),
  ).rejects.toThrow('khôi phục');
  await expect(
    recordLoanAdvanceAtomically('u1', loan.id, {
      id: 'blocked',
      amount: 100,
      lentAt: loan.lentAt,
      note: 'More',
      financeTransactionId: `loan-lent-${loan.id}-blocked`,
    }),
  ).rejects.toThrow('khôi phục');
  await expect(
    removeLoanRepaymentAtomically('u1', loan.id, {
      id: 'blocked',
      amount: 100,
      receivedAt: loan.lentAt,
      financeTransactionId: `loan-${loan.id}-blocked`,
      status: 'posted',
    }),
  ).rejects.toThrow('khôi phục');

  // Simulate a deletion by another device while this device is interrupted.
  resetFirestoreMock();
  await recoverLoanCache('u1');
  expect(await hasEncryptedItemRecovery('u1', 'loans')).toBe(false);
  expect((await readLoanData('u1')).loans).toEqual([]);
  expect(getFirestoreMockRows('u1')).toEqual([]);
  const backupKeys = (await AsyncStorage.getAllKeys()).filter((target) =>
    target.startsWith('lifemate:cache-recovery-backup:loans:'),
  );
  expect(backupKeys).toHaveLength(1);
  const backup = JSON.parse((await getEncryptedItem('u1', backupKeys[0]))!);
  expect(
    backup.find((entry: { storageKey: string }) => entry.storageKey === key)
      .previous,
  ).toBe(original);
});

describe('new loan recovery', () => {
  it('reuses the same loan after an uncertain save and retires it after confirmation', async () => {
    const first = await reserveNewLoanAttempt('u1', loan);
    expect(
      await reserveNewLoanAttempt('u1', { ...loan, id: 'another-id' }),
    ).toEqual(first);
    await expect(
      reserveNewLoanAttempt('u1', { ...loan, principalAmount: 2000 }),
    ).rejects.toThrow('đang chờ xác nhận');

    await saveLoanData('u1', first);
    expect(await getPendingNewLoanAttempt('u1', [])).toBeNull();
  });

  it('releases a retry key after a definitive cloud conflict', async () => {
    await saveLoanData('u1', loan);
    const conflicting = {
      ...loan,
      borrowerName: 'Bình',
    };
    await reserveNewLoanAttempt('u1', conflicting);
    await expect(saveLoanData('u1', conflicting)).rejects.toThrow(
      'không thể sửa',
    );
    expect(await getPendingNewLoanAttempt('u1', [])).toBeNull();
  });
});

describe('loan repayment recovery', () => {
  it.each([100, 200])(
    'starts a fresh repayment of %i after reloading a committed attempt left by an interrupted app',
    async (nextAmount) => {
      await saveLoanData('u1', loan);
      const previous = await getOrCreateRepaymentAttempt('u1', loan.id, 100);
      // The server commits, but the app stops before caching or clearing its attempt.
      await recordLoanRepaymentAtomically('u1', loan.id, previous);

      const reloaded = await readLoanData('u1');
      expect(reloaded.synced).toBe(true);
      expect(reloaded.loans[0].repayments).toEqual([
        { ...previous, status: 'posted' },
      ]);

      const next = await getOrCreateRepaymentAttempt('u1', loan.id, nextAmount);
      expect(next.id).not.toBe(previous.id);
      const committed = await recordLoanRepaymentAtomically(
        'u1',
        loan.id,
        next,
      );
      expect(committed.loan.repayments.map(({ amount }) => amount)).toEqual([
        100,
        nextAmount,
      ]);
    },
  );

  it('reuses an unconfirmed attempt so retries do not create another receipt', async () => {
    const first = await getOrCreateRepaymentAttempt('u1', loan.id, 100);
    expect(await getOrCreateRepaymentAttempt('u1', loan.id, 100)).toEqual(
      first,
    );
    await expect(
      getOrCreateRepaymentAttempt('u1', loan.id, 200),
    ).rejects.toThrow('đang chờ xác nhận');
  });

  it('keeps an unconfirmed attempt when the cloud cannot be read', async () => {
    await saveLoanData('u1', loan);
    const first = await getOrCreateRepaymentAttempt('u1', loan.id, 100);
    getDocsFromServer.mockRejectedValueOnce(new Error('Offline'));
    expect((await readLoanData('u1')).synced).toBe(false);
    expect(await getOrCreateRepaymentAttempt('u1', loan.id, 100)).toEqual(
      first,
    );
  });

  it('uses confirmed in-memory history when the committed loan was not cached', async () => {
    await saveLoanData('u1', loan);
    const first = await getOrCreateRepaymentAttempt('u1', loan.id, 100);
    const committed = await recordLoanRepaymentAtomically('u1', loan.id, first);

    const next = await getOrCreateRepaymentAttempt(
      'u1',
      loan.id,
      200,
      committed.loan.repayments,
    );
    expect(next.id).not.toBe(first.id);
    expect(next.amount).toBe(200);
  });

  it('does not retire an attempt based on a pending or mismatched history entry', async () => {
    const first = await getOrCreateRepaymentAttempt('u1', loan.id, 100);
    await expect(
      getOrCreateRepaymentAttempt('u1', loan.id, 200, [first]),
    ).rejects.toThrow('đang chờ xác nhận');
    await expect(
      getOrCreateRepaymentAttempt('u1', loan.id, 200, [
        { ...first, amount: 99, status: 'posted' },
      ]),
    ).rejects.toThrow('đang chờ xác nhận');
  });
});

it('fully deletes lending and repayment transactions together, preserving other loans and accounts', async () => {
  await saveLoanData('u1', loan);
  await saveLoanData('u1', { ...loan, id: 'unrelated' });
  await saveLoanData('u2', { ...loan, ownerId: 'u2' });
  const advance = await getOrCreateAdvanceAttempt('u1', loan.id, 50, {
    lentAt: loan.lentAt,
    note: 'Thêm',
  });
  await recordLoanAdvanceAtomically('u1', loan.id, advance);
  const receipt = await getOrCreateRepaymentAttempt('u1', loan.id, 100);
  await recordLoanRepaymentAtomically('u1', loan.id, receipt);
  const result = await deleteLoanData('u1', loan.id);
  expect(result.loans.map(({ id }) => id)).toEqual(['unrelated']);
  expect(getFirestoreMockRows('u1').map(({ loanId }) => loanId)).toEqual([
    'unrelated',
  ]);
  expect(getFirestoreMockRows('u2')).toHaveLength(1);
  await deleteLoanData('u1', loan.id);
  expect(getFirestoreMockRows('u1')).toHaveLength(1);
});

it('cleans up explicitly retried historical deletion and rejects mismatched linked data atomically', async () => {
  await saveLoanData('u1', loan);
  const receipt = await getOrCreateRepaymentAttempt('u1', loan.id, 100);
  await recordLoanRepaymentAtomically('u1', loan.id, receipt);
  const historicalRows = getFirestoreMockRows('u1');
  await deleteLoanData('u1', loan.id);
  for (const row of historicalRows) seedFirestoreMock('u1', row);
  await readLoanData('u1');
  expect(getFirestoreMockRows('u1')).toHaveLength(2);
  const result = await deleteLoanData('u1', loan.id);
  expect(result.deletedLendingTransactionId).toBeDefined();
  expect(getFirestoreMockRows('u1')).toEqual([]);
  for (const row of historicalRows) seedFirestoreMock('u1', row);
  seedFirestoreMock('u1', {
    ...historicalRows.find(({ type }) => type === 'income')!,
    amount: 999,
  });
  await expect(deleteLoanData('u1', loan.id)).rejects.toThrow();
  expect(getFirestoreMockRows('u1')).toHaveLength(2);
});
