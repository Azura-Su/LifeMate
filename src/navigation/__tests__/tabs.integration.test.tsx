import { NavigationContainer } from '@react-navigation/native';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import {
  AppState,
  Platform,
  StyleSheet,
  View,
  type AppStateStatus,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from '../AppNavigator';
import { useAuthStore } from '../../store/authStore';
import { useConfigStore } from '../../store/configStore';
import { useFinanceStore } from '../../store/financeStore';
import { resetFirestoreMock } from '../../testing/firestoreMock';
import { useFinanceLockStore } from '../../store/financeLockStore';
import { useNotesLockStore } from '../../store/notesLockStore';

// Native font loading is outside this navigation integration test.
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);
jest.mock('@react-native-firebase/firestore', () =>
  jest.requireActual('../../testing/firestoreMock'),
);
jest.mock('../../screens/Mp3/AudioPlayer', () => ({ AudioPlayer: () => null }));
jest.mock('expo-audio', () => {
  // The native hook keeps one player for the lifetime of the screen.
  const player = {
    isLoaded: false,
    loop: false,
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    replace: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    setPlaybackRate: jest.fn(),
    setActiveForLockScreen: jest.fn(),
    updateLockScreenMetadata: jest.fn(),
    clearLockScreenControls: jest.fn(),
  };
  return {
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
    useAudioPlayer: () => player,
    useAudioPlayerStatus: () => ({
      playing: false,
      isLoaded: false,
      currentTime: 0,
      duration: 0,
    }),
  };
});
jest.mock('../../../modules/lifemate-audio', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'test-id' }));
jest.mock('../../services/audio/audioFiles', () => ({
  readAudioIndex: jest.fn().mockResolvedValue([]),
  mergeAudioIndex: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../services/firebase/audioLibraryService', () => ({
  fetchCloudTracks: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../services/firebase/authService', () => ({
  logout: jest.fn().mockResolvedValue(undefined),
  login: jest.fn(),
}));
jest.mock('../../services/firebase/remoteConfigService', () => ({
  loadRemoteUsers: jest.fn(),
}));
jest.mock('../../services/firebase/messagingService', () => ({
  disablePush: jest.fn().mockResolvedValue(undefined),
  registerPush: jest.fn(),
}));

beforeEach(() => {
  AppState.currentState = 'active';
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  jest
    .mocked(LocalAuthentication.authenticateAsync)
    .mockResolvedValue({ success: true });
  useAuthStore.getState().setUser({
    uid: 'lock-user',
    email: 'test@example.com',
    displayName: 'Asher',
  });
  resetFirestoreMock();
  useFinanceLockStore.getState().lock();
  useFinanceLockStore.setState({
    uid: null,
    enabled: null,
    unlocked: false,
    appActive: true,
    authenticating: false,
    changing: false,
    loading: false,
    error: null,
  });
  useNotesLockStore.setState({
    uid: null,
    unlocked: false,
    authenticating: false,
    error: null,
  });
  useFinanceStore.setState({
    uid: null,
    transactions: [],
    syncStatus: null,
    loading: false,
    error: null,
  });
});
afterEach(() => jest.restoreAllMocks());

function renderApp(insets = { top: 0, bottom: 0, left: 0, right: 0 }) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets,
      }}
    >
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>,
  );
}

function pressFinanceTab() {
  fireEvent.press(screen.getByLabelText('Tài chính, tab, 2 of 3'));
}

