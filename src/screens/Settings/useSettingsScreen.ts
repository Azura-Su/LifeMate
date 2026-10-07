import { useRef, useState } from 'react';
import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useProfile } from '../../hooks/useProfile';
import { logout } from '../../services/firebase/authService';
import {
  disablePush,
  registerPush,
} from '../../services/firebase/messagingService';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';

export function useSettingsScreen() {
  const profile = useProfile();
  const permission = useNotificationStore((state) => state.permission);
  const token = useNotificationStore((state) => state.token);
  const pushError = useNotificationStore((state) => state.error);
  const [busy, setBusy] = useState<'push' | 'logout' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pending = useRef(false);

  async function enablePush() {
    if (pending.current) return;
    pending.current = true;
    setBusy('push');
    setError(null);
    const uid = useAuthStore.getState().user?.uid;
    try {
      if (permission === 'denied') {
        await Linking.openSettings();
        return;
      }
      const result = await registerPush(true);
      if (uid && useAuthStore.getState().user?.uid === uid)
        useNotificationStore.setState({ ...result, error: null });
    } catch {
      setError(
        'Chưa thể bật thông báo. Vui lòng thử lại trên thiết bị có kết nối mạng.',
      );
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }

  async function signOut() {
    if (pending.current) return;
    pending.current = true;
    setBusy('logout');
    setError(null);
    try {
      // Auth observer resets the navigation and queues token deletion; network failure
      // during token deletion must not keep the user signed in.
      await logout();
      useAuthStore.getState().setUser(null);
      useNotificationStore.getState().reset();
      void disablePush().catch(() => undefined);
    } catch {
      setError('Chưa thể đăng xuất. Vui lòng thử lại.');
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }

  async function copyToken() {
    if (!token) return;
    try {
      await Clipboard.setStringAsync(token);
      setCopied(true);
    } catch {
      setError('Chưa thể sao chép mã thiết bị.');
    }
  }

  return {
    ...profile,
    permission,
    token,
    pushError,
    busy,
    error,
    copied,
    enablePush,
    signOut,
    copyToken,
  };
}
