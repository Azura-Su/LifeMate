const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');

const rules = fs.readFileSync(
  `${process.cwd()}/firebase/firestore.rules`,
  'utf8',
);
const projectId = `demo-lifemate-rules-${process.pid}`;

function heldRecord() {
  return {
    id: 'fund-1',
    ownerId: 'u1',
    senderName: 'Bác Trà',
    purpose: 'Điện nước',
    createdAt: 100,
    updatedAt: 100,
    remainingAmount: 100,
    entryIds: ['received-1'],
    entries: [
      {
        id: 'received-1',
        kind: 'received',
        amount: 100,
        occurredAt: 100,
        note: '',
      },
    ],
  };
}

function audioRecord() {
  return {
    id: 'audio-1',
    ownerId: 'u1',
    title: 'Bài hát',
    fileName: 'audio-1.mp3',
    mimeType: 'audio/mpeg',
    durationMs: 1000,
    sizeBytes: 1000,
    createdAt: 100,
    source: 'audio',
    storageProvider: 'supabase',
  };
}

function loanRecord() {
  return {
    id: 'loan-1',
    ownerId: 'u1',
    borrowerName: 'Thảo',
    principalAmount: 100,
    lentAt: 100,
    dueAt: null,
    remindOnDueDate: false,
    note: '',
    repayments: [],
    cancelledAt: null,
    updatedAt: 100,
  };
}

function loanExpense() {
  return {
    id: 'loan-lent-loan-1',
    ownerId: 'u1',
    type: 'expense',
    amount: 100,
    category: 'Cho mượn',
    note: '',
    createdAt: 100,
    expenseSource: 'loan_lending',
    loanId: 'loan-1',
  };
}

