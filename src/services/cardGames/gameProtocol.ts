import type { CardGameRoom, GameSnapshot } from '../../types/cardGame';
import { audioCloudUrl } from '../../config/audioCloud';
import { isPhomConfig } from './phomConfig';
import { isPhomView } from './phomProtocol';
import { isSouthConfig, isSouthRules } from './tienLenConfig';

const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown): v is number =>
  Number.isSafeInteger(v) && (v as number) >= 0;
const uid = (v: unknown): v is string =>
  typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const uuid = (v: unknown) =>
  typeof v === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
    v,
  );
const cards = (v: unknown): v is number[] =>
  Array.isArray(v) &&
  v.length <= 13 &&
  new Set(v).size === v.length &&
  v.every((c) => integer(c) && c < 52);
const keys = (v: Record<string, unknown>, allowed: string[]) =>
  Object.keys(v).every((k) => allowed.includes(k));
function validAvatarUrl(value: unknown, playerUid: string) {
  if (value === undefined || value === null) return true;
  if (typeof value !== 'string') return false;
  try {
    const target = new URL(value);
    const origin = audioCloudUrl();
    return (
      !!origin &&
      target.origin === origin &&
      target.pathname ===
        `/storage/v1/object/sign/lifemate-avatars/profiles/${playerUid}/avatar.jpg` &&
      target.searchParams.getAll('token').length === 1 &&
      !!target.searchParams.get('token') &&
      [...target.searchParams.keys()].every((key) => key === 'token') &&
      !target.username &&
      !target.password &&
      !target.hash
    );
  } catch {
    return false;
  }
}

