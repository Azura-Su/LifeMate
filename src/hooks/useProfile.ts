import { useAuthStore } from '../store/authStore';
import { useConfigStore } from '../store/configStore';
import { resolveUserName } from '../utils/users';

export function useProfile() {
  const user = useAuthStore((state) => state.user);
  const users = useConfigStore((state) => state.users);
  return { user, name: resolveUserName(user, users) };
}
