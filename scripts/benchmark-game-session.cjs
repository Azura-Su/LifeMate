// Deterministic controller benchmark. No network or production data is used.
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
// Pass an older gameSession.ts path to measure the baseline under the same clock.
const source =
  process.argv[2] ||
  require.resolve('../src/services/cardGames/gameSession.ts');
let now = 0,
  id = 0;
const timers = new Map();
const setTimer = (fn, ms) => {
  const key = ++id;
  timers.set(key, { at: now + ms, fn });
  return key;
};
const context = {
  exports: {},
  AbortController,
  setTimeout: setTimer,
  clearTimeout: (key) => timers.delete(key),
};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync(source, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  context,
);
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
const advance = async (ms) => {
  const target = now + ms;
  while (true) {
    const next = [...timers]
      .filter(([, t]) => t.at <= target)
      .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
    if (!next) break;
    now = next[1].at;
    timers.delete(next[0]);
    next[1].fn();
    await flush();
  }
  now = target;
  await flush();
};
const snapshot = (version) => ({
  serverTime: version,
  room: {
    id: 'fixture',
    epoch: 'fixture',
    code: 'ABCDEFGH',
    topic: 'fixture',
    version,
    matchId: null,
    phase: 'lobby',
    host: 'a',
    controller: true,
    members: [],
    game: null,
  },
});
(async () => {
  let version = 1,
    actionableAt;
  const seen = new Map();
  let requests = 0;
  const session = context.exports.createGameSession({
    sessionId: 'fixture',
    uuid: () => 'fixture',
    subscribe: () => () => {},
    request: async () => {
      requests++;
      const result = snapshot(version);
      await new Promise((resolve) => setTimer(resolve, 200));
      return result;
    },
    onChange: (state) => {
      if (state.snapshot && !state.loading) {
        actionableAt ??= now;
        if (!seen.has(state.snapshot.room.version))
          seen.set(state.snapshot.room.version, now);
      }
    },
  });
  session.start();
  await advance(6000);
  if (actionableAt === undefined)
    throw new Error('Room did not become actionable');
  const delays = [];
  // Vary event timing in 150ms steps across 20 samples.
  for (let i = 0; i < 20; i++) {
    await advance(5000 + i * 150);
    version++;
    const changedAt = now;
    while (!seen.has(version) && now - changedAt < 10000) await advance(10);
    if (!seen.has(version))
      throw new Error('Snapshot update exceeded 10 seconds');
    delays.push(seen.get(version) - changedAt);
  }
  session.stop();
  const sorted = [...delays].sort((a, b) => a - b);
  process.stdout.write(
    JSON.stringify({
      transport: 'fixed 200ms HTTP, Realtime unavailable',
      startupMs: actionableAt,
      samples: delays.length,
      delaysMs: delays,
      medianMs:
        (sorted[Math.floor((sorted.length - 1) / 2)] +
          sorted[Math.floor(sorted.length / 2)]) /
        2,
      p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
      maxMs: sorted.at(-1),
      requests,
      timersAfterStop: timers.size,
    }) + '\n',
  );
})();
