import { disablePush, registerPush } from '../messagingService';
const mockGetPermission = jest.fn();
const mockRequestPermission = jest.fn();
const mockGetToken = jest.fn();
const mockDeleteToken = jest.fn();
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => mockGetPermission(),
  requestPermissionsAsync: () => mockRequestPermission(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  AndroidImportance: { HIGH: 4 },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
}));
jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: () => ({}),
  getToken: () => mockGetToken(),
  deleteToken: () => mockDeleteToken(),
  setAutoInitEnabled: jest.fn().mockResolvedValue(undefined),
  isDeviceRegisteredForRemoteMessages: () => true,
  registerDeviceForRemoteMessages: jest.fn(),
  onMessage: jest.fn(),
  onTokenRefresh: jest.fn(),
  onNotificationOpenedApp: jest.fn(),
  getInitialNotification: jest.fn(),
  setBackgroundMessageHandler: jest.fn(),
}));

describe('push permission and registration', () => {
  beforeEach(() => {
    mockGetToken.mockReset();
    mockRequestPermission.mockReset();
  });
  it('never prompts on a passive session restore', async () => {
    mockGetPermission.mockResolvedValue({
      granted: false,
      status: 'undetermined',
    });
    expect(await registerPush(false)).toEqual({
      permission: 'unknown',
      token: null,
    });
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(mockGetToken).not.toHaveBeenCalled();
  });
  it('does not generate a token after denial', async () => {
    mockGetPermission.mockResolvedValue({ granted: false });
    mockRequestPermission.mockResolvedValue({
      granted: false,
      status: 'denied',
    });
    expect(await registerPush(true)).toEqual({
      permission: 'denied',
      token: null,
    });
    expect(mockGetToken).not.toHaveBeenCalled();
  });
  it('returns the FCM token after permission has been granted', async () => {
    mockGetPermission.mockResolvedValue({ granted: true });
    mockGetToken.mockResolvedValue('test-device-token');
    expect(await registerPush(false)).toEqual({
      permission: 'granted',
      token: 'test-device-token',
    });
  });
  it('removes a token even when logout races with registration', async () => {
    mockGetPermission.mockResolvedValue({ granted: true });
    mockGetToken.mockResolvedValue('new-token');
    mockDeleteToken.mockResolvedValue(undefined);
    await Promise.all([registerPush(false), disablePush()]);
    expect(mockDeleteToken).toHaveBeenCalled();
  });
});
