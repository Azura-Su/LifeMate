import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { AgendaItem } from '../../types/agenda';

const keyFor = (uid: string) =>
  `lifemate:agenda-reminders:v1:${encodeURIComponent(uid)}`;
async function readIds(uid: string): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(uid));
    const value: unknown = raw ? JSON.parse(raw) : {};
    if (!value || typeof value !== 'object') return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        (pair): pair is [string, string] => typeof pair[1] === 'string',
      ),
    );
  } catch {
    return {};
  }
}
// Stored as "notificationId|reminderAt"; older values hold only the id.
function parseEntry(value: string | undefined) {
  if (!value) return null;
  const split = value.lastIndexOf('|');
  return split < 0
    ? { id: value, at: null }
    : { id: value.slice(0, split), at: Number(value.slice(split + 1)) };
}
async function saveIds(uid: string, ids: Record<string, string>) {
  await AsyncStorage.setItem(keyFor(uid), JSON.stringify(ids));
}

// All reminder ids for an account live in one stored map. Run updates one at
// a time so concurrent schedules (e.g. after a refresh) cannot drop an id and
// leave a reminder that can no longer be cancelled.
const queues = new Map<string, Promise<unknown>>();
function serial<T>(uid: string, operation: () => Promise<T>): Promise<T> {
  const next = (queues.get(uid) ?? Promise.resolve())
    .catch(() => undefined)
    .then(operation);
  queues.set(uid, next);
  void next
    .finally(() => {
      if (queues.get(uid) === next) queues.delete(uid);
    })
    .catch(() => undefined);
  return next;
}

async function cancelReminder(uid: string, taskId: string) {
  const ids = await readIds(uid);
  const notificationId = parseEntry(ids[taskId])?.id;
  if (notificationId)
    await Notifications.cancelScheduledNotificationAsync(notificationId).catch(
      () => undefined,
    );
  delete ids[taskId];
  await saveIds(uid, ids);
}

export function cancelAgendaReminder(uid: string, taskId: string) {
  return serial(uid, () => cancelReminder(uid, taskId));
}

export function cancelAllAgendaReminders(uid: string) {
  return serial(uid, async () => {
    const ids = await readIds(uid);
    await Promise.all(
      Object.values(ids).map((value) =>
        Notifications.cancelScheduledNotificationAsync(
          parseEntry(value)!.id,
        ).catch(() => undefined),
      ),
    );
    await saveIds(uid, {});
  });
}

export function scheduleAgendaReminder(
  uid: string,
  taskId: string,
  reminderAt: number,
  askPermission = true,
  // Background reloads pass true: an identical reminder that is already
  // scheduled is kept instead of being cancelled and re-created.
  keepIfUnchanged = false,
) {
  return serial(uid, () =>
    scheduleReminder(uid, taskId, reminderAt, askPermission, keepIfUnchanged),
  );
}

// Reconcile the full set after a cloud sync so reminders for items completed
// or deleted on another device are cancelled as well as newly added ones.
export function reconcileAgendaReminders(uid: string, items: AgendaItem[]) {
  return serial(uid, async () => {
    const active = new Map(
      items
        .filter(
          (item) =>
            !item.completed &&
            item.reminderAt !== null &&
            item.reminderAt > Date.now(),
        )
        .map((item) => [item.id, item.reminderAt as number]),
    );
    const ids = await readIds(uid);
    let changed = false;
    for (const [taskId, value] of Object.entries(ids)) {
      const entry = parseEntry(value);
      if (!active.has(taskId) || active.get(taskId) !== entry?.at) {
        if (entry?.id)
          await Notifications.cancelScheduledNotificationAsync(entry.id).catch(
            () => undefined,
          );
        delete ids[taskId];
        changed = true;
      }
    }
    if (changed) await saveIds(uid, ids);
    for (const [taskId, reminderAt] of active)
      await scheduleReminder(uid, taskId, reminderAt, false, true).catch(
        () => undefined,
      );
  });
}

async function scheduleReminder(
  uid: string,
  taskId: string,
  reminderAt: number,
  askPermission: boolean,
  keepIfUnchanged: boolean,
) {
  if (
    keepIfUnchanged &&
    parseEntry((await readIds(uid))[taskId])?.at === reminderAt
  )
    return 'scheduled' as const;
  await cancelReminder(uid, taskId);
  if (reminderAt <= Date.now()) return 'past' as const;
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync('lifemate', {
      name: 'LifeMate',
      importance: Notifications.AndroidImportance.HIGH,
    });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && askPermission)
    permission = await Notifications.requestPermissionsAsync();
  if (
    !permission.granted &&
    permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL
  )
    return 'denied' as const;
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Nhắc việc',
      body: 'Bạn có một việc cần hoàn thành.',
      data: { taskId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(reminderAt),
      channelId: 'lifemate',
    },
  });
  const ids = await readIds(uid);
  ids[taskId] = `${notificationId}|${reminderAt}`;
  await saveIds(uid, ids);
  return 'scheduled' as const;
}
