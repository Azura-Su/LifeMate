import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';

const storageKey = 'lifemate.card-games.device-session.v1';
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const storageOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

type DeviceSessionStorage = Pick<
  typeof SecureStore,
  'getItemAsync' | 'setItemAsync'
>;

export function createGameDeviceSessionIdLoader(
  storage: DeviceSessionStorage = SecureStore,
  createId: () => string = randomUUID,
) {
  let sessionId: Promise<string> | null = null;

  return () => {
    if (!sessionId) {
      sessionId = (async () => {
        const stored = await storage.getItemAsync(storageKey, storageOptions);
        if (stored && uuidPattern.test(stored)) return stored;

        const created = createId();
        await storage.setItemAsync(storageKey, created, storageOptions);
        return created;
      })().catch((error) => {
        sessionId = null;
        throw error;
      });
    }
    return sessionId;
  };
}

export const getGameDeviceSessionId = createGameDeviceSessionIdLoader();
