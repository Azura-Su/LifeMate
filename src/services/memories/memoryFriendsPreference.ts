import { useAuthStore } from '../../store/authStore';
import { assertAccountWritable } from '../security/accountLifecycle';
import {
  getEncryptedItem,
  setEncryptedItem,
} from '../security/encryptedLocalStorage';

// Navigation hint only. This cache never grants access to friends or photos.
function key(uid: string) {
  if (
    !/^[A-Za-z0-9_-]{1,128}$/.test(uid) ||
    useAuthStore.getState().user?.uid !== uid
  )
    throw new Error('Phiên tài khoản đã thay đổi.');
  assertAccountWritable(uid);
  return `lifemate:memory-friends-tab:v1:${encodeURIComponent(uid)}`;
}
export async function readMemoryFriendsPreference(
  uid: string,
): Promise<boolean | null> {
  const value = await getEncryptedItem(uid, key(uid));
  key(uid);
  return value === 'true' ? true : value === 'false' ? false : null;
}
export async function writeMemoryFriendsPreference(
  uid: string,
  hasFriends: boolean,
) {
  await setEncryptedItem(uid, key(uid), hasFriends ? 'true' : 'false');
  key(uid);
}
