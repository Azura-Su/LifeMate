import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AESEncryptionKey,
  AESSealedData,
  CryptoDigestAlgorithm,
  aesDecryptAsync,
  aesEncryptAsync,
  digestStringAsync,
  randomUUID,
} from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { accountTask } from './accountLifecycle';
import { isAccountCacheKey } from './accountCacheKeys';

const ENCRYPTED_PREFIX = 'lifemate:aes-gcm:v1:';
const KEY_PREFIX = 'lifemate-storage-key-v1-';
const keyLoads = new Map<string, Promise<AESEncryptionKey>>();
const itemQueues = new Map<string, Promise<unknown>>();

function withItemLock<T>(storageKey: string, operation: () => Promise<T>) {
  const previous = itemQueues.get(storageKey) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  itemQueues.set(storageKey, next);
  void next
    .finally(() => {
      if (itemQueues.get(storageKey) === next) itemQueues.delete(storageKey);
    })
    .catch(() => undefined);
  return next;
}

function secureKeyOptions() {
  return {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  };
}

async function encryptionKey(
  uid: string,
  createIfMissing: boolean,
): Promise<AESEncryptionKey> {
  const pending = keyLoads.get(uid);
  if (pending) return pending;

  const load = (async () => {
    const uidHash = await digestStringAsync(CryptoDigestAlgorithm.SHA256, uid);
    const keyName = `${KEY_PREFIX}${uidHash}`;
    const saved = await SecureStore.getItemAsync(keyName, secureKeyOptions());
    if (saved) return AESEncryptionKey.import(saved, 'base64');
    if (!createIfMissing)
      throw new Error('Không tìm thấy khóa bảo vệ dữ liệu trên thiết bị.');

    const existingKeys = (await AsyncStorage.getAllKeys()).filter((key) =>
      isAccountCacheKey(key, uid),
    );
    for (const storageKey of existingKeys) {
      if (
        (await AsyncStorage.getItem(storageKey))?.startsWith(ENCRYPTED_PREFIX)
      )
        throw new Error('Không tìm thấy khóa bảo vệ dữ liệu trên thiết bị.');
    }

    const generated = await AESEncryptionKey.generate();
    await SecureStore.setItemAsync(
      keyName,
      await generated.encoded('base64'),
      secureKeyOptions(),
    );
    return generated;
  })();
  keyLoads.set(uid, load);
  try {
    return await load;
  } finally {
    if (keyLoads.get(uid) === load) keyLoads.delete(uid);
  }
}

function utf8(value: string) {
  return new TextEncoder().encode(value);
}

function associatedData(uid: string, storageKey: string) {
  return utf8(`LifeMate|${uid}|${storageKey}|v1`);
}

async function encryptValue(
  uid: string,
  storageKey: string,
  value: string,
  key?: AESEncryptionKey,
) {
  const sealed = await aesEncryptAsync(
    utf8(value),
    key ?? (await encryptionKey(uid, true)),
    { additionalData: associatedData(uid, storageKey) },
  );
  return `${ENCRYPTED_PREFIX}${await sealed.combined('base64')}`;
}

// expo-crypto 55 forwards Base64 strings unchanged, but Android fromCombined
// accepts only bytes. Decode here without relying on browser-only globals.
function decodeBase64(value: string) {
  if (
    !value ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  )
    throw new Error('Invalid Base64');
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array((value.length / 4) * 3 - padding);
  let offset = 0;
  for (let index = 0; index < value.length; index += 4) {
    const block =
      (alphabet.indexOf(value[index]) << 18) |
      (alphabet.indexOf(value[index + 1]) << 12) |
      ((alphabet.indexOf(value[index + 2]) & 63) << 6) |
      (alphabet.indexOf(value[index + 3]) & 63);
    bytes[offset++] = (block >>> 16) & 255;
    if (offset < bytes.length) bytes[offset++] = (block >>> 8) & 255;
    if (offset < bytes.length) bytes[offset++] = block & 255;
  }
  return bytes;
}

async function decryptValue(uid: string, storageKey: string, value: string) {
  const key = await encryptionKey(uid, false);
  return decryptWithKey(uid, storageKey, value, key);
}

