type FirestoreRow = {
  path: string;
  uid: string;
  id: string;
  value: Record<string, unknown>;
};
type FirestoreReference = { path: string; uid: string; id: string | null };

const records = new Map<string, FirestoreRow>();

function reference(parts: unknown[]): FirestoreReference {
  return {
    path: parts.slice(1).join('/'),
    uid: String(parts[2]),
    id: typeof parts[4] === 'string' ? parts[4] : null,
  };
}

function saveRecord(ref: FirestoreReference, value: Record<string, unknown>) {
  if (!ref.id) throw new Error('Document reference requires an id.');
  records.set(ref.path, {
    path: ref.path,
    uid: ref.uid,
    id: ref.id,
    value,
  });
}

export function resetFirestoreMock() {
  records.clear();
}

export function seedFirestoreMock(uid: string, value: Record<string, unknown>) {
  records.set(`financeAccounts/${uid}/transactions/${String(value.id)}`, {
    path: `financeAccounts/${uid}/transactions/${String(value.id)}`,
    uid,
    id: String(value.id),
    value,
  });
}

export function seedFinancePreferencesMock(
  uid: string,
  value: Record<string, unknown>,
) {
  records.set(`financeAccounts/${uid}/settings/preferences`, {
    path: `financeAccounts/${uid}/settings/preferences`,
    uid,
    id: 'preferences',
    value,
  });
}

export function getFirestoreMockRows(uid: string) {
  return [...records.values()]
    .filter(
      (entry) =>
        entry.uid === uid &&
        entry.path.startsWith(`financeAccounts/${uid}/transactions/`),
    )
    .map((entry) => entry.value);
}

export const getFirestore = jest.fn(() => 'firestore');
export const collection = jest.fn((...parts: unknown[]) => reference(parts));
export const doc = jest.fn((...parts: unknown[]) => reference(parts));
export const getDocsFromServer = jest.fn(
  async (collectionRef: FirestoreReference) => ({
    docs: [...records.values()]
      .filter((entry) => {
        const prefix = `${collectionRef.path}/`;
        return (
          entry.uid === collectionRef.uid &&
          entry.path.startsWith(prefix) &&
          !entry.path.slice(prefix.length).includes('/')
        );
      })
      .map((entry) => ({ id: entry.id, data: () => entry.value })),
  }),
);
export const getDocFromServer = jest.fn(
  async (reference: FirestoreReference) => {
    const record = records.get(reference.path);
    return {
      exists: () => !!record,
      data: () => record?.value,
    };
  },
);
export const setDoc = jest.fn(
  async (ref: FirestoreReference, value: Record<string, unknown>) => {
    saveRecord(ref, value);
  },
);
type TransactionLike = {
  get: (ref: FirestoreReference) => Promise<{
    exists: () => boolean;
    data: () => Record<string, unknown> | undefined;
  }>;
  set: (
    ref: FirestoreReference,
    value: Record<string, unknown>,
  ) => TransactionLike;
};
export const runTransaction = jest.fn(
  async (
    _firestore: unknown,
    updateFunction: (transaction: TransactionLike) => unknown,
  ) => {
    const writes: {
      ref: FirestoreReference;
      value: Record<string, unknown>;
    }[] = [];
    const transaction: TransactionLike = {
      get: getDocFromServer,
      set: (ref, value) => {
        writes.push({ ref, value });
        return transaction;
      },
    };
    const result = await updateFunction(transaction);
    for (const { ref, value } of writes) await setDoc(ref, value);
    return result;
  },
);
export const updateDoc = jest.fn(
  async (ref: FirestoreReference, value: Record<string, unknown>) => {
    if (!records.has(ref.path))
      throw Object.assign(new Error('Not found'), { code: 'not-found' });
    saveRecord(ref, value);
  },
);
export const deleteDoc = jest.fn(async (ref: FirestoreReference) => {
  records.delete(ref.path);
});
export const writeBatch = jest.fn(() => {
  const pending: { ref: FirestoreReference; value: Record<string, unknown> }[] =
    [];
  return {
    set: (ref: FirestoreReference, value: Record<string, unknown>) => {
      pending.push({ ref, value });
    },
    commit: async () => {
      pending.forEach(({ ref, value }) => saveRecord(ref, value));
    },
  };
});
