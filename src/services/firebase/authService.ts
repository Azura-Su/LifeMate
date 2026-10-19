import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  getAuth,
  getIdToken,
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
import { useAuthStore } from '../../store/authStore';
import {
  accountTask,
  assertAccountWritable,
} from '../security/accountLifecycle';
import { validateDisplayName, validatePasswordChange } from '../../utils/auth';

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
  const error = validateDisplayName(name);
  if (error) throw new Error(error);
  await updateProfile(activeUser(uid), { displayName: name.trim() });
  activeUser(uid);
}

export async function accountIdToken(uid: string) {
  const token = await getIdToken(activeUser(uid), true);
  activeUser(uid);
  return token;
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

export function changeAccountPassword(
  uid: string,
  current: string,
  next: string,
) {
  const invalid = validatePasswordChange(current, next, next);
  if (invalid) return Promise.reject(new Error(invalid));
  const session = () => {
    assertAccountWritable(uid);
    const user = getAuth().currentUser;
    if (useAuthStore.getState().user?.uid !== uid || user?.uid !== uid)
      throw Object.assign(new Error('Session changed'), {
        code: 'auth/session-changed',
      });
    return user;
  };
  return accountTask(uid, async () => {
    const user = session();
    if (
      !user.email ||
      !user.providerData.some((provider) => provider.providerId === 'password')
    )
      throw Object.assign(new Error('Password provider required'), {
        code: 'auth/password-provider-required',
      });
    await reauthenticateWithCredential(
      user,
      EmailAuthProvider.credential(user.email, current),
    );
    // Native updatePassword uses the current native user; check both sessions
    // and the deletion gate immediately before handing it the new password.
    await updatePassword(session(), next);
    session();
  });
}
