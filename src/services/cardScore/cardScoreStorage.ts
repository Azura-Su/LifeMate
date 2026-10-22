import { randomUUID } from 'expo-crypto';
import type { CardScoreMatch } from '../../types/cardScore';
import { isCardScoreMatch, validatePlayerNames } from '../../utils/cardScore';
import { scoreChanges } from '../../utils/cardScoreAudit';
import {
  getEncryptedItem,
  setEncryptedItem,
} from '../security/encryptedLocalStorage';

const queues = new Map<string, Promise<unknown>>();

// One-time cleanup cutoff for card-score history that was present when the
// production history purge ran. New tables are timestamped after this point.
const CARD_SCORE_HISTORY_PURGE_CUTOFF = Date.parse('2026-10-22T05:25:00Z');
const PURGED_ONLINE_ROOM_IDS = new Set([
  '201fc5c2-3563-4dc0-97a3-2aeb144b548c',
  '764b3ab6-840e-490c-b3bf-f5ce0a5700b7',
  '8e82710a-24af-415a-b58f-0a7dbae7bc7f',
  '8f784221-5c65-413d-94d0-ad77304b0852',
  'd44974c0-67fb-46cd-880c-811de7fc9569',
  'e2650752-6afe-4935-91d9-ba1eed3144ec',
  '17eedd7d-15d3-45f5-8640-f81d757cddf7',
]);

function isPurgedCardScoreHistory(match: CardScoreMatch) {
  if (match.onlineRoomId && PURGED_ONLINE_ROOM_IDS.has(match.onlineRoomId))
    return true;
  if (match.createdAt > CARD_SCORE_HISTORY_PURGE_CUTOFF) return false;
  const isHistory =
    match.status === 'finished' || !!match.deletedAt || !!match.localFinished;
  const historyAt = Math.max(match.updatedAt, match.localFinishedAt ?? 0);
  return isHistory && historyAt <= CARD_SCORE_HISTORY_PURGE_CUTOFF;
}

export function cardScoreStorageKey(uid: string) {
  return `lifemate:card-score:v1:${encodeURIComponent(uid)}`;
}

function deletedOnlineMatchesKey(uid: string) {
  return `lifemate:card-score-deleted-online:v1:${encodeURIComponent(uid)}`;
}

type DeletedOnlineMatch = {
  roomId: string;
  matchIds: string[];
  blockRoom: boolean;
};

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
  const retainedMatches = validMatches.filter(
    (match) => !isPurgedCardScoreHistory(match),
  );
  if (
    retainedMatches.length !== validMatches.length ||
    validMatches.some((match, index) => match !== value[index])
  )
    await writeMatches(uid, retainedMatches);
  return retainedMatches;
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
    JSON.stringify(matches.filter((match) => !isPurgedCardScoreHistory(match))),
  );
}

async function readDeletedOnlineMatches(
  uid: string,
): Promise<DeletedOnlineMatch[]> {
  const saved = await getEncryptedItem(uid, deletedOnlineMatchesKey(uid));
  if (saved === null) return [];
  let value: unknown;
  try {
    value = JSON.parse(saved);
  } catch {
    throw new Error('Chưa đọc được các bàn online đã xóa trên thiết bị.');
  }
  if (
    !Array.isArray(value) ||
    value.some(
      (item) =>
        !item ||
        typeof item !== 'object' ||
        typeof item.roomId !== 'string' ||
        !Array.isArray(item.matchIds) ||
        item.matchIds.some((matchId: unknown) => typeof matchId !== 'string') ||
        typeof item.blockRoom !== 'boolean',
    )
  )
    throw new Error('Dữ liệu bàn online đã xóa trên thiết bị không hợp lệ.');
  return value as DeletedOnlineMatch[];
}

async function writeDeletedOnlineMatches(
  uid: string,
  matches: DeletedOnlineMatch[],
) {
  await setEncryptedItem(
    uid,
    deletedOnlineMatchesKey(uid),
    JSON.stringify(matches),
  );
}

function validateMatch(match: CardScoreMatch) {
  const nameError = validatePlayerNames(
    match.players.map(({ name }) => name),
    match.onlineRoomId ? Infinity : undefined,
  );
  if (nameError) throw new Error(nameError);
  if (!isCardScoreMatch(match))
    throw new Error('Thông tin bàn chơi không hợp lệ.');
}

export async function readCardScoreMatches(
  uid: string,
  options: { includeDeleted?: boolean } = {},
) {
  requireUid(uid);
  return enqueue(uid, async () =>
    (await readMatches(uid)).filter(
      (match) => options.includeDeleted || !match.deletedAt,
    ),
  );
}

