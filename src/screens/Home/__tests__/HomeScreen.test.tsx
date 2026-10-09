import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { HomeScreen } from '../HomeScreen';
import { useAuthStore } from '../../../store/authStore';
import { useConfigStore } from '../../../store/configStore';
import { useFinanceStore } from '../../../store/financeStore';
import { financeStorageKey } from '../../../services/finance/financeStorage';
import {
  resetFirestoreMock,
  seedFirestoreMock,
} from '../../../testing/firestoreMock';
import type { FinanceTransaction } from '../../../types/finance';
import { useFinanceLockStore } from '../../../store/financeLockStore';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RefreshControl } from 'react-native';
import { useAgendaStore } from '../../../store/agendaStore';
import { loadRemoteUsers } from '../../../services/firebase/remoteConfigService';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);
jest.mock('@react-native-firebase/firestore', () =>
  jest.requireActual('../../../testing/firestoreMock'),
);
jest.mock('../../../services/firebase/remoteConfigService', () => ({
  loadRemoteUsers: jest.fn(),
}));
jest.mock('../../../services/firebase/authService', () => ({
  logout: jest.fn(),
  login: jest.fn(),
}));
jest.mock('../../../services/firebase/messagingService', () => ({
  disablePush: jest.fn(),
  registerPush: jest.fn(),
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  resetFirestoreMock();
  useAuthStore.getState().setUser({
    uid: 'home-user',
    email: 'home@example.com',
    displayName: 'Asher',
  });
  useConfigStore.setState({ users: [], loading: false, warning: null });
  useAgendaStore.setState({
    uid: null,
    items: [],
    synced: false,
    loading: false,
    error: null,
    reminderStatus: null,
  });
  useFinanceStore.setState({
    uid: null,
    transactions: [],
    syncStatus: null,
    loading: false,
    error: null,
  });
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  jest
    .mocked(LocalAuthentication.authenticateAsync)
    .mockResolvedValue({ success: true });
  useFinanceLockStore.getState().lock();
  useFinanceLockStore.setState({
    uid: null,
    enabled: null,
    authenticating: false,
    changing: false,
    loading: false,
    unlocked: false,
    appActive: true,
    error: null,
  });
});

const navigation = { navigate: jest.fn() };
function renderHome() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
      }}
    >
      <HomeScreen
        navigation={navigation as never}
        route={{ key: 'home', name: 'Home' }}
      />
    </SafeAreaProvider>,
  );
}

it('keeps the pull-to-refresh indicator hidden during background loads', () => {
  useConfigStore.setState({ loading: true });
  useAgendaStore.setState({ uid: 'home-user', loading: true });
  renderHome();

  expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false);
  expect(screen.getByText('Tài chính của bạn')).toBeTruthy();
});

it('shows the pull-to-refresh indicator only while a manual refresh runs', async () => {
  let finishConfig!: (value: { users: []; warning: null }) => void;
  jest.mocked(loadRemoteUsers).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishConfig = resolve;
      }),
  );
  renderHome();

  fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');
  expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(true);

  await act(async () => finishConfig({ users: [], warning: null }));
  await waitFor(() =>
    expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(
      false,
    ),
  );
});

it('ends a manual refresh when a background service does not respond', async () => {
  jest
    .mocked(loadRemoteUsers)
    .mockImplementationOnce(() => new Promise(() => undefined));
  jest.useFakeTimers();
  try {
    renderHome();
    fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');
    expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(true);

    await act(async () => jest.advanceTimersByTimeAsync(15_000));
    expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(
      false,
    );
  } finally {
    jest.useRealTimers();
  }
});

it('shows an offline status for Today even with no cached tasks', () => {
  useAgendaStore.setState({
    uid: 'home-user',
    items: [],
    synced: false,
    loading: false,
  });
  renderHome();

  expect(
    screen.getByText('Chưa đồng bộ công việc. Kéo xuống để thử lại.'),
  ).toBeTruthy();
});