async function decryptWithKey(
  uid: string,
  storageKey: string,
  value: string,
  key: AESEncryptionKey,
) {
  try {
    const payload = decodeBase64(value.slice(ENCRYPTED_PREFIX.length));
    const plaintext = await aesDecryptAsync(
      AESSealedData.fromCombined(payload),
      key,
      { additionalData: associatedData(uid, storageKey) },
    );
    if (!(plaintext instanceof Uint8Array))
      throw new Error('Invalid plaintext');
    return new TextDecoder().decode(plaintext);
  } catch {
    // Native conversion errors may include the entire encrypted cache value.
    throw new Error('Không đọc được dữ liệu đã mã hóa trên thiết bị.');
  }
}

function recoveryMarkerKey(uid: string, scope: string) {
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(scope))
    throw new Error('Phạm vi khôi phục không hợp lệ.');
  return `lifemate:cache-recovery:${scope}:v1:${encodeURIComponent(uid)}`;
}

export function hasEncryptedItemRecovery(uid: string, scope: string) {
  const marker = recoveryMarkerKey(uid, scope);
  return withItemLock(
    marker,
    async () => (await AsyncStorage.getItem(marker)) !== null,
  );
}

type RecoveryEntry = {
  storageKey: string;
  previous: string | null;
  replacement: string;
};

/** Caller supplies a fixed namespace whitelist and a fresh, verified cloud snapshot. */
export function recoverEncryptedItems(
  uid: string,
  scope: string,
  expectedKeys: readonly string[],
  values: Readonly<Record<string, string>>,
  assertCurrent: () => void,
  refreshValues?: () => Promise<Readonly<Record<string, string>>>,
) {
  const marker = recoveryMarkerKey(uid, scope);
  const keys = [...expectedKeys].sort();
  if (
    !keys.length ||
    new Set(keys).size !== keys.length ||
    keys.some((key) => !isAccountCacheKey(key, uid)) ||
    JSON.stringify(Object.keys(values).sort()) !== JSON.stringify(keys)
  )
    return Promise.reject(new Error('Danh sách cache khôi phục không hợp lệ.'));
  const lockTargets = (
    index: number,
    operation: () => Promise<void>,
  ): Promise<void> =>
    index === keys.length
      ? operation()
      : withItemLock(keys[index], () => lockTargets(index + 1, operation));
  return withItemLock(marker, () =>
    lockTargets(0, () =>
      accountTask(uid, async () => {
        assertCurrent();
        // Never generate or replace an account key during recovery.
        const key = await encryptionKey(uid, false);
        assertCurrent();
        const pending = await AsyncStorage.getItem(marker);
        assertCurrent();
        let entries: RecoveryEntry[];
        if (pending !== null) {
          const backupPrefix = `lifemate:cache-recovery-backup:${scope}:v1:`;
          if (
            !pending.startsWith(backupPrefix) ||
            !isAccountCacheKey(pending, uid)
          )
            throw new Error(
              'Bản khôi phục chưa hợp lệ. Dữ liệu cũ vẫn được giữ.',
            );
          const backup = await AsyncStorage.getItem(pending);
          assertCurrent();
          if (!backup)
            throw new Error(
              'Chưa đọc được bản dự phòng. Dữ liệu cũ vẫn được giữ.',
            );
          const decoded = await decryptWithKey(uid, pending, backup, key);
          assertCurrent();
          const parsed: unknown = JSON.parse(decoded);
          if (
            !Array.isArray(parsed) ||
            parsed.length !== keys.length ||
            parsed.some(
              (entry, index) =>
                !entry ||
                entry.storageKey !== keys[index] ||
                (entry.previous !== null &&
                  typeof entry.previous !== 'string') ||
                typeof entry.replacement !== 'string' ||
                !entry.replacement.startsWith(ENCRYPTED_PREFIX),
            )
          )
            throw new Error(
              'Bản khôi phục chưa hợp lệ. Dữ liệu cũ vẫn được giữ.',
            );
          entries = parsed;
          // A key changed between attempts must not install unreadable replacements.
          for (const entry of entries) {
            await decryptWithKey(uid, entry.storageKey, entry.replacement, key);
            assertCurrent();
          }
        } else {
          entries = [];
          for (const storageKey of keys) {
            const previous = await AsyncStorage.getItem(storageKey);
            assertCurrent();
            const replacement = await encryptValue(
              uid,
              storageKey,
              values[storageKey],
              key,
            );
            assertCurrent();
            entries.push({ storageKey, previous, replacement });
          }
          const backupKey = `lifemate:cache-recovery-backup:${scope}:v1:${randomUUID()}:${encodeURIComponent(uid)}`;
          const existing = await AsyncStorage.getItem(backupKey);
          assertCurrent();
          if (existing !== null)
            throw new Error('Bản dự phòng đã tồn tại. Hãy thử lại.');
          // Encrypt the whole archive: legacy values may still contain plaintext.
          const backup = await encryptValue(
            uid,
            backupKey,
            JSON.stringify(entries),
            key,
          );
          assertCurrent();
          await AsyncStorage.setItem(backupKey, backup);
          assertCurrent();
          const verified = await AsyncStorage.getItem(backupKey);
          assertCurrent();
          if (verified !== backup)
            throw new Error('Chưa xác minh được bản dự phòng.');
          await AsyncStorage.setItem(marker, backupKey);
          assertCurrent();
          if ((await AsyncStorage.getItem(marker)) !== backupKey)
            throw new Error('Chưa lưu được trạng thái khôi phục.');
          assertCurrent();
        }
        if (refreshValues) {
          const fresh = await refreshValues();
          assertCurrent();
          if (
            JSON.stringify(Object.keys(fresh).sort()) !==
              JSON.stringify(keys) ||
            keys.some((storageKey) => typeof fresh[storageKey] !== 'string')
          )
            throw new Error('Danh sách cache khôi phục không hợp lệ.');
          // A cloud-only namespace must not replay a stale snapshot after a crash.
          for (const entry of entries) {
            entry.replacement = await encryptValue(
              uid,
              entry.storageKey,
              fresh[entry.storageKey],
              key,
            );
            assertCurrent();
          }
        }
        for (const entry of entries) {
          assertCurrent();
          await AsyncStorage.setItem(entry.storageKey, entry.replacement);
          assertCurrent();
          if (
            (await AsyncStorage.getItem(entry.storageKey)) !== entry.replacement
          )
            throw new Error(
              'Chưa xác minh được cache mới. Hãy tiếp tục khôi phục.',
            );
          assertCurrent();
        }
        await AsyncStorage.removeItem(marker);
        assertCurrent();
      }),
    ),
  );
}

