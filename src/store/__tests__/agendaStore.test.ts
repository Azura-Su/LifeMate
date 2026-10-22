import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getFirestore, setDoc } from '@react-native-firebase/firestore';
import * as Notifications from 'expo-notifications';
import { useAgendaStore } from '../agendaStore';
import { reconcileAgendaReminders } from '../../services/agenda/agendaReminders';
import { saveAgendaItem } from '../../services/agenda/agendaStorage';
import * as agendaStorage from '../../services/agenda/agendaStorage';
import { resetFirestoreMock } from '../../testing/firestoreMock';
import type { AgendaItem } from '../../types/agenda';

let mockAuthState = {
  user: { uid: 'u1' } as { uid: string } | null,
  sessionEpoch: 1,
};
jest.mock('../authStore', () => ({
  useAuthStore: { getState: () => mockAuthState },
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);
jest.mock('@react-native-firebase/firestore', () =>
  jest.requireActual('../../testing/firestoreMock'),
);
let mockNextId = 0;
jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: jest.fn(async () => `n${++mockNextId}`),
}));

beforeEach(async () => {
  jest.clearAllMocks();
  mockAuthState = { user: { uid: 'u1' }, sessionEpoch: 1 };
  await AsyncStorage.clear();
  resetFirestoreMock();
  useAgendaStore.setState({
    uid: 'u1',
    items: [],
    loading: false,
    error: null,
  });
});
afterEach(() => jest.restoreAllMocks());

it.each([true, false])(
  'reconciles reminders from the persisted result after completing=%s conflicts with a cloud edit',
  async (completed) => {
    const original: AgendaItem = {
      id: 'task',
      ownerId: 'u1',
      title: 'Việc',
      details: '',
      dueAt: Date.now() + 3_600_000,
      reminderAt: Date.now() + 3_600_000,
      completed: !completed,
      updatedAt: 1,
    };
    await saveAgendaItem('u1', original);
    useAgendaStore.setState({ items: [original] });
    await reconcileAgendaReminders('u1', [original]);
    // Another device changes the reminder while this device still shows the old row.
    const remote = {
      ...original,
      reminderAt: original.reminderAt! + 60_000,
      details: 'Remote edit',
      updatedAt: 2,
    };
    await setDoc(
      doc(getFirestore(), 'agendaAccounts', 'u1', 'items', original.id),
      remote,
    );

    await useAgendaStore.getState().complete('u1', original.id, completed);

    const items = useAgendaStore.getState().items;
    expect(items).toHaveLength(2);
    expect(items.find((item) => item.id === original.id)).toEqual(remote);
    const active = items.filter(
      (item) => !item.completed && item.reminderAt !== null,
    );
    const reminders = JSON.parse(
      (await AsyncStorage.getItem('lifemate:agenda-reminders:v1:u1'))!,
    );
    expect(Object.keys(reminders).sort()).toEqual(
      active.map((item) => item.id).sort(),
    );
    for (const item of active) {
      expect(reminders[item.id]).toMatch(new RegExp(`\\|${item.reminderAt}$`));
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: expect.objectContaining({
            date: new Date(item.reminderAt!),
          }),
        }),
      );
    }
  },
);

it.each(['load', 'save', 'complete', 'remove'] as const)(
  'ignores a pending %s result after logout and login to the same account',
  async (operation) => {
    const original: AgendaItem = {
      id: 'old-task',
      ownerId: 'u1',
      title: 'Cũ',
      details: '',
      dueAt: Date.now() + 3_600_000,
      reminderAt: Date.now() + 3_600_000,
      completed: true,
      updatedAt: 1,
    };
    useAgendaStore.setState({ items: [original] });
    let resolve!: (value: { items: AgendaItem[]; synced: boolean }) => void;
    const pending = new Promise<{ items: AgendaItem[]; synced: boolean }>(
      (done) => {
        resolve = done;
      },
    );
    const method =
      operation === 'load'
        ? 'readAgenda'
        : operation === 'remove'
          ? 'deleteAgendaItem'
          : 'saveAgendaItem';
    jest.spyOn(agendaStorage, method).mockReturnValueOnce(pending);
    const state = useAgendaStore.getState();
    const request =
      operation === 'load'
        ? state.load('u1')
        : operation === 'remove'
          ? state.remove('u1', original.id)
          : operation === 'complete'
            ? state.complete('u1', original.id, false)
            : state.save('u1', { ...original, completed: false }, original);
    mockAuthState = { user: null, sessionEpoch: 2 };
    mockAuthState = { user: { uid: 'u1' }, sessionEpoch: 3 };
    const newItem = { ...original, id: 'new-task', title: 'Phiên mới' };
    useAgendaStore.setState({ items: [newItem], loading: false });
    resolve({ items: [{ ...original, completed: false }], synced: true });
    await request;
    expect(useAgendaStore.getState().items).toEqual([newItem]);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(
      Notifications.cancelScheduledNotificationAsync,
    ).not.toHaveBeenCalled();
  },
);
