import { randomUUID } from 'expo-crypto';
import type { CardScoreMatch } from '../../types/cardScore';
import { isCardScoreMatch, validatePlayerNames } from '../../utils/cardScore';
import {
  getEncryptedItem,
  setEncryptedItem,
} from '../security/encryptedLocalStorage';

const queues = new Map<string, Promise<unknown>>();

export function cardScoreStorageKey(uid: string) {
  return `lifemate:card-score:v1:${encodeURIComponent(uid)}`;
}

function requireUid(uid: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid))
    throw new Error('Không tìm thấy tài khoản đang đăng nhập.');
}

function enqueue<T>(uid: string, operation: () => Promise<T>): Promise<T> {
  const key = cardScoreStorageKey(uid);
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  queues.set(key, next);
  void next
    .finally(() => {
      if (queues.get(key) === next) queues.delete(key);
    })
    .catch(() => undefined);
  return next;
}

async function readMatches(uid: string): Promise<CardScoreMatch[]> {
  const saved = await getEncryptedItem(uid, cardScoreStorageKey(uid));
  if (saved === null) return [];
  let value: unknown;
  try {
    value = JSON.parse(saved);
  } catch {
    throw new Error('Chưa đọc được lịch sử ghi điểm trên thiết bị.');
  }
  if (!Array.isArray(value))
    throw new Error('Dữ liệu lịch sử ghi điểm trên thiết bị không hợp lệ.');
  const matches = value.map((stored) =>
    isCardScoreMatch(stored) ? stored : migrateLegacyMatch(stored),
  );
  if (matches.some((match) => match === null))
    throw new Error('Dữ liệu lịch sử ghi điểm trên thiết bị không hợp lệ.');
  const validMatches = matches as CardScoreMatch[];
  if (validMatches.some((match, index) => match !== value[index]))
    await writeMatches(uid, validMatches);
  return validMatches;
}

function migrateLegacyMatch(value: unknown): CardScoreMatch | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { mode, ...legacy } = value as Record<string, unknown>;
  if (!['south', 'north', 'free'].includes(String(mode))) return null;
  const migrated = { ...legacy, title: 'Bàn chơi' };
  return isCardScoreMatch(migrated) ? migrated : null;
}

async function writeMatches(uid: string, matches: CardScoreMatch[]) {
  await setEncryptedItem(
    uid,
    cardScoreStorageKey(uid),
    JSON.stringify(matches),
  );
}

function validateMatch(match: CardScoreMatch) {
  const nameError = validatePlayerNames(match.players.map(({ name }) => name));
  if (nameError) throw new Error(nameError);
  if (!isCardScoreMatch(match))
    throw new Error('Thông tin bàn chơi không hợp lệ.');
}

export async function readCardScoreMatches(uid: string) {
  requireUid(uid);
  return enqueue(uid, () => readMatches(uid));
}

export async function createCardScoreMatch(
  uid: string,
  input: Omit<
    CardScoreMatch,
    'id' | 'rounds' | 'status' | 'createdAt' | 'updatedAt'
  >,
) {
  requireUid(uid);
  const now = Date.now();
  const match: CardScoreMatch = {
    ...input,
    id: randomUUID(),
    rounds: [],
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  validateMatch(match);
  return enqueue(uid, async () => {
    const matches = await readMatches(uid);
    await writeMatches(uid, [match, ...matches]);
    return match;
  });
}

export async function updateCardScoreMatch(uid: string, match: CardScoreMatch) {
  requireUid(uid);
  validateMatch(match);
  return enqueue(uid, async () => {
    const matches = await readMatches(uid);
    const index = matches.findIndex((item) => item.id === match.id);
    if (index < 0) throw new Error('Không tìm thấy ván chơi cần cập nhật.');
    const updated = { ...match, updatedAt: Date.now() };
    matches[index] = updated;
    await writeMatches(uid, matches);
    return updated;
  });
}

export async function deleteCardScoreMatch(uid: string, matchId: string) {
  requireUid(uid);
  return enqueue(uid, async () => {
    const matches = await readMatches(uid);
    const remaining = matches.filter((match) => match.id !== matchId);
    if (remaining.length === matches.length) return matches;
    await writeMatches(uid, remaining);
    return remaining;
  });
}
