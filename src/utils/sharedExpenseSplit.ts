import type { SharedExpense } from '../types/finance';

export type ExpenseSplitMode = 'manual' | 'equal' | 'portions';
export type ExpenseSplitPerson = {
  id: string;
  name: string;
  amount: string;
  portions: string;
};
export type ExpenseSplitDraft = {
  mode: ExpenseSplitMode;
  includeMe: boolean;
  myPortions: string;
  people: ExpenseSplitPerson[];
};

/** Split preferences belong to the form; saved debts/receipts keep their contract. */
export function createExpenseSplitDraft(
  shared?: SharedExpense,
): ExpenseSplitDraft {
  return {
    mode: 'manual',
    includeMe: true,
    myPortions: '1',
    people:
      shared?.participants.map((p) => ({
        id: p.id,
        name: p.name,
        amount: String(p.owedAmount),
        portions: '1',
      })) ?? [],
  };
}

/** Hundredths of a portion; never reinterpret malformed input as a count. */
export function parseExpensePortions(value: string): number | null {
  const match = /^(\d{1,4})(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

/** Largest remainder allocation, with stable ties in display order (me first). */
export function allocateSharedExpense(
  total: number,
  portions: readonly number[],
): number[] | null {
  if (
    !Number.isSafeInteger(total) ||
    total <= 0 ||
    portions.length < 1 ||
    portions.length > 21 ||
    portions.some((n) => !Number.isSafeInteger(n) || n < 0 || n > 999999)
  )
    return null;
  const sum = portions.reduce((n, value) => n + value, 0);
  if (!sum) return null;
  const denominator = BigInt(sum);
  const parts = portions.map((n, index) => {
    const numerator = BigInt(total) * BigInt(n);
    return {
      index,
      amount: Number(numerator / denominator),
      remainder: numerator % denominator,
    };
  });
  const remaining = total - parts.reduce((n, p) => n + p.amount, 0);
  const order = [...parts].sort((a, b) =>
    a.remainder === b.remainder
      ? a.index - b.index
      : a.remainder > b.remainder
        ? -1
        : 1,
  );
  for (let i = 0; i < remaining; i += 1) order[i].amount += 1;
  return parts.map((p) => p.amount);
}

/** Used by preview and submit, so no effect can leave stale calculated debts. */
export function previewExpenseSplit(
  total: number | null,
  draft: ExpenseSplitDraft,
) {
  if (draft.mode === 'manual') return { people: draft.people, error: null };
  const clearAmounts = () => draft.people.map((p) => ({ ...p, amount: '' }));
  if (total === null || !draft.people.length)
    return { people: clearAmounts(), error: null };
  const mine =
    draft.mode === 'equal'
      ? draft.includeMe
        ? 100
        : 0
      : parseExpensePortions(draft.myPortions);
  const others = draft.people.map((p) =>
    draft.mode === 'equal' ? 100 : parseExpensePortions(p.portions),
  );
  if (mine === null || others.some((n) => n === null || n <= 0))
    return {
      people: clearAmounts(),
      error:
        'Nhập số suất hợp lệ (tối đa 9.999,99); mỗi người cần trả phải có suất lớn hơn 0.',
    };
  const amounts = allocateSharedExpense(total, [mine, ...(others as number[])]);
  if (!amounts)
    return {
      people: clearAmounts(),
      error: 'Chưa tính được phần chia. Kiểm tra số tiền và số suất.',
    };
  return {
    people: draft.people.map((p, i) => ({
      ...p,
      amount: String(amounts[i + 1]),
    })),
    error: amounts.slice(1).some((n) => n === 0)
      ? 'Số tiền quá nhỏ để mỗi người cần trả ít nhất 1đ. Hãy kiểm tra lại.'
      : null,
  };
}
