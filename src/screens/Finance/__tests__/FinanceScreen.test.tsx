import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getDocsFromServer,
  runTransaction,
  setDoc,
} from '@react-native-firebase/firestore';
import * as SecureStore from 'expo-secure-store';
import { Alert, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
  waitFor,
} from '@testing-library/react-native';
import { FinanceScreen } from '../FinanceScreen';
import { useFinanceScreen } from '../useFinanceScreen';
import { useAuthStore } from '../../../store/authStore';
import { useFinanceStore } from '../../../store/financeStore';
import {
  financeStorageKey,
  resetFinanceCloudState,
  readFinanceTransactions,
} from '../../../services/finance/financeStorage';
import { setEncryptedItem } from '../../../services/security/encryptedLocalStorage';
import { readFinancePreferences } from '../../../services/finance/financePreferences';
import type { FinanceTransaction } from '../../../types/finance';
import {
  resetFirestoreMock,
  seedFirestoreMock,
  seedFinancePreferencesMock,
} from '../../../testing/firestoreMock';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);
jest.mock('@react-native-firebase/firestore', () =>
  jest.requireActual('../../../testing/firestoreMock'),
);

function financeScreenElement(suspended = false) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      <FinanceScreen suspended={suspended} />
    </SafeAreaProvider>
  );
}
function renderFinanceScreen(suspended = false) {
  return render(financeScreenElement(suspended));
}

function pressMeasuredPicker(button: ReturnType<typeof screen.getByRole>) {
  const instance = button.parent?.instance as unknown as {
    measureInWindow: jest.Mock;
  };
  instance.measureInWindow.mockImplementation(
    (callback: (x: number, y: number, width: number, height: number) => void) =>
      callback(16, 220, 180, 44),
  );
  fireEvent.press(button);
}

beforeEach(async () => {
  await AsyncStorage.clear();
  resetFirestoreMock();
  resetFinanceCloudState();
  useAuthStore.getState().setUser({
    uid: 'finance-user',
    email: 'person@example.com',
    displayName: null,
  });
  useFinanceStore.setState({
    uid: null,
    transactions: [],
    syncStatus: null,
    loading: false,
    error: null,
  });
});

it.each(['hidden', 'reopened'] as const)(
  'rejects a transaction confirmation after Finance was %s',
  async (state) => {
    const transaction: FinanceTransaction = {
      id: 'locked-delete',
      ownerId: 'finance-user',
      type: 'expense',
      amount: 100,
      category: 'Ăn uống',
      note: 'Lock guarded',
      createdAt: Date.now(),
    };
    seedFirestoreMock('finance-user', transaction);
    let confirm: (() => void) | undefined;
    const alert = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        confirm = buttons?.find(
          (button) => button.style === 'destructive',
        )?.onPress;
      });
    try {
      const view = renderFinanceScreen();
      fireEvent.press(
        await screen.findByRole('button', {
          name: 'Xóa giao dịch Lock guarded',
        }),
      );
      expect(confirm).toBeDefined();
      view.rerender(financeScreenElement(true));
      if (state === 'reopened') view.rerender(financeScreenElement(false));
      await act(async () => confirm?.());
      expect(
        useFinanceStore
          .getState()
          .transactions.some(({ id }) => id === transaction.id),
      ).toBe(true);
      expect(
        (await readFinanceTransactions('finance-user')).some(
          ({ id }) => id === transaction.id,
        ),
      ).toBe(true);
    } finally {
      alert.mockRestore();
    }
  },
);