async function main() {
  const environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules, host: '127.0.0.1', port: 8080 },
  });
  try {
    const owner = environment.authenticatedContext('u1').firestore();
    const outsider = environment.authenticatedContext('u2').firestore();
    await require('./pets.rules.cjs')(environment);
    // Every persisted namespace must keep reads scoped to its UID path.
    const isolationPaths = [
      'audioLibraries/u1/tracks/isolation-probe',
      'financeAccounts/u1/transactions/isolation-probe',
      'financeAccounts/u1/settings/preferences',
      'financeAccounts/u1/loans/isolation-probe',
      'financeAccounts/u1/heldFunds/isolation-probe',
      'financeAccounts/u1/deletedLoans/isolation-probe',
      'financeAccounts/u1/deletedLoanRepayments/isolation-probe',
      'noteAccounts/u1/notes/isolation-probe',
      'noteAccounts/u1/deletedNotes/isolation-probe',
      'agendaAccounts/u1/items/isolation-probe',
      'agendaAccounts/u1/deletedItems/isolation-probe',
      'memoryAccounts/u1/items/isolation-probe',
    ];
    await environment.withSecurityRulesDisabled(async (context) => {
      for (const path of isolationPaths)
        await context.firestore().doc(path).set({ ownerId: 'u1' });
    });
    const unauthenticated = environment.unauthenticatedContext().firestore();
    for (const path of isolationPaths) {
      await assertSucceeds(owner.doc(path).get());
      await assertFails(outsider.doc(path).get());
      await assertFails(unauthenticated.doc(path).get());
    }
    await environment.withSecurityRulesDisabled(async (context) => {
      for (const path of isolationPaths)
        await context.firestore().doc(path).delete();
    });

    const privateMemory = owner.doc('memoryAccounts/u1/items/memory-1');
    const privateMemoryData = {
      id: 'memory-1',
      ownerId: 'u1',
      revision: 'first',
      deleted: false,
      dateKey: '2026-10-16',
      text: 'Private memory',
      photoFileName: 'photo.jpg',
      photoSizeBytes: 3,
      visibility: 'private',
      createdAt: 100,
      updatedAt: 100,
    };
    // Email verification is not required for one's private backup.
    await assertSucceeds(privateMemory.set(privateMemoryData));
    await assertSucceeds(privateMemory.get());
    await assertFails(outsider.doc(privateMemory.path).get());
    await assertFails(outsider.doc(privateMemory.path).set(privateMemoryData));
    await assertFails(
      unauthenticated.doc(privateMemory.path).set(privateMemoryData),
    );
    await assertFails(privateMemory.update({ ownerId: 'u2' }));
    await assertFails(privateMemory.update({ photoSizeBytes: 15728641 }));
    await assertFails(privateMemory.update({ photoFileName: '../other.jpg' }));
    await assertFails(privateMemory.delete());
    await assertSucceeds(
      privateMemory.set({
        id: 'memory-1',
        ownerId: 'u1',
        revision: 'deleted',
        deleted: true,
        updatedAt: 200,
      }),
    );
    await assertSucceeds(privateMemory.get());
    const fund = owner.doc('financeAccounts/u1/heldFunds/fund-1');
    const audio = owner.doc('audioLibraries/u1/tracks/audio-1');
    const base = heldRecord();
    await assertSucceeds(fund.set(base));
    await assertFails(outsider.doc(fund.path).get());

    const paid = {
      id: 'paid-1',
      kind: 'paid',
      amount: 40,
      occurredAt: 101,
      note: '',
    };
    await assertSucceeds(
      fund.set({
        ...base,
        updatedAt: 101,
        entries: [...base.entries, paid],
        entryIds: [...base.entryIds, paid.id],
        remainingAmount: 60,
      }),
    );
    await assertSucceeds(
      fund.update({ senderName: 'Bác Trà mới', updatedAt: 102 }),
    );
    await assertFails(
      fund.set({
        ...base,
        updatedAt: 103,
        entries: [...base.entries, paid],
        entryIds: [...base.entryIds, paid.id],
        remainingAmount: 100,
      }),
    );
    await assertSucceeds(
      fund.set({
        ...base,
        senderName: 'Bác Trà mới',
        updatedAt: 103,
        entries: [...base.entries, { ...paid, amount: 140 }],
        entryIds: [...base.entryIds, paid.id],
        remainingAmount: -40,
      }),
    );
    await assertFails(
      fund.set({
        ...base,
        senderName: 'Bác Trà mới',
        updatedAt: 104,
        entries: [...base.entries, { ...paid, id: 'received-1' }],
        entryIds: ['received-1', 'received-1'],
        remainingAmount: 60,
      }),
    );

    const legacy = owner.doc('financeAccounts/u1/heldFunds/legacy');
    const legacyRecord = { ...base, id: 'legacy' };
    delete legacyRecord.remainingAmount;
    delete legacyRecord.entryIds;
    await environment.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(legacy.path).set(legacyRecord);
    });
    await assertSucceeds(
      legacy.set({
        ...legacyRecord,
        remainingAmount: 100,
        entryIds: ['received-1'],
      }),
    );
    await assertSucceeds(
      legacy.update({ senderName: 'Tên mới', updatedAt: 101 }),
    );
    await assertFails(
      legacy.set({
        ...legacyRecord,
        senderName: 'Khác',
        remainingAmount: 100,
        entryIds: ['received-1'],
      }),
    );

    const loan = owner.doc('financeAccounts/u1/loans/loan-1');
    const expense = owner.doc(
      'financeAccounts/u1/transactions/loan-lent-loan-1',
    );
    await assertFails(loan.set(loanRecord()));
    const createLoan = owner.batch();
    createLoan.set(loan, loanRecord());
    createLoan.set(expense, loanExpense());
    await assertSucceeds(createLoan.commit());
    await assertFails(outsider.doc(loan.path).get());
    const repayment = {
      id: 'receipt-1',
      amount: 40,
      receivedAt: 101,
      financeTransactionId: 'loan-loan-1-receipt-1',
      status: 'posted',
    };
    const receipt = owner.doc(
      'financeAccounts/u1/transactions/loan-loan-1-receipt-1',
    );
    const postRepayment = owner.batch();
    postRepayment.update(loan, {
      repayments: [repayment],
      recordedRepaymentAmount: 40,
      updatedAt: 101,
    });
    postRepayment.set(receipt, {
      id: repayment.financeTransactionId,
      ownerId: 'u1',
      type: 'income',
      amount: 40,
      category: 'Thu hồi cho mượn',
      note: '',
      createdAt: 101,
      incomeSource: 'loan_repayment',
      loanId: 'loan-1',
      repaymentId: repayment.id,
      repaymentReceivedAt: repayment.receivedAt,
    });
    await assertSucceeds(postRepayment.commit());

    // Whole-loan deletion removes both directions and prevents stale receipt replay.
    await assertFails(expense.delete());
    await assertFails(receipt.delete());
    const tombstone = owner.doc('financeAccounts/u1/deletedLoans/loan-1');
    const incomeData = (await receipt.get()).data();
    const deleteLoan = owner.batch();
    deleteLoan.set(tombstone, {
      id: 'loan-1',
      ownerId: 'u1',
      deleted: true,
      updatedAt: 103,
      repayments: [repayment],
    });
    deleteLoan.delete(loan);
    deleteLoan.delete(expense);
    deleteLoan.delete(receipt);
    await assertSucceeds(deleteLoan.commit());
    assert.equal((await expense.get()).exists, false);
    assert.equal((await receipt.get()).exists, false);
    await assertFails(receipt.set(incomeData));
    // Historical rows retained by older clients can be explicitly cleaned up.
    await environment.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(expense.path).set(loanExpense());
      await context.firestore().doc(receipt.path).set(incomeData);
    });
    await assertFails(outsider.doc(receipt.path).delete());
    const cleanup = owner.batch();
    cleanup.delete(expense);
    cleanup.delete(receipt);
    await assertSucceeds(cleanup.commit());

    // The maximum supported history must stay within rule access-call limits.
    const largeId = 'large-loan';
    const largeLoan = {
      ...loanRecord(),
      id: largeId,
      principalAmount: 10000,
      repayments: Array.from({ length: 100 }, (_, index) => ({
        id: `r${index}`,
        amount: 1,
        receivedAt: 101,
        financeTransactionId: `loan-${largeId}-r${index}`,
        status: 'posted',
      })),
      advances: Array.from({ length: 50 }, (_, index) => ({
        id: `a${index}`,
        amount: 1,
        lentAt: 100,
        financeTransactionId: `loan-lent-${largeId}-a${index}`,
      })),
      additionalAmount: 50,
    };
    const largeLoanRef = owner.doc(`financeAccounts/u1/loans/${largeId}`);
    const largeRows = [
      {
        ...loanExpense(),
        id: `loan-lent-${largeId}`,
        loanId: largeId,
        amount: 10000,
      },
      ...largeLoan.repayments.map((item) => ({
        ...incomeData,
        id: item.financeTransactionId,
        loanId: largeId,
        repaymentId: item.id,
        amount: 1,
      })),
      ...largeLoan.advances.map((item) => ({
        ...loanExpense(),
        id: item.financeTransactionId,
        loanId: largeId,
        advanceId: item.id,
        amount: 1,
      })),
    ];
    await environment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const seed = db.batch();
      seed.set(db.doc(largeLoanRef.path), largeLoan);
      for (const row of largeRows)
        seed.set(db.doc(`financeAccounts/u1/transactions/${row.id}`), row);
      await seed.commit();
    });
    const removeLargeLoan = owner.batch();
    removeLargeLoan.set(
      owner.doc(`financeAccounts/u1/deletedLoans/${largeId}`),
      {
        id: largeId,
        ownerId: 'u1',
        deleted: true,
        updatedAt: 104,
        repayments: largeLoan.repayments,
        advances: largeLoan.advances,
        additionalAmount: 50,
      },
    );
    removeLargeLoan.delete(largeLoanRef);
    for (const row of largeRows)
      removeLargeLoan.delete(
        owner.doc(`financeAccounts/u1/transactions/${row.id}`),
      );
    await assertSucceeds(removeLargeLoan.commit());

    const sharedExpense = owner.doc(
      'financeAccounts/u1/transactions/shared-meal',
    );
    const sharedMeal = {
      id: 'shared-meal',
      ownerId: 'u1',
      type: 'expense',
      amount: 500,
      category: 'Ăn uống',
      note: 'Ăn chung',
      createdAt: 100,
      sharedExpense: {
        participants: [{ id: 'an', name: 'An', owedAmount: 300 }],
        receipts: [],
      },
    };
    await assertSucceeds(sharedExpense.set(sharedMeal));
    await assertSucceeds(
      sharedExpense.update({
        sharedExpense: {
          ...sharedMeal.sharedExpense,
          receipts: [
            {
              id: 'paid-1',
              participantId: 'an',
              amount: 100,
              receivedAt: 101,
              note: '',
            },
          ],
        },
      }),
    );
    await assertFails(outsider.doc(sharedExpense.path).get());
    await assertFails(
      owner.doc('financeAccounts/u1/transactions/fake-income').set({
        ...sharedMeal,
        id: 'fake-income',
        type: 'income',
      }),
    );

    await assertSucceeds(audio.set(audioRecord()));
    await assertSucceeds(audio.update({ deletionPending: true }));
    await assertFails(audio.update({ deletionPending: false }));
    await assertFails(audio.update({ title: 'Đổi tên' }));
    await assertSucceeds(audio.delete());
    assert.equal((await audio.get()).exists, false);
    const access = owner.doc('accountAccess/u1');
    await assertFails(access.set({ status: 'active' }));
    for (const status of ['disabled', 'deleting', 'deleted']) {
      await environment.withSecurityRulesDisabled(async (context) => {
        await context
          .firestore()
          .doc('accountAccess/u1')
          .set({ status, validSince: 0 });
      });
      await assertSucceeds(access.get());
      await assertFails(outsider.doc('accountAccess/u1').get());
      await assertFails(owner.collection('accountAccess').get());
      await assertFails(fund.get());
      await assertFails(privateMemory.get());
      await assertFails(audio.set(audioRecord()));
    }
    await environment.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .doc('accountAccess/u1')
        .set({ status: 'active', validSince: 0 });
    });
    await assertSucceeds(fund.get());
    await environment.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .doc('accountAccess/u1')
        .set({ status: 'active', validSince: 100 });
    });
    const revoked = environment
      .authenticatedContext('u1', { auth_time: 99 })
      .firestore();
    const fresh = environment
      .authenticatedContext('u1', { auth_time: 100 })
      .firestore();
    await assertFails(revoked.doc(fund.path).get());
    await assertFails(revoked.doc(privateMemory.path).get());
    await assertSucceeds(fresh.doc(privateMemory.path).get());
    await assertSucceeds(fresh.doc(fund.path).get());
    process.stdout.write(
      'Firestore rules: all UID namespace reads isolated; held funds, loans, shared expenses, and audio deletion passed.\n',
    );
  } finally {
    await environment.cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
