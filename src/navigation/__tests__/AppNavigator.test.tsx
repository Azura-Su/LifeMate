import { act, render, screen } from '@testing-library/react-native';
import { useAuthStore } from '../../store/authStore';
import { AppNavigator } from '../AppNavigator';

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

describe('session gate', () => {
  beforeEach(() => useAuthStore.setState({ user: null, initializing: true }));
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
});
