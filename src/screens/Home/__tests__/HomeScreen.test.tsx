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
import { resetFirestoreMock } from '../../../testing/firestoreMock';
import { useFinanceLockStore } from '../../../store/financeLockStore';
import { useFinanceStore } from '../../../store/financeStore';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RefreshControl } from 'react-native';
import { useAgendaStore } from '../../../store/agendaStore';
import { useNoteStore } from '../../../store/noteStore';
import { loadRemoteConfig } from '../../../services/firebase/remoteConfigService';
import type { AgendaItem } from '../../../types/agenda';
import type { LifeNote } from '../../../types/note';
import type { FinanceTransaction } from '../../../types/finance';
import { toDateKey } from '../../../utils/vietnameseCalendar';

type RenderedNode = {
  props: { testID?: unknown };
  children: (RenderedNode | string)[];
};

function findRenderedCardIds(node: RenderedNode): string[] {
  const testID = node.props.testID;
  return [
    ...(testID === 'home-finance-card' || testID === 'home-today-card'
      ? [testID]
      : []),
    ...node.children.flatMap((child) =>
      typeof child === 'string' ? [] : findRenderedCardIds(child),
    ),
  ];
}

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
  loadRemoteConfig: jest.fn(),
  readActivatedRemoteConfig: jest.fn(),
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
  homeFocusHandler = null;
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
  useNoteStore.setState({
    uid: 'home-user',
    notes: [],
    synced: true,
    loading: false,
    error: null,
  });
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  jest
    .mocked(LocalAuthentication.authenticateAsync)
    .mockResolvedValue({ success: true });
  useFinanceLockStore.getState().lock();
  useFinanceLockStore.setState({
    uid: 'home-user',
    enabled: false,
    authenticating: false,
    changing: false,
    loading: false,
    unlocked: false,
    appActive: true,
    error: null,
  });
  useFinanceStore.setState({
    uid: 'home-user',
    transactions: [],
    syncStatus: 'synced',
    loading: false,
    error: null,
  });
});

let homeFocusHandler: (() => void) | null = null;
const navigation = {
  navigate: jest.fn(),
  addListener: jest.fn((_event: string, listener: () => void) => {
    homeFocusHandler = listener;
    return jest.fn();
  }),
};
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
  expect(screen.getByText('Lịch')).toBeTruthy();
  expect(screen.getByText('Việc cần làm')).toBeTruthy();
  expect(screen.getByTestId('home-finance-card')).toBeTruthy();
});

it('shows the pull-to-refresh indicator only while a manual refresh runs', async () => {
  let finishConfig!: (value: {
    users: [];
    registrationEnabled: false;
    warning: null;
  }) => void;
  jest.mocked(loadRemoteConfig).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishConfig = resolve;
      }),
  );
  renderHome();

  fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');
  expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(true);

  await act(async () =>
    finishConfig({ users: [], registrationEnabled: false, warning: null }),
  );
  await waitFor(() =>
    expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(
      false,
    ),
  );
});

it('ends a manual refresh when a background service does not respond', async () => {
  jest
    .mocked(loadRemoteConfig)
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

it('shows the agenda offline status in the calendar sheet task tab', () => {
  useAgendaStore.setState({
    uid: 'home-user',
    items: [],
    synced: false,
    loading: false,
  });
  renderHome();

  fireEvent.press(screen.getByRole('button', { name: 'Mở việc hôm nay' }));
  expect(
    screen.getByText('Chưa đồng bộ công việc. Kéo xuống để thử lại.'),
  ).toBeTruthy();
});

it('shows the finance summary before today’s calendar and tasks', async () => {
  const today = new Date();
  const dateKey = toDateKey(today);
  const note: LifeNote = {
    id: `calendar-day-${dateKey}-birthday`,
    ownerId: 'home-user',
    title: 'Sinh nhật vợ',
    body: 'Mua bánh',
    updatedAt: 1,
  };
  const task: AgendaItem = {
    id: 'pay-electricity',
    ownerId: 'home-user',
    title: 'Đóng tiền điện',
    details: '',
    dueAt: new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      18,
      30,
    ).getTime(),
    completed: false,
    reminderAt: null,
    updatedAt: 1,
  };
  const financeTransactions: FinanceTransaction[] = [
    {
      id: 'home-income',
      ownerId: 'home-user',
      type: 'income',
      amount: 500_000,
      category: 'Lương',
      note: 'Phụ cấp',
      createdAt: new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        12,
      ).getTime(),
    },
    {
      id: 'home-expense',
      ownerId: 'home-user',
      type: 'expense',
      amount: 50_000,
      category: 'Ăn uống',
      note: 'Bữa trưa',
      createdAt: new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        12,
      ).getTime(),
    },
  ];
  useNoteStore.setState({
    uid: 'home-user',
    notes: [note],
    synced: true,
    loading: false,
    error: null,
  });
  useAgendaStore.setState({
    uid: 'home-user',
    items: [task],
    synced: true,
    loading: false,
    error: null,
    reminderStatus: null,
  });
  useFinanceStore.setState({
    uid: 'home-user',
    transactions: financeTransactions,
    syncStatus: 'synced',
    loading: false,
    error: null,
  });
  const home = renderHome();

  const cardOrder = findRenderedCardIds(home.root as unknown as RenderedNode);
  expect([...new Set(cardOrder)]).toEqual([
    'home-finance-card',
    'home-today-card',
  ]);
  expect(screen.getByTestId('home-finance-card')).toBeTruthy();
  expect(screen.getByText('500.000 ₫')).toBeTruthy();
  expect(screen.getByText('50.000 ₫')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Mở lịch hôm nay' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Mở việc hôm nay' })).toBeTruthy();
  await waitFor(() => expect(screen.getByText(/\d+ mục hôm nay/)).toBeTruthy());
  expect(screen.getByText('1 việc hôm nay')).toBeTruthy();
  expect(screen.getByText('Sinh nhật vợ')).toBeTruthy();
  expect(screen.getByText('Đóng tiền điện')).toBeTruthy();
  expect(screen.getByText('18:30')).toBeTruthy();
  expect(screen.getByText(/· Âm \d+\/\d+/)).toBeTruthy();
  expect(screen.queryByText('Xem hoặc thêm việc hôm nay')).toBeNull();
  expect(screen.queryByTestId(/^calendar-day-/)).toBeNull();
  expect(screen.queryByText('Danh sách nghe')).toBeNull();
  expect(screen.queryByLabelText('Mở thư viện MP3')).toBeNull();
  expect(
    screen.queryByText('Một ngày gọn gàng, theo nhịp của bạn.'),
  ).toBeNull();
  expect(
    screen.queryByText('Không cần vội. Hôm nay, cứ theo nhịp của bạn.'),
  ).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'Mở lịch hôm nay' }));
  expect(await screen.findByTestId(`calendar-day-${dateKey}`)).toBeTruthy();
  expect(screen.queryByRole('tablist')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Đóng lịch và việc' }));
  fireEvent.press(screen.getByRole('button', { name: 'Mở việc hôm nay' }));
  expect(screen.queryByRole('tablist')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Đóng lịch và việc' }));
});

