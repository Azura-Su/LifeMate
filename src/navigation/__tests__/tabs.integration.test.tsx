import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from '../AppNavigator';
import { useAuthStore } from '../../store/authStore';
import { useConfigStore } from '../../store/configStore';

// Native font loading is outside this navigation integration test.
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
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

it('shows the configured name, opens all three tabs, and returns to Login on logout', async () => {
  useAuthStore
    .getState()
    .setUser({
      uid: 'test-user',
      email: 'su.azura99@gmail.com',
      displayName: null,
    });
  useConfigStore.setState({
    users: [{ mail: 'su.azura99@gmail.com', name: 'Asher' }],
  });
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
      }}
    >
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>,
  );
  expect(await screen.findByText('Asher')).toBeTruthy();
  fireEvent.press(screen.getByText('MP3'));
  expect(await screen.findByText('Âm nhạc sẽ ở đây')).toBeTruthy();
  fireEvent.press(screen.getByText('Setting'));
  fireEvent.press(await screen.findByText('Đăng xuất'));
  expect(await screen.findByText('Đăng nhập')).toBeTruthy();
  expect(screen.queryByText('Asher')).toBeNull();
});
