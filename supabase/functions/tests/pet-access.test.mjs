import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyTransaction,
  summarizeTransactions,
} from '../pet-access/financeAdapter.mjs';
import { levelForExp, progressFor } from '../pet-access/expConfig.mjs';
import { createPetHandler } from '../pet-access/handler.mjs';

const at = (iso) => Date.parse(iso);
const expense = (category, amount, createdAt, extra = {}) => ({
  type: 'expense',
  category,
  amount,
  createdAt,
  ...extra,
});
const range = { fromDay: '2026-10-01', toDay: '2026-10-28', offsetMinutes: 420 };

test('many transactions and bigger amounts still record a single day', () => {
  const day = at('2026-10-28T03:00:00Z');
  const small = summarizeTransactions([expense('Ăn uống', 20000, day)], range);
  const big = summarizeTransactions(
    Array.from({ length: 10 }, () => expense('Ăn uống', 2000000, day)),
    range,
  );
  assert.deepEqual(small.days, ['2026-10-28']);
  assert.deepEqual(big.days, small.days);
  assert.equal(big.todayEffects.eat, 3, 'daily care effects are capped');
});

test('loans, repayments and reimbursements never record or feed the pet', () => {
  const day = at('2026-10-28T03:00:00Z');
  for (const row of [
    expense('Cho vay', 500000, day, { expenseSource: 'loan_lending' }),
    { type: 'income', incomeSource: 'loan_repayment', category: 'x', createdAt: day },
    { type: 'income', incomeSource: 'expense_reimbursement', category: 'x', createdAt: day },
    expense('Ăn uống', 1, day, { sharedExpenseReceipt: { expenseId: 'e' } }),
  ])
    assert.equal(classifyTransaction(row), null);
  // A shared bill is one record, not one per participant.
  const shared = summarizeTransactions(
    [expense('Ăn uống', 900000, day, { sharedExpense: { participants: [{}, {}], receipts: [] } })],
    range,
  );
  assert.deepEqual(shared.todayEffects, { eat: 1 });
});

test('custom and unknown categories map to a neutral effect', () => {
  const row = expense('Quà tặng mẹ', 100000, at('2026-10-28T03:00:00Z'));
  assert.deepEqual(classifyTransaction(row), { recordsDay: true, effect: 'neutral' });
  assert.equal(classifyTransaction({ type: 'expense', category: 'x' }), null);
});

test('days use Vietnam time and ignore future or pre-adoption dates', () => {
  const rows = [
    expense('Khác', 1, at('2026-10-27T18:00:00Z')), // 01:00 on the 28th in VN
    expense('Khác', 1, at('2026-11-02T03:00:00Z')),
    expense('Khác', 1, at('2026-09-02T03:00:00Z')),
  ];
  assert.deepEqual(summarizeTransactions(rows, range).days, ['2026-10-28']);
});

test('levels, stages and skill tiers follow total EXP down as well as up', () => {
  assert.equal(levelForExp(0), 1);
  assert.equal(levelForExp(-50), 1);
  assert.deepEqual(
    [29, 30, 150, 1000, 99999].map((exp) => levelForExp(exp)),
    [1, 2, 4, 10, 10],
  );
  assert.equal(progressFor(630).stage, 'ascended');
  assert.equal(progressFor(629).stage, 'juvenile');
  assert.equal(progressFor(240).skillTier, 1);
  assert.equal(progressFor(239).skillTier, 0);
});

function handler(rpc, rows = []) {
  return createPetHandler({
    verifyIdentity: async (token) => {
      if (token !== 'ok') throw Error('bad');
      return { uid: 'u1', authTime: 1 };
    },
    rpc,
    listTransactions: async () => rows,
    now: () => at('2026-10-28T05:00:00Z'),
  });
}
const post = (body, token = 'ok') =>
  new Request('https://x/functions/v1/pet-access', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

test('client cannot send EXP, level or arbitrary fields', async () => {
  const calls = [];
  const run = handler(async (name, args) => (calls.push([name, args]), {}));
  for (const body of [
    { type: 'sync', exp: 100 },
    { type: 'care', actionId: '11111111-1111-4111-8111-111111111111', level: 9 },
    { type: 'roll' },
    { type: 'grant' },
  ])
    assert.equal((await run(post(body))).status, 400);
  assert.equal((await run(post({ type: 'state' }, 'bad'))).status, 401);
  assert.equal(calls.length, 0);
});

test('sync derives recorded days on the server and returns progression', async () => {
  const calls = [];
  const pet = { speciesId: 'phoenix', adoptedAt: at('2026-10-20T00:00:00Z'), totalExp: 85 };
  const run = handler(
    async (name, args) => {
      calls.push([name, args]);
      return { status: 'owned', pet };
    },
    [expense('Ăn uống', 5, at('2026-10-28T02:00:00Z')), expense('Khác', 5, at('2026-10-26T02:00:00Z'))],
  );
  const body = await (await run(post({ type: 'sync' }))).json();
  const reconcile = calls.find(([name]) => name === 'lifemate_pet_reconcile')[1];
  assert.deepEqual(reconcile.p_days, ['2026-10-26', '2026-10-28']);
  assert.equal(reconcile.p_rules.record_day, 10);
  assert.equal(body.pet.level, 3);
  assert.equal(body.pet.stage, 'hatchling');
  assert.deepEqual(body.todayEffects, { eat: 1 });
});

test('database errors map to stable codes', async () => {
  const run = handler(async () => {
    throw Error('all-reserved');
  });
  const response = await run(
    post({ type: 'roll', actionId: '11111111-1111-4111-8111-111111111111' }),
  );
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'all-reserved' });
});
