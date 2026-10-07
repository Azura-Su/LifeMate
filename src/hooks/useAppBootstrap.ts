import { useEffect } from 'react';
import { AppState } from 'react-native';
import { observeAuth } from '../services/firebase/authService';
import {
  disablePush,
  observePush,
  registerPush,
} from '../services/firebase/messagingService';
import { useAuthStore } from '../store/authStore';
import { useConfigStore } from '../store/configStore';
import { useNotificationStore } from '../store/notificationStore';

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

  useEffect(() => {
    void useConfigStore.getState().refresh();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void useConfigStore.getState().refresh();
    });
    return () => listener.remove();
  }, []);

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
    void restore();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void restore();
    });
    return () => {
      active = false;
      unsubscribe();
      listener.remove();
    };
  }, [uid]);
}
