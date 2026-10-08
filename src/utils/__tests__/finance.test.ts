import {
  getMonthlySummary,
  parseFinanceAmount,
  parseFinanceTransaction,
} from '../finance';
import type { FinanceTransaction } from '../../types/finance';

const rows: FinanceTransaction[] = [
  {
    id: 'salary',
    ownerId: 'u1',
    type: 'income',
    amount: 25000000,
    category: 'Lương',
    note: '',
    createdAt: new Date(2026, 9, 1).getTime(),
  },
  {
    id: 'food',
    ownerId: 'u1',
    type: 'expense',
    amount: 1250000,
    category: 'Ăn uống',
    note: '',
    createdAt: new Date(2026, 9, 2).getTime(),
  },
  {
    id: 'old',
    ownerId: 'u1',
    type: 'income',
    amount: 500,
    category: 'Khác',
    note: '',
    createdAt: new Date(2026, 8, 30).getTime(),
  },
];

it('parses only valid transactions for the expected account', () => {
  expect(parseFinanceTransaction(rows[0], 'u1')).toEqual(rows[0]);
  expect(parseFinanceTransaction({ ...rows[0], amount: 0 }, 'u1')).toBeNull();
  expect(parseFinanceTransaction(rows[0], 'u2')).toBeNull();
});

it('accepts positive whole-number VND amounts and rejects invalid input', () => {
  expect(parseFinanceAmount('25.000.000')).toBe(25000000);
  expect(parseFinanceAmount('0')).toBeNull();
  expect(parseFinanceAmount('abc')).toBeNull();
  expect(parseFinanceAmount('999999999999999999999')).toBeNull();
});

it('summarizes the selected month without counting other months', () => {
  expect(getMonthlySummary(rows, new Date(2026, 9, 15))).toEqual({
    income: 25000000,
    expense: 1250000,
    balance: 23750000,
  });
});
