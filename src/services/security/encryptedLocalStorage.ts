import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AESEncryptionKey,
  AESSealedData,
  CryptoDigestAlgorithm,
  aesDecryptAsync,
  aesEncryptAsync,
  digestStringAsync,
} from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

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

async function encryptValue(uid: string, storageKey: string, value: string) {
  const sealed = await aesEncryptAsync(
    utf8(value),
    await encryptionKey(uid, true),
    { additionalData: associatedData(uid, storageKey) },
  );
  return `${ENCRYPTED_PREFIX}${await sealed.combined('base64')}`;
}

async function decryptValue(uid: string, storageKey: string, value: string) {
  const payload = value.slice(ENCRYPTED_PREFIX.length);
  if (!payload)
    throw new Error('Không đọc được dữ liệu đã mã hóa trên thiết bị.');
  const plaintext = await aesDecryptAsync(
    AESSealedData.fromCombined(payload),
    await encryptionKey(uid, false),
    { additionalData: associatedData(uid, storageKey) },
  );
  if (!(plaintext instanceof Uint8Array))
    throw new Error('Không đọc được dữ liệu đã mã hóa trên thiết bị.');
  return new TextDecoder().decode(plaintext);
}

/** Reads encrypted data and upgrades legacy plaintext values in place. */
export async function getEncryptedItem(uid: string, storageKey: string) {
  return withItemLock(storageKey, async () => {
    const stored = await AsyncStorage.getItem(storageKey);
    if (stored === null) return null;
    if (stored.startsWith(ENCRYPTED_PREFIX))
      return decryptValue(uid, storageKey, stored);

    const encrypted = await encryptValue(uid, storageKey, stored);
    await AsyncStorage.setItem(storageKey, encrypted);
    return stored;
  });
}

export async function setEncryptedItem(
  uid: string,
  storageKey: string,
  value: string,
) {
  return withItemLock(storageKey, async () => {
    await AsyncStorage.setItem(
      storageKey,
      await encryptValue(uid, storageKey, value),
    );
  });
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
    `lifemate:finance-preferences:v1:${encodedUid}`,
    `lifemate:notes:v1:${encodedUid}`,
    `lifemate:agenda:v1:${encodedUid}`,
  ];
  const storedKeys = new Set(await AsyncStorage.getAllKeys());
  await Promise.all(
    knownKeys
      .filter((storageKey) => storedKeys.has(storageKey))
      .map((storageKey) => getEncryptedItem(uid, storageKey)),
  );
}