it('shows cloud data and a recovery status when the encrypted cache is unavailable', async () => {
  const cloudRow: FinanceTransaction = {
    id: 'cloud-salary',
    ownerId: 'finance-user',
    type: 'income',
    amount: 12000000,
    category: 'Lương',
    note: 'Cloud copy',
    createdAt: Date.now(),
  };
  await setEncryptedItem(
    'finance-user',
    financeStorageKey('finance-user'),
    JSON.stringify([cloudRow]),
  );
  seedFirestoreMock('finance-user', cloudRow);
  const getItem = jest.mocked(SecureStore.getItemAsync);
  const originalGetItem = getItem.getMockImplementation();
  getItem.mockRejectedValue(new Error('Keychain access failed'));
  try {
    renderFinanceScreen();

    expect(
      await screen.findByText('Đã tải từ cloud · cache trên máy chưa đọc được'),
    ).toBeTruthy();
    expect(screen.getByText('Cloud copy')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tải lại' })).toBeTruthy();
  } finally {
    if (originalGetItem) getItem.mockImplementation(originalGetItem);
  }
});

it('shows a clear empty state and zero period totals', async () => {
  renderFinanceScreen();
  expect(await screen.findByText('Chưa có giao dịch nào')).toBeTruthy();
  expect(screen.getByText('Tổng thu')).toBeTruthy();
  expect(screen.getByText('Tổng chi')).toBeTruthy();
  expect(screen.getByText('Còn lại trong kỳ')).toBeTruthy();
  expect(await screen.findByText('Đã lưu trên tài khoản')).toBeTruthy();
});

it('separates fixed report tabs from the title header', async () => {
  renderFinanceScreen();
  await screen.findByText('Đã lưu trên tài khoản');
  const header = within(screen.getByTestId('screen-fixed-header'));
  const reportMode = within(screen.getByTestId('screen-fixed-content'));
  expect(
    reportMode.getByRole('tab', { name: 'Báo cáo chi tiêu' }),
  ).toBeTruthy();
  expect(header.getByRole('button', { name: 'Thêm giao dịch' })).toBeTruthy();
  fireEvent.press(reportMode.getByRole('tab', { name: 'Báo cáo thu nhập' }));
  fireEvent.press(screen.getByRole('button', { name: 'Năm báo cáo trước' }));
  fireEvent.press(header.getByRole('button', { name: 'Thêm khoản thu' }));

  expect(screen.getByLabelText('Ngày giao dịch').props.value).toBe(
    `01/01/${new Date().getFullYear() - 1}`,
  );
});

it('never renders the previous account transactions while binding a new account', async () => {
  const previous: FinanceTransaction = {
    id: 'private-old-account',
    ownerId: 'old-user',
    type: 'income',
    amount: 12000000,
    category: 'Lương',
    note: 'Dữ liệu tài khoản trước',
    createdAt: Date.now(),
  };
  useFinanceStore.setState({ uid: 'old-user', transactions: [previous] });
  const renderedTransactions: FinanceTransaction[][] = [];
  const hook = renderHook(() => {
    const model = useFinanceScreen();
    renderedTransactions.push(model.transactions);
    return model;
  });
  await act(async () => undefined);

  expect(renderedTransactions.flat()).not.toContainEqual(previous);
  expect(hook.result.current.transactions).toEqual([]);
});

it('warns when the current records have not reached the account cloud store', async () => {
  const localRow: FinanceTransaction = {
    id: 'local-salary',
    ownerId: 'finance-user',
    type: 'income',
    amount: 12000000,
    category: 'Lương',
    note: 'Lương chỉ trên máy',
    createdAt: new Date(2026, 9, 1, 12).getTime(),
  };
  await AsyncStorage.setItem(
    financeStorageKey('finance-user'),
    JSON.stringify([localRow]),
  );
  const reads = jest.mocked(getDocsFromServer);
  const read = reads.getMockImplementation()!;
  let failed = false;
  reads.mockImplementation((ref) => {
    const target = ref as unknown as { path: string; filters?: unknown[] };
    if (
      !failed &&
      target.path === 'financeAccounts/finance-user/transactions' &&
      !target.filters
    ) {
      failed = true;
      return Promise.reject(new Error('Offline'));
    }
    return read(ref);
  });

  renderFinanceScreen();

  expect(
    await screen.findByText('Chưa sao lưu · chỉ có trên thiết bị'),
  ).toBeTruthy();
  expect(screen.getByText('Lương chỉ trên máy')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Đồng bộ lại' })).toBeTruthy();
  reads.mockImplementation(read);
});

it('marks custom finance preferences unsynced and retries them on refresh', async () => {
  const hook = renderHook(() => useFinanceScreen());
  await waitFor(() => expect(hook.result.current.syncStatus).toBe('synced'));
  jest.mocked(setDoc).mockRejectedValueOnce(new Error('Offline'));

  await act(async () => {
    await hook.result.current.addCategory('expense', 'Thú cưng');
  });
  expect(hook.result.current.preferences.expenseCategories).toContain(
    'Thú cưng',
  );
  expect(hook.result.current.syncStatus).toBe('local');

  await act(async () => {
    await hook.result.current.refresh();
  });
  expect(hook.result.current.syncStatus).toBe('synced');
});

it('records salary on the selected date and persists it', async () => {
  const year = new Date().getFullYear();
  renderFinanceScreen();
  fireEvent.press(
    await screen.findByRole('button', { name: 'Chọn tháng xem giao dịch' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Tháng 9' }));
  fireEvent.press(
    await screen.findByRole('button', { name: 'Thêm giao dịch' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Thu nhập' }));
  fireEvent.changeText(screen.getByLabelText('Số tiền'), '25000000');
  fireEvent.changeText(
    screen.getByLabelText('Ngày giao dịch'),
    `15/09/${year}`,
  );
  fireEvent.changeText(screen.getByLabelText('Ghi chú'), 'Lương tháng này');
  fireEvent.press(screen.getByRole('button', { name: 'Lưu giao dịch' }));

  expect(await screen.findByText('Lương tháng này')).toBeTruthy();
  expect(screen.getAllByText('25.000.000 ₫').length).toBeGreaterThan(0);
  expect(
    await AsyncStorage.getItem('lifemate:finance:v1:finance-user'),
  ).not.toBeNull();
  const [saved] = await readFinanceTransactions('finance-user');
  expect(new Date(saved.createdAt).getDate()).toBe(15);
  expect(saved).toMatchObject({ type: 'income', incomeSource: 'company' });
});

it('formats the entered amount and can dismiss the form from its header', async () => {
  renderFinanceScreen();
  await screen.findByText('Đã lưu trên tài khoản');
  fireEvent.press(screen.getByRole('button', { name: 'Thêm giao dịch' }));
  fireEvent.changeText(screen.getByLabelText('Số tiền'), '25000000');
  expect(screen.getByLabelText('Số tiền').props.value).toBe('25.000.000');
  expect(
    screen.getByLabelText('Số tiền bằng chữ: Hai mươi lăm triệu đồng'),
  ).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Đóng thêm giao dịch' }));
  expect(screen.queryByLabelText('Số tiền')).toBeNull();
});

it('adds a shared expense and records a partial repayment from its detail', async () => {
  renderFinanceScreen();
  await screen.findByText('Đã lưu trên tài khoản');
  fireEvent.press(screen.getByRole('button', { name: 'Thêm giao dịch' }));
  fireEvent.changeText(screen.getByLabelText('Số tiền'), '500000');
  fireEvent.changeText(screen.getByLabelText('Ghi chú'), 'Ăn chung');
  fireEvent.press(screen.getByRole('switch', { name: 'Có người cần trả lại' }));
  fireEvent.changeText(screen.getByLabelText('Tên người 1'), 'An');
  fireEvent.changeText(
    screen.getByLabelText('Số tiền người 1 cần trả'),
    '300000',
  );
  expect(screen.getByText('Phần của tôi dự kiến: 200.000 ₫')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Lưu giao dịch' }));

  const open = await screen.findByRole('button', {
    name: 'Xem chi tiết Ăn chung',
  });
  fireEvent.press(open);
  expect(screen.getByText('Chi chung')).toBeTruthy();
  expect(screen.queryByText(/Tiền nhận lại giảm chi/)).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Nhận lại tiền từ An' }));
  fireEvent.changeText(screen.getByLabelText('Số tiền nhận lại'), '100000');
  fireEvent.press(screen.getByRole('button', { name: 'Lưu lần nhận lại' }));

  await waitFor(() => {
    expect(screen.getByText('+100.000 ₫')).toBeTruthy();
    expect(
      useFinanceStore.getState().transactions[0].sharedExpense?.receipts,
    ).toMatchObject([{ participantId: expect.any(String), amount: 100000 }]);
  });
});

it.each(['edit', 'delete'] as const)(
  'rejects a stale receipt %s after a background refresh',
  async (action) => {
    const original: FinanceTransaction = {
      id: 'shared-stale',
      ownerId: 'finance-user',
      type: 'expense',
      amount: 500000,
      category: 'Ăn uống',
      note: 'Chi chung cũ',
      createdAt: Date.now(),
      sharedExpense: {
        participants: [{ id: 'an', name: 'An', owedAmount: 300000 }],
        receipts: [
          {
            id: 'receipt',
            participantId: 'an',
            amount: 100000,
            receivedAt: Date.now(),
            note: 'Cũ',
          },
        ],
      },
    };
    seedFirestoreMock('finance-user', original);
    renderFinanceScreen();
    fireEvent.press(
      await screen.findByRole('button', { name: 'Xem chi tiết Chi chung cũ' }),
    );
    let confirmDelete: (() => void) | undefined;
    const alert = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        confirmDelete = buttons?.find(
          (button) => button.style === 'destructive',
        )?.onPress;
      });
    try {
      fireEvent.press(
        screen.getByRole('button', {
          name: action === 'edit' ? 'Sửa lần nhận từ An' : 'Xóa lần nhận từ An',
        }),
      );
      const updated: FinanceTransaction = {
        ...original,
        sharedExpense: {
          ...original.sharedExpense!,
          receipts: [
            {
              ...original.sharedExpense!.receipts[0],
              amount: 200000,
              note: 'Mới từ thiết bị khác',
            },
          ],
        },
      };
      seedFirestoreMock('finance-user', updated);
      await act(async () => useFinanceStore.getState().load('finance-user'));
      if (action === 'edit') {
        fireEvent.changeText(
          screen.getByLabelText('Ghi chú lần nhận lại'),
          'Ghi đè từ form cũ',
        );
        fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }));
      } else act(() => confirmDelete?.());
      await waitFor(() =>
        expect(screen.getAllByText(/thay đổi/).length).toBeGreaterThan(0),
      );
      expect(
        useFinanceStore.getState().transactions[0].sharedExpense?.receipts,
      ).toEqual(updated.sharedExpense!.receipts);
      expect(
        (await readFinanceTransactions('finance-user'))[0].sharedExpense
          ?.receipts,
      ).toEqual(updated.sharedExpense!.receipts);
    } finally {
      alert.mockRestore();
    }
  },
);

it('acknowledges an identical new-receipt retry without another write and rejects a changed request', async () => {
  const original: FinanceTransaction = {
    id: 'shared-retry',
    ownerId: 'finance-user',
    type: 'expense',
    amount: 500000,
    category: 'Ăn uống',
    note: 'Chi chung',
    createdAt: Date.now(),
    sharedExpense: {
      participants: [{ id: 'an', name: 'An', owedAmount: 300000 }],
      receipts: [],
    },
  };
  seedFirestoreMock('finance-user', original);
  const { result } = renderHook(() => useFinanceScreen());
  await waitFor(() =>
    expect(useFinanceStore.getState().transactions).toHaveLength(1),
  );
  const draft = {
    requestId: 'stable-request',
    participantId: 'an',
    amount: '100000',
    date: '19/10/2026',
    note: '  Lần nhận  ',
  };
  await act(async () => result.current.saveSharedReceipt(original, draft));
  const writes = jest.mocked(runTransaction).mock.calls.length;
  await act(async () => {
    await expect(
      result.current.saveSharedReceipt(original, draft),
    ).resolves.toBeUndefined();
    await expect(
      result.current.saveSharedReceipt(original, {
        ...draft,
        amount: '200000',
      }),
    ).rejects.toThrow('Lần nhận này đã thay đổi');
  });
  expect(jest.mocked(runTransaction)).toHaveBeenCalledTimes(writes);
  expect(
    useFinanceStore.getState().transactions[0].sharedExpense?.receipts,
  ).toHaveLength(1);
});

it('stops showing a shared expense as pending when its dated repayment is today before noon', async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 16, 10, 30) });
  try {
    seedFirestoreMock('finance-user', {
      id: 'settled-shared-expense',
      ownerId: 'finance-user',
      type: 'expense',
      amount: 98000,
      category: 'Ăn uống',
      note: 'Ăn trưa bún vịt quay',
      createdAt: new Date(2026, 9, 14, 12).getTime(),
      sharedExpense: {
        participants: [{ id: 'chinh', name: 'Chỉnh', owedAmount: 49000 }],
        receipts: [
          {
            id: 'paid',
            participantId: 'chinh',
            amount: 49000,
            receivedAt: new Date(2026, 9, 16, 12).getTime(),
            note: 'Đã thanh toán',
          },
        ],
      },
    });

    renderFinanceScreen();
    expect(await screen.findByText('Ăn trưa bún vịt quay')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /Xem khoản còn chờ nhận/ }),
    ).toBeNull();

    fireEvent.press(screen.getByRole('tab', { name: 'Báo cáo chi tiêu' }));
    expect(screen.queryByText(/Còn chờ nhận/)).toBeNull();
  } finally {
    jest.useRealTimers();
  }
});

