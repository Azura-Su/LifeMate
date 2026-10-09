import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addFinanceTransaction,
  deleteFinanceTransaction,
  financeStorageKey,
  readFinanceTransactions,
} from '../financeStorage';
import type { FinanceTransaction } from '../../../types/finance';
import { resetFirestoreMock } from '../../../testing/firestoreMock';

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
  await AsyncStorage.clear();
  resetFirestoreMock();
});

it('persists transactions under an account-specific key', async () => {
  await addFinanceTransaction('u1', row);
  expect(financeStorageKey('u1')).not.toBe(financeStorageKey('u2'));
  expect(await readFinanceTransactions('u1')).toEqual([row]);
  expect(await readFinanceTransactions('u2')).toEqual([]);
});

it('rejects records owned by another account without writing them', async () => {
  await expect(
    addFinanceTransaction('u2', { ...row, id: 'foreign', ownerId: 'u1' }),
  ).rejects.toThrow('tài khoản');
  expect(await readFinanceTransactions('u1')).toEqual([]);
  expect(await readFinanceTransactions('u2')).toEqual([]);
});

it('rejects invalid amounts and malformed timestamps', async () => {
  await expect(
    addFinanceTransaction('u1', { ...row, amount: Number.NaN }),
  ).rejects.toThrow('Số tiền');
  await expect(
    addFinanceTransaction('u1', { ...row, createdAt: Infinity }),
  ).rejects.toThrow('giao dịch');
  await expect(
    addFinanceTransaction('u1', { ...row, amount: 1.5 }),
  ).rejects.toThrow('Số tiền');
  expect(await readFinanceTransactions('u1')).toEqual([]);
});

it('serializes simultaneous writes and deletes only the chosen transaction', async () => {
  await Promise.all([
    addFinanceTransaction('u1', row),
    addFinanceTransaction('u1', { ...row, id: 'expense-1', type: 'expense' }),
  ]);
  await deleteFinanceTransaction('u1', row.id);
  expect(await readFinanceTransactions('u1')).toMatchObject([
    { id: 'expense-1' },
  ]);
});

it('preserves invalid storage instead of silently overwriting it', async () => {
  await AsyncStorage.setItem(financeStorageKey('u1'), '{broken');
  await expect(readFinanceTransactions('u1')).rejects.toThrow('đọc được');
  const stored = await AsyncStorage.getItem(financeStorageKey('u1'));
  expect(stored).toMatch(/^lifemate:aes-gcm:v1:/);
  await expect(readFinanceTransactions('u1')).rejects.toThrow('đọc được');
  expect(await AsyncStorage.getItem(financeStorageKey('u1'))).toBe(stored);
});
