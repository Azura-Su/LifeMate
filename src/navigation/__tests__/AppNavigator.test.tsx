import { act, render, screen } from '@testing-library/react-native';
import { useAuthStore } from '../../store/authStore';
import { useConfigStore } from '../../store/configStore';
import { AppNavigator } from '../AppNavigator';

jest.mock('../../services/firebase/remoteConfigService', () => ({
  loadRemoteConfig: jest.fn(),
  readActivatedRemoteConfig: jest.fn(),
  observeRemoteConfig: jest.fn(),
}));

jest.mock('../../screens/Login/LoginScreen', () => {
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return { LoginScreen: () => <Text>Login form</Text> };
});
jest.mock('../MainTabs', () => {
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return { MainTabs: () => <Text>Home MP3 Setting</Text> };
});
jest.mock('../../screens/Register/RegisterScreen', () => {
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return { RegisterScreen: () => <Text>Register form</Text> };
});

describe('session gate', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      initializing: true,
      authView: 'login',
      registrationPhase: 'idle',
      registrationUid: null,
    });
    useConfigStore.setState({ registrationEnabled: false });
  });
  it('waits for Firebase before rendering protected tabs or the login form', () => {
    render(<AppNavigator />);
    expect(screen.queryByText('Home MP3 Setting')).toBeNull();
    expect(screen.queryByText('Login form')).toBeNull();
    act(() => useAuthStore.getState().setUser(null));
    expect(screen.getByText('Login form')).toBeTruthy();
  });
  it('unmounts authenticated navigation on logout', () => {
    useAuthStore
      .getState()
      .setUser({ uid: '1', email: 'asher@example.com', displayName: null });
    render(<AppNavigator />);
    expect(screen.getByText('Home MP3 Setting')).toBeTruthy();
    act(() => useAuthStore.getState().setUser(null));
    expect(screen.queryByText('Home MP3 Setting')).toBeNull();
    expect(screen.getByText('Login form')).toBeTruthy();
  });
  it('keeps the registration screen through automatic Firebase sign-in', () => {
    useConfigStore.setState({ registrationEnabled: true });
    act(() => useAuthStore.getState().setUser(null));
    render(<AppNavigator />);
    act(() => {
      useAuthStore.getState().openRegistration();
      useAuthStore.getState().beginRegistration();
      useAuthStore.getState().setUser({
        uid: 'new',
        email: 'new@b.co',
        displayName: null,
      });
    });
    expect(screen.getByText('Register form')).toBeTruthy();
    expect(screen.queryByText('Home MP3 Setting')).toBeNull();
    act(() => {
      useAuthStore.getState().markRegistrationCreated('new');
      useAuthStore.getState().finishRegistration('new');
    });
    expect(screen.getByText('Home MP3 Setting')).toBeTruthy();
  });
  it('closes an idle registration form when Remote Config disables it', () => {
    useConfigStore.setState({ registrationEnabled: true });
    act(() => useAuthStore.getState().setUser(null));
    render(<AppNavigator />);
    act(() => useAuthStore.getState().openRegistration());
    expect(screen.getByText('Register form')).toBeTruthy();
    act(() => useConfigStore.setState({ registrationEnabled: false }));
    expect(screen.getByText('Login form')).toBeTruthy();
  });
});
