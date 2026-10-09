import { act, renderHook } from '@testing-library/react-native';
import type { SessionUser } from '../../types/models';
import { useAppBootstrap } from '../useAppBootstrap';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { observeAuth } from '../../services/firebase/authService';
import {
  disablePush,
  observePush,
  registerPush,
} from '../../services/firebase/messagingService';
import { cancelAllAgendaReminders } from '../../services/agenda/agendaReminders';
import { migrateSensitiveCache } from '../../services/security/encryptedLocalStorage';

jest.mock('../../services/firebase/authService', () => ({
  observeAuth: jest.fn(),
}));
jest.mock('../../services/firebase/messagingService', () => ({
  disablePush: jest.fn().mockResolvedValue(undefined),
  observePush: jest.fn(),
  registerPush: jest.fn(),
}));
jest.mock('../../services/agenda/agendaReminders', () => ({
  cancelAllAgendaReminders: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../services/security/encryptedLocalStorage', () => ({
  migrateSensitiveCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../services/firebase/remoteConfigService', () => ({
  loadRemoteUsers: jest.fn().mockResolvedValue({ users: [], warning: null }),
}));

describe('session lifecycle', () => {
  let authChanged: (user: SessionUser | null) => void;
  const unsubscribePush = jest.fn();
  beforeEach(() => {
    useAuthStore.setState({ user: null, initializing: true });
    useNotificationStore.getState().reset();
    jest.mocked(observeAuth).mockImplementation((callback) => {
      authChanged = callback;
      return jest.fn();
    });
    jest.mocked(observePush).mockReturnValue(unsubscribePush);
  });
  it('ignores a registration result arriving after logout and unsubscribes listeners', async () => {
    let finish!: (value: { permission: 'granted'; token: string }) => void;
    jest.mocked(registerPush).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { unmount } = renderHook(useAppBootstrap);
    await act(async () =>
      authChanged({ uid: 'a', email: 'a@b.co', displayName: null }),
    );
    expect(migrateSensitiveCache).toHaveBeenCalledWith('a');
    await act(async () => authChanged(null));
    await act(async () =>
      finish({ permission: 'granted', token: 'late-token' }),
    );
    expect(useNotificationStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(unsubscribePush).toHaveBeenCalled();
    expect(disablePush).toHaveBeenCalled();
    unmount();
  });

  it('cancels the signed-out account reminders so they stop firing', async () => {
    jest.mocked(registerPush).mockResolvedValue({
      permission: 'denied',
      token: null,
    } as never);
    const { unmount } = renderHook(useAppBootstrap);
    await act(async () =>
      authChanged({ uid: 'a', email: 'a@b.co', displayName: null }),
    );
    expect(cancelAllAgendaReminders).not.toHaveBeenCalled();

    await act(async () => authChanged(null));
    expect(cancelAllAgendaReminders).toHaveBeenCalledWith('a');
    unmount();
  });
});
