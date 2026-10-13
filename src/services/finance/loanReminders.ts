import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { LoanRecord } from '../../types/loan';
import { getLoanStatus } from '../../types/loan';
import { useAuthStore } from '../../store/authStore';

const idsKey = (uid: string) =>
  `lifemate:loan-reminders:v1:${encodeURIComponent(uid)}`;
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

async function readIds(uid: string): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(idsKey(uid));
    const value: unknown = raw ? JSON.parse(raw) : {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
  } catch {
    return {};
  }
}

function parseEntry(value: string | undefined) {
  if (!value) return null;
  const split = value.lastIndexOf('|');
  return split < 0
    ? { id: value, at: null }
    : { id: value.slice(0, split), at: Number(value.slice(split + 1)) };
}

function reminderTime(dueAt: number) {
  const date = new Date(dueAt);
  date.setHours(9, 0, 0, 0);
  return date.getTime();
}

async function cancel(
  uid: string,
  loanId: string,
  ids?: Record<string, string>,
) {
  const current = ids ?? (await readIds(uid));
  const entry = parseEntry(current[loanId]);
  if (entry?.id)
    await Notifications.cancelScheduledNotificationAsync(entry.id).catch(
      () => undefined,
    );
  delete current[loanId];
  await AsyncStorage.setItem(idsKey(uid), JSON.stringify(current));
}

async function schedule(
  uid: string,
  loanId: string,
  at: number,
  requestPermission: boolean,
  keepIfUnchanged: boolean,
  isActive: () => boolean,
): Promise<'scheduled' | 'denied' | 'past' | 'none'> {
  const ids = await readIds(uid);
  if (!isActive()) return 'none';
  if (keepIfUnchanged && parseEntry(ids[loanId])?.at === at) return 'scheduled';
  await cancel(uid, loanId, ids);
  if (!isActive()) return 'none';
  if (at <= Date.now()) return 'past';
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync('lifemate', {
      name: 'LifeMate',
      importance: Notifications.AndroidImportance.HIGH,
    });
  let permission = await Notifications.getPermissionsAsync();
  if (!isActive()) return 'none';
  if (!permission.granted && requestPermission)
    permission = await Notifications.requestPermissionsAsync();
  if (!isActive()) return 'none';
  if (
    !permission.granted &&
    permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL
  )
    return 'denied';
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Nhắc hạn cho vay',
      body: 'Bạn có một khoản đến hạn cần kiểm tra.',
      data: { loanId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(at),
      channelId: 'lifemate',
    },
  });
  ids[loanId] = `${notificationId}|${at}`;
  await AsyncStorage.setItem(idsKey(uid), JSON.stringify(ids));
  if (!isActive()) {
    await cancel(uid, loanId, ids);
    return 'none';
  }
  return 'scheduled';
}

export function reconcileLoanReminders(
  uid: string,
  loans: LoanRecord[],
  requestPermissionForNew = false,
  requestedLoanId?: string,
) {
  const user = useAuthStore.getState().user;
  const isActive = () =>
    user?.uid === uid && useAuthStore.getState().user === user;
  return serial(uid, async () => {
    if (!isActive()) return 'none';
    const active = new Map(
      loans
        .filter(
          (loan) =>
            getLoanStatus(loan) === 'open' &&
            loan.remindOnDueDate &&
            loan.dueAt !== null,
        )
        .map((loan) => [loan.id, reminderTime(loan.dueAt as number)]),
    );
    const ids = await readIds(uid);
    for (const [loanId, value] of Object.entries(ids)) {
      if (!isActive()) return 'none';
      const entry = parseEntry(value);
      if (!active.has(loanId) || active.get(loanId) !== entry?.at)
        await cancel(uid, loanId, ids);
    }
    let requestedStatus: 'scheduled' | 'denied' | 'past' | 'none' = 'none';
    for (const [loanId, at] of active) {
      if (!isActive()) return 'none';
      try {
        const status = await schedule(
          uid,
          loanId,
          at,
          requestPermissionForNew && loanId === requestedLoanId,
          true,
          isActive,
        );
        if (loanId === requestedLoanId) requestedStatus = status;
      } catch {
        if (loanId === requestedLoanId) requestedStatus = 'denied';
      }
    }
    return requestedStatus;
  });
}

export function cancelAllLoanReminders(uid: string) {
  return serial(uid, async () => {
    const ids = await readIds(uid);
    await Promise.all(
      Object.values(ids).map(async (value) => {
        const entry = parseEntry(value);
        if (entry?.id)
          await Notifications.cancelScheduledNotificationAsync(entry.id).catch(
            () => undefined,
          );
      }),
    );
    await AsyncStorage.removeItem(idsKey(uid));
  });
}
