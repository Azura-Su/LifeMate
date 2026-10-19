import { useEffect, useMemo, useRef, useState } from 'react';
import { useFinanceAccount } from '../../hooks/useFinanceAccount';
import { useFinanceStore } from '../../store/financeStore';
import type {
  RegularFinanceIncomeSource,
  FinanceTransaction,
  FinanceTransactionType,
  SharedExpense,
} from '../../types/finance';
import {
  readFinancePreferences,
  writeFinancePreferences,
  type FinancePreferences,
  type FinanceTransactionTemplate,
} from '../../services/finance/financePreferences';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../types/finance';
import {
  getFinanceReport,
  parseFinanceAmount,
  parseFinanceDate,
} from '../../utils/finance';
import { parseSharedExpense } from '../../utils/sharedExpense';

type Draft = {
  type: FinanceTransactionType;
  incomeSource?: RegularFinanceIncomeSource;
  amount: string;
  category: string;
  note: string;
  date: string;
  sharedExpense?: SharedExpense;
};

const EMPTY_PREFERENCES: FinancePreferences = {
  incomeCategories: [...INCOME_CATEGORIES],
  otherIncomeCategories: [INCOME_CATEGORIES[2]],
  expenseCategories: [...EXPENSE_CATEGORIES],
  templates: [],
};

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useFinanceScreen() {
  const currentDate = new Date();
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const account = useFinanceAccount();
  const { uid, transactions } = account;
  const add = useFinanceStore((state) => state.add);
  const remove = useFinanceStore((state) => state.remove);
  const update = useFinanceStore((state) => state.update);
  const [preferences, setPreferences] = useState(EMPTY_PREFERENCES);
  const preferencesRef = useRef(EMPTY_PREFERENCES);
  const preferencesUid = useRef<string | null>(null);
  const preferencesLoad = useRef<Promise<void>>(Promise.resolve());
  const [preferencesSynced, setPreferencesSynced] = useState<boolean | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    preferencesUid.current = uid;
    preferencesRef.current = EMPTY_PREFERENCES;
    setPreferences(EMPTY_PREFERENCES);
    setPreferencesSynced(null);
    preferencesLoad.current = uid
      ? readFinancePreferences(uid)
          .then((result) => {
            if (active && preferencesUid.current === uid) {
              preferencesRef.current = result.preferences;
              setPreferences(result.preferences);
              setPreferencesSynced(result.synced);
            }
          })
          .catch(() => {
            if (active && preferencesUid.current === uid)
              setPreferencesSynced(false);
          })
      : Promise.resolve();
    return () => {
      active = false;
    };
  }, [uid]);

  async function savePreferences(
    updatePreferences: (current: FinancePreferences) => FinancePreferences,
  ) {
    if (!uid) throw new Error('Bạn cần đăng nhập để lưu cài đặt.');
    await preferencesLoad.current;
    if (preferencesUid.current !== uid)
      throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
    const next = updatePreferences(preferencesRef.current);
    preferencesRef.current = next;
    setPreferences(next);
    const result = await writeFinancePreferences(uid, next);
    if (preferencesUid.current === uid) {
      if (result.synced) {
        preferencesRef.current = result.preferences;
        setPreferences(result.preferences);
      }
      setPreferencesSynced(result.synced);
    }
  }

  async function refresh() {
    await account.refresh();
    if (!uid) return;
    const result = await readFinancePreferences(uid);
    if (preferencesUid.current === uid) {
      preferencesRef.current = result.preferences;
      setPreferences(result.preferences);
      setPreferencesSynced(result.synced);
    }
  }

  async function addTransaction(draft: Draft) {
    if (!uid) throw new Error('Bạn cần đăng nhập để lưu giao dịch.');
    const amount = parseFinanceAmount(draft.amount);
    if (amount === null) throw new Error('Nhập số tiền lớn hơn 0.');
    const createdAt = parseFinanceDate(draft.date);
    if (createdAt === null)
      throw new Error('Ngày không hợp lệ. Nhập theo dạng DD/MM/YYYY.');
    const sharedExpense = draft.sharedExpense
      ? parseSharedExpense(draft.sharedExpense, amount)
      : undefined;
    if (draft.type !== 'expense' && draft.sharedExpense)
      throw new Error('Chỉ khoản chi mới có người trả lại.');
    if (draft.sharedExpense && !sharedExpense)
      throw new Error('Phần người cần trả lại không hợp lệ.');
    const transaction: FinanceTransaction = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
      ownerId: uid,
      type: draft.type,
      ...(draft.type === 'income'
        ? { incomeSource: draft.incomeSource ?? 'company' }
        : {}),
      amount,
      category: draft.category,
      note: draft.note.trim(),
      createdAt,
      ...(draft.type === 'expense' && sharedExpense ? { sharedExpense } : {}),
    };
    await add(uid, transaction);
    return transaction.id;
  }

  async function removeTransaction(id: string) {
    if (!uid) throw new Error('Bạn cần đăng nhập để xóa giao dịch.');
    await remove(uid, id);
  }

  async function updateTransaction(
    id: string,
    draft: Draft,
    expected: FinanceTransaction,
  ) {
    if (!uid) throw new Error('Bạn cần đăng nhập để sửa giao dịch.');
    const original = transactions.find((item) => item.id === id);
    if (!original) throw new Error('Không tìm thấy giao dịch cần sửa.');
    const amount = parseFinanceAmount(draft.amount);
    if (amount === null) throw new Error('Nhập số tiền lớn hơn 0.');
    const createdAt = parseFinanceDate(draft.date);
    if (createdAt === null)
      throw new Error('Ngày không hợp lệ. Nhập theo dạng DD/MM/YYYY.');
    const transaction: FinanceTransaction = {
      ...original,
      type: draft.type,
      amount,
      category: draft.category,
      note: draft.note.trim(),
      createdAt,
    };
    // Omit the key for expenses: Firestore rejects `undefined` field values.
    if (draft.type === 'income')
      transaction.incomeSource = draft.incomeSource ?? 'company';
    else delete transaction.incomeSource;
    if (draft.type === 'expense' && draft.sharedExpense) {
      const parsed = parseSharedExpense(draft.sharedExpense, amount);
      if (!parsed) throw new Error('Phần người cần trả lại không hợp lệ.');
      transaction.sharedExpense = parsed;
    } else {
      if (original.sharedExpense?.receipts.length)
        throw new Error(
          'Hãy xóa các lần nhận lại trước khi bỏ phần chia khoản chi.',
        );
      delete transaction.sharedExpense;
    }
    await update(uid, transaction, expected);
  }

  async function saveSharedReceipt(
    original: FinanceTransaction,
    draft: {
      requestId: string;
      participantId: string;
      amount: string;
      date: string;
      note: string;
    },
    receiptId?: string,
  ) {
    if (!uid) throw new Error('Bạn cần đăng nhập để lưu lần nhận lại.');
    const amount = parseFinanceAmount(draft.amount);
    const receivedAt = parseFinanceDate(draft.date);
    if (amount === null || receivedAt === null)
      throw new Error('Số tiền hoặc ngày nhận không hợp lệ.');
    if (original.ownerId !== uid || !original.sharedExpense)
      throw new Error('Không tìm thấy khoản chi cần cập nhật.');
    // Only deduplication reads current state. The mutation below must keep the
    // snapshot captured when the form opened as its CAS expectation.
    const latest = useFinanceStore.getState();
    const latestTransaction =
      latest.uid === uid
        ? latest.transactions.find(({ id }) => id === original.id)
        : undefined;
    const existingRequest =
      !receiptId && latestTransaction?.ownerId === uid
        ? latestTransaction.sharedExpense?.receipts.find(
            ({ id }) => id === draft.requestId,
          )
        : undefined;
    if (!receiptId && existingRequest) {
      if (
        existingRequest.participantId === draft.participantId &&
        existingRequest.amount === amount &&
        existingRequest.receivedAt === receivedAt &&
        existingRequest.note === draft.note.trim()
      )
        return;
      throw new Error('Lần nhận này đã thay đổi. Hãy tải lại.');
    }
    const receipts = receiptId
      ? original.sharedExpense.receipts.map((receipt) =>
          receipt.id === receiptId
            ? {
                ...receipt,
                participantId: draft.participantId,
                amount,
                receivedAt,
                note: draft.note.trim(),
              }
            : receipt,
        )
      : [
          ...original.sharedExpense.receipts,
          {
            id: draft.requestId,
            participantId: draft.participantId,
            amount,
            receivedAt,
            note: draft.note.trim(),
          },
        ];
    if (receiptId && !receipts.some(({ id }) => id === receiptId))
      throw new Error('Không tìm thấy lần nhận cần sửa.');
    const sharedExpense = parseSharedExpense(
      { ...original.sharedExpense, receipts },
      original.amount,
    );
    if (!sharedExpense)
      throw new Error(
        'Số tiền nhận vượt phần người này cần trả hoặc dữ liệu chưa hợp lệ.',
      );
    await update(uid, { ...original, sharedExpense }, original);
  }

  async function removeSharedReceipt(
    original: FinanceTransaction,
    receiptId: string,
  ) {
    if (!uid) throw new Error('Bạn cần đăng nhập để xóa lần nhận lại.');
    if (
      original.ownerId !== uid ||
      !original.sharedExpense?.receipts.some(({ id }) => id === receiptId)
    )
      throw new Error('Không tìm thấy lần nhận cần xóa.');
    await update(
      uid,
      {
        ...original,
        sharedExpense: {
          ...original.sharedExpense,
          receipts: original.sharedExpense.receipts.filter(
            ({ id }) => id !== receiptId,
          ),
        },
      },
      original,
    );
  }

  async function addTemplate(template: Omit<FinanceTransactionTemplate, 'id'>) {
    await preferencesLoad.current;
    const name = template.name.trim();
    if (!name || !Number.isSafeInteger(template.amount) || template.amount <= 0)
      throw new Error('Tên mẫu và số tiền chưa hợp lệ.');
    if (preferencesRef.current.templates.length >= 100)
      throw new Error('Bạn đã đạt giới hạn 100 mẫu giao dịch.');
    if (
      preferencesRef.current.templates.some(
        (item) =>
          item.type === template.type &&
          item.name.toLocaleLowerCase('vi') === name.toLocaleLowerCase('vi'),
      )
    )
      throw new Error('Tên mẫu này đã có rồi.');
    await savePreferences((current) => ({
      ...current,
      templates: [...current.templates, { ...template, name, id: makeId() }],
    }));
  }

  async function removeTemplate(id: string) {
    await savePreferences((current) => ({
      ...current,
      templates: current.templates.filter((item) => item.id !== id),
    }));
  }

  async function addCategory(
    type: FinanceTransactionType,
    value: string,
    incomeSource: RegularFinanceIncomeSource = 'company',
  ) {
    await preferencesLoad.current;
    const category = value.trim();
    if (!category || category.length > 50)
      throw new Error('Tên danh mục từ 1 đến 50 ký tự.');
    const key =
      type === 'expense'
        ? 'expenseCategories'
        : incomeSource === 'other'
          ? 'otherIncomeCategories'
          : 'incomeCategories';
    const values = preferencesRef.current[key];
    if (values.length >= 30)
      throw new Error('Mỗi loại có thể có tối đa 30 danh mục.');
    if (
      values.some(
        (item) =>
          item.toLocaleLowerCase('vi') === category.toLocaleLowerCase('vi'),
      )
    )
      throw new Error('Danh mục này đã có rồi.');
    await savePreferences((current) => ({
      ...current,
      [key]: [...current[key], category],
    }));
  }

  async function removeCategory(
    type: FinanceTransactionType,
    value: string,
    incomeSource: RegularFinanceIncomeSource = 'company',
  ) {
    const builtIn = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (builtIn.some((category) => category === value)) return;
    const key =
      type === 'expense'
        ? 'expenseCategories'
        : incomeSource === 'other'
          ? 'otherIncomeCategories'
          : 'incomeCategories';
    await savePreferences((current) => ({
      ...current,
      [key]: current[key].filter((item) => item !== value),
    }));
  }

  function changePeriod(nextYear: number, nextMonth: number) {
    setYear(Math.min(9999, Math.max(1900, nextYear)));
    setMonth(Math.min(12, Math.max(1, nextMonth)));
  }

  const report = useMemo(
    () => getFinanceReport(transactions, year, month, month),
    [transactions, year, month],
  );

  return {
    ...account,
    syncStatus:
      account.syncStatus === 'recovery'
        ? 'recovery'
        : account.syncStatus === 'local' || preferencesSynced === false
          ? 'local'
          : account.syncStatus,
    refresh,
    year,
    month,
    report,
    preferences,
    addTemplate,
    removeTemplate,
    addCategory,
    removeCategory,
    setPeriod: changePeriod,
    addTransaction,
    updateTransaction,
    removeTransaction,
    saveSharedReceipt,
    removeSharedReceipt,
  };
}
