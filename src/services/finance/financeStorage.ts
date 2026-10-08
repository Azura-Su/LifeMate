import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FinanceTransaction } from '../../types/finance';
import { parseFinanceTransaction } from '../../utils/finance';

const queues = new Map<string, Promise<unknown>>();

export function financeStorageKey(uid: string) {
  return `lifemate:finance:v1:${encodeURIComponent(uid)}`;
}

function requireUid(uid: string) {
  if (!uid.trim()) throw new Error('Không tìm thấy tài khoản đang đăng nhập.');
}

export async function readFinanceTransactions(
  uid: string,
): Promise<FinanceTransaction[]> {
  requireUid(uid);
  const saved = await AsyncStorage.getItem(financeStorageKey(uid));
  if (!saved) return [];

  let values: unknown;
  try {
    values = JSON.parse(saved);
  } catch {
    throw new Error('Chưa đọc được sổ thu chi trên thiết bị.');
  }
  if (!Array.isArray(values))
    throw new Error('Dữ liệu sổ thu chi trên thiết bị không hợp lệ.');
  return values
    .map((value) => parseFinanceTransaction(value, uid))
    .filter((value): value is FinanceTransaction => value !== null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function updateFinanceTransactions(
  uid: string,
  update: (transactions: FinanceTransaction[]) => FinanceTransaction[],
) {
  requireUid(uid);
  const previous = queues.get(uid) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      const transactions = await readFinanceTransactions(uid);
      const updated = update(transactions).sort(
        (a, b) => b.createdAt - a.createdAt,
      );
      await AsyncStorage.setItem(
        financeStorageKey(uid),
        JSON.stringify(updated),
      );
      return updated;
    });
  queues.set(uid, next);
  void next
    .finally(() => {
      if (queues.get(uid) === next) queues.delete(uid);
    })
    .catch(() => undefined);
  return next;
}

export function addFinanceTransaction(
  uid: string,
  transaction: FinanceTransaction,
) {
  requireUid(uid);
  if (transaction.ownerId !== uid)
    return Promise.reject(
      new Error('Giao dịch không thuộc tài khoản đang đăng nhập.'),
    );
  if (!Number.isSafeInteger(transaction.amount) || transaction.amount <= 0)
    return Promise.reject(new Error('Số tiền phải là số nguyên lớn hơn 0.'));
  if (!parseFinanceTransaction(transaction, uid))
    return Promise.reject(new Error('Thông tin giao dịch không hợp lệ.'));
  return updateFinanceTransactions(uid, (transactions) => [
    transaction,
    ...transactions.filter((item) => item.id !== transaction.id),
  ]);
}

export function deleteFinanceTransaction(uid: string, id: string) {
  requireUid(uid);
  return updateFinanceTransactions(uid, (transactions) =>
    transactions.filter((transaction) => transaction.id !== id),
  );
}
