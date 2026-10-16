import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../store/authStore';
import { useConfigStore } from '../../../store/configStore';
import { LoginScreen } from '../LoginScreen';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('../../../services/firebase/remoteConfigService', () => ({
  loadRemoteConfig: jest.fn(),
  readActivatedRemoteConfig: jest.fn(),
}));
jest.mock('../useLoginScreen', () => ({
  useLoginScreen: () => ({
    email: '',
    setEmail: jest.fn(),
    password: '',
    setPassword: jest.fn(),
    visible: false,
    toggleVisible: jest.fn(),
    loading: false,
    error: null,
    submit: jest.fn(),
  }),
}));

function renderLogin() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
      }}
    >
      <LoginScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    initializing: false,
    authView: 'login',
    registrationPhase: 'idle',
    registrationUid: null,
  });
  useConfigStore.setState({ registrationEnabled: false });
});

it('only opens registration when Remote Config enables it', () => {
  const view = renderLogin();
  expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Tạo tài khoản' })).toBeNull();

  act(() => useConfigStore.setState({ registrationEnabled: true }));
  expect(screen.getByRole('button', { name: 'Tạo tài khoản' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Tạo tài khoản' }));
  expect(useAuthStore.getState().authView).toBe('register');

  view.unmount();
});
