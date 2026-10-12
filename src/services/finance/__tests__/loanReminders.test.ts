import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../../../store/authStore';
import type { LoanRecord } from '../../../types/loan';
import {
  cancelAllLoanReminders,
  reconcileLoanReminders,
} from '../loanReminders';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
}));

const scheduledIds = new Set<string>();
const granted = { granted: true } as Awaited<
  ReturnType<typeof Notifications.getPermissionsAsync>
>;
const denied = { granted: false } as typeof granted;
const idsKey = 'lifemate:loan-reminders:v1:u1';
let nextId = 0;
let loan: LoanRecord;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  scheduledIds.clear();
  nextId = 0;
  useAuthStore.setState({
    user: { uid: 'u1', email: null, displayName: null },
  });
  loan = {
    id: 'loan-1',
    ownerId: 'u1',
    borrowerName: 'An',
    principalAmount: 1000,
    lentAt: Date.now(),
    dueAt: Date.now() + 3 * 24 * 3_600_000,
    remindOnDueDate: true,
    note: '',
    repayments: [],
    cancelledAt: null,
    updatedAt: Date.now(),
  };
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(granted);
  jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue(granted);
  jest
    .mocked(Notifications.scheduleNotificationAsync)
    .mockImplementation(async () => {
      const id = `n${++nextId}`;
      scheduledIds.add(id);
      return id;
    });
  jest
    .mocked(Notifications.cancelScheduledNotificationAsync)
    .mockImplementation(async (id) => {
      scheduledIds.delete(id);
    });
});

it('keeps an active account reminder scheduled once across unchanged reloads', async () => {
  expect(await reconcileLoanReminders('u1', [loan], true, loan.id)).toBe(
    'scheduled',
  );
  expect(await reconcileLoanReminders('u1', [loan], false, loan.id)).toBe(
    'scheduled',
  );

  expect([...scheduledIds]).toEqual(['n1']);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  const expectedDate = new Date(loan.dueAt as number);
  expectedDate.setHours(9, 0, 0, 0);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      trigger: expect.objectContaining({ date: expectedDate }),
    }),
  );
});

it('does not restore reminders when a stale reconcile arrives after logout cancellation', async () => {
  await reconcileLoanReminders('u1', [loan]);
  expect(scheduledIds.size).toBe(1);
  useAuthStore.getState().setUser(null);
  await cancelAllLoanReminders('u1');

  expect(await reconcileLoanReminders('u1', [loan], true, loan.id)).toBe(
    'none',
  );

  expect(scheduledIds.size).toBe(0);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  expect(await AsyncStorage.getItem(idsKey)).toBeNull();
});

it.each(['get', 'request'] as const)(
  'does not schedule if logout occurs while waiting to %s notification permission',
  async (permissionStage) => {
    const started = deferred();
    const release = deferred();
    const pendingPermission = async () => {
      started.resolve();
      await release.promise;
      return granted;
    };
    if (permissionStage === 'get') {
      jest
        .mocked(Notifications.getPermissionsAsync)
        .mockImplementationOnce(pendingPermission);
    } else {
      jest
        .mocked(Notifications.getPermissionsAsync)
        .mockResolvedValueOnce(denied);
      jest
        .mocked(Notifications.requestPermissionsAsync)
        .mockImplementationOnce(pendingPermission);
    }
    const reconciling = reconcileLoanReminders('u1', [loan], true, loan.id);
    await started.promise;
    useAuthStore.getState().setUser(null);
    release.resolve();

    expect(await reconciling).toBe('none');
    expect(scheduledIds.size).toBe(0);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  },
);

it.each([false, true])(
  'cancels a notification returned after logout (cancel-all queued: %s)',
  async (alsoCancelAll) => {
    const started = deferred();
    const release = deferred();
    jest
      .mocked(Notifications.scheduleNotificationAsync)
      .mockImplementationOnce(async () => {
        started.resolve();
        await release.promise;
        scheduledIds.add('late-notification');
        return 'late-notification';
      });
    const reconciling = reconcileLoanReminders('u1', [loan], true, loan.id);
    await started.promise;
    useAuthStore.getState().setUser(null);
    const cancelling = alsoCancelAll
      ? cancelAllLoanReminders('u1')
      : Promise.resolve();
    release.resolve();

    expect(await reconciling).toBe('none');
    await cancelling;

    expect(scheduledIds.size).toBe(0);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'late-notification',
    );
    expect(JSON.parse((await AsyncStorage.getItem(idsKey)) ?? '{}')).toEqual(
      {},
    );
  },
);

it('does not revive an old job after the same UID signs in with a new session', async () => {
  const started = deferred();
  const release = deferred();
  jest
    .mocked(Notifications.getPermissionsAsync)
    .mockImplementationOnce(async () => {
      started.resolve();
      await release.promise;
      return granted;
    });
  const oldJob = reconcileLoanReminders('u1', [loan], true, loan.id);
  await started.promise;
  useAuthStore.getState().setUser(null);
  useAuthStore
    .getState()
    .setUser({ uid: 'u1', email: null, displayName: null });
  release.resolve();

  expect(await oldJob).toBe('none');
  expect(scheduledIds.size).toBe(0);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

  expect(await reconcileLoanReminders('u1', [loan], false, loan.id)).toBe(
    'scheduled',
  );
  expect([...scheduledIds]).toEqual(['n1']);
});
