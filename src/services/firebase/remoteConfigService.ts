import {
  activate,
  ensureInitialized,
  fetchAndActivate,
  getBoolean,
  getRemoteConfig,
  getString,
  onConfigUpdate,
} from '@react-native-firebase/remote-config';
import {
  DEFAULT_USERS,
  REMOTE_CONFIG_REGISTRATION_KEY,
  REMOTE_CONFIG_USERS_KEY,
} from '../../config/defaults';
import type { DirectoryUser } from '../../types/models';
import { parseUsers } from '../../utils/users';

export function readActivatedRemoteConfig(previous: DirectoryUser[]) {
  const remoteConfig = getRemoteConfig();
  return {
    users:
      parseUsers(getString(remoteConfig, REMOTE_CONFIG_USERS_KEY)) ?? previous,
    registrationEnabled: getBoolean(
      remoteConfig,
      REMOTE_CONFIG_REGISTRATION_KEY,
    ),
  };
}

export async function loadRemoteConfig(previous: DirectoryUser[]) {
  const remoteConfig = getRemoteConfig();
  // RNFirebase v26 property setters queue native configuration before fetch.
  // https://rnfirebase.io/remote-config/usage
  remoteConfig.defaultConfig = {
    [REMOTE_CONFIG_USERS_KEY]: JSON.stringify(DEFAULT_USERS),
    [REMOTE_CONFIG_REGISTRATION_KEY]: false,
  };
  remoteConfig.settings = {
    minimumFetchIntervalMillis: __DEV__ ? 0 : 3_600_000,
    fetchTimeoutMillis: 10_000,
  };
  let warning: string | null = null;
  await ensureInitialized(remoteConfig);
  const cached = readActivatedRemoteConfig(previous);
  try {
    await fetchAndActivate(remoteConfig);
  } catch {
    warning = 'Chưa thể cập nhật. Đang dùng thông tin đã lưu.';
  }
  const users = parseUsers(getString(remoteConfig, REMOTE_CONFIG_USERS_KEY));
  if (users === null)
    warning = 'Cấu hình tên chưa hợp lệ. Đang dùng thông tin đã lưu.';
  return {
    users: users ?? cached.users,
    registrationEnabled: getBoolean(
      remoteConfig,
      REMOTE_CONFIG_REGISTRATION_KEY,
    ),
    warning,
  };
}

export function observeRemoteConfig(onChange: () => void, onError: () => void) {
  const remoteConfig = getRemoteConfig();
  let active = true;
  const unsubscribe = onConfigUpdate(remoteConfig, {
    next: () => {
      void activate(remoteConfig)
        .then(() => {
          if (active) onChange();
        })
        .catch(() => {
          if (active) onError();
        });
    },
    error: () => {
      if (active) onError();
    },
    complete: () => undefined,
  });
  return () => {
    active = false;
    unsubscribe();
  };
}
