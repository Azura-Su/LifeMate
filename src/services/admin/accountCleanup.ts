import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from '@react-native-firebase/auth';
import {
  doc,
  getFirestore,
  onSnapshot,
} from '@react-native-firebase/firestore';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { audioCloudApiKey, audioCloudUrl } from '../../config/audioCloud';
import { useAuthStore } from '../../store/authStore';
import { cancelAllAgendaReminders } from '../agenda/agendaReminders';
import { cancelAllLoanReminders } from '../finance/loanReminders';
import { logout } from '../firebase/authService';
import {
  blockAccountWrites,
  drainAccountWrites,
} from '../security/accountLifecycle';
import { removeAccountEncryptionKey } from '../security/encryptedLocalStorage';

const KNOWN = 'lifemate:account-cache-uids:v1';
const PURGE = 'lifemate:account-purge:v1';
const UID = /^[A-Za-z0-9_-]{1,128}$/;
let queue: Promise<unknown> = Promise.resolve();
const running = new Map<string, Promise<void>>();
async function remembered(key: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(key);
  const values: unknown = raw ? JSON.parse(raw) : [];
  return Array.isArray(values)
    ? values.filter(
        (uid): uid is string => typeof uid === 'string' && UID.test(uid),
      )
    : [];
}
function remember(key: string, uid: string, remove = false) {
  const task = queue
    .catch(() => undefined)
    .then(async () => {
      const values = (await remembered(key)).filter((value) => value !== uid);
      if (!remove) values.push(uid);
      await AsyncStorage.setItem(key, JSON.stringify(values));
    });
  queue = task;
  return task;
}
export function isAccountCacheKey(key: string, uid: string) {
  if (
    key === `lifemate-audio-playlists-v1-${uid}` ||
    key === `lifemate-audio-playlist-${uid}`
  )
    return true;
  const parts = key.split(':');
  if (parts[0] !== 'lifemate') return false;
  if (['loan-repayment-attempt', 'loan-advance-attempt'].includes(parts[1]))
    return parts.length === 5 && parts[3] === encodeURIComponent(uid);
  return parts.at(-1) === encodeURIComponent(uid);
}
async function endSession(uid: string) {
  if (useAuthStore.getState().user?.uid === uid)
    useAuthStore.getState().setUser(null);
  if (getAuth().currentUser?.uid === uid) await logout();
}
export function purgeAccountCache(uid: string) {
  if (!UID.test(uid)) return Promise.reject(new Error('Invalid UID'));
  if (running.has(uid)) return running.get(uid)!;
  blockAccountWrites(uid);
  const task = (async () => {
    // Persist retry intent before invalidating this session.
    await remember(PURGE, uid);
    const signOut = endSession(uid).then(
      () => null,
      () => new Error('Chưa kết thúc được phiên đăng nhập.'),
    );
    await drainAccountWrites(uid);
    await cancelAllAgendaReminders(uid);
    await cancelAllLoanReminders(uid);
    const keys = (await AsyncStorage.getAllKeys()).filter((key) =>
      isAccountCacheKey(key, uid),
    );
    await AsyncStorage.multiRemove(keys);
    for (const folder of ['audio', 'memories']) {
      if (FileSystem.documentDirectory)
        await FileSystem.deleteAsync(
          `${FileSystem.documentDirectory}${folder}/${encodeURIComponent(uid)}/`,
          { idempotent: true },
        );
    }
    await removeAccountEncryptionKey(uid);
    const encoded = Array.from(uid, (c) => c.codePointAt(0)!.toString(16)).join(
      '_',
    );
    await SecureStore.deleteItemAsync(`lifemate.financeLock.v1.${encoded}`);
    await remember(KNOWN, uid, true);
    // A sign-out failure must not prevent removing private local data.
    const signOutError = await signOut;
    if (signOutError) throw signOutError;
    await remember(PURGE, uid, true);
  })();
  running.set(uid, task);
  void task.finally(() => running.delete(uid)).catch(() => undefined);
  return task;
}
async function status(uid: string, signal: AbortSignal) {
  const url = audioCloudUrl(),
    key = audioCloudApiKey();
  if (!url || !key) return;
  const response = await fetch(`${url}/functions/v1/user-admin`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', apikey: key },
    body: JSON.stringify({ action: 'status', uid }),
  });
  if (!response.ok) return;
  return (await response.json()).status;
}
export async function recoverAccountCleanup(signal: AbortSignal) {
  for (const uid of await remembered(PURGE)) await purgeAccountCache(uid);
  // Include caches from sessions that predate this feature.
  const known = new Set(await remembered(KNOWN));
  for (const key of await AsyncStorage.getAllKeys()) {
    const legacy = key.match(
      /^lifemate-audio-(?:playlists-v1-|playlist-)([A-Za-z0-9_-]{1,128})$/,
    );
    if (legacy) {
      known.add(legacy[1]);
      continue;
    }
    const parts = key.split(':');
    if (parts[0] !== 'lifemate' || parts[2] !== 'v1' || parts.length < 4)
      continue;
    const candidate = parts[3];
    if (UID.test(candidate)) known.add(candidate);
  }
  for (const uid of known) {
    if (signal.aborted) return;
    const state = await status(uid, signal);
    if (signal.aborted) return;
    if (state === 'deleting' || state === 'deleted')
      await purgeAccountCache(uid);
    else if (state === 'disabled') await endSession(uid);
  }
}
export function observeAccountAccess(uid: string) {
  void remember(KNOWN, uid).catch(() => undefined);
  return onSnapshot(
    doc(getFirestore(), 'accountAccess', uid),
    (snapshot) => {
      const state = snapshot.data()?.status;
      if (state === 'deleting' || state === 'deleted')
        void purgeAccountCache(uid).catch(() => undefined);
      else if (state === 'disabled')
        void endSession(uid).catch(() => undefined);
    },
    () => undefined,
  );
}
