import { useAuthStore } from '../../../store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  cancelAgendaReminder,
  cancelAllAgendaReminders,
  reconcileAgendaReminders,
  scheduleAgendaReminder,
} from '../agendaReminders';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);
let mockNextId = 0;
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: jest.fn(async () => `n${++mockNextId}`),
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  useAuthStore.getState().setUser({ uid: 'u1' } as never);
});

it('keeps an unchanged reminder on reload and reschedules a changed one', async () => {
  const at = Date.now() + 3_600_000;
  await scheduleAgendaReminder('u1', 't1', at, false, true);
  await scheduleAgendaReminder('u1', 't1', at, false, true);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();

  await scheduleAgendaReminder('u1', 't1', at + 60_000, false, true);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
    `n${mockNextId - 1}`,
  );

  await cancelAgendaReminder('u1', 't1');
  expect(
    Notifications.cancelScheduledNotificationAsync,
  ).toHaveBeenLastCalledWith(`n${mockNextId}`);
});

it('does not recreate reminders after logout while permission is pending', async () => {
  let release!: (value: { granted: boolean }) => void;
  jest.mocked(Notifications.getPermissionsAsync).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }) as never,
  );
  const pending = scheduleAgendaReminder('u1', 'late', Date.now() + 3600000);
  while (!release) await Promise.resolve();
  useAuthStore.getState().setUser(null);
  const cancellation = cancelAllAgendaReminders('u1');
  release({ granted: true });
  await pending;
  await cancellation;
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('cancels a returned native ID when the same UID logs out and back in', async () => {
  let release!: (id: string) => void;
  jest.mocked(Notifications.scheduleNotificationAsync).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const pending = scheduleAgendaReminder(
    'u1',
    'late-native',
    Date.now() + 3600000,
  );
  while (!release) await Promise.resolve();
  useAuthStore.getState().setUser(null);
  useAuthStore.getState().setUser({ uid: 'u1' } as never);
  release('late-id');
  await pending;
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
    'late-id',
  );
  expect(
    (await AsyncStorage.getItem('lifemate:agenda-reminders:v1:u1')) ?? '',
  ).not.toContain('late-id');
});

it('fences queued scheduling and reconciliation using the session captured before enqueue', async () => {
  let release!: (value: { granted: boolean }) => void;
  jest.mocked(Notifications.getPermissionsAsync).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }) as never,
  );
  const at = Date.now() + 3_600_000;
  const first = scheduleAgendaReminder('u1', 'blocking', at);
  while (!release) await Promise.resolve();
  const queued = scheduleAgendaReminder('u1', 'queued', at);
  const reconcile = reconcileAgendaReminders('u1', [
    {
      id: 'reconciled',
      ownerId: 'u1',
      title: 'Việc',
      details: '',
      dueAt: at,
      reminderAt: at,
      completed: false,
      updatedAt: 1,
    },
  ]);
  useAuthStore.getState().setUser(null);
  useAuthStore.getState().setUser({ uid: 'u1' } as never);
  release({ granted: true });
  await Promise.all([first, queued, reconcile]);
  expect(Notifications.getPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});
