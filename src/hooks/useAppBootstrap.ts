import { useEffect } from 'react';
import { AppState } from 'react-native';
import { observeAuth } from '../services/firebase/authService';
import {
  disablePush,
  observePush,
  registerPush,
} from '../services/firebase/messagingService';
import { cancelAllAgendaReminders } from '../services/agenda/agendaReminders';
import { migrateSensitiveCache } from '../services/security/encryptedLocalStorage';
import { useAuthStore } from '../store/authStore';
import { useConfigStore } from '../store/configStore';
import { useNotificationStore } from '../store/notificationStore';

const PUSH_RECHECK_MS = 30 * 60 * 1000;

export function useAppBootstrap() {
  const uid = useAuthStore((state) => state.user?.uid);
  useEffect(
    () =>
      observeAuth(
        (user) => {
          const oldUid = useAuthStore.getState().user?.uid;
          if (oldUid !== user?.uid || !user)
            useNotificationStore.getState().reset();
          useAuthStore.getState().setUser(user);
          if (!user) void disablePush().catch(() => undefined);
        },
        () => useAuthStore.getState().setUser(null),
      ),
    [],
  );

  // Local reminders outlive the session. Cancel the previous account's ones
  // whenever it signs out or another account takes over, from any path
  // (Settings logout, token revocation, account switch).
  useEffect(
    () =>
      useAuthStore.subscribe((state, previous) => {
        const previousUid = previous.user?.uid;
        if (previousUid && previousUid !== state.user?.uid)
          void cancelAllAgendaReminders(previousUid).catch(() => undefined);
      }),
    [],
  );

  useEffect(() => {
    void useConfigStore.getState().refresh();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void useConfigStore.getState().refresh();
    });
    return () => listener.remove();
  }, []);

  useEffect(() => {
    if (!uid) return;
    void migrateSensitiveCache(uid).catch(() => undefined);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    let active = true;
    const isCurrentSession = () =>
      active && useAuthStore.getState().user?.uid === uid;
    const unsubscribe = observePush(
      (message) => {
        if (isCurrentSession())
          useNotificationStore.setState({ lastMessage: message });
      },
      (token) => {
        if (
          isCurrentSession() &&
          useNotificationStore.getState().permission === 'granted'
        ) {
          useNotificationStore.setState({ token });
        }
      },
    );
    const restore = async () => {
      try {
        const result = await registerPush(false);
        if (isCurrentSession())
          useNotificationStore.setState({ ...result, error: null });
      } catch {
        if (isCurrentSession())
          useNotificationStore.setState({
            error:
              'Chưa thể kết nối thông báo. Bạn có thể thử lại trong Setting.',
          });
      }
    };
    // Push registration is several native calls; on foreground only re-check
    // occasionally (token changes still arrive through observePush).
    let lastRestore = Date.now();
    void restore();
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      // Re-check right away while permission is missing, so enabling it in
      // the OS settings shows up as soon as the user comes back.
      const granted = useNotificationStore.getState().permission === 'granted';
      if (granted && Date.now() - lastRestore < PUSH_RECHECK_MS) return;
      lastRestore = Date.now();
      void restore();
    });
    return () => {
      active = false;
      unsubscribe();
      listener.remove();
    };
  }, [uid]);
}
