import { fireEvent, render, screen } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import App from '../../../App';
import { useAppBootstrap } from '../../hooks/useAppBootstrap';
jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn(async () => {}) }));
jest.mock('../../hooks/useAppBootstrap', () => ({
  useAppBootstrap: jest.fn(),
}));
jest.mock('../../hooks/useAndroidNavigationBar', () => ({
  useAndroidNavigationBar: jest.fn(),
}));
jest.mock('../../services/firebase/messagingService', () => ({
  isHeadlessLaunch: jest.fn(async () => false),
}));
jest.mock('../AppNavigator', () => ({ AppNavigator: () => null }));
jest.mock('../../components/NotificationBanner', () => ({
  NotificationBanner: () => null,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: jest.requireActual('react-native').View,
}));
it('dismisses the native splash after actual foreground content lays out', () => {
  render(<App isHeadless={false} />);
  expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  fireEvent(screen.getByTestId('app-content'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
  });
  expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
});
it('does not mount foreground effects or dismiss the splash during a headless launch', () => {
  jest.mocked(SplashScreen.hideAsync).mockClear();
  jest.mocked(useAppBootstrap).mockClear();
  render(<App isHeadless />);
  expect(screen.queryByTestId('app-content')).toBeNull();
  expect(useAppBootstrap).not.toHaveBeenCalled();
  expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
});
