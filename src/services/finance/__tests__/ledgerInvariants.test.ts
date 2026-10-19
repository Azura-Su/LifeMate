import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFirestoreMockRows,
  resetFirestoreMock,
} from '../../../testing/firestoreMock';
import {
  getHeldMoneyTotals,
  type HeldMoneyRecord,
} from '../../../types/heldMoney';
import { getLoanOutstandingAmount, type LoanRecord } from '../../../types/loan';
import {
  addHeldMoneyEntry,
  createHeldMoneyRecord,
  deleteHeldMoneyEntry,
  readHeldMoney,
  updateHeldMoneyEntry,
} from '../heldMoneyStorage';
import {
  getOrCreateAdvanceAttempt,
  getOrCreateRepaymentAttempt,
  readLoanData,
  recordLoanAdvanceAtomically,
  recordLoanRepaymentAtomically,
  removeInitialLoanEntryAtomically,
  removeLoanAdvanceAtomically,
  removeLoanRepaymentAtomically,
  saveLoanData,
  updateLoanAdvanceAtomically,
  updateLoanRepaymentAtomically,
} from '../loanStorage';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);
jest.mock('@react-native-firebase/firestore', () =>
  jest.requireActual('../../../testing/firestoreMock'),
);

const time = new Date(2026, 9, 16, 12).getTime();
const loan: LoanRecord = {
  id: 'audit-loan',
  ownerId: 'u1',
  borrowerName: 'An',
  principalAmount: 1000,
  lentAt: time,
  dueAt: null,
  remindOnDueDate: false,
  note: '',
  repayments: [],
  cancelledAt: null,
  updatedAt: time,
};
beforeEach(async () => {
  await AsyncStorage.clear();
  resetFirestoreMock();
});

it('keeps loan totals and linked finance rows aligned across advance and repayment corrections', async () => {
  await saveLoanData('u1', loan);
  const advance = await getOrCreateAdvanceAttempt('u1', loan.id, 500, {
    lentAt: time,
    note: 'Cho thêm',
  });
  await recordLoanAdvanceAtomically('u1', loan.id, advance);
  await recordLoanAdvanceAtomically('u1', loan.id, advance);
  expect(getFirestoreMockRows('u1')).toHaveLength(2);
  const edited = await updateLoanAdvanceAtomically('u1', loan.id, advance, {
    amount: 600,
    lentAt: time,
    note: 'Sửa lần cho thêm',
  });
  const currentAdvance = edited.loans.find(({ id }) => id === loan.id)!
    .advances![0];
  expect(
    getFirestoreMockRows('u1').find(
      ({ id }) => id === advance.financeTransactionId,
    )?.amount,
  ).toBe(600);

  const repayment = await getOrCreateRepaymentAttempt('u1', loan.id, 1200);
  const posted = await recordLoanRepaymentAtomically('u1', loan.id, repayment);
  expect(getLoanOutstandingAmount(posted.loan)).toBe(400);
  await expect(
    removeLoanAdvanceAtomically('u1', loan.id, currentAdvance),
  ).rejects.toThrow();
  const corrected = await updateLoanRepaymentAtomically(
    'u1',
    loan.id,
    posted.loan.repayments[0],
    { amount: 900, receivedAt: repayment.receivedAt },
  );
  expect(getLoanOutstandingAmount(corrected.loan)).toBe(700);
  expect(
    getFirestoreMockRows('u1').find(
      ({ id }) => id === repayment.financeTransactionId,
    )?.amount,
  ).toBe(900);
  const withoutAdvance = await removeLoanAdvanceAtomically(
    'u1',
    loan.id,
    currentAdvance,
  );
  expect(getLoanOutstandingAmount(withoutAdvance)).toBe(100);
  const withoutRepayment = await removeLoanRepaymentAtomically(
    'u1',
    loan.id,
    corrected.loan.repayments[0],
  );
  expect(getLoanOutstandingAmount(withoutRepayment)).toBe(1000);
  expect(getFirestoreMockRows('u1')).toMatchObject([
    { id: 'loan-lent-audit-loan', amount: 1000 },
  ]);
});

it('promotes the retained advance without duplicating its linked expense', async () => {
  await saveLoanData('u1', loan);
  const advance = await getOrCreateAdvanceAttempt('u1', loan.id, 500, {
    lentAt: time + 86400000,
    note: 'Giữ khoản này',
  });
  const added = await recordLoanAdvanceAtomically('u1', loan.id, advance);
  const promoted = await removeInitialLoanEntryAtomically(
    'u1',
    loan.id,
    added.loan.updatedAt,
  );
  expect(promoted.loan.principalAmount).toBe(500);
  expect(promoted.loan.advances).toEqual([]);
  expect(getFirestoreMockRows('u1')).toMatchObject([
    { id: 'loan-lent-audit-loan', amount: 500 },
  ]);
  expect((await readLoanData('u1')).loans[0].principalAmount).toBe(500);
});

it('preserves held-fund advances, exact settlement, retry IDs and personal-finance isolation', async () => {
  const received = {
    id: 'received',
    kind: 'received' as const,
    amount: 500,
    occurredAt: time,
    note: '',
  };
  const fund: HeldMoneyRecord = {
    id: 'audit-fund',
    ownerId: 'u1',
    senderName: 'An',
    purpose: 'Điện nước',
    createdAt: time,
    updatedAt: time,
    entries: [received],
  };
  await createHeldMoneyRecord('u1', fund);
  const paid = {
    id: 'paid',
    kind: 'paid' as const,
    amount: 700,
    occurredAt: time,
    note: '',
  };
  const advanced = await addHeldMoneyEntry('u1', fund.id, paid);
  expect(getHeldMoneyTotals(advanced!).remaining).toBe(-200);
  const retry = await addHeldMoneyEntry('u1', fund.id, paid);
  expect(retry!.entries).toHaveLength(2);
  const topUp = { ...received, id: 'top-up', amount: 200 };
  const settled = await addHeldMoneyEntry('u1', fund.id, topUp);
  expect(getHeldMoneyTotals(settled!).remaining).toBe(0);
  const corrected = await updateHeldMoneyEntry('u1', fund.id, paid, {
    ...paid,
    amount: 600,
  });
  expect(getHeldMoneyTotals(corrected!).remaining).toBe(100);
  await expect(
    updateHeldMoneyEntry('u1', fund.id, paid, { ...paid, amount: 650 }),
  ).rejects.toThrow('đã thay đổi');
  const removed = await deleteHeldMoneyEntry('u1', fund.id, topUp);
  expect(getHeldMoneyTotals(removed!).remaining).toBe(-100);
  const reloaded = await readHeldMoney('u1');
  expect(reloaded.synced).toBe(true);
  expect(getHeldMoneyTotals(reloaded.records[0]).remaining).toBe(-100);
  expect(getFirestoreMockRows('u1')).toEqual([]);
});
