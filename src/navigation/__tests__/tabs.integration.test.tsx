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
  StyleSheet,
  View,
  type AppStateStatus,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from '../AppNavigator';
import { useAuthStore } from '../../store/authStore';
import { useConfigStore } from '../../store/configStore';
import { useFinanceStore } from '../../store/financeStore';
import { resetFirestoreMock } from '../../testing/firestoreMock';
import { useFinanceLockStore } from '../../store/financeLockStore';

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
  useFinanceStore.setState({
    uid: null,
    transactions: [],
    syncStatus: null,
    loading: false,
    error: null,
  });
});
afterEach(() => jest.restoreAllMocks());

function renderApp(
  insets = { top: 0, bottom: 0, left: 0, right: 0 },
) {
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
    .filter(
      (item) => StyleSheet.flatten(item.props.style)?.display === 'none',
    );
  expect(hiddenTabItems).toHaveLength(2);
  expect(await screen.findByText('Asher')).toBeTruthy();
  fireEvent.press(screen.getByText('Tài chính'));
  expect(await screen.findByText('Chưa có giao dịch nào')).toBeTruthy();
  fireEvent.press(screen.getByText('MP3'));
  expect(await screen.findByText('Chưa có bài để nghe')).toBeTruthy();

  fireEvent.press(screen.getByText('Home'));
  expect(screen.queryByText('Cài đặt')).toBeNull();
  expect(screen.queryByText('Ghi chú')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Mở menu' }));
  expect(await screen.findByText('Face ID cho Tài chính')).toBeTruthy();
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
  expect(await screen.findByText('Chưa có ghi chú')).toBeTruthy();

  fireEvent.press(screen.getByText('Home'));
  fireEvent.press(screen.getByRole('button', { name: 'Mở menu' }));
  fireEvent.press(await screen.findByText('Đăng xuất'));
  expect(await screen.findByText('Đăng nhập')).toBeTruthy();
  expect(screen.queryByText('Asher')).toBeNull();
});

it('keeps the ledger locked after canceled Face ID, allows retry, and reuses the session across tabs', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('on');
  jest
    .mocked(LocalAuthentication.authenticateAsync)
    .mockResolvedValueOnce({ success: false, error: 'user_cancel' });
  renderApp();
  fireEvent.press(await screen.findByText('Tài chính'));
  expect(await screen.findByText('Đã hủy xác thực.')).toBeTruthy();
  expect(screen.queryByText('Giao dịch trong tháng')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Mở khóa' }));
  expect(await screen.findByText('Giao dịch trong tháng')).toBeTruthy();
  fireEvent.press(screen.getByText('Home'));
  fireEvent.press(screen.getByText('Tài chính'));
  expect(await screen.findByText('Giao dịch trong tháng')).toBeTruthy();
  expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(2);
});

it('unmounts an open transaction form in the background and asks once on resume', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('on');
  let changeState!: (state: AppStateStatus) => void;
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback) => {
      changeState = callback;
      return { remove: jest.fn() };
    });
  renderApp();
  fireEvent.press(await screen.findByText('Tài chính'));
  expect(await screen.findByText('Giao dịch trong tháng')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Thêm giao dịch' }));
  expect(screen.getByLabelText('Số tiền')).toBeTruthy();
  act(() => changeState('background'));
  expect(screen.queryByLabelText('Số tiền')).toBeNull();
  expect(screen.queryByText('Giao dịch trong tháng')).toBeNull();
  act(() => changeState('active'));
  expect(await screen.findByText('Giao dịch trong tháng')).toBeTruthy();
  expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(2);
});

it('allows a successful Face ID prompt that temporarily makes iOS inactive', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('on');
  let changeState!: (state: AppStateStatus) => void;
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback) => {
      changeState = callback;
      return { remove: jest.fn() };
    });
  let finish!: (value: LocalAuthentication.LocalAuthenticationResult) => void;
  jest.mocked(LocalAuthentication.authenticateAsync).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  renderApp();
  fireEvent.press(await screen.findByText('Tài chính'));
  await waitFor(() =>
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalled(),
  );
  act(() => changeState('inactive'));
  await act(async () => finish({ success: true }));
  expect(screen.queryByText('Giao dịch trong tháng')).toBeNull();
  act(() => changeState('active'));
  expect(await screen.findByText('Giao dịch trong tháng')).toBeTruthy();
});
