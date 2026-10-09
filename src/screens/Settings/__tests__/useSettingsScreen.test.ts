import { act, renderHook } from '@testing-library/react-native';
import { useSettingsScreen } from '../useSettingsScreen';
import { useAuthStore } from '../../../store/authStore';
import { useNotificationStore } from '../../../store/notificationStore';
import { logout } from '../../../services/firebase/authService';

jest.mock('../../../services/firebase/authService', () => ({
  logout: jest.fn(),
}));
jest.mock('../../../services/firebase/messagingService', () => ({
  disablePush: jest.fn().mockResolvedValue(undefined),
  registerPush: jest.fn(),
}));
jest.mock('../../../services/firebase/remoteConfigService', () => ({
  loadRemoteUsers: jest.fn(),
}));

describe('logout', () => {
  beforeEach(() => {
    useAuthStore
      .getState()
      .setUser({ uid: '1', email: 'asher@example.com', displayName: null });
    useNotificationStore.setState({
      token: 'old',
      lastMessage: { title: 'Old', body: 'Private' },
    });
  });
  it('clears the user and user-visible push state on success', async () => {
    jest.mocked(logout).mockResolvedValue(undefined);
    const { result } = renderHook(useSettingsScreen);
    await act(async () => result.current.signOut());
    expect(useAuthStore.getState().user).toBeNull();
    expect(useNotificationStore.getState().token).toBeNull();
    expect(useNotificationStore.getState().lastMessage).toBeNull();
  });
  it('keeps the session when Firebase sign-out fails and reports the failure', async () => {
    jest.mocked(logout).mockRejectedValue(new Error('native failure'));
    const { result } = renderHook(useSettingsScreen);
    await act(async () => result.current.signOut());
    expect(useAuthStore.getState().user?.uid).toBe('1');
    expect(result.current.error).toContain('đăng xuất');
    expect(result.current.busy).toBeNull();
  });
});
