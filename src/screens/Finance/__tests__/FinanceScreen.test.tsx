import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDocsFromServer, setDoc } from '@react-native-firebase/firestore';
import * as SecureStore from 'expo-secure-store';
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
import type { FinanceTransaction } from '../../../types/finance';
import {
  resetFirestoreMock,
  seedFirestoreMock,
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
    render(<FinanceScreen />);

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
  render(<FinanceScreen />);
  expect(await screen.findByText('Chưa có giao dịch nào')).toBeTruthy();
  expect(screen.getByText('Tổng thu')).toBeTruthy();
  expect(screen.getByText('Tổng chi')).toBeTruthy();
  expect(screen.getByText('Còn lại trong kỳ')).toBeTruthy();
  expect(await screen.findByText('Đã lưu trên tài khoản')).toBeTruthy();
});

it('keeps report tabs and the add action in the fixed header', async () => {
  render(<FinanceScreen />);
  await screen.findByText('Đã lưu trên tài khoản');
  const header = within(screen.getByTestId('screen-fixed-header'));
  expect(header.getByRole('tab', { name: 'Báo cáo chi tiêu' })).toBeTruthy();
  expect(header.getByRole('button', { name: 'Thêm giao dịch' })).toBeTruthy();
  fireEvent.press(header.getByRole('tab', { name: 'Báo cáo thu nhập' }));
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
  jest.mocked(getDocsFromServer).mockRejectedValueOnce(new Error('Offline'));

  render(<FinanceScreen />);

  expect(
    await screen.findByText('Chưa sao lưu · chỉ có trên thiết bị'),
  ).toBeTruthy();
  expect(screen.getByText('Lương chỉ trên máy')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Đồng bộ lại' })).toBeTruthy();
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
  render(<FinanceScreen />);
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
});

it('formats the entered amount and can dismiss the form from its header', async () => {
  render(<FinanceScreen />);
  await screen.findByText('Đã lưu trên tài khoản');
  fireEvent.press(screen.getByRole('button', { name: 'Thêm giao dịch' }));
  fireEvent.changeText(screen.getByLabelText('Số tiền'), '25000000');
  expect(screen.getByLabelText('Số tiền đã nhập: 25.000.000 ₫')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Hủy thêm giao dịch' }));
  expect(screen.queryByLabelText('Số tiền')).toBeNull();
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

  render(<FinanceScreen />);

  expect(await screen.findByText('Lương tháng hiện tại')).toBeTruthy();
  expect(screen.getByText(`Tháng ${currentMonth} · ${year}`)).toBeTruthy();
  expect(screen.queryByText('Khoản chi tháng trước')).toBeNull();
  expect(screen.getAllByText('25.000.000 ₫').length).toBeGreaterThan(0);
});

it('moves one month at a time and can return to the current month', async () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const previousDate = new Date(currentYear, currentMonth - 2, 1);

  render(<FinanceScreen />);
  expect(
    await screen.findByText(`Tháng ${currentMonth} · ${currentYear}`),
  ).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Tháng trước' }));
  expect(
    screen.getByText(
      `Tháng ${previousDate.getMonth() + 1} · ${previousDate.getFullYear()}`,
    ),
  ).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Về tháng hiện tại' }));
  expect(
    screen.getByText(`Tháng ${currentMonth} · ${currentYear}`),
  ).toBeTruthy();
});

it('keeps the viewed month when the month picker is cancelled after browsing years', async () => {
  const now = new Date();
  render(<FinanceScreen />);
  fireEvent.press(
    await screen.findByRole('button', { name: 'Chọn tháng xem giao dịch' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Năm trước' }));
  fireEvent.press(screen.getByRole('button', { name: 'Đóng' }));

  expect(
    screen.getByText(`Tháng ${now.getMonth() + 1} · ${now.getFullYear()}`),
  ).toBeTruthy();
});

it('keeps the report range when its picker is cancelled after browsing years', async () => {
  const now = new Date();
  render(<FinanceScreen />);
  fireEvent.press(await screen.findByRole('tab', { name: 'Báo cáo thu nhập' }));
  fireEvent.press(screen.getByRole('button', { name: 'Tùy chọn tháng' }));
  fireEvent.press(screen.getByRole('button', { name: 'Chọn tháng bắt đầu' }));
  fireEvent.press(screen.getByRole('button', { name: 'Năm trước' }));
  fireEvent.press(screen.getByRole('button', { name: 'Đóng' }));

  expect(
    screen.getByText(
      `01/${now.getFullYear()} – ${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`,
    ),
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

  render(<FinanceScreen />);
  expect(
    await screen.findByText('Chưa có giao dịch trong tháng này'),
  ).toBeTruthy();
  fireEvent.press(
    screen.getByRole('button', { name: 'Chọn tháng xem giao dịch' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Năm trước' }));
  fireEvent.press(screen.getByRole('button', { name: 'Tháng 5' }));

  expect(await screen.findByText('Tiền nhà năm trước')).toBeTruthy();
  expect(screen.getByText(`Tháng 5 · ${year - 1}`)).toBeTruthy();
  expect(screen.getByText('6.000.000 ₫')).toBeTruthy();

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

  render(<FinanceScreen />);
  fireEvent.press(await screen.findByRole('tab', { name: 'Báo cáo thu nhập' }));

  expect(await screen.findByText('Tổng thu nhập')).toBeTruthy();
  expect(screen.getByText('15.400.000 ₫')).toBeTruthy();
  expect(screen.getByLabelText('Tổng thu nhập: 15.400.000 ₫')).toBeTruthy();
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
  expect(screen.getByLabelText('Tổng thu nhập: 15.400.000 ₫')).toBeTruthy();

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

  render(<FinanceScreen />);
  fireEvent.press(await screen.findByRole('tab', { name: 'Báo cáo chi tiêu' }));

  expect(await screen.findByText('Tổng chi tiêu')).toBeTruthy();
  expect(screen.getByText('3.500.000 ₫')).toBeTruthy();
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

  render(<FinanceScreen />);
  fireEvent.press(await screen.findByRole('tab', { name: 'Báo cáo thu nhập' }));
  fireEvent.press(screen.getByRole('button', { name: 'Tùy chọn tháng' }));
  fireEvent.press(screen.getByRole('button', { name: 'Chọn tháng bắt đầu' }));
  fireEvent.press(screen.getByRole('button', { name: 'Năm trước' }));
  fireEvent.press(screen.getByRole('button', { name: `Tháng 12 ${year - 1}` }));

  expect(
    screen.getByText(`${String(12).padStart(2, '0')}/${year - 1} – 10/${year}`),
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
  render(<FinanceScreen />);
  await screen.findByText('Đã lưu trên tài khoản');
  fireEvent.press(screen.getByRole('tab', { name: 'Báo cáo chi tiêu' }));
  expect(screen.getByLabelText('Tổng chi tiêu: 0 ₫')).toBeTruthy();
  expect(screen.queryByText('Ăn uống')).toBeNull();
  expect(screen.getByRole('button', { name: 'Thêm khoản chi' })).toBeTruthy();
});
