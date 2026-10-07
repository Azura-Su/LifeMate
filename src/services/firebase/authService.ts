import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
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

export async function logout() {
  await signOut(getAuth());
}