/** Archive only the UID's view; shared status, scores and write grants stay intact. */
export async function setCardScoreLocalFinished(
  uid: string,
  matchId: string,
  finished: boolean,
) {
  requireUid(uid);
  return enqueue(uid, async () => {
    const matches = await readMatches(uid);
    const index = matches.findIndex((match) => match.id === matchId);
    if (index < 0 || !matches[index].onlineRoomId || matches[index].deletedAt)
      throw new Error('Không tìm thấy bảng điểm online cần cập nhật.');
    const updated = { ...matches[index] };
    if (finished) {
      updated.localFinished = true;
      updated.localFinishedAt = Date.now();
    } else {
      delete updated.localFinished;
      delete updated.localFinishedAt;
    }
    matches[index] = updated;
    await writeMatches(uid, matches);
    return matches;
  });
}

/** Cache content only; write permission must always come from a fresh server read. */
export async function cacheSharedCardScoreMatches(
  uid: string,
  shared: CardScoreMatch[],
  replace = false,
) {
  requireUid(uid);
  if (shared.some((match) => !match.sharedVersion || !isCardScoreMatch(match)))
    throw new Error('Bảng điểm đồng bộ không hợp lệ.');
  return enqueue(uid, async () => {
    const matches = await readMatches(uid);
    const incoming = shared
      .map((match) => {
        const clean = { ...match };
        delete clean.localFinished;
        delete clean.localFinishedAt;
        return clean;
      })
      .filter((match) => !isPurgedCardScoreHistory(match))
      .map((match) => {
        const cached = matches.find((item) => item.id === match.id);
        const updated = { ...match };
        delete updated.localFinished;
        if (cached?.localFinished) {
          updated.localFinished = true;
          updated.localFinishedAt = cached.localFinishedAt;
        }
        return updated;
      });
    const next = matches.filter(
      (match) =>
        (!replace || !match.sharedVersion) &&
        !shared.some((item) => item.id === match.id),
    );
    await writeMatches(uid, [...incoming, ...next]);
    return [...incoming, ...next];
  });
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

export async function syncOnlineCardScoreMatch(
  uid: string,
  input: {
    roomId: string;
    code: string;
    amountPerCard: number;
    members: { uid: string; name: string }[];
    matchId: string | null;
    result: {
      ranking: { uid: string; name?: string; moneyDelta?: number }[];
    } | null;
  },
) {
  requireUid(uid);
  if (PURGED_ONLINE_ROOM_IDS.has(input.roomId)) return null;
  return enqueue(uid, async () => {
    const matches = await readMatches(uid);
    const deletedMatches = await readDeletedOnlineMatches(uid);
    const shared = matches.find(
      (match) => match.onlineRoomId === input.roomId && match.sharedVersion,
    );
    if (shared) return shared;
    if (
      deletedMatches.some(
        (item) =>
          item.roomId === input.roomId &&
          (item.blockRoom ||
            input.matchId === null ||
            item.matchIds.includes(input.matchId)),
      )
    )
      return null;
    const roomMatches = matches.filter(
      (match) => match.onlineRoomId === input.roomId && !match.deletedAt,
    );
    const existing = roomMatches.find((match) => match.status === 'active');
    const finished = roomMatches.find((match) => match.status === 'finished');
    if (!existing && finished && input.matchId) {
      const seenInLegacyTable =
        !finished.lastSyncedOnlineMatchId &&
        (finished.rounds.some((round) => round.id === input.matchId) ||
          finished.ignoredOnlineRoundIds?.includes(input.matchId));
      if (
        finished.lastSyncedOnlineMatchId === input.matchId ||
        seenInLegacyTable
      )
        return finished;
    }
    const ignoredPlayers = new Set(
      existing?.ignoredOnlinePlayerIds ??
        finished?.ignoredOnlinePlayerIds ??
        [],
    );
    const playerInfo = new Map<string, string>();
    input.members.forEach((member) => {
      if (
        !ignoredPlayers.has(member.uid) &&
        !existing?.players.some((player) => player.id === member.uid)
      )
        playerInfo.set(member.uid, sanitizeOnlineName(member.name));
    });
    input.result?.ranking.forEach((rank) => {
      if (
        !ignoredPlayers.has(rank.uid) &&
        !existing?.players.some((player) => player.id === rank.uid) &&
        !playerInfo.has(rank.uid)
      )
        playerInfo.set(rank.uid, sanitizeOnlineName(rank.name));
    });
    const players = [
      ...new Map([
        ...(existing?.players ?? [])
          .filter((player) => !ignoredPlayers.has(player.id))
          .map((player) => [player.id, player.name] as const),
        ...[...playerInfo].map(([id, name]) => [id, name] as const),
      ]),
    ].map(([id, name]) => ({ id, name }));
    if (players.length < 2) return existing ?? finished ?? null;
    const seenNames = new Set<string>();
    for (const player of players) {
      const baseName = player.name.trim();
      player.name = baseName;
      let suffix = 2;
      while (seenNames.has(player.name.toLocaleLowerCase('vi-VN')))
        player.name = `${baseName.slice(0, 24)} · ${suffix++}`;
      seenNames.add(player.name.trim().toLocaleLowerCase('vi-VN'));
    }
    const now = Date.now();
    const match: CardScoreMatch = existing
      ? {
          ...existing,
          players,
          seatOrder: [
            ...existing.seatOrder.filter((id) =>
              players.some((player) => player.id === id),
            ),
            ...players
              .map(({ id }) => id)
              .filter((id) => !existing.seatOrder.includes(id)),
          ],
        }
      : {
          id: randomUUID(),
          title: `Tiến lên miền Nam · ${input.code}`,
          players,
          seatOrder: players.map((player) => player.id),
          dealerPlayerId: players[0].id,
          rounds: [],
          status: 'active',
          createdAt: now,
          updatedAt: now,
          onlineRoomId: input.roomId,
          onlineRoomCode: input.code,
          amountPerCard: input.amountPerCard,
          ...(ignoredPlayers.size
            ? { ignoredOnlinePlayerIds: [...ignoredPlayers] }
            : {}),
        };
    match.onlineRoomCode = input.code;
    // Only mark a match synced once its result exists; marking it mid-game
    // would make a later result sync hit the finished-table early return.
    if (input.matchId && input.result)
      match.lastSyncedOnlineMatchId = input.matchId;
    const playerIds = new Set(players.map(({ id }) => id));
    match.rounds = match.rounds.map((round) => ({
      ...round,
      scores: Object.fromEntries(
        Object.entries(round.scores).filter(([id]) => playerIds.has(id)),
      ),
    }));
    if (
      input.result?.ranking.length &&
      input.matchId &&
      !match.ignoredOnlineRoundIds?.includes(input.matchId) &&
      !match.rounds.some((round) => round.id === input.matchId)
    ) {
      match.rounds = [
        ...match.rounds,
        {
          id: input.matchId,
          createdAt: now,
          scores: Object.fromEntries(
            input.result.ranking
              .filter((rank) => playerIds.has(rank.uid))
              .map((rank) => [
                rank.uid,
                Number.isSafeInteger(rank.moneyDelta) ? rank.moneyDelta! : 0,
              ]),
          ),
        },
      ];
    }
    validateMatch(match);
    const index = existing
      ? matches.findIndex((item) => item.id === existing.id)
      : -1;
    if (index < 0) matches.unshift(match);
    else matches[index] = match;
    if (!existing || JSON.stringify(existing) !== JSON.stringify(match)) {
      match.updatedAt = now;
      await writeMatches(uid, matches);
    }
    return match;
  });
}

export async function finishOnlineCardScoreMatch(uid: string, roomId: string) {
  requireUid(uid);
  return enqueue(uid, async () => {
    const matches = await readMatches(uid);
    const match = matches.find(
      (item) =>
        item.onlineRoomId === roomId &&
        item.status === 'active' &&
        !item.sharedVersion &&
        !item.deletedAt,
    );
    if (!match || match.status === 'finished') return matches;
    const updated = {
      ...match,
      status: 'finished' as const,
      updatedAt: Date.now(),
    };
    matches[matches.indexOf(match)] = updated;
    await writeMatches(uid, matches);
    return matches;
  });
}

export async function updateCardScoreMatch(
  uid: string,
  match: CardScoreMatch,
  options: { resume?: boolean; actorName?: string } = {},
) {
  requireUid(uid);
  validateMatch(match);
  return enqueue(uid, async () => {
    const matches = await readMatches(uid);
    const index = matches.findIndex((item) => item.id === match.id);
    if (index < 0) throw new Error('Không tìm thấy ván chơi cần cập nhật.');
    const latest = matches[index];
    if (latest.sharedVersion)
      throw new Error('Bảng điểm phòng phải được lưu trên máy chủ.');
    if (latest.deletedAt)
      throw new Error('Bảng điểm đã xóa không thể khôi phục.');
    const updated = mergeScoreMatch(latest, match, options);
    const changes = scoreChanges(latest, updated);
    updated.audit = [
      ...(latest.audit ?? []),
      ...(changes.length
        ? [
            {
              id: randomUUID(),
              at: updated.updatedAt,
              actorUid: uid,
              actorName: options.actorName?.trim() || uid,
              changes,
            },
          ]
        : []),
    ];
    matches[index] = updated;
    await writeMatches(uid, matches);
    return updated;
  });
}

function sanitizeOnlineName(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return 'Người chơi';
  return value.trim().slice(0, 30);
}

function mergeScoreMatch(
  latest: CardScoreMatch,
  incoming: CardScoreMatch,
  options: { resume?: boolean } = {},
) {
  if (!latest.onlineRoomId) return { ...incoming, updatedAt: Date.now() };
  const ignoredPlayerIds = new Set([
    ...(latest.ignoredOnlinePlayerIds ?? []),
    ...(incoming.ignoredOnlinePlayerIds ?? []),
  ]);
  const players = [
    ...incoming.players,
    ...latest.players.filter(
      (player) =>
        !ignoredPlayerIds.has(player.id) &&
        !incoming.players.some((item) => item.id === player.id),
    ),
  ].filter((player) => !ignoredPlayerIds.has(player.id));
  const playerIds = new Set(players.map(({ id }) => id));
  const ignoredRoundIds = new Set([
    ...(latest.ignoredOnlineRoundIds ?? []),
    ...(incoming.ignoredOnlineRoundIds ?? []),
  ]);
  const roundsById = new Map<string, CardScoreMatch['rounds'][number]>();
  for (const round of latest.rounds) roundsById.set(round.id, round);
  for (const round of incoming.rounds) roundsById.set(round.id, round);
  const rounds = [...roundsById.values()]
    .filter((round) => !ignoredRoundIds.has(round.id))
    .map((round) => ({
      ...round,
      scores: Object.fromEntries(
        Object.entries(round.scores).filter(([id]) => playerIds.has(id)),
      ),
    }));
  const seatOrder = [
    ...incoming.seatOrder.filter((id) => playerIds.has(id)),
    ...players
      .map(({ id }) => id)
      .filter((id) => !incoming.seatOrder.includes(id)),
  ];
  return {
    ...latest,
    ...incoming,
    players,
    seatOrder,
    dealerPlayerId: playerIds.has(incoming.dealerPlayerId)
      ? incoming.dealerPlayerId
      : (seatOrder[0] ?? ''),
    rounds,
    status:
      latest.status === 'finished' && !options.resume
        ? 'finished'
        : incoming.status,
    ignoredOnlinePlayerIds: [...ignoredPlayerIds],
    ignoredOnlineRoundIds: [...ignoredRoundIds],
    lastSyncedOnlineMatchId:
      latest.lastSyncedOnlineMatchId ?? incoming.lastSyncedOnlineMatchId,
    updatedAt: Date.now(),
  };
}

export async function deleteCardScoreMatch(
  uid: string,
  matchId: string,
  actorName?: string,
) {
  requireUid(uid);
  return enqueue(uid, async () => {
    const matches = await readMatches(uid);
    const deleted = matches.find((match) => match.id === matchId);
    if (!deleted) return matches;
    if (deleted.sharedVersion)
      throw new Error('Chỉ chủ phòng mới được xóa bảng điểm trên máy chủ.');
    if (deleted.deletedAt) return matches.filter((match) => !match.deletedAt);
    if (deleted.onlineRoomId) {
      const deletedMatches = await readDeletedOnlineMatches(uid);
      const marker = {
        roomId: deleted.onlineRoomId,
        matchIds: [
          ...new Set(
            [
              deleted.lastSyncedOnlineMatchId,
              ...deleted.rounds.map(({ id }) => id),
              ...(deleted.ignoredOnlineRoundIds ?? []),
            ].filter((id): id is string => !!id),
          ),
        ],
        blockRoom: false,
      };
      marker.blockRoom = marker.matchIds.length === 0;
      if (
        !deletedMatches.some(
          (item) =>
            item.roomId === marker.roomId &&
            item.blockRoom === marker.blockRoom &&
            item.matchIds.length === marker.matchIds.length &&
            item.matchIds.every((matchId) => marker.matchIds.includes(matchId)),
        )
      )
        await writeDeletedOnlineMatches(uid, [...deletedMatches, marker]);
    }
    const now = Date.now();
    const tombstone: CardScoreMatch = {
      ...deleted,
      status: 'finished',
      deletedAt: now,
      updatedAt: now,
      audit: [
        ...(deleted.audit ?? []),
        {
          id: randomUUID(),
          at: now,
          actorUid: uid,
          actorName: actorName?.trim() || uid,
          changes: [{ kind: 'table-delete' }],
        },
      ],
    };
    const next = matches.map((match) =>
      match.id === matchId ? tombstone : match,
    );
    await writeMatches(uid, next);
    return next.filter((match) => !match.deletedAt);
  });
}