it('shows the configured name, opens all tabs, and returns to Login on logout', async () => {
  useAuthStore.getState().setUser({
    uid: 'test-user',
    email: 'asher@example.com',
    displayName: null,
  });
  useConfigStore.setState({
    users: [{ mail: 'asher@example.com', name: 'Asher' }],
  });
  resetFirestoreMock();
  useFinanceStore.setState({
    uid: null,
    transactions: [],
    syncStatus: null,
    loading: false,
    error: null,
  });
  renderApp({ top: 59, bottom: 34, left: 0, right: 0 });
  const hiddenTabItems = screen
    .UNSAFE_getAllByType(View)
    .filter((item) => StyleSheet.flatten(item.props.style)?.display === 'none');
  expect(hiddenTabItems).toHaveLength(4);
  expect(await screen.findByText('Asher')).toBeTruthy();
  expect(screen.getByLabelText('Home, tab, 1 of 3')).toBeTruthy();
  expect(screen.getByLabelText('Tài chính, tab, 2 of 3')).toBeTruthy();
  expect(screen.getByLabelText('MP3, tab, 3 of 3')).toBeTruthy();
  pressFinanceTab();
  expect(await screen.findByText('Chưa có giao dịch nào')).toBeTruthy();
  fireEvent.press(screen.getByText('MP3'));
  expect(await screen.findByText('Chưa có bài để nghe')).toBeTruthy();

  fireEvent.press(screen.getByText('Home'));
  expect(screen.queryByText('Cài đặt')).toBeNull();
  expect(screen.queryByText('Ghi chú')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Mở menu' }));
  expect(await screen.findByText('Face ID cho tab Tài chính')).toBeTruthy();
  expect(screen.queryByText('Face ID · chưa bật')).toBeNull();
  expect(screen.getByText('Bật thông báo')).toBeTruthy();
  expect(screen.getByText('LifeMate · 1.0.0')).toBeTruthy();
  expect(
    StyleSheet.flatten(
      screen.getByTestId('drawer-safe-area-content').props.style,
    ),
  ).toMatchObject({ paddingTop: 59, paddingBottom: 34 });
  const drawerBottom = await screen.findByTestId('drawer-bottom-actions');
  expect(
    within(drawerBottom).getByRole('button', { name: 'Đăng xuất' }),
  ).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Ghi chú' }));
  await waitFor(() => expect(useNotesLockStore.getState().unlocked).toBe(true));
  expect(await screen.findByText('Chưa có ghi chú')).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Quay về Home' }));
  fireEvent.press(screen.getByRole('button', { name: 'Mở menu' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Ghi điểm bài' }));
  expect(await screen.findByText('Sẵn sàng ghi điểm?')).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Bảng điểm' })).toBeTruthy();
  expect(screen.queryByText('TIỆN ÍCH')).toBeNull();
  expect(screen.queryByLabelText('Home, tab, 1 of 3')).toBeNull();
  expect(screen.queryByLabelText('Tài chính, tab, 2 of 3')).toBeNull();
  expect(screen.queryByLabelText('MP3, tab, 3 of 3')).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'Quay về Home' }));
  fireEvent.press(screen.getByRole('button', { name: 'Mở menu' }));
  fireEvent.press(await screen.findByText('Đăng xuất'));
  expect(await screen.findByText('Đăng nhập')).toBeTruthy();
  expect(screen.queryByText('Asher')).toBeNull();
});

it('shows Home Finance and protects the Finance tab with Face ID', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('on');
  jest
    .mocked(LocalAuthentication.authenticateAsync)
    .mockResolvedValueOnce({ success: false, error: 'user_cancel' });
  let changeState!: (state: AppStateStatus) => void;
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback) => {
      changeState = callback;
      return { remove: jest.fn() };
    });

  renderApp();
  await waitFor(() =>
    expect(useFinanceLockStore.getState().enabled).toBe(true),
  );
  expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
  expect(
    await screen.findByRole('button', { name: 'Chọn ngày, hôm nay' }),
  ).toBeTruthy();
  expect(screen.queryByText('Tóm tắt trên Home đang ẩn')).toBeNull();

  act(() => changeState('background'));
  act(() => changeState('active'));
  expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();

  pressFinanceTab();
  expect(await screen.findByText('Đã hủy xác thực.')).toBeTruthy();
  expect(screen.queryByText('Giao dịch trong tháng')).toBeNull();
  expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button', { name: 'Mở khóa' }));
  expect(await screen.findByText('Giao dịch trong tháng')).toBeTruthy();
  expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(2);

  act(() => changeState('background'));
  expect(screen.queryByText('Giao dịch trong tháng')).toBeNull();
  act(() => changeState('active'));
  expect(await screen.findByText('Giao dịch trong tháng')).toBeTruthy();
  expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(3);
});

it('shows Finance when Face ID succeeds and iOS does not report active again', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('on');
  const listeners: ((state: AppStateStatus) => void)[] = [];
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback) => {
      listeners.push(callback);
      return { remove: jest.fn() };
    });
  let finish!: (value: LocalAuthentication.LocalAuthenticationResult) => void;
  jest.mocked(LocalAuthentication.authenticateAsync).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );

  AppState.currentState = 'active';
  renderApp();
  pressFinanceTab();
  await waitFor(() =>
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalled(),
  );

  act(() => {
    AppState.currentState = 'inactive';
    listeners.forEach((listener) => listener('inactive'));
  });
  await act(async () => finish({ success: true }));

  expect(useFinanceLockStore.getState().unlocked).toBe(true);
  expect(await screen.findByText('Giao dịch trong tháng')).toBeTruthy();
});

