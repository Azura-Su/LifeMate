import type { CardGameRoom, GameSnapshot } from '../../types/cardGame';

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
  if (value.room === null)
    return {
      room: null,
      serverTime: value.serverTime,
      refreshToken: value.refreshToken as boolean | undefined,
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
      'controller',
      'topic',
      'members',
      'game',
    ]) ||
    !uuid(r.id) ||
    !uuid(r.epoch) ||
    !integer(r.version) ||
    r.version < 1 ||
    (r.matchId !== null && !uuid(r.matchId)) ||
    typeof r.code !== 'string' ||
    !/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(r.code) ||
    !['lobby', 'playing', 'finished', 'closed'].includes(r.phase as string) ||
    typeof r.controller !== 'boolean' ||
    r.topic !== `card-room:${r.id}:${r.epoch}` ||
    !Array.isArray(r.members) ||
    r.members.length > 4 ||
    !r.members.every(
      (m) =>
        object(m) &&
        keys(m, ['uid', 'name', 'ready', 'wins']) &&
        uid(m.uid) &&
        typeof m.name === 'string' &&
        m.name.length <= 30 &&
        typeof m.ready === 'boolean' &&
        integer(m.wins),
    ) ||
    new Set(r.members.map((m) => m.uid)).size !== r.members.length ||
    !r.members.some((m) => m.uid === viewer) ||
    !r.members.some((m) => m.uid === r.host)
  )
    return fail();
  if (r.phase === 'playing' && (!object(r.game) || r.game.status !== 'playing'))
    return fail();
  if (r.game !== null) {
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
      ]) ||
      g.rulesVersion !== 'south-v1' ||
      !['playing', 'finished', 'cancelled'].includes(g.status as string) ||
      !cards(g.hand) ||
      !Array.isArray(g.players) ||
      g.players.length < 2 ||
      g.players.length > 4 ||
      !g.players.every(
        (p) =>
          object(p) &&
          keys(p, ['uid', 'count', 'finished', 'forfeited']) &&
          uid(p.uid) &&
          integer(p.count) &&
          p.count <= 13 &&
          typeof p.finished === 'boolean' &&
          typeof p.forfeited === 'boolean',
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
            p.labels.every((x) => typeof x === 'string'),
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
    room: r as unknown as CardGameRoom,
    serverTime: value.serverTime,
    refreshToken: value.refreshToken as boolean | undefined,
  };
}
