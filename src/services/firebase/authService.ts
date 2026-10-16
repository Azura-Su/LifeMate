import {
  createUserWithEmailAndPassword,
  getAuth,
  getIdTokenResult,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from '@react-native-firebase/auth';
import type { SessionUser } from '../../types/models';
import { normalizeEmail } from '../../utils/users';

export function observeAuth(
  onChange: (user: SessionUser | null) => void,
  onError: () => void,
) {
  return onAuthStateChanged(
    getAuth(),
    (user) =>
      onChange(
        user
          ? {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
            }
          : null,
      ),
    onError,
  );
}

export async function login(email: string, password: string) {
  await signInWithEmailAndPassword(getAuth(), normalizeEmail(email), password);
}

export async function createAccount(email: string, password: string) {
  const credential = await createUserWithEmailAndPassword(
    getAuth(),
    normalizeEmail(email),
    password,
  );
  return credential.user.uid;
}

function activeUser(uid: string) {
  const user = getAuth().currentUser;
  if (!user || user.uid !== uid)
    throw new Error('Phiên tài khoản đã thay đổi. Hãy đăng nhập lại.');
  return user;
}

export function currentSessionUser(uid: string): SessionUser | null {
  const user = getAuth().currentUser;
  return user?.uid === uid
    ? { uid: user.uid, email: user.email, displayName: user.displayName }
    : null;
}

export async function updateAccountDisplayName(uid: string, name: string) {
  await updateProfile(activeUser(uid), { displayName: name.trim() });
  activeUser(uid);
}

export async function sendAccountVerificationEmail(uid: string) {
  await sendEmailVerification(activeUser(uid));
  activeUser(uid);
}

export async function refreshAccountVerification(uid: string) {
  await reload(activeUser(uid));
  const token = await getIdTokenResult(activeUser(uid), true);
  activeUser(uid);
  if (token.claims.sub !== uid)
    throw new Error('Phiên tài khoản đã thay đổi. Hãy đăng nhập lại.');
  return token.claims.email_verified === true;
}

export async function logout() {
  await signOut(getAuth());
}
