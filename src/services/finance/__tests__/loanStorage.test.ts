import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  deleteLoanData,
  getOrCreateAdvanceAttempt,
  recordLoanAdvanceAtomically,
  getPendingNewLoanAttempt,
  getOrCreateRepaymentAttempt,
  readLoanData,
  recordLoanRepaymentAtomically,
  reserveNewLoanAttempt,
  saveLoanData,
} from '../loanStorage';
import {
  getDocsFromServer,
  getFirestoreMockRows,
  seedFirestoreMock,
  resetFirestoreMock,
} from '../../../testing/firestoreMock';
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