it('loads current-month totals and keeps Home focused on Finance and Today', async () => {
  const now = new Date();
  const salary: FinanceTransaction = {
    id: 'current-salary',
    ownerId: 'home-user',
    type: 'income',
    amount: 25000000,
    category: 'Lương',
    note: '',
    createdAt: new Date(now.getFullYear(), now.getMonth(), 1, 12).getTime(),
  };
  seedFirestoreMock('home-user', salary);
  seedFirestoreMock('home-user', {
    ...salary,
    id: 'current-expense',
    type: 'expense',
    amount: 2000000,
    category: 'Nhà cửa',
  });
  seedFirestoreMock('home-user', {
    ...salary,
    id: 'previous-salary',
    createdAt: new Date(now.getFullYear(), now.getMonth() - 1, 1, 12).getTime(),
  });
  renderHome();

  expect(screen.getByText('Hôm nay')).toBeTruthy();
  expect(screen.queryByText('Danh sách nghe')).toBeNull();
  expect(screen.queryByLabelText('Mở thư viện MP3')).toBeNull();
  expect(
    screen.queryByText('Một ngày gọn gàng, theo nhịp của bạn.'),
  ).toBeNull();
  expect(
    screen.queryByText('Không cần vội. Hôm nay, cứ theo nhịp của bạn.'),
  ).toBeNull();

  expect(await screen.findByLabelText('Còn lại tháng này: đã ẩn')).toBeTruthy();
  expect(screen.getAllByText('***')).toHaveLength(3);
  expect(screen.queryByLabelText('Còn lại tháng này: 23.000.000 ₫')).toBeNull();
  expect(screen.queryByText('25.000.000 ₫')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Hiện số tiền' }));
  expect(
    await screen.findByLabelText('Còn lại tháng này: 23.000.000 ₫'),
  ).toBeTruthy();
  expect(
    screen.getByLabelText('Tổng thu tháng này: 25.000.000 ₫'),
  ).toBeTruthy();
  expect(screen.getByLabelText('Tổng chi tháng này: 2.000.000 ₫')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Ẩn số tiền' }));
  expect(screen.getAllByText('***')).toHaveLength(3);
  expect(screen.getByLabelText('Tổng thu tháng này: đã ẩn')).toBeTruthy();
  expect(screen.getByLabelText('Tổng chi tháng này: đã ẩn')).toBeTruthy();
  expect(screen.queryByLabelText('Còn lại tháng này: 23.000.000 ₫')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Mở Tài chính' }));
  expect(navigation.navigate).toHaveBeenLastCalledWith('Finance');
});

it('uses cloud transactions when the local finance cache cannot be read', async () => {
  const remoteRow: FinanceTransaction = {
    id: 'cloud-salary',
    ownerId: 'home-user',
    type: 'income',
    amount: 12000000,
    category: 'Lương',
    note: 'Cloud copy',
    createdAt: new Date().setHours(12, 0, 0, 0),
  };
  seedFirestoreMock('home-user', remoteRow);
  await AsyncStorage.setItem(financeStorageKey('home-user'), 'invalid json');
  renderHome();
  expect(
    await screen.findByText(
      'Đang hiển thị dữ liệu cloud · cache trên máy chưa đọc được',
    ),
  ).toBeTruthy();
  expect(useFinanceStore.getState().transactions).toEqual([remoteRow]);
  expect(
    screen.queryByText('Chưa đọc được sổ thu chi trên thiết bị.'),
  ).toBeNull();
});

it('requires successful device authentication to reveal Home totals when Finance is protected', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('on');
  jest
    .mocked(LocalAuthentication.authenticateAsync)
    .mockResolvedValueOnce({ success: false, error: 'user_cancel' })
    .mockImplementationOnce(async () => {
      useFinanceLockStore.getState().setAppActive(false);
      await Promise.resolve();
      useFinanceLockStore.getState().setAppActive(true);
      return { success: true };
    });
  renderHome();
  expect(await screen.findByLabelText('Còn lại tháng này: đã ẩn')).toBeTruthy();
  await waitFor(() =>
    expect(useFinanceLockStore.getState().enabled).toBe(true),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Hiện số tiền' }));
  expect(await screen.findByText('Đã hủy xác thực.')).toBeTruthy();
  expect(screen.queryByLabelText('Còn lại tháng này: 0 ₫')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Hiện số tiền' }));
  expect(await screen.findByLabelText('Còn lại tháng này: 0 ₫')).toBeTruthy();
  expect(useFinanceLockStore.getState().unlocked).toBe(true);
});
