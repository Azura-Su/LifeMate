import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import {
  isAccountCacheKey,
  purgeAccountCache,
  recoverAccountCleanup,
} from '../accountCleanup';
import { accountTask } from '../../security/accountLifecycle';
import { useAuthStore } from '../../../store/authStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: () => ({ currentUser: null }),
}));
jest.mock('@react-native-firebase/firestore', () => ({
  doc: jest.fn(),
  getFirestore: jest.fn(),
  onSnapshot: jest.fn(),
}));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../firebase/authService', () => ({ logout: jest.fn() }));
jest.mock('../../agenda/agendaReminders', () => ({
  cancelAllAgendaReminders: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../finance/loanReminders', () => ({
  cancelAllLoanReminders: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../config/audioCloud', () => ({
  audioCloudUrl: () => 'https://example.supabase.co',
  audioCloudApiKey: () => 'public',
}));

test('cache ownership does not match a different UID or partial UID', () => {
  expect(
    isAccountCacheKey('lifemate:memory-friends-tab:v1:alice', 'alice'),
  ).toBe(true);
  expect(isAccountCacheKey('lifemate:memory-friends-tab:v1:alice', 'bob')).toBe(
    false,
  );
  expect(isAccountCacheKey('lifemate-audio-playlists-v1-alice', 'alice')).toBe(
    true,
  );
  expect(isAccountCacheKey('lifemate-audio-playlist-alice', 'alice')).toBe(
    true,
  );
  expect(isAccountCacheKey('lifemate-audio-playlist-alice2', 'alice')).toBe(
    false,
  );
  expect(isAccountCacheKey('lifemate:notes:v1:alice', 'alice')).toBe(true);
  expect(isAccountCacheKey('lifemate:pets:v1:alice', 'alice')).toBe(true);
  expect(isAccountCacheKey('lifemate:pets:v1:alice2', 'alice')).toBe(false);
  expect(
    isAccountCacheKey('lifemate:loan-repayment-attempt:v1:alice:loan', 'alice'),
  ).toBe(true);
  expect(isAccountCacheKey('lifemate:notes:v1:alice2', 'alice')).toBe(false);
  expect(isAccountCacheKey('lifemate:notes:v1:bob', 'alice')).toBe(false);
  for (const kind of ['loan-repayment-attempt', 'loan-advance-attempt']) {
    expect(isAccountCacheKey(`lifemate:${kind}:v1:bob:alice`, 'alice')).toBe(
      false,
    );
    expect(isAccountCacheKey(`lifemate:${kind}:v1:alice:bob`, 'alice')).toBe(
      true,
    );
  }
});
test('purge drains a pending write before removing only its account data', async () => {
  const uid = 'purge-test';
  let finish!: () => void;
  await AsyncStorage.setItem(`lifemate:notes:v1:${uid}`, 'old');
  await AsyncStorage.setItem(`lifemate:pets:v1:${uid}`, 'pet DNA and outbox');
  await AsyncStorage.setItem('lifemate:notes:v1:other', 'keep');
  const writing = accountTask(uid, async () => {
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    await AsyncStorage.setItem(`lifemate:notes:v1:${uid}`, 'late');
  });
  await Promise.resolve();
  const deleting = purgeAccountCache(uid);
  await expect(accountTask(uid, async () => undefined)).rejects.toThrow();
  finish();
  await writing;
  await deleting;
  expect(await AsyncStorage.getItem(`lifemate:notes:v1:${uid}`)).toBeNull();
  expect(await AsyncStorage.getItem(`lifemate:pets:v1:${uid}`)).toBeNull();
  expect(await AsyncStorage.getItem('lifemate:notes:v1:other')).toBe('keep');
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
    'file:///documents/audio/purge-test/',
    { idempotent: true },
  );
});
test('signed-out device discovers deletion without a Firebase session', async () => {
  await AsyncStorage.setItem('lifemate:memories:v1:offline-user', 'private');
  useAuthStore.getState().setUser(null);
  const original = global.fetch;
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ status: 'deleted' }) });
  try {
    await recoverAccountCleanup(new AbortController().signal);
    expect(
      await AsyncStorage.getItem('lifemate:memories:v1:offline-user'),
    ).toBeNull();
  } finally {
    global.fetch = original;
  }
});