it('keeps tomorrow’s repayment pending today and a next-month repayment pending in the prior month', async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 16, 10, 30) });
  try {
    const sharedExpense: FinanceTransaction = {
      id: 'tomorrow-shared-expense',
      ownerId: 'finance-user',
      type: 'expense',
      amount: 98000,
      category: 'Ăn uống',
      note: 'Khoản trả ngày mai',
      createdAt: new Date(2026, 9, 14, 12).getTime(),
      sharedExpense: {
        participants: [{ id: 'an', name: 'An', owedAmount: 49000 }],
        receipts: [
          {
            id: 'tomorrow',
            participantId: 'an',
            amount: 49000,
            receivedAt: new Date(2026, 9, 17, 12).getTime(),
            note: '',
          },
        ],
      },
    };
    seedFirestoreMock('finance-user', sharedExpense);
    seedFirestoreMock('finance-user', {
      ...sharedExpense,
      id: 'previous-month-shared-expense',
      amount: 50000,
      note: 'Khoản trả tháng sau',
      createdAt: new Date(2026, 8, 30, 12).getTime(),
      sharedExpense: {
        participants: [{ id: 'binh', name: 'Bình', owedAmount: 25000 }],
        receipts: [
          {
            id: 'next-month',
            participantId: 'binh',
            amount: 25000,
            receivedAt: new Date(2026, 9, 1, 12).getTime(),
            note: '',
          },
        ],
      },
    });

    renderFinanceScreen();
    expect(await screen.findByText('Khoản trả ngày mai')).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Xem khoản còn chờ nhận: 1 khoản, 49.000 ₫',
      }),
    ).toBeTruthy();

    fireEvent.press(screen.getByRole('tab', { name: 'Báo cáo chi tiêu' }));
    expect(screen.getByText('Còn chờ nhận 49.000 ₫')).toBeTruthy();
    expect(screen.getByText('Còn chờ nhận 25.000 ₫')).toBeTruthy();
  } finally {
    jest.useRealTimers();
  }
});

