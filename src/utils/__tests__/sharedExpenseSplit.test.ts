import {
  allocateSharedExpense,
  parseExpensePortions,
} from '../sharedExpenseSplit';

it('parses integer/fractional portions without treating invalid text as another count', () => {
  expect(
    ['1', '0.5', '1,25', '9999.99', '0', ' 2 '].map(parseExpensePortions),
  ).toEqual([100, 50, 125, 999999, 0, 200]);
  for (const input of [
    '',
    '-1',
    '1e2',
    '1/2',
    '1.001',
    '1,2.3',
    '10000',
    'Infinity',
  ])
    expect(parseExpensePortions(input)).toBeNull();
});

it('splits equally with deterministic rounding, including my portion', () => {
  expect(allocateSharedExpense(100000, [100, 100, 100])).toEqual([
    33334, 33333, 33333,
  ]);
  expect(allocateSharedExpense(300001, [100, 100])).toEqual([150001, 150000]);
  expect(allocateSharedExpense(120000, [0, 100, 100])).toEqual([
    0, 60000, 60000,
  ]);
});

it('allocates portions proportionally and gives leftover dong to the largest remainder', () => {
  expect(allocateSharedExpense(150000, [100, 200, 300])).toEqual([
    25000, 50000, 75000,
  ]);
  expect(allocateSharedExpense(10, [100, 200, 300])).toEqual([2, 3, 5]);
  expect(allocateSharedExpense(5, [100, 100, 200])).toEqual([1, 1, 3]);
  expect(allocateSharedExpense(70000, [50, 125])).toEqual([20000, 50000]);
});

it('keeps exact integer totals near the largest supported bill and for tiny bills', () => {
  for (const total of [1, 2, 101, 100000, Number.MAX_SAFE_INTEGER])
    for (const portions of [
      [100, 100, 100],
      [0, 999999, 1],
      Array(21).fill(999999),
    ]) {
      const result = allocateSharedExpense(total, portions)!;
      expect(result).toHaveLength(portions.length);
      expect(result.every((n) => Number.isSafeInteger(n) && n >= 0)).toBe(true);
      expect(result.reduce((sum, n) => sum + n, 0)).toBe(total);
    }
});

it('rejects invalid bills or portion sets before doing arithmetic', () => {
  for (const total of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN])
    expect(allocateSharedExpense(total, [100, 100])).toBeNull();
  for (const portions of [
    [],
    [0, 0],
    [1, -1],
    [1, 0.5],
    [1, NaN],
    Array(22).fill(1),
    [1000000],
  ])
    expect(allocateSharedExpense(100000, portions)).toBeNull();
});