it('asks for Face ID again when opening Finance after enabling its lock', async () => {
  renderApp();
  await waitFor(() =>
    expect(useFinanceLockStore.getState().enabled).toBe(false),
  );

  fireEvent.press(screen.getByRole('button', { name: 'Mở menu' }));
  const financeLockSwitch = await screen.findByRole('switch', {
    name: 'Yêu cầu xác thực thiết bị để mở tab Tài chính',
  });
  fireEvent(financeLockSwitch, 'valueChange', true);
  await waitFor(() =>
    expect(useFinanceLockStore.getState().enabled).toBe(true),
  );
  expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);
  expect(useFinanceLockStore.getState().unlocked).toBe(false);

  fireEvent.press(screen.getByRole('button', { name: 'Đóng menu' }));
  pressFinanceTab();
  expect(await screen.findByText('Giao dịch trong tháng')).toBeTruthy();
  expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(2);
});

it('retries automatic Finance authentication after changing the lock setting', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('on');
  jest
    .mocked(LocalAuthentication.authenticateAsync)
    .mockResolvedValueOnce({ success: false, error: 'user_cancel' });
  renderApp();

  await waitFor(() =>
    expect(useFinanceLockStore.getState().enabled).toBe(true),
  );
  pressFinanceTab();
  expect(await screen.findByText('Đã hủy xác thực.')).toBeTruthy();
  expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);

  fireEvent.press(screen.getByLabelText('Home, tab, 1 of 3'));
  fireEvent.press(screen.getByRole('button', { name: 'Mở menu' }));
  fireEvent(
    screen.getByRole('switch', {
      name: 'Yêu cầu xác thực thiết bị để mở tab Tài chính',
    }),
    'valueChange',
    false,
  );
  await waitFor(() =>
    expect(useFinanceLockStore.getState().enabled).toBe(false),
  );

  fireEvent(
    screen.getByRole('switch', {
      name: 'Yêu cầu xác thực thiết bị để mở tab Tài chính',
    }),
    'valueChange',
    true,
  );
  await waitFor(() =>
    expect(useFinanceLockStore.getState().enabled).toBe(true),
  );
  expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(3);

  fireEvent.press(screen.getByRole('button', { name: 'Đóng menu' }));
  pressFinanceTab();
  await waitFor(() =>
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(4),
  );
  expect(await screen.findByText('Giao dịch trong tháng')).toBeTruthy();
});

it('preserves an open transaction form across background and Face ID', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('on');
  let changeState!: (state: AppStateStatus) => void;
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback) => {
      changeState = callback;
      return { remove: jest.fn() };
    });
  renderApp();
  pressFinanceTab();
  expect(await screen.findByText('Giao dịch trong tháng')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Thêm giao dịch' }));
  expect(screen.getByLabelText('Số tiền')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Số tiền'), '125000');
  fireEvent.changeText(screen.getByLabelText('Ghi chú'), 'Ăn trưa');
  act(() => changeState('background'));
  expect(screen.queryByLabelText('Số tiền')).toBeNull();
  expect(screen.queryByText('Giao dịch trong tháng')).toBeNull();
  act(() => changeState('active'));
  expect(await screen.findByText('Giao dịch trong tháng')).toBeTruthy();
  expect(await screen.findByLabelText('Số tiền')).toBeTruthy();
  expect(screen.getByLabelText('Số tiền').props.value).toBe('125.000');
  expect(
    screen.getByLabelText('Số tiền bằng chữ: Một trăm hai mươi lăm nghìn đồng'),
  ).toBeTruthy();
  expect(screen.getByLabelText('Ghi chú').props.value).toBe('Ăn trưa');
  expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(2);
});

