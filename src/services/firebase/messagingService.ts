import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  deleteToken,
  getInitialNotification,
  getIsHeadless,
  getMessaging,
  getToken,
  isDeviceRegisteredForRemoteMessages,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  setAutoInitEnabled,
  setBackgroundMessageHandler,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import type { AppNotification, PushPermission } from '../../types/models';

// Serialize device registration/revocation so a late token cannot survive logout.
let operation: Promise<unknown> = Promise.resolve();
function enqueue<T>(run: () => Promise<T>): Promise<T> {
  const next = operation.then(run, run);
  operation = next.catch(() => undefined);
  return next;
}

export function registerPush(
  askPermission: boolean,
): Promise<{ permission: PushPermission; token: string | null }> {
  return enqueue(async () => {
    // A channel is required before Android 13's permission prompt.
    // https://docs.expo.dev/versions/latest/sdk/notifications/
    if (Platform.OS === 'android')
      await Notifications.setNotificationChannelAsync('lifemate', {
        name: 'LifeMate',
        importance: Notifications.AndroidImportance.HIGH,
      });
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && askPermission)
      permission = await Notifications.requestPermissionsAsync();
    const granted =
      permission.granted ||
      permission.ios?.status ===
        Notifications.IosAuthorizationStatus.PROVISIONAL;
    if (!granted)
      return {
        permission: permission.status === 'denied' ? 'denied' : 'unknown',
        token: null,
      };
    const messaging = getMessaging();
    await setAutoInitEnabled(messaging, true);
    if (
      Platform.OS === 'ios' &&
      !isDeviceRegisteredForRemoteMessages(messaging)
    ) {
      await registerDeviceForRemoteMessages(messaging);
    }
    return { permission: 'granted', token: await getToken(messaging) };
  });
}

export function disablePush() {
  return enqueue(async () => {
    const messaging = getMessaging();
    await setAutoInitEnabled(messaging, false);
    await deleteToken(messaging);
  });
}

function toNotification(message: RemoteMessage): AppNotification {
  return {
    title: message.notification?.title?.slice(0, 120) || 'LifeMate',
    body:
      message.notification?.body?.slice(0, 600) || 'Bạn có một thông báo mới.',
  };
}

export function observePush(
  onNotification: (message: AppNotification) => void,
  onToken: (token: string) => void,
) {
  const messaging = getMessaging();
  let active = true;
  const notify = (message: RemoteMessage) => {
    if (active) onNotification(toNotification(message));
  };
  const unsubscribes = [
    onMessage(messaging, notify),
    onNotificationOpenedApp(messaging, notify),
    onTokenRefresh(messaging, (token) => {
      if (active) onToken(token);
    }),
  ];
  void getInitialNotification(messaging)
    .then((message) => {
      if (message) notify(message);
    })
    .catch(() => undefined);
  return () => {
    active = false;
    unsubscribes.forEach((unsubscribe) => unsubscribe());
  };
}

export function registerBackgroundMessages() {
  // Notification payloads are displayed by Android/iOS while backgrounded.
  // No data-only work is needed in v1; never navigate or mutate UI in this handler.
  setBackgroundMessageHandler(getMessaging(), async () => undefined);
}

export function isHeadlessLaunch() {
  return getIsHeadless(getMessaging());
}
