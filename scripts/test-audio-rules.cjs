/* global __dirname */
// Local emulators only. Install tools with the command in docs/audio-library.md.
const { createRequire } = require('node:module');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const tool = createRequire(resolve(__dirname, '../.build/tools/package.json'));
const { initializeTestEnvironment, assertFails, assertSucceeds } = tool(
  '@firebase/rules-unit-testing',
);
const { doc, setDoc, getDoc, deleteDoc } = tool('firebase/firestore');
const { ref, uploadBytes, getBytes } = tool('firebase/storage');

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
      'PASS: 38 owner-isolation, finance-data, finance-preference and audio rules assertions',
    );
  } finally {
    await env.cleanup();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