it('shows Home totals while Finance tab remains locked', async () => {
  const today = new Date();
  useFinanceStore.setState({
    uid: 'home-user',
    transactions: [
      {
        id: 'private-income',
        ownerId: 'home-user',
        type: 'income',
        amount: 900_000,
        category: 'Lương',
        note: '',
        createdAt: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          12,
        ).getTime(),
      },
    ],
    syncStatus: 'synced',
    loading: false,
    error: null,
  });
  useFinanceLockStore.setState({
    ...useFinanceLockStore.getState(),
    uid: 'home-user',
    enabled: true,
    loading: false,
    unlocked: false,
    appActive: true,
  });
  navigation.navigate.mockClear();
  renderHome();

  expect(await screen.findByText('900.000 ₫')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Chọn ngày, hôm nay' }),
  ).toBeTruthy();
  expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Mở sổ Tài chính' }));
  expect(navigation.navigate).toHaveBeenCalledWith('Finance');
  expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
});

it('shows Home amounts while Finance is locked and the app is inactive', () => {
  const today = new Date();
  useFinanceStore.setState({
    uid: 'home-user',
    transactions: [
      {
        id: 'private-income',
        ownerId: 'home-user',
        type: 'income',
        amount: 900_000,
        category: 'Lương',
        note: '',
        createdAt: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          12,
        ).getTime(),
      },
    ],
    syncStatus: 'synced',
    loading: false,
    error: null,
  });
  useFinanceLockStore.setState({
    ...useFinanceLockStore.getState(),
    uid: 'home-user',
    enabled: true,
    loading: false,
    unlocked: false,
    appActive: false,
  });
  renderHome();

  expect(screen.getByText('900.000 ₫')).toBeTruthy();
});

it('returns the finance summary to today when Home regains focus', () => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  useFinanceStore.setState({
    uid: 'home-user',
    transactions: [
      {
        id: 'today-expense',
        ownerId: 'home-user',
        type: 'expense',
        amount: 50_000,
        category: 'Ăn uống',
        note: 'Hôm nay',
        createdAt: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          12,
        ).getTime(),
      },
      {
        id: 'yesterday-expense',
        ownerId: 'home-user',
        type: 'expense',
        amount: 100_000,
        category: 'Ăn uống',
        note: 'Hôm qua',
        createdAt: new Date(
          yesterday.getFullYear(),
          yesterday.getMonth(),
          yesterday.getDate(),
          12,
        ).getTime(),
      },
    ],
    syncStatus: 'synced',
    loading: false,
    error: null,
  });
  renderHome();

  fireEvent.press(screen.getByRole('button', { name: 'Chọn ngày, hôm nay' }));
  fireEvent.press(
    screen.getByTestId(`home-finance-picker-day-${toDateKey(yesterday)}`),
  );
  expect(screen.getByText('100.000 ₫')).toBeTruthy();

  act(() => homeFocusHandler?.());

  expect(
    screen.getByRole('button', { name: 'Chọn ngày, hôm nay' }),
  ).toBeTruthy();
  expect(screen.getByText('50.000 ₫')).toBeTruthy();
});

it('opens the preparation checklist from the drawer', async () => {
  navigation.navigate.mockClear();
  renderHome();

  fireEvent.press(screen.getByRole('button', { name: 'Mở menu' }));
  fireEvent.press(screen.getByRole('button', { name: 'Danh sách chuẩn bị' }));

  await waitFor(() =>
    expect(navigation.navigate).toHaveBeenCalledWith('Checklists'),
  );
});
