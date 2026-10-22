import { useAuthStore } from '../store/authStore';
import { useConfigStore } from '../store/configStore';
import { normalizeEmail } from '../utils/users';

function allowed(email: string | null | undefined, gameUsers: string[]) {
  return (
    !!email?.trim() &&
    gameUsers.some((mail) => normalizeEmail(mail) === normalizeEmail(email))
  );
}

export function hasOnlineGameAccess() {
  return allowed(
    useAuthStore.getState().user?.email,
    useConfigStore.getState().gameUsers,
  );
}

export function useOnlineGameAccess() {
  const email = useAuthStore((state) => state.user?.email);
  const gameUsers = useConfigStore((state) => state.gameUsers);
  return allowed(email, gameUsers);
}