it('shows Notes when Face ID succeeds after iOS is active but its event was missed', async () => {
  const listeners: ((state: AppStateStatus) => void)[] = [];
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback) => {
      listeners.push(callback);
      return { remove: jest.fn() };
    });
  let finish!: (value: LocalAuthentication.LocalAuthenticationResult) => void;
  jest.mocked(LocalAuthentication.authenticateAsync).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );

  AppState.currentState = 'active';
  renderApp();
  fireEvent.press(screen.getByRole('button', { name: 'Mở menu' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Ghi chú' }));
  await waitFor(() =>
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalled(),
  );

  act(() => {
    AppState.currentState = 'inactive';
    listeners.forEach((listener) => listener('inactive'));
  });
  AppState.currentState = 'active';
  await act(async () => finish({ success: true }));

  expect(await screen.findByText('Chưa có ghi chú')).toBeTruthy();
});

it('shows Notes after successful Face ID even before iOS reports active', async () => {
  const listeners: ((state: AppStateStatus) => void)[] = [];
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback) => {
      listeners.push(callback);
      return { remove: jest.fn() };
    });
  let finish!: (value: LocalAuthentication.LocalAuthenticationResult) => void;
  jest.mocked(LocalAuthentication.authenticateAsync).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );

  AppState.currentState = 'active';
  renderApp();
  fireEvent.press(screen.getByRole('button', { name: 'Mở menu' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Ghi chú' }));
  await waitFor(() =>
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalled(),
  );

  act(() => {
    AppState.currentState = 'inactive';
    listeners.forEach((listener) => listener('inactive'));
  });
  await act(async () => finish({ success: true }));
  expect(useNotesLockStore.getState().unlocked).toBe(true);
  expect(await screen.findByText('Chưa có ghi chú')).toBeTruthy();

  act(() => {
    AppState.currentState = 'active';
    listeners.forEach((listener) => listener('active'));
  });
  expect(await screen.findByText('Chưa có ghi chú')).toBeTruthy();
});

it('shows Notes after successful Face ID when iOS never sends the active event', async () => {
  const listeners: ((state: AppStateStatus) => void)[] = [];
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback) => {
      listeners.push(callback);
      return { remove: jest.fn() };
    });
  let finish!: (value: LocalAuthentication.LocalAuthenticationResult) => void;
  jest.mocked(LocalAuthentication.authenticateAsync).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );

  AppState.currentState = 'active';
  renderApp();
  fireEvent.press(screen.getByRole('button', { name: 'Mở menu' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Ghi chú' }));
  await waitFor(() =>
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalled(),
  );

  act(() => {
    AppState.currentState = 'inactive';
    listeners.forEach((listener) => listener('inactive'));
  });
  await act(async () => finish({ success: true }));

  expect(useNotesLockStore.getState().unlocked).toBe(true);
  expect(await screen.findByText('Chưa có ghi chú')).toBeTruthy();
});

it('preserves a new note draft across background and Face ID', async () => {
  const listeners: ((state: AppStateStatus) => void)[] = [];
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback) => {
      listeners.push(callback);
      return { remove: jest.fn() };
    });

  AppState.currentState = 'active';
  renderApp();
  fireEvent.press(screen.getByRole('button', { name: 'Mở menu' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Ghi chú' }));
  await waitFor(() => expect(useNotesLockStore.getState().unlocked).toBe(true));
  expect(await screen.findByText('Chưa có ghi chú')).toBeTruthy();

  fireEvent.press(screen.getByLabelText('Tạo ghi chú'));
  fireEvent.changeText(screen.getByLabelText('Tiêu đề ghi chú'), 'Ý tưởng mới');
  fireEvent.changeText(screen.getByLabelText('Ý thứ 1'), 'Nội dung cần giữ');

  act(() => {
    AppState.currentState = 'background';
    listeners.forEach((listener) => listener('background'));
  });
  expect(screen.getByText('Ghi chú riêng tư')).toBeTruthy();

  act(() => {
    AppState.currentState = 'active';
    listeners.forEach((listener) => listener('active'));
  });

  expect(await screen.findByText('Ghi chú mới')).toBeTruthy();
  expect(screen.getByLabelText('Tiêu đề ghi chú').props.value).toBe(
    'Ý tưởng mới',
  );
  expect(screen.getByLabelText('Ý thứ 1').props.value).toBe('Nội dung cần giữ');
  expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(2);
});

it('keeps Notes locked when the app backgrounds during Face ID', async () => {
  const listeners: ((state: AppStateStatus) => void)[] = [];
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback) => {
      listeners.push(callback);
      return { remove: jest.fn() };
    });
  let finish!: (value: LocalAuthentication.LocalAuthenticationResult) => void;
  jest.mocked(LocalAuthentication.authenticateAsync).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );

  AppState.currentState = 'active';
  renderApp();
  fireEvent.press(screen.getByRole('button', { name: 'Mở menu' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Ghi chú' }));
  await waitFor(() =>
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalled(),
  );

  act(() => {
    AppState.currentState = 'background';
    listeners.forEach((listener) => listener('background'));
  });
  await act(async () => finish({ success: true }));

  expect(useNotesLockStore.getState().unlocked).toBe(false);
  expect(screen.getByText('Ghi chú riêng tư')).toBeTruthy();
  expect(screen.queryByText('Chưa có ghi chú')).toBeNull();
});

it('does not enable the secure-window screenshot workaround for Finance on iOS', async () => {
  expect(Platform.OS).toBe('ios');
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('on');

  renderApp();
  pressFinanceTab();

  expect(await screen.findByText('Giao dịch trong tháng')).toBeTruthy();
  expect(usePreventScreenCapture).not.toHaveBeenCalled();
});
