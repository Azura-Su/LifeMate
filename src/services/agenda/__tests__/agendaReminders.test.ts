import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  cancelAgendaReminder,
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

beforeEach(() => AsyncStorage.clear());

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