it('shows a Vietnamese date calendar that fits the transaction dialog', async () => {
  renderFinanceScreen();
  await screen.findByText('Đã lưu trên tài khoản');
  fireEvent.press(screen.getByRole('button', { name: 'Thêm giao dịch' }));

  const dateInput = screen.getByLabelText('Ngày giao dịch');
  const [day, month, year] = (dateInput.props.value as string)
    .split('/')
    .map(Number);
  fireEvent.press(
    screen.getByRole('button', { name: 'Mở lịch chọn ngày giao dịch' }),
  );

  const picker = within(screen.getByTestId('finance-date-picker'));
  expect(picker.getByTestId('finance-date-picker-month').props.children).toBe(
    `tháng ${month} năm ${year}`,
  );
  expect(picker.getByText('T2')).toBeTruthy();
  expect(picker.getByText('CN')).toBeTruthy();
  expect(
    picker.getByRole('button', {
      name: `Chọn ngày ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
    }).props.accessibilityState.selected,
  ).toBe(true);

  const daysInMonth = new Date(year, month, 0).getDate();
  const nextDay = (day % daysInMonth) + 1;
  fireEvent.press(
    picker.getByRole('button', {
      name: `Chọn ngày ${String(nextDay).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
    }),
  );
  expect(
    screen.queryByRole('button', { name: 'Đóng chọn ngày giao dịch' }),
  ).toBeNull();

  expect(screen.getByLabelText('Ngày giao dịch').props.value).toBe(
    `${String(nextDay).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
  );
});

it('keeps the delete button beside a custom category in the dropdown', async () => {
  renderFinanceScreen();
  await screen.findByText('Đã lưu trên tài khoản');
  fireEvent.press(screen.getByRole('button', { name: 'Thêm giao dịch' }));
  fireEvent(screen.getByTestId('finance-category-section'), 'layout', {
    nativeEvent: { layout: { x: 16, y: 300, width: 320, height: 60 } },
  });
  expect(screen.queryByLabelText('Tên danh mục mới')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Thêm danh mục' }));
  fireEvent.changeText(screen.getByLabelText('Tên danh mục mới'), 'Thú cưng');
  fireEvent.press(screen.getByRole('button', { name: 'Thêm mục' }));
  fireEvent.press(
    await screen.findByRole('button', { name: 'Danh mục: Thú cưng' }),
  );

  const removeButton = await screen.findByRole('button', {
    name: 'Xóa danh mục Thú cưng',
  });
  expect(removeButton).toBeTruthy();
  const categoryChip = screen.getByTestId('finance-category-Thú cưng');
  expect(StyleSheet.flatten(categoryChip.props.style)).toMatchObject({
    flexDirection: 'row',
    alignItems: 'center',
  });
});

it('shows compact add controls, default categories, and a validity-gated save', async () => {
  renderFinanceScreen();
  await screen.findByText('Đã lưu trên tài khoản');
  fireEvent.press(screen.getByRole('button', { name: 'Thêm giao dịch' }));
  fireEvent(screen.getByTestId('finance-category-section'), 'layout', {
    nativeEvent: { layout: { x: 16, y: 300, width: 320, height: 60 } },
  });

  fireEvent.press(screen.getByRole('button', { name: 'Danh mục: Ăn uống' }));
  expect(screen.getByText('Điện nước')).toBeTruthy();
  expect(screen.getByText('Xăng xe')).toBeTruthy();
  fireEvent.press(
    screen.getByRole('button', { name: 'Đóng danh sách lựa chọn' }),
  );
  expect(screen.queryByLabelText('Tên danh mục mới')).toBeNull();
  expect(screen.queryByLabelText('Tên mẫu mới')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Hủy' })).toBeNull();

  const save = screen.getByRole('button', { name: 'Lưu giao dịch' });
  expect(save.props.accessibilityState).toMatchObject({ disabled: true });
  fireEvent.changeText(screen.getByLabelText('Số tiền'), '125000');
  expect(save.props.accessibilityState).toMatchObject({ disabled: false });
  fireEvent.changeText(screen.getByLabelText('Ngày giao dịch'), '31/02/2026');
  expect(
    screen.getByRole('button', { name: 'Lưu giao dịch' }).props
      .accessibilityState,
  ).toMatchObject({ disabled: true });
});

it('keeps transaction templates scoped to their income or expense type', async () => {
  seedFinancePreferencesMock('finance-user', {
    incomeCategories: ['Lương', 'Thưởng', 'Thu nhập khác'],
    expenseCategories: [
      'Ăn uống',
      'Di chuyển',
      'Nhà cửa',
      'Mua sắm',
      'Sức khỏe',
      'Khác',
    ],
    templates: [
      {
        id: 'coffee-custom',
        name: 'Cà phê 30.000đ',
        type: 'expense',
        amount: 30000,
        category: 'Ăn uống',
        note: 'Cà phê',
      },
      {
        id: 'salary-template',
        name: 'Lương tháng',
        type: 'income',
        amount: 25000000,
        category: 'Lương',
        note: '',
      },
    ],
  });
  renderFinanceScreen();
  await screen.findByText('Đã lưu trên tài khoản');
  fireEvent.press(screen.getByRole('button', { name: 'Thêm giao dịch' }));

  expect(screen.getByText('Cà phê 30.000đ')).toBeTruthy();
  expect(screen.queryByText('Lương tháng')).toBeNull();
  expect(screen.queryByLabelText('Tên mẫu mới')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Thu nhập' }));
  expect(screen.getByText('Lương tháng')).toBeTruthy();
  expect(screen.queryByText('Cà phê 30.000đ')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Thêm mẫu giao dịch' }));
  expect(screen.getByLabelText('Tên mẫu mới')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Số tiền'), '800000');
  fireEvent.changeText(screen.getByLabelText('Tên mẫu mới'), 'Thưởng quý');
  fireEvent.press(screen.getByRole('button', { name: 'Lưu mẫu' }));
  expect(await screen.findByText('Thưởng quý')).toBeTruthy();
  const savedPreferences = await readFinancePreferences('finance-user');
  expect(savedPreferences.preferences.templates).toContainEqual(
    expect.objectContaining({
      name: 'Thưởng quý',
      type: 'income',
      amount: 800000,
      incomeSource: 'company',
    }),
  );
});

it('allows outside income and keeps company income report separate', async () => {
  const year = new Date().getFullYear();
  const companyIncome: FinanceTransaction = {
    id: 'legacy-company-salary',
    ownerId: 'finance-user',
    type: 'income',
    amount: 25000000,
    category: 'Lương',
    note: 'Lương cũ',
    createdAt: new Date(year, 0, 5, 12).getTime(),
  };
  const outsideIncome: FinanceTransaction = {
    ...companyIncome,
    id: 'outside-income',
    amount: 350000,
    incomeSource: 'other',
    category: 'Thu nhập khác',
    note: 'Bán đồ cũ',
    createdAt: new Date(year, 0, 6, 12).getTime(),
  };
  seedFirestoreMock('finance-user', companyIncome);
  seedFirestoreMock('finance-user', outsideIncome);

  renderFinanceScreen();
  fireEvent.press(await screen.findByRole('tab', { name: 'Báo cáo thu nhập' }));
  expect(
    await screen.findByLabelText('Thu nhập công ty: 25.000.000 ₫'),
  ).toBeTruthy();
  expect(screen.queryByText('Bán đồ cũ')).toBeNull();
  pressMeasuredPicker(
    screen.getByRole('button', { name: 'Nguồn thu: Công ty' }),
  );
  fireEvent.press(
    screen.getByRole('button', {
      name: 'Chọn nguồn thu báo cáo: Ngoài công ty',
    }),
  );
  expect(
    screen.getByLabelText('Thu nhập ngoài công ty: 350.000 ₫'),
  ).toBeTruthy();
  pressMeasuredPicker(
    screen.getByRole('button', { name: 'Nguồn thu: Ngoài công ty' }),
  );
  fireEvent.press(
    screen.getByRole('button', { name: 'Chọn nguồn thu báo cáo: Tất cả' }),
  );
  expect(screen.getByLabelText('Tổng thu nhập: 25.350.000 ₫')).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Thêm khoản thu' }));
  fireEvent.press(screen.getByRole('button', { name: 'Thu nhập' }));
  fireEvent(screen.getByTestId('finance-income-source-section'), 'layout', {
    nativeEvent: { layout: { x: 16, y: 220, width: 320, height: 50 } },
  });
  fireEvent.press(screen.getByRole('button', { name: 'Nguồn thu: Công ty' }));
  fireEvent.press(
    screen.getByRole('button', { name: 'Chọn nguồn thu: Ngoài công ty' }),
  );
  fireEvent(screen.getByTestId('finance-category-section'), 'layout', {
    nativeEvent: { layout: { x: 16, y: 300, width: 320, height: 60 } },
  });
  fireEvent.press(
    screen.getByRole('button', { name: 'Danh mục: Thu nhập khác' }),
  );
  expect(screen.queryByTestId('finance-category-Lương')).toBeNull();
  expect(screen.queryByTestId('finance-category-Thưởng')).toBeNull();
  expect(screen.getByTestId('finance-category-Thu nhập khác')).toBeTruthy();
  fireEvent.press(
    screen.getByRole('button', { name: 'Nguồn thu: Ngoài công ty' }),
  );
  fireEvent.press(
    screen.getByRole('button', { name: 'Chọn nguồn thu: Công ty' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Danh mục: Lương' }));
  expect(screen.getByTestId('finance-category-Lương')).toBeTruthy();
  expect(screen.getByTestId('finance-category-Thưởng')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Nguồn thu: Công ty' }));
  fireEvent.press(
    screen.getByRole('button', { name: 'Chọn nguồn thu: Ngoài công ty' }),
  );
  fireEvent.changeText(screen.getByLabelText('Số tiền'), '50000');
  fireEvent.changeText(screen.getByLabelText('Ghi chú'), 'Bán sách');
  fireEvent.press(screen.getByRole('button', { name: 'Lưu giao dịch' }));

  await waitFor(async () => {
    expect(await readFinanceTransactions('finance-user')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          note: 'Bán sách',
          type: 'income',
          incomeSource: 'other',
        }),
      ]),
    );
  });
});

it('opens on the current month and excludes transactions from other months', async () => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const year = now.getFullYear();
  const currentSalary: FinanceTransaction = {
    id: 'current-month-salary',
    ownerId: 'finance-user',
    type: 'income',
    amount: 25000000,
    category: 'Lương',
    note: 'Lương tháng hiện tại',
    createdAt: new Date(year, currentMonth - 1, 15, 12).getTime(),
  };
  const previousMonthExpense: FinanceTransaction = {
    id: 'previous-month-spend',
    ownerId: 'finance-user',
    type: 'expense',
    amount: 800000,
    category: 'Mua sắm',
    note: 'Khoản chi tháng trước',
    createdAt: new Date(year, currentMonth - 2, 8, 12).getTime(),
  };
  seedFirestoreMock('finance-user', currentSalary);
  seedFirestoreMock('finance-user', previousMonthExpense);

  renderFinanceScreen();

  expect(await screen.findByText('Lương tháng hiện tại')).toBeTruthy();
  expect(screen.getByText(`Tháng ${currentMonth} năm ${year}`)).toBeTruthy();
  expect(screen.queryByText('Khoản chi tháng trước')).toBeNull();
  expect(screen.getAllByText('25.000.000 ₫').length).toBeGreaterThan(0);
});

it('moves one month at a time and can return to the current month', async () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const previousDate = new Date(currentYear, currentMonth - 2, 1);

  renderFinanceScreen();
  expect(
    await screen.findByText(`Tháng ${currentMonth} năm ${currentYear}`),
  ).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Tháng trước' }));
  expect(
    screen.getByText(
      `Tháng ${previousDate.getMonth() + 1} năm ${previousDate.getFullYear()}`,
    ),
  ).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Về tháng hiện tại' }));
  expect(
    screen.getByText(`Tháng ${currentMonth} năm ${currentYear}`),
  ).toBeTruthy();
});

it('keeps the viewed month when the month picker is cancelled after browsing years', async () => {
  const now = new Date();
  renderFinanceScreen();
  fireEvent.press(
    await screen.findByRole('button', { name: 'Chọn tháng xem giao dịch' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Năm trước' }));
  fireEvent.press(
    screen.getByRole('button', { name: 'Đóng chọn tháng xem giao dịch' }),
  );

  expect(
    screen.getByText(`Tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`),
  ).toBeTruthy();
});

it('keeps the report range when its picker is cancelled after browsing years', async () => {
  const now = new Date();
  renderFinanceScreen();
  fireEvent.press(await screen.findByRole('tab', { name: 'Báo cáo thu nhập' }));
  fireEvent.press(screen.getByRole('button', { name: 'Tùy chọn tháng' }));
  fireEvent.press(screen.getByRole('button', { name: /^Chọn tháng bắt đầu:/ }));
  fireEvent.press(screen.getByRole('button', { name: 'Năm trước' }));
  fireEvent.press(
    screen.getByRole('button', { name: 'Đóng bộ chọn tháng báo cáo' }),
  );

  expect(
    screen.getByRole('button', {
      name: `Chọn tháng bắt đầu: 01/${now.getFullYear()}`,
    }),
  ).toBeTruthy();
  expect(
    screen.getByRole('button', {
      name: `Chọn tháng kết thúc: ${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`,
    }),
  ).toBeTruthy();
});

it('lets the user jump to a month in another year', async () => {
  const year = new Date().getFullYear();
  const rent: FinanceTransaction = {
    id: 'last-year-rent',
    ownerId: 'finance-user',
    type: 'expense',
    amount: 6000000,
    category: 'Nhà cửa',
    note: 'Tiền nhà năm trước',
    createdAt: new Date(year - 1, 4, 2, 12).getTime(),
  };
  seedFirestoreMock('finance-user', rent);

  renderFinanceScreen();
  expect(
    await screen.findByText('Chưa có giao dịch trong tháng này'),
  ).toBeTruthy();
  fireEvent.press(
    screen.getByRole('button', { name: 'Chọn tháng xem giao dịch' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Năm trước' }));
  fireEvent.press(screen.getByRole('button', { name: 'Tháng 5' }));

  expect(await screen.findByText('Tiền nhà năm trước')).toBeTruthy();
  expect(screen.getByText(`Tháng 5 năm ${year - 1}`)).toBeTruthy();
  expect(screen.getAllByText('6.000.000 ₫').length).toBeGreaterThan(0);

  fireEvent.press(
    screen.getByRole('button', {
      name: `Thêm khoản thu tháng 5 năm ${year - 1}`,
    }),
  );
  expect(screen.getByLabelText('Ngày giao dịch').props.value).toBe(
    `01/05/${year - 1}`,
  );
  expect(
    screen.getByRole('button', { name: 'Thu nhập' }).props.accessibilityState,
  ).toMatchObject({ selected: true });
});

it('shows all income including removed categories and excludes expenses', async () => {
  const year = new Date().getFullYear();
  const salary: FinanceTransaction = {
    id: 'report-salary',
    ownerId: 'finance-user',
    type: 'income',
    amount: 12000000,
    category: 'Lương',
    note: 'Lương tháng 3',
    createdAt: new Date(year, 2, 8, 12).getTime(),
  };
  const bonus: FinanceTransaction = {
    ...salary,
    id: 'report-bonus',
    amount: 2000000,
    category: 'Thưởng',
    note: 'Thưởng lễ',
    createdAt: new Date(year, 3, 8, 12).getTime(),
  };
  const extraIncome: FinanceTransaction = {
    ...salary,
    id: 'report-extra',
    amount: 500000,
    category: 'Thu nhập khác',
    note: 'Khoản thu thêm',
    createdAt: new Date(year, 3, 10, 12).getTime(),
  };
  const expense: FinanceTransaction = {
    ...salary,
    id: 'report-expense',
    type: 'expense',
    amount: 800000,
    category: 'Mua sắm',
    note: 'Khoản chi không tính',
    createdAt: new Date(year, 3, 11, 12).getTime(),
  };
  const otherCategory: FinanceTransaction = {
    ...salary,
    id: 'report-uncategorized',
    amount: 900000,
    category: 'Khác',
    note: 'Khoản thu từ danh mục đã xóa',
    createdAt: new Date(year, 3, 12, 12).getTime(),
  };
  [salary, bonus, extraIncome, expense, otherCategory].forEach((row) =>
    seedFirestoreMock('finance-user', row),
  );

  renderFinanceScreen();
  fireEvent.press(await screen.findByRole('tab', { name: 'Báo cáo thu nhập' }));

  expect(await screen.findByText('Thu nhập công ty')).toBeTruthy();
  expect(screen.getByText('15.400.000 ₫')).toBeTruthy();
  expect(screen.getByLabelText('Thu nhập công ty: 15.400.000 ₫')).toBeTruthy();
  expect(screen.queryByText('Lương tháng 3')).toBeNull();
  fireEvent.press(
    screen.getByRole('button', { name: `Xem giao dịch tháng 3 năm ${year}` }),
  );
  fireEvent.press(
    screen.getByRole('button', { name: `Xem giao dịch tháng 4 năm ${year}` }),
  );
  expect(screen.getByText('Lương tháng 3')).toBeTruthy();
  expect(screen.getByText('Thưởng lễ')).toBeTruthy();
  expect(screen.getByText('Khoản thu thêm')).toBeTruthy();
  expect(screen.queryByText('Khoản chi không tính')).toBeNull();
  expect(screen.getByText('Khoản thu từ danh mục đã xóa')).toBeTruthy();
  expect(screen.queryByText('Tổng chi')).toBeNull();
  fireEvent.press(
    screen.getByRole('button', { name: `Xem giao dịch tháng 3 năm ${year}` }),
  );
  expect(screen.queryByText('Lương tháng 3')).toBeNull();
  expect(screen.getByLabelText('Thu nhập công ty: 15.400.000 ₫')).toBeTruthy();

  fireEvent.press(
    screen.getByRole('button', {
      name: `Thêm khoản thu tháng 4 năm ${year}`,
    }),
  );
  expect(screen.getByLabelText('Ngày giao dịch').props.value).toBe(
    `01/04/${year}`,
  );
  expect(
    screen.getByRole('button', { name: 'Thu nhập' }).props.accessibilityState,
  ).toMatchObject({ selected: true });
});

it('shows a separate expenses-only report with category totals', async () => {
  const year = new Date().getFullYear();
  const food: FinanceTransaction = {
    id: 'expense-food-report',
    ownerId: 'finance-user',
    type: 'expense',
    amount: 500000,
    category: 'Ăn uống',
    note: 'Ăn trưa',
    createdAt: new Date(year, 4, 8, 12).getTime(),
  };
  const shopping: FinanceTransaction = {
    ...food,
    id: 'expense-shopping-report',
    amount: 3000000,
    category: 'Mua sắm',
    note: 'Mua đồ gia dụng',
    createdAt: new Date(year, 5, 8, 12).getTime(),
  };
  const salary: FinanceTransaction = {
    ...food,
    id: 'income-excluded-from-expense-report',
    type: 'income',
    amount: 25000000,
    category: 'Lương',
    note: 'Lương không tính vào chi',
    createdAt: new Date(year, 4, 10, 12).getTime(),
  };
  [food, shopping, salary].forEach((row) =>
    seedFirestoreMock('finance-user', row),
  );

  renderFinanceScreen();
  fireEvent.press(await screen.findByRole('tab', { name: 'Báo cáo chi tiêu' }));

  expect(await screen.findByText('Tổng chi tiêu')).toBeTruthy();
  const totalAmount = screen.getByLabelText('Tổng chi tiêu: 3.500.000 ₫');
  expect(totalAmount.props.adjustsFontSizeToFit).toBeUndefined();
  expect(totalAmount.props.numberOfLines).toBeUndefined();
  fireEvent.press(
    screen.getByRole('button', { name: `Xem giao dịch tháng 5 năm ${year}` }),
  );
  fireEvent.press(
    screen.getByRole('button', { name: `Xem giao dịch tháng 6 năm ${year}` }),
  );
  expect(screen.getByText('Ăn trưa')).toBeTruthy();
  expect(screen.getByText('Mua đồ gia dụng')).toBeTruthy();
  expect(screen.queryByText('Lương không tính vào chi')).toBeNull();
  expect(screen.queryByText('Tổng thu nhập')).toBeNull();

  fireEvent.press(
    screen.getByRole('button', {
      name: `Thêm khoản chi tháng 5 năm ${year}`,
    }),
  );
  expect(screen.getByLabelText('Ngày giao dịch').props.value).toBe(
    `01/05/${year}`,
  );
  expect(
    screen.getByRole('button', { name: 'Chi tiêu' }).props.accessibilityState,
  ).toMatchObject({ selected: true });
});

it('reveals a newly saved shared expense in the expense report', async () => {
  const existingExpense: FinanceTransaction = {
    id: 'existing-search-result',
    ownerId: 'finance-user',
    type: 'expense',
    amount: 100000,
    category: 'Ăn uống',
    note: 'Chi trước đó',
    createdAt: Date.now(),
  };
  seedFirestoreMock('finance-user', existingExpense);
  renderFinanceScreen();
  fireEvent.press(await screen.findByRole('tab', { name: 'Báo cáo chi tiêu' }));
  fireEvent.press(
    screen.getByRole('button', { name: 'Mở tìm kiếm giao dịch chi tiêu' }),
  );
  fireEvent.changeText(
    screen.getByLabelText('Tìm giao dịch chi tiêu'),
    'không khớp',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Thêm khoản chi' }));
  fireEvent.changeText(screen.getByLabelText('Số tiền'), '500000');
  fireEvent.changeText(screen.getByLabelText('Ghi chú'), 'Ăn chung mới');
  fireEvent.press(screen.getByRole('switch', { name: 'Có người cần trả lại' }));
  fireEvent.changeText(screen.getByLabelText('Tên người 1'), 'An');
  fireEvent.changeText(
    screen.getByLabelText('Số tiền người 1 cần trả'),
    '300000',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Lưu giao dịch' }));

  expect(await screen.findByText('Ăn chung mới')).toBeTruthy();
  expect(screen.queryByLabelText('Tìm giao dịch chi tiêu')).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Mở tìm kiếm giao dịch chi tiêu' }),
  ).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Tháng' }).props.accessibilityState
      .selected,
  ).toBe(true);
  expect(
    useFinanceStore
      .getState()
      .transactions.find((transaction) => transaction.note === 'Ăn chung mới')
      ?.sharedExpense,
  ).toMatchObject({
    participants: [{ name: 'An', owedAmount: 300000 }],
  });
  await act(async () => {
    await useFinanceStore.getState().load('finance-user');
  });
  expect(screen.getByText('Ăn chung mới')).toBeTruthy();
});

it('lets the income report span a custom range across years', async () => {
  const year = new Date().getFullYear();
  const decemberSalary: FinanceTransaction = {
    id: 'december-salary',
    ownerId: 'finance-user',
    type: 'income',
    amount: 100,
    category: 'Lương',
    note: 'Lương tháng 12',
    createdAt: new Date(year - 1, 11, 8, 12).getTime(),
  };
  const januaryBonus: FinanceTransaction = {
    ...decemberSalary,
    id: 'january-bonus',
    amount: 200,
    category: 'Thưởng',
    note: 'Thưởng tháng 1',
    createdAt: new Date(year, 0, 8, 12).getTime(),
  };
  seedFirestoreMock('finance-user', decemberSalary);
  seedFirestoreMock('finance-user', januaryBonus);

  renderFinanceScreen();
  fireEvent.press(await screen.findByRole('tab', { name: 'Báo cáo thu nhập' }));
  fireEvent.press(screen.getByRole('button', { name: 'Tùy chọn tháng' }));
  fireEvent.press(screen.getByRole('button', { name: /^Chọn tháng bắt đầu:/ }));
  fireEvent.press(screen.getByRole('button', { name: 'Năm trước' }));
  fireEvent.press(screen.getByRole('button', { name: `Tháng 12 ${year - 1}` }));

  expect(
    screen.getByRole('button', {
      name: `Chọn tháng bắt đầu: 12/${year - 1}`,
    }),
  ).toBeTruthy();
  expect(
    screen.getByRole('button', { name: `Chọn tháng kết thúc: 10/${year}` }),
  ).toBeTruthy();
  expect(screen.getByText('300 ₫')).toBeTruthy();
  fireEvent.press(
    screen.getByRole('button', {
      name: `Xem giao dịch tháng 12 năm ${year - 1}`,
    }),
  );
  fireEvent.press(
    screen.getByRole('button', { name: `Xem giao dịch tháng 1 năm ${year}` }),
  );
  expect(screen.getByText('Lương tháng 12')).toBeTruthy();
  expect(screen.getByText('Thưởng tháng 1')).toBeTruthy();
});

it('keeps an empty expense report compact without zero category rows', async () => {
  renderFinanceScreen();
  await screen.findByText('Đã lưu trên tài khoản');
  fireEvent.press(screen.getByRole('tab', { name: 'Báo cáo chi tiêu' }));
  expect(screen.getByLabelText('Tổng chi tiêu: 0 ₫')).toBeTruthy();
  expect(screen.queryByText('Ăn uống')).toBeNull();
  expect(screen.getByRole('button', { name: 'Thêm khoản chi' })).toBeTruthy();
  expect(screen.getByText('Chưa phát sinh')).toBeTruthy();
});

it('keeps long report categories on one line while retaining their amounts', async () => {
  const category = 'Thu nhập dự án tư vấn và cộng tác dài hạn';
  const transaction: FinanceTransaction = {
    id: 'long-category-income',
    ownerId: 'finance-user',
    type: 'income',
    amount: 987654321,
    category,
    note: 'Khoản thu lớn',
    createdAt: Date.now(),
  };
  seedFirestoreMock('finance-user', transaction);

  renderFinanceScreen();
  fireEvent.press(await screen.findByRole('tab', { name: 'Báo cáo thu nhập' }));

  const categoryName = await screen.findByText(category);
  expect(categoryName.props.numberOfLines).toBe(1);
  expect(screen.getByLabelText('Thu nhập công ty: 987.654.321 ₫')).toBeTruthy();
  expect(screen.getAllByText('987.654.321 ₫').length).toBeGreaterThan(0);
});

it('keeps monthly income, expense, and balance readable on one line', async () => {
  const now = new Date();
  const income: FinanceTransaction = {
    id: 'month-income-wrap',
    ownerId: 'finance-user',
    type: 'income',
    amount: 12500000,
    category: 'Lương',
    note: 'Lương tháng này',
    createdAt: now.getTime(),
  };
  const expense: FinanceTransaction = {
    ...income,
    id: 'month-expense-wrap',
    type: 'expense',
    amount: 2500000,
    category: 'Nhà cửa',
    note: 'Tiền nhà',
  };
  seedFirestoreMock('finance-user', income);
  seedFirestoreMock('finance-user', expense);

  renderFinanceScreen();

  const stats = await screen.findByTestId('finance-month-stats');
  for (const amount of ['12.500.000 ₫', '2.500.000 ₫', '10.000.000 ₫']) {
    const value = within(stats).getByText(amount);
    expect(value.props.numberOfLines).toBe(1);
    expect(value.props.adjustsFontSizeToFit).toBe(true);
  }
});

it('hides the held-money creation modal when Finance is suspended', async () => {
  const view = renderFinanceScreen();
  fireEvent.press(await screen.findByRole('tab', { name: 'Sổ đóng hộ' }));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Thêm khoản đóng hộ' }),
    ).toBeEnabled(),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Thêm khoản đóng hộ' }));
  expect(
    await screen.findByRole('header', { name: 'Khoản đóng hộ mới' }),
  ).toBeTruthy();
  view.rerender(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      <FinanceScreen suspended />
    </SafeAreaProvider>,
  );
  expect(
    screen.queryByRole('header', { name: 'Khoản đóng hộ mới' }),
  ).toBeNull();
});
