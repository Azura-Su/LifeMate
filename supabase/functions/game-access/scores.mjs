// Only score content crosses this boundary. Authority, identity, revisions and
// audit are owned by SQL; a client can never grant another account access.
export function validateScoreDocument(doc) {
  const fail = () => {
    throw Error('invalid-input');
  };
  const object = (value) =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
  const text = (value, max) =>
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= max &&
    !/[\p{Cc}\p{Cf}]/u.test(value);
  const id = (value) =>
    typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
  const fields = [
    'title',
    'players',
    'seatOrder',
    'dealerPlayerId',
    'rounds',
    'status',
  ];
  if (
    !object(doc) ||
    Object.keys(doc).some((key) => !fields.includes(key)) ||
    fields.some((key) => !(key in doc)) ||
    !text(doc.title, 60) ||
    !Array.isArray(doc.players) ||
    doc.players.length < 1 ||
    doc.players.length > 128
  )
    fail();
  const ids = new Set(),
    names = new Set();
  for (const player of doc.players) {
    if (
      !object(player) ||
      Object.keys(player).some((key) => !['id', 'name'].includes(key)) ||
      !id(player.id) ||
      !text(player.name, 30) ||
      ids.has(player.id) ||
      names.has(player.name.trim().toLocaleLowerCase('vi-VN'))
    )
      fail();
    ids.add(player.id);
    names.add(player.name.trim().toLocaleLowerCase('vi-VN'));
  }
  if (
    !Array.isArray(doc.seatOrder) ||
    doc.seatOrder.length !== ids.size ||
    new Set(doc.seatOrder).size !== ids.size ||
    doc.seatOrder.some((key) => !ids.has(key)) ||
    !ids.has(doc.dealerPlayerId) ||
    !['active', 'finished'].includes(doc.status) ||
    !Array.isArray(doc.rounds) ||
    doc.rounds.length > 2000
  )
    fail();
  const rounds = new Set();
  for (const round of doc.rounds) {
    if (
      !object(round) ||
      Object.keys(round).some(
        (key) => !['id', 'createdAt', 'scores'].includes(key),
      ) ||
      !id(round.id) ||
      rounds.has(round.id) ||
      !Number.isSafeInteger(round.createdAt) ||
      round.createdAt < 0 ||
      !object(round.scores) ||
      Object.entries(round.scores).some(
        ([key, value]) => !ids.has(key) || !Number.isSafeInteger(value),
      )
    )
      fail();
    rounds.add(round.id);
  }
  return doc;
}

export function validateScorePatch(patch) {
  const object = (value) =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
  if (
    !object(patch) ||
    Object.keys(patch).length !== 3 ||
    Object.keys(patch).some(
      (key) => !['settings', 'upsertRounds', 'deleteRoundIds'].includes(key),
    ) ||
    !object(patch.settings) ||
    'rounds' in patch.settings ||
    !Array.isArray(patch.upsertRounds) ||
    patch.upsertRounds.length > 100 ||
    !Array.isArray(patch.deleteRoundIds) ||
    patch.deleteRoundIds.length > 100 ||
    patch.deleteRoundIds.some(
      (id) => typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id),
    ) ||
    new Set(patch.deleteRoundIds).size !== patch.deleteRoundIds.length
  )
    throw Error('invalid-input');
  validateScoreDocument({ ...patch.settings, rounds: patch.upsertRounds });
  if (
    patch.upsertRounds.some((round) => patch.deleteRoundIds.includes(round.id))
  )
    throw Error('invalid-input');
  return patch;
}