/** Reads encrypted data and upgrades legacy plaintext values in place. */
export async function getEncryptedItem(
  uid: string,
  storageKey: string,
  { migrateLegacy = true }: { migrateLegacy?: boolean } = {},
) {
  return withItemLock(storageKey, () =>
    accountTask(uid, async () => {
      const stored = await AsyncStorage.getItem(storageKey);
      if (stored === null) return null;
      if (stored.startsWith(ENCRYPTED_PREFIX))
        return decryptValue(uid, storageKey, stored);

      if (!migrateLegacy) return stored;
      const encrypted = await encryptValue(uid, storageKey, stored);
      await AsyncStorage.setItem(storageKey, encrypted);
      return stored;
    }),
  );
}

export async function setEncryptedItem(
  uid: string,
  storageKey: string,
  value: string,
) {
  return withItemLock(storageKey, () =>
    accountTask(uid, async () => {
      await AsyncStorage.setItem(
        storageKey,
        await encryptValue(uid, storageKey, value),
      );
    }),
  );
}

export async function removeAccountEncryptionKey(uid: string) {
  await keyLoads.get(uid)?.catch(() => undefined);
  const hash = await digestStringAsync(CryptoDigestAlgorithm.SHA256, uid);
  await SecureStore.deleteItemAsync(`${KEY_PREFIX}${hash}`, secureKeyOptions());
}

export function removeEncryptedItem(storageKey: string) {
  return withItemLock(storageKey, () => AsyncStorage.removeItem(storageKey));
}

export async function migrateSensitiveCache(uid: string) {
  const encodedUid = encodeURIComponent(uid);
  const knownKeys = [
    `lifemate:finance:v1:${encodedUid}`,
    `lifemate:finance:cloud-migration:v1:${encodedUid}`,
    `lifemate:finance:pending:v1:${encodedUid}`,
    `lifemate:finance:pending-base:v1:${encodedUid}`,
    `lifemate:held-money:v1:${encodedUid}`,
    `lifemate:finance-preferences:v1:${encodedUid}`,
    `lifemate:notes:v1:${encodedUid}`,
    `lifemate:agenda:v1:${encodedUid}`,
    `lifemate:card-score:v1:${encodedUid}`,
    `lifemate:card-score-deleted-online:v1:${encodedUid}`,
    `lifemate:prep-checklists:v1:${encodedUid}`,
  ];
  const storedKeys = new Set(await AsyncStorage.getAllKeys());
  await Promise.all(
    knownKeys
      .filter((storageKey) => storedKeys.has(storageKey))
      .map((storageKey) => getEncryptedItem(uid, storageKey)),
  );
}
