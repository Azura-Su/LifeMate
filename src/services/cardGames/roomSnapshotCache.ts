import type { CardGameRoom, GameSnapshot } from '../../types/cardGame';
import {
  getEncryptedItem,
  removeEncryptedItem,
  setEncryptedItem,
} from '../security/encryptedLocalStorage';
import { parseGameSnapshot } from './gameProtocol';

const cache = new Map<string, GameSnapshot>();

function storageKey(uid: string) {
  return `lifemate:card-game-room-snapshot:v1:${encodeURIComponent(uid)}`;
}

function matchesRoom(snapshot: GameSnapshot | null, code: string) {
  return snapshot?.room?.code === code.toUpperCase();
}

function redactFinishedSnapshot(snapshot: GameSnapshot): GameSnapshot | null {
  const room = snapshot.room;
  if (room?.phase !== 'finished' || room.game?.status !== 'finished')
    return null;
  return {
    ...snapshot,
    serverTime: 0,
    room: {
      ...room,
      members: room.members.map(
        ({ avatarUrl: _avatarUrl, ...member }) => member,
      ),
      game:
        room.game.rulesVersion === 'phom-v1'
          ? {
              ...room.game,
              hand: [],
              players: room.game.players.map(
                ({ resultCards: _resultCards, ...player }) => player,
              ),
            }
          : { ...room.game, hand: [] },
    },
  };
}

export function getCachedRoomSnapshot(uid: string, code: string) {
  const snapshot = cache.get(uid) ?? null;
  return matchesRoom(snapshot, code) ? snapshot : null;
}

export async function loadCachedRoomSnapshot(uid: string, code: string) {
  const inMemory = getCachedRoomSnapshot(uid, code);
  if (inMemory) return inMemory;

  try {
    const saved = await getEncryptedItem(uid, storageKey(uid));
    if (!saved) return null;
    const parsed: unknown = JSON.parse(saved);
    const snapshot = parseGameSnapshot(parsed, uid);
    const redacted = redactFinishedSnapshot(snapshot);
    if (!matchesRoom(redacted, code)) return null;
    cache.set(uid, redacted!);
    return redacted;
  } catch {
    return null;
  }
}

export async function saveRoomSnapshot(uid: string, snapshot: GameSnapshot) {
  const finished = redactFinishedSnapshot(snapshot);
  if (!finished) {
    const room = snapshot.room as CardGameRoom | null;
    const previous = room
      ? (cache.get(uid) ?? (await loadCachedRoomSnapshot(uid, room.code)))
      : null;
    if (
      room &&
      previous?.room &&
      (previous.room.id === room.id || previous.room.code === room.code)
    ) {
      cache.delete(uid);
      await removeEncryptedItem(storageKey(uid));
    }
    return;
  }

  const previous = cache.get(uid);
  cache.set(uid, finished);
  if (JSON.stringify(previous) === JSON.stringify(finished)) return;
  await setEncryptedItem(uid, storageKey(uid), JSON.stringify(finished));
}

export async function clearCachedRoomSnapshot(uid: string, code?: string) {
  const current = cache.get(uid);
  if (code && !matchesRoom(current ?? null, code)) return;
  cache.delete(uid);
  await removeEncryptedItem(storageKey(uid));
}