export function parseGameSnapshot(
  value: unknown,
  viewer: string,
): GameSnapshot {
  const fail = () => {
    throw new Error('Phản hồi bàn chơi chưa hợp lệ.');
  };
  if (
    !object(value) ||
    !integer(value.serverTime) ||
    (value.refreshToken !== undefined &&
      typeof value.refreshToken !== 'boolean')
  )
    return fail();
  if (
    value.removal !== undefined &&
    (value.room !== null ||
      !object(value.removal) ||
      !keys(value.removal, ['id', 'roomId', 'reason']) ||
      !uuid(value.removal.id) ||
      !uuid(value.removal.roomId) ||
      value.removal.reason !== 'kicked')
  )
    return fail();
  if (value.room === null)
    return {
      room: null,
      serverTime: value.serverTime,
      refreshToken: value.refreshToken as boolean | undefined,
      ...(value.removal
        ? { removal: value.removal as GameSnapshot['removal'] }
        : {}),
    };
  const r = value.room;
  if (
    !object(r) ||
    !keys(r, [
      'id',
      'code',
      'version',
      'epoch',
      'matchId',
      'phase',
      'host',
      'ownerUid',
      'controller',
      'topic',
      'members',
      'game',
      'amountPerCard',
      'gameKind',
      'phomConfig',
      'southConfig',
      'nextSouthRules',
      'nextPhomConfig',
    ]) ||
    !uuid(r.id) ||
    (r.gameKind !== undefined &&
      !['south', 'phom'].includes(r.gameKind as string)) ||
    (r.gameKind === 'phom'
      ? !isPhomConfig(r.phomConfig)
      : r.phomConfig !== undefined) ||
    (r.southConfig !== undefined &&
      (r.gameKind === 'phom' || !isSouthConfig(r.southConfig))) ||
    (r.nextSouthRules !== undefined &&
      (r.gameKind === 'phom' || !isSouthRules(r.nextSouthRules))) ||
    (r.nextPhomConfig !== undefined &&
      (r.gameKind !== 'phom' || !isPhomConfig(r.nextPhomConfig))) ||
    !uuid(r.epoch) ||
    !integer(r.version) ||
    r.version < 1 ||
    (r.matchId !== null && !uuid(r.matchId)) ||
    (r.ownerUid !== undefined && r.ownerUid !== null && !uid(r.ownerUid)) ||
    typeof r.code !== 'string' ||
    !/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(r.code) ||
    (r.amountPerCard !== undefined &&
      (!integer(r.amountPerCard) || r.amountPerCard > 1_000_000_000)) ||
    !['lobby', 'playing', 'finished', 'closed'].includes(r.phase as string) ||
    typeof r.controller !== 'boolean' ||
    r.topic !== `card-room:${r.id}:${r.epoch}` ||
    !Array.isArray(r.members) ||
    r.members.length > 4 ||
    !r.members.every(
      (m) =>
        object(m) &&
        keys(m, ['uid', 'name', 'ready', 'wins', 'balance', 'avatarUrl']) &&
        uid(m.uid) &&
        typeof m.name === 'string' &&
        m.name.length <= 30 &&
        typeof m.ready === 'boolean' &&
        integer(m.wins) &&
        (m.balance === undefined || Number.isSafeInteger(m.balance)) &&
        validAvatarUrl(m.avatarUrl, m.uid),
    ) ||
    new Set(r.members.map((m) => m.uid)).size !== r.members.length ||
    !r.members.some((m) => m.uid === viewer) ||
    !r.members.some((m) => m.uid === r.host)
  )
    return fail();
  if (r.phase === 'playing' && (!object(r.game) || r.game.status !== 'playing'))
    return fail();
  if (r.gameKind === 'phom' && r.game !== null && !isPhomView(r.game, viewer))
    return fail();
  if (r.game !== null && r.gameKind !== 'phom') {
    const g = r.game;
    if (
      !object(g) ||
      !keys(g, [
        'rulesVersion',
        'status',
        'hand',
        'players',
        'turn',
        'table',
        'passed',
        'openingCard',
        'deadline',
        'result',
        'southConfig',
        'cutTwoFees',
      ]) ||
      !['south-v1', 'south-v2'].includes(g.rulesVersion as string) ||
      (g.rulesVersion === 'south-v2'
        ? !isSouthConfig(g.southConfig) ||
          !isSouthConfig(r.southConfig) ||
          g.southConfig.finishMode !== r.southConfig.finishMode ||
          g.southConfig.cutTwoAmount !== r.southConfig.cutTwoAmount ||
          !Array.isArray(g.cutTwoFees) ||
          g.cutTwoFees.length > 4 ||
          !g.cutTwoFees.every(
            (f) =>
              object(f) &&
              keys(f, ['from', 'to', 'count', 'amount']) &&
              uid(f.from) &&
              uid(f.to) &&
              f.from !== f.to &&
              integer(f.count) &&
              f.count >= 1 &&
              f.count <= 3 &&
              integer(f.amount) &&
              f.amount ===
                f.count *
                  (g.southConfig as { cutTwoAmount: number }).cutTwoAmount,
          )
        : g.southConfig !== undefined ||
          g.cutTwoFees !== undefined ||
          r.southConfig !== undefined) ||
      !['playing', 'finished', 'cancelled'].includes(g.status as string) ||
      !cards(g.hand) ||
      !Array.isArray(g.players) ||
      g.players.length < 2 ||
      g.players.length > 4 ||
      !g.players.every(
        (p) =>
          object(p) &&
          keys(p, [
            'uid',
            'count',
            'finished',
            'forfeited',
            'name',
            'balance',
          ]) &&
          uid(p.uid) &&
          integer(p.count) &&
          p.count <= 13 &&
          typeof p.finished === 'boolean' &&
          typeof p.forfeited === 'boolean' &&
          (p.name === undefined ||
            (typeof p.name === 'string' && p.name.length <= 30)) &&
          (p.balance === undefined || Number.isSafeInteger(p.balance)),
      ) ||
      new Set(g.players.map((p) => p.uid)).size !== g.players.length ||
      !g.players.some((p) => p.uid === viewer) ||
      !Array.isArray(g.passed) ||
      !g.passed.every(uid) ||
      (g.turn !== null && !g.players.some((p) => p.uid === g.turn)) ||
      (g.openingCard !== null &&
        (!integer(g.openingCard) || g.openingCard > 51)) ||
      (g.deadline !== null && !integer(g.deadline))
    )
      return fail();
    if (
      g.table !== null &&
      (!object(g.table) ||
        !uid(g.table.uid) ||
        !cards(g.table.cards) ||
        !g.table.cards.length)
    )
      return fail();
    const playerIds = (g.players as Record<string, unknown>[]).map(
      (p) => p.uid,
    );
    if (
      g.rulesVersion === 'south-v2' &&
      Array.isArray(g.cutTwoFees) &&
      (g.cutTwoFees.some(
        (f) => !playerIds.includes(f.from) || !playerIds.includes(f.to),
      ) ||
        g.cutTwoFees.reduce((n, f) => n + f.count, 0) > 4)
    )
      return fail();
    if (
      g.result !== null &&
      (!object(g.result) ||
        typeof g.result.reason !== 'string' ||
        !Array.isArray(g.result.ranking) ||
        g.result.ranking.length > 4 ||
        !g.result.ranking.every(
          (p) =>
            object(p) &&
            uid(p.uid) &&
            integer(p.rank) &&
            p.rank >= 1 &&
            p.rank <= 4 &&
            Array.isArray(p.labels) &&
            p.labels.every((x) => typeof x === 'string') &&
            (p.name === undefined ||
              (typeof p.name === 'string' && p.name.length <= 30)) &&
            (p.remainingCards === undefined ||
              (integer(p.remainingCards) && p.remainingCards <= 13)) &&
            (p.moneyDelta === undefined ||
              Number.isSafeInteger(p.moneyDelta)) &&
            (p.breakdown === undefined ||
              (Array.isArray(p.breakdown) &&
                p.breakdown.length <= 8 &&
                p.breakdown.every(
                  (b) =>
                    object(b) &&
                    keys(b, ['kind', 'amount', 'otherUid']) &&
                    ['remaining-cards', 'cut-two'].includes(b.kind as string) &&
                    Number.isSafeInteger(b.amount) &&
                    uid(b.otherUid),
                ))) &&
            (g.rulesVersion !== 'south-v2' ||
              (Array.isArray(p.breakdown) &&
                p.breakdown.reduce((n, b) => n + b.amount, 0) ===
                  p.moneyDelta)),
        ))
    )
      return fail();
    if (
      g.status === 'playing' &&
      (g.turn === null || g.deadline === null || g.result !== null)
    )
      return fail();
  }
  // Keep only the documented envelope; private state fields are rejected above.
  return {
    room: {
      ...r,
      amountPerCard: integer(r.amountPerCard) ? r.amountPerCard : 0,
      members: r.members.map((m) => ({
        ...m,
        balance: Number.isSafeInteger(m.balance) ? m.balance : 0,
      })),
      game:
        r.game && object(r.game) && object(r.game.result)
          ? {
              ...r.game,
              result: {
                ...r.game.result,
                ranking: (
                  r.game.result.ranking as Record<string, unknown>[]
                ).map((p) => ({
                  ...p,
                  remainingCards: p.remainingCards ?? 0,
                  moneyDelta: p.moneyDelta ?? 0,
                })),
              },
            }
          : r.game,
    } as unknown as CardGameRoom,
    serverTime: value.serverTime,
    refreshToken: value.refreshToken as boolean | undefined,
  };
}

export function parseGameRoomStatus(value: unknown, expectedRoomId: string) {
  if (
    !object(value) ||
    !uuid(value.roomId) ||
    value.roomId !== expectedRoomId ||
    typeof value.exists !== 'boolean' ||
    typeof value.owner !== 'boolean' ||
    typeof value.canRejoin !== 'boolean' ||
    typeof value.canReopen !== 'boolean' ||
    typeof value.canDelete !== 'boolean' ||
    typeof value.expired !== 'boolean' ||
    (value.minClientVersion !== undefined &&
      (!integer(value.minClientVersion) || value.minClientVersion > 7)) ||
    (value.phase !== null &&
      !['lobby', 'playing', 'finished', 'closed'].includes(
        value.phase as string,
      )) ||
    (value.version !== null &&
      (!integer(value.version) || value.version < 1)) ||
    (value.matchId !== null && !uuid(value.matchId))
  )
    throw new Error('Phản hồi trạng thái phòng chưa hợp lệ.');
  return value as import('../../types/cardGame').GameRoomStatus;
}
