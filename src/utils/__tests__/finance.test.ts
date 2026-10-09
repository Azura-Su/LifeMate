import {
  formatFinanceDate,
  getExpenseReport,
  getFinanceReport,
  getIncomeReport,
  getSalaryReport,
  getMonthlySummary,
  parseFinanceAmount,
  parseFinanceDate,
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

it('groups every transaction in the selected inclusive month range', () => {
  const transactions = [
    ...rows,
    {
      ...rows[1],
      id: 'march',
      createdAt: new Date(2026, 2, 3).getTime(),
    },
    {
      ...rows[1],
      id: 'april',
      createdAt: new Date(2026, 3, 4).getTime(),
    },
    {
      ...rows[0],
      id: 'other-year',
      createdAt: new Date(2025, 2, 4).getTime(),
    },
  ];
  expect(getFinanceReport(transactions, 2026, 9, 10)).toMatchObject({
    income: 25000500,
    expense: 1250000,
    balance: 23750500,
    months: [
      { month: 9, income: 500, expense: 0 },
      { month: 10, income: 25000000, expense: 1250000 },
    ],
  });
  expect(getFinanceReport(transactions, 2026, 2, 4).months).toMatchObject([
    { month: 3, income: 0, expense: 1250000 },
    { month: 4, income: 0, expense: 1250000 },
  ]);
  expect(getFinanceReport(transactions, 2026, 0, 4).months).toEqual([]);
  expect(getFinanceReport(transactions, 2026, 2, 13).months).toEqual([]);
});

it('summarizes salary only across an inclusive range that can span years', () => {
  const transactions: FinanceTransaction[] = [
    {
      ...rows[0],
      id: 'dec-2023-salary',
      amount: 100,
      createdAt: new Date(2023, 11, 8).getTime(),
    },
    {
      ...rows[0],
      id: 'jan-2024-salary',
      amount: 200,
      createdAt: new Date(2024, 0, 8).getTime(),
    },
    {
      ...rows[0],
      id: 'feb-2024-bonus',
      amount: 300,
      category: 'Thưởng',
      createdAt: new Date(2024, 1, 8).getTime(),
    },
    {
      ...rows[1],
      id: 'mar-2024-expense',
      amount: 400,
      category: 'Lương',
      createdAt: new Date(2024, 2, 8).getTime(),
    },
    {
      ...rows[0],
      id: 'apr-2024-salary',
      amount: 500,
      createdAt: new Date(2024, 3, 8).getTime(),
    },
    {
      ...rows[0],
      id: 'may-2024-salary',
      amount: 600,
      createdAt: new Date(2024, 4, 8).getTime(),
    },
  ];

  expect(getSalaryReport(transactions, 2023, 12, 2024, 4)).toEqual({
    total: 800,
    months: [
      { year: 2023, month: 12, total: 100, transactions: [transactions[0]] },
      { year: 2024, month: 1, total: 200, transactions: [transactions[1]] },
      { year: 2024, month: 4, total: 500, transactions: [transactions[4]] },
    ],
  });
  expect(getSalaryReport(transactions, 2024, 5, 2023, 12)).toEqual({
    total: 0,
    months: [],
  });
});

it('summarizes all income including removed categories across a custom multi-year range', () => {
  const transactions: FinanceTransaction[] = [
    {
      ...rows[0],
      id: 'salary-start',
      amount: 100,
      createdAt: new Date(2023, 11, 8).getTime(),
    },
    {
      ...rows[0],
      id: 'bonus',
      amount: 200,
      category: 'Thưởng',
      createdAt: new Date(2024, 0, 8).getTime(),
    },
    {
      ...rows[0],
      id: 'other-income',
      amount: 300,
      category: 'Thu nhập khác',
      createdAt: new Date(2024, 0, 15).getTime(),
    },
    {
      ...rows[0],
      id: 'expense-category-salary',
      type: 'expense',
      amount: 400,
      createdAt: new Date(2024, 1, 8).getTime(),
    },
    {
      ...rows[0],
      id: 'untracked-income',
      category: 'Khác',
      amount: 500,
      createdAt: new Date(2024, 1, 9).getTime(),
    },
    {
      ...rows[0],
      id: 'salary-end',
      amount: 600,
      createdAt: new Date(2024, 3, 30).getTime(),
    },
    {
      ...rows[0],
      id: 'after-range',
      amount: 700,
      createdAt: new Date(2024, 4, 1).getTime(),
    },
  ];

  expect(getIncomeReport(transactions, 2023, 12, 2024, 4)).toEqual({
    total: 1700,
    categories: { Lương: 700, Thưởng: 200, 'Thu nhập khác': 300, Khác: 500 },
    months: [
      {
        year: 2023,
        month: 12,
        total: 100,
        categories: { Lương: 100, Thưởng: 0, 'Thu nhập khác': 0, Khác: 0 },
        transactions: [transactions[0]],
      },
      {
        year: 2024,
        month: 1,
        total: 500,
        categories: { Lương: 0, Thưởng: 200, 'Thu nhập khác': 300, Khác: 0 },
        transactions: [transactions[1], transactions[2]],
      },
      {
        year: 2024,
        month: 2,
        total: 500,
        categories: { Lương: 0, Thưởng: 0, 'Thu nhập khác': 0, Khác: 500 },
        transactions: [transactions[4]],
      },
      {
        year: 2024,
        month: 4,
        total: 600,
        categories: { Lương: 600, Thưởng: 0, 'Thu nhập khác': 0, Khác: 0 },
        transactions: [transactions[5]],
      },
    ],
  });
  expect(getIncomeReport(transactions, 2024, 5, 2023, 12)).toEqual({
    total: 0,
    categories: { Lương: 0, Thưởng: 0, 'Thu nhập khác': 0 },
    months: [],
  });
});

it('summarizes expenses by category across a custom multi-year range', () => {
  const transactions: FinanceTransaction[] = [
    {
      ...rows[1],
      id: 'december-food',
      amount: 100,
      category: 'Ăn uống',
      createdAt: new Date(2023, 11, 8).getTime(),
    },
    {
      ...rows[1],
      id: 'january-housing',
      amount: 200,
      category: 'Nhà cửa',
      createdAt: new Date(2024, 0, 8).getTime(),
    },
    {
      ...rows[1],
      id: 'january-other-expense',
      amount: 300,
      category: 'Khác',
      createdAt: new Date(2024, 0, 15).getTime(),
    },
    {
      ...rows[0],
      id: 'income-not-counted',
      amount: 400,
      category: 'Ăn uống',
      createdAt: new Date(2024, 0, 20).getTime(),
    },
    {
      ...rows[1],
      id: 'legacy-expense-category',
      amount: 500,
      category: 'Thu nhập khác',
      createdAt: new Date(2024, 1, 8).getTime(),
    },
    {
      ...rows[1],
      id: 'outside-range',
      amount: 600,
      category: 'Mua sắm',
      createdAt: new Date(2024, 2, 1).getTime(),
    },
  ];

  expect(getExpenseReport(transactions, 2023, 12, 2024, 2)).toEqual({
    total: 1100,
    categories: {
      'Ăn uống': 100,
      'Di chuyển': 0,
      'Nhà cửa': 200,
      'Mua sắm': 0,
      'Sức khỏe': 0,
      Khác: 300,
      'Thu nhập khác': 500,
    },
    months: [
      {
        year: 2023,
        month: 12,
        total: 100,
        categories: {
          'Ăn uống': 100,
          'Di chuyển': 0,
          'Nhà cửa': 0,
          'Mua sắm': 0,
          'Sức khỏe': 0,
          Khác: 0,
          'Thu nhập khác': 0,
        },
        transactions: [transactions[0]],
      },
      {
        year: 2024,
        month: 1,
        total: 500,
        categories: {
          'Ăn uống': 0,
          'Di chuyển': 0,
          'Nhà cửa': 200,
          'Mua sắm': 0,
          'Sức khỏe': 0,
          Khác: 300,
          'Thu nhập khác': 0,
        },
        transactions: [transactions[1], transactions[2]],
      },
      {
        year: 2024,
        month: 2,
        total: 500,
        categories: {
          'Ăn uống': 0,
          'Di chuyển': 0,
          'Nhà cửa': 0,
          'Mua sắm': 0,
          'Sức khỏe': 0,
          Khác: 0,
          'Thu nhập khác': 500,
        },
        transactions: [transactions[4]],
      },
    ],
  });
});

it('parses and formats a valid local transaction date', () => {
  const timestamp = parseFinanceDate('29/02/2024');
  expect(timestamp).not.toBeNull();
  expect(new Date(timestamp!).getDate()).toBe(29);
  expect(parseFinanceDate('31/04/2026')).toBeNull();
  expect(parseFinanceDate('29/02/2025')).toBeNull();
  expect(formatFinanceDate(new Date(2026, 9, 8))).toBe('08/10/2026');
});
