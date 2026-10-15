import type {
  FinanceTransaction,
  SharedExpense,
  SharedExpenseParticipant,
  SharedExpenseReceipt,
} from '../types/finance';

export type PendingSharedExpense = {
  transaction: FinanceTransaction;
  remaining: number;
  pendingPeople: string[];
};

const ID = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_DATE = 253402300799999;

export function parseSharedExpense(
  value: unknown,
  grossAmount: number,
): SharedExpense | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Partial<SharedExpense>;
  if (
    !Array.isArray(row.participants) ||
    row.participants.length < 1 ||
    row.participants.length > 20 ||
    !Array.isArray(row.receipts) ||
    row.receipts.length > 100
  )
    return null;

  const participants: SharedExpenseParticipant[] = [];
  const ids = new Set<string>();
  let owedTotal = 0;
  for (const value of row.participants) {
    if (!value || typeof value !== 'object') return null;
    const person = value as Partial<SharedExpenseParticipant>;
    const name = typeof person.name === 'string' ? person.name.trim() : '';
    if (
      typeof person.id !== 'string' ||
      !ID.test(person.id) ||
      ids.has(person.id) ||
      typeof name !== 'string' ||
      !name ||
      name.length > 100 ||
      !Number.isSafeInteger(person.owedAmount) ||
      (person.owedAmount ?? 0) <= 0
    )
      return null;
    ids.add(person.id);
    owedTotal += person.owedAmount!;
    if (!Number.isSafeInteger(owedTotal) || owedTotal > grossAmount)
      return null;
    participants.push({ id: person.id, name, owedAmount: person.owedAmount! });
  }

  const receipts: SharedExpenseReceipt[] = [];
  const receiptIds = new Set<string>();
  const receivedByPerson = new Map<string, number>();
  for (const value of row.receipts) {
    if (!value || typeof value !== 'object') return null;
    const receipt = value as Partial<SharedExpenseReceipt>;
    if (
      typeof receipt.id !== 'string' ||
      !ID.test(receipt.id) ||
      receiptIds.has(receipt.id) ||
      typeof receipt.participantId !== 'string' ||
      !ids.has(receipt.participantId) ||
      !Number.isSafeInteger(receipt.amount) ||
      (receipt.amount ?? 0) <= 0 ||
      typeof receipt.receivedAt !== 'number' ||
      !Number.isFinite(receipt.receivedAt) ||
      receipt.receivedAt < 0 ||
      receipt.receivedAt > MAX_DATE ||
      typeof receipt.note !== 'string' ||
      receipt.note.length > 120
    )
      return null;
    receiptIds.add(receipt.id);
    const received =
      (receivedByPerson.get(receipt.participantId) ?? 0) + receipt.amount!;
    if (
      received >
      participants.find(({ id }) => id === receipt.participantId)!.owedAmount
    )
      return null;
    receivedByPerson.set(receipt.participantId, received);
    receipts.push({
      id: receipt.id,
      participantId: receipt.participantId,
      amount: receipt.amount!,
      receivedAt: receipt.receivedAt,
      note: receipt.note.trim(),
    });
  }
  return { participants, receipts };
}

export function getSharedExpenseTotals(shared: SharedExpense) {
  const owed = shared.participants.reduce(
    (sum, person) => sum + person.owedAmount,
    0,
  );
  const received = shared.receipts.reduce(
    (sum, receipt) => sum + receipt.amount,
    0,
  );
  return { owed, received, remaining: owed - received };
}

export function getPendingSharedExpenses(
  transactions: FinanceTransaction[],
  asOfExclusive = Date.now() + 1,
): PendingSharedExpense[] {
  return transactions
    .flatMap((transaction) => {
      if (
        transaction.type !== 'expense' ||
        !transaction.sharedExpense ||
        transaction.createdAt >= asOfExclusive
      )
        return [];
      const shared = transaction.sharedExpense;
      const pending = shared.participants.flatMap((person) => {
        const remaining = getSharedExpensePersonTotals(
          shared,
          person.id,
          asOfExclusive,
        ).remaining;
        return remaining > 0 ? [{ name: person.name, remaining }] : [];
      });
      const remaining = pending.reduce(
        (sum, person) => sum + person.remaining,
        0,
      );
      return remaining > 0
        ? [
            {
              transaction,
              remaining,
              pendingPeople: pending.map(({ name }) => name),
            },
          ]
        : [];
    })
    .sort((a, b) => b.transaction.createdAt - a.transaction.createdAt);
}

export function getSharedExpensePersonTotals(
  shared: SharedExpense,
  participantId: string,
  asOfExclusive = Number.POSITIVE_INFINITY,
) {
  const owed =
    shared.participants.find(({ id }) => id === participantId)?.owedAmount ?? 0;
  const received = shared.receipts
    .filter(
      (receipt) =>
        receipt.participantId === participantId &&
        receipt.receivedAt < asOfExclusive,
    )
    .reduce((sum, receipt) => sum + receipt.amount, 0);
  return { owed, received, remaining: owed - received };
}
