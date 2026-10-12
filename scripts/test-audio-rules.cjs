/* global __dirname */
// Local emulators only. Install tools with the command in docs/audio-library.md.
const { createRequire } = require('node:module');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { deepStrictEqual, strictEqual } = require('node:assert');
const tool = createRequire(resolve(__dirname, '../.build/tools/package.json'));
const {
  initializeTestEnvironment,
  assertFails: expectDenied,
  assertSucceeds: expectAllowed,
} = tool('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, deleteDoc, writeBatch } =
  tool('firebase/firestore');
const { ref, uploadBytes, getBytes } = tool('firebase/storage');
let assertionCount = 0;
async function assertSucceeds(operation) {
  const result = await expectAllowed(operation);
  assertionCount++;
  return result;
}
async function assertFails(operation) {
  const result = await expectDenied(operation);
  assertionCount++;
  return result;
}

(async () => {
  const env = await initializeTestEnvironment({
    projectId: 'demo-lifemate-audio',
    firestore: {
      host: '127.0.0.1',
      port: 8180,
      rules: readFileSync(
        resolve(__dirname, '../firebase/firestore.rules'),
        'utf8',
      ),
    },
    storage: {
      host: '127.0.0.1',
      port: 9299,
      rules: readFileSync(
        resolve(__dirname, '../firebase/storage.rules'),
        'utf8',
      ),
    },
  });
  try {
    await env.clearFirestore();
    const owner = env.authenticatedContext('u1');
    const other = env.authenticatedContext('u2');
    const guest = env.unauthenticatedContext();
    const path = 'audioLibraries/u1/tracks/t1';
    const data = {
      id: 't1',
      ownerId: 'u1',
      title: 'Audio',
      fileName: 't1.mp3',
      mimeType: 'audio/mpeg',
      durationMs: 2000,
      sizeBytes: 3,
      createdAt: Date.now(),
      source: 'audio',
    };
    await assertSucceeds(setDoc(doc(owner.firestore(), path), data));
    await assertSucceeds(
      setDoc(doc(owner.firestore(), path), {
        ...data,
        storageProvider: 'supabase',
      }),
    );
    await assertFails(
      setDoc(doc(owner.firestore(), path), {
        ...data,
        storageProvider: 'public',
      }),
    );
    await assertFails(
      setDoc(doc(owner.firestore(), path), {
        ...data,
        storageProvider: 'supabase',
        sizeBytes: 52428801,
      }),
    );
    await assertSucceeds(getDoc(doc(owner.firestore(), path)));
    await assertFails(getDoc(doc(other.firestore(), path)));
    await assertFails(getDoc(doc(guest.firestore(), path)));
    await assertFails(setDoc(doc(other.firestore(), path), data));
    await assertFails(
      setDoc(doc(owner.firestore(), path), { ...data, ownerId: 'u2' }),
    );
    await assertFails(
      setDoc(doc(owner.firestore(), path), {
        ...data,
        localUri: 'file:///secret',
      }),
    );
    await assertFails(
      setDoc(doc(owner.firestore(), path), { ...data, durationMs: -1 }),
    );
    const financePath = 'financeAccounts/u1/transactions/salary-1';
    const finance = {
      id: 'salary-1',
      ownerId: 'u1',
      type: 'income',
      amount: 25000000,
      category: 'Lương',
      note: 'Tháng 10',
      createdAt: Date.now(),
    };
    await assertSucceeds(setDoc(doc(owner.firestore(), financePath), finance));
    await assertSucceeds(getDoc(doc(owner.firestore(), financePath)));
    await assertFails(getDoc(doc(other.firestore(), financePath)));
    await assertFails(getDoc(doc(guest.firestore(), financePath)));
    await assertFails(setDoc(doc(other.firestore(), financePath), finance));
    await assertFails(
      setDoc(doc(owner.firestore(), financePath), {
        ...finance,
        ownerId: 'u2',
      }),
    );
    await assertFails(
      setDoc(doc(owner.firestore(), financePath), {
        ...finance,
        localUri: 'file:///private',
      }),
    );
    await assertFails(
      setDoc(doc(owner.firestore(), financePath), { ...finance, amount: -1 }),
    );
    await assertFails(
      setDoc(doc(owner.firestore(), financePath), {
        ...finance,
        type: 'transfer',
      }),
    );
    await assertFails(
      setDoc(doc(owner.firestore(), financePath), {
        ...finance,
        createdAt: 'yesterday',
      }),
    );
    // Income may carry its source; expenses never may.
    await assertSucceeds(
      setDoc(doc(owner.firestore(), financePath), {
        ...finance,
        incomeSource: 'other',
      }),
    );
    await assertFails(
      setDoc(doc(owner.firestore(), financePath), {
        ...finance,
        incomeSource: 'salary',
      }),
    );
    await assertFails(
      setDoc(doc(owner.firestore(), financePath), {
        ...finance,
        type: 'expense',
        category: 'Ăn uống',
        incomeSource: 'company',
      }),
    );
    await assertSucceeds(deleteDoc(doc(owner.firestore(), financePath)));
    const preferencesPath = 'financeAccounts/u1/settings/preferences';
    const preferences = {
      incomeCategories: ['Lương', 'Làm thêm'],
      expenseCategories: ['Ăn uống', 'Thú cưng'],
      templates: [
        {
          id: 'pet-food',
          name: 'Thức ăn cho mèo',
          type: 'expense',
          amount: 80000,
          category: 'Thú cưng',
          note: 'Hạt cho mèo',
        },
      ],
    };
    await assertSucceeds(
      setDoc(doc(owner.firestore(), preferencesPath), preferences),
    );
    await assertSucceeds(
      setDoc(doc(owner.firestore(), preferencesPath), {
        ...preferences,
        expenseCategories: ['Ăn uống', 'Thú cưng', 'Học tập'],
      }),
    );
    await assertSucceeds(getDoc(doc(owner.firestore(), preferencesPath)));
    await assertFails(getDoc(doc(other.firestore(), preferencesPath)));
    await assertFails(getDoc(doc(guest.firestore(), preferencesPath)));
    await assertFails(
      setDoc(doc(other.firestore(), preferencesPath), preferences),
    );
    await assertFails(
      setDoc(doc(owner.firestore(), preferencesPath), {
        ...preferences,
        localOnly: true,
      }),
    );
    await assertFails(
      setDoc(doc(owner.firestore(), preferencesPath), {
        ...preferences,
        incomeCategories: Array.from({ length: 31 }, (_, index) => `C${index}`),
      }),
    );
    await assertFails(deleteDoc(doc(owner.firestore(), preferencesPath)));

    // A loan and its financial entries must stay linked in the same atomic
    // write. In particular, the first repayment starts from an empty list.
    const loanPath = (id) => `financeAccounts/u1/loans/${id}`;
    const transactionPath = (id) => `financeAccounts/u1/transactions/${id}`;
    const loan = {
      id: 'loan-rules-test',
      ownerId: 'u1',
      borrowerName: 'Người mượn',
      principalAmount: 1000,
      lentAt: 1791766800000,
      dueAt: null,
      remindOnDueDate: false,
      note: '',
      repayments: [],
      cancelledAt: null,
      updatedAt: 1791766800000,
    };
    const lendingExpense = (record) => ({
      id: `loan-lent-${record.id}`,
      ownerId: record.ownerId,
      type: 'expense',
      amount: record.principalAmount,
      category: 'Cho mượn',
      expenseSource: 'loan_lending',
      loanId: record.id,
      note: record.borrowerName,
      createdAt: record.lentAt,
    });
    const repayment = (loanId, id, amount, receivedAt) => ({
      id,
      amount,
      receivedAt,
      financeTransactionId: `loan-${loanId}-${id}`,
      status: 'posted',
    });
    const repaymentIncome = (record, payment) => ({
      id: payment.financeTransactionId,
      ownerId: record.ownerId,
      type: 'income',
      amount: payment.amount,
      category: 'Thu hồi cho mượn',
      incomeSource: 'loan_repayment',
      loanId: record.id,
      repaymentId: payment.id,
      repaymentReceivedAt: payment.receivedAt,
      note: record.borrowerName,
      createdAt: payment.receivedAt,
    });
    const batchLoanWithTransaction = (db, record, transaction) => {
      const batch = writeBatch(db);
      batch.set(doc(db, loanPath(record.id)), record);
      batch.set(doc(db, transactionPath(transaction.id)), transaction);
      return batch.commit();
    };
    const ownerDb = owner.firestore();
    await assertFails(setDoc(doc(ownerDb, loanPath(loan.id)), loan));
    await assertFails(
      setDoc(
        doc(ownerDb, transactionPath(lendingExpense(loan).id)),
        lendingExpense(loan),
      ),
    );
    await assertSucceeds(
      batchLoanWithTransaction(ownerDb, loan, lendingExpense(loan)),
    );
    await assertFails(getDoc(doc(other.firestore(), loanPath(loan.id))));
    await assertFails(getDoc(doc(guest.firestore(), loanPath(loan.id))));
    await assertFails(
      setDoc(doc(other.firestore(), loanPath(loan.id)), {
        ...loan,
        note: 'Không phải chủ tài khoản',
      }),
    );

    const firstPayment = repayment(loan.id, 'first', 200, loan.lentAt + 1);
    const afterFirstPayment = {
      ...loan,
      repayments: [firstPayment],
      updatedAt: loan.updatedAt + 1,
    };
    await assertSucceeds(
      batchLoanWithTransaction(
        ownerDb,
        afterFirstPayment,
        repaymentIncome(loan, firstPayment),
      ),
    );
    const firstSnapshot = await assertSucceeds(
      getDoc(doc(ownerDb, loanPath(loan.id))),
    );
    deepStrictEqual(firstSnapshot.data().repayments, [firstPayment]);

    const secondPayment = repayment(loan.id, 'second', 300, loan.lentAt + 2);
    const afterSecondPayment = {
      ...loan,
      repayments: [firstPayment, secondPayment],
      updatedAt: loan.updatedAt + 2,
    };
    await assertSucceeds(
      batchLoanWithTransaction(
        ownerDb,
        afterSecondPayment,
        repaymentIncome(loan, secondPayment),
      ),
    );
    const secondSnapshot = await assertSucceeds(
      getDoc(doc(ownerDb, loanPath(loan.id))),
    );
    deepStrictEqual(secondSnapshot.data().repayments, [
      firstPayment,
      secondPayment,
    ]);

    const thirdPayment = repayment(loan.id, 'third', 100, loan.lentAt + 3);
    const afterThirdPayment = {
      ...loan,
      repayments: [firstPayment, secondPayment, thirdPayment],
      updatedAt: loan.updatedAt + 3,
    };
    // An append without its income document cannot be committed.
    await assertFails(
      setDoc(doc(ownerDb, loanPath(loan.id)), afterThirdPayment),
    );
    // Even a valid linked income cannot authorize rewriting earlier history.
    await assertFails(
      batchLoanWithTransaction(
        ownerDb,
        {
          ...afterThirdPayment,
          repayments: [
            { ...firstPayment, amount: 201 },
            secondPayment,
            thirdPayment,
          ],
        },
        repaymentIncome(loan, thirdPayment),
      ),
    );
    await assertFails(
      setDoc(doc(ownerDb, loanPath(loan.id)), {
        ...afterSecondPayment,
        repayments: [],
        updatedAt: loan.updatedAt + 4,
      }),
    );
    await assertFails(
      batchLoanWithTransaction(
        other.firestore(),
        afterThirdPayment,
        repaymentIncome(loan, thirdPayment),
      ),
    );
    const preservedSnapshot = await assertSucceeds(
      getDoc(doc(ownerDb, loanPath(loan.id))),
    );
    deepStrictEqual(preservedSnapshot.data(), afterSecondPayment);
    const rejectedIncome = await assertSucceeds(
      getDoc(doc(ownerDb, transactionPath(thirdPayment.financeTransactionId))),
    );
    strictEqual(rejectedIncome.exists(), false);

    // Older app versions could persist one pending repayment before creating
    // its financial entry. Finalizing that single item must not slice [0:0].
    const legacyLoan = { ...loan, id: 'loan-legacy-pending' };
    const legacyPayment = repayment(
      legacyLoan.id,
      'pending-first',
      250,
      loan.lentAt + 1,
    );
    const legacyPendingLoan = {
      ...legacyLoan,
      repayments: [{ ...legacyPayment, status: 'pending' }],
    };
    await env.withSecurityRulesDisabled(async (context) => {
      await batchLoanWithTransaction(
        context.firestore(),
        legacyPendingLoan,
        lendingExpense(legacyLoan),
      );
    });
    const finalizedLoan = {
      ...legacyLoan,
      repayments: [legacyPayment],
      updatedAt: loan.updatedAt + 1,
    };
    await assertSucceeds(
      batchLoanWithTransaction(
        ownerDb,
        finalizedLoan,
        repaymentIncome(legacyLoan, legacyPayment),
      ),
    );
    const finalizedSnapshot = await assertSucceeds(
      getDoc(doc(ownerDb, loanPath(legacyLoan.id))),
    );
    deepStrictEqual(finalizedSnapshot.data(), finalizedLoan);
    const legacyIncome = await assertSucceeds(
      getDoc(doc(ownerDb, transactionPath(legacyPayment.financeTransactionId))),
    );
    deepStrictEqual(
      legacyIncome.data(),
      repaymentIncome(legacyLoan, legacyPayment),
    );

    const object = 'audio/u1/t1/t1.mp3';
    const bytes = new Uint8Array([1, 2, 3]);
    const metadata = {
      contentType: 'audio/mpeg',
      customMetadata: { ownerId: 'u1' },
    };
    await assertSucceeds(
      uploadBytes(ref(owner.storage(), object), bytes, metadata),
    );
    await assertSucceeds(getBytes(ref(owner.storage(), object)));
    await assertFails(getBytes(ref(other.storage(), object)));
    await assertFails(getBytes(ref(guest.storage(), object)));
    await assertFails(
      uploadBytes(ref(other.storage(), object), bytes, metadata),
    );
    await assertFails(
      uploadBytes(ref(owner.storage(), object), bytes, {
        ...metadata,
        contentType: 'video/mp4',
      }),
    );
    await assertFails(
      uploadBytes(ref(owner.storage(), 'audio/u1/t1/t1.mp4'), bytes, metadata),
    );
    console.log(
      `PASS: ${assertionCount} owner-isolation, finance-data, loan-repayment, finance-preference and audio rules assertions`,
    );
  } finally {
    await env.cleanup();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
