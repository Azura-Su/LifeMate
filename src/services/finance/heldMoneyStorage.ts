import {
  collection,
  doc,
  getDocsFromServer,
  getFirestore,
  runTransaction,
} from '@react-native-firebase/firestore';
import type { HeldMoneyEntry, HeldMoneyRecord } from '../../types/heldMoney';
import { getHeldMoneyTotals } from '../../types/heldMoney';
import {
  getEncryptedItem,
  setEncryptedItem,
} from '../security/encryptedLocalStorage';

const ID = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_ENTRIES = 200;
const MAX_AMOUNT = 1_000_000_000_000;
const MAX_DATE = 253402300799999;
const CLOUD_TIMEOUT_MS = 15000;
const queues = new Map<string, Promise<unknown>>();

export type HeldMoneyReadResult = {
  records: HeldMoneyRecord[];
  synced: boolean;
};

export class HeldMoneyConflictError extends Error {
  constructor() {
    super('Khoản đóng hộ đã thay đổi trên tài khoản. Tải lại rồi thử tiếp.');
  }
}

export function heldMoneyStorageKey(uid: string) {
  return `lifemate:held-money:v1:${encodeURIComponent(uid)}`;
}

export function newHeldMoneyId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function requireUid(uid: string) {
  if (!ID.test(uid))
    throw new Error('Không tìm thấy tài khoản đang đăng nhập.');
}

function withTimeout<T>(promise: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Chưa kết nối được sổ đóng hộ. Hãy thử lại.')),
      CLOUD_TIMEOUT_MS,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function enqueue<T>(uid: string, operation: () => Promise<T>): Promise<T> {
  const previous = queues.get(uid) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  queues.set(uid, next);
  void next
    .finally(() => {
      if (queues.get(uid) === next) queues.delete(uid);
    })
    .catch(() => undefined);
  return next;
}

function recordPath(uid: string, id: string) {
  return doc(getFirestore(), 'financeAccounts', uid, 'heldFunds', id);
}

function parseEntry(value: unknown): HeldMoneyEntry | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Partial<HeldMoneyEntry>;
  if (
    typeof row.id !== 'string' ||
    !ID.test(row.id) ||
    (row.kind !== 'received' &&
      row.kind !== 'paid' &&
      row.kind !== 'returned') ||
    !Number.isSafeInteger(row.amount) ||
    !row.amount ||
    row.amount < 1 ||
    row.amount > MAX_AMOUNT ||
    typeof row.occurredAt !== 'number' ||
    !Number.isFinite(row.occurredAt) ||
    row.occurredAt < 0 ||
    row.occurredAt > MAX_DATE ||
    typeof row.note !== 'string' ||
    row.note.length > 500
  )
    return null;
  return {
    id: row.id,
    kind: row.kind,
    amount: row.amount,
    occurredAt: row.occurredAt,
    note: row.note.trim(),
  };
}

export function parseHeldMoneyRecord(
  value: unknown,
  uid: string,
): HeldMoneyRecord | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Partial<HeldMoneyRecord>;
  if (
    typeof row.id !== 'string' ||
    !ID.test(row.id) ||
    row.ownerId !== uid ||
    typeof row.senderName !== 'string' ||
    !row.senderName.trim() ||
    row.senderName.length > 80 ||
    typeof row.purpose !== 'string' ||
    !row.purpose.trim() ||
    row.purpose.length > 120 ||
    typeof row.createdAt !== 'number' ||
    !Number.isFinite(row.createdAt) ||
    row.createdAt < 0 ||
    row.createdAt > MAX_DATE ||
    typeof row.updatedAt !== 'number' ||
    !Number.isFinite(row.updatedAt) ||
    row.updatedAt < row.createdAt ||
    row.updatedAt > MAX_DATE ||
    !Array.isArray(row.entries) ||
    row.entries.length > MAX_ENTRIES
  )
    return null;
  const entries = row.entries.map(parseEntry);
  if (
    entries.some((entry) => !entry) ||
    new Set(entries.map((entry) => entry?.id)).size !== entries.length
  )
    return null;
  const record: HeldMoneyRecord = {
    id: row.id,
    ownerId: uid,
    senderName: row.senderName.trim(),
    purpose: row.purpose.trim(),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    entries: entries as HeldMoneyEntry[],
  };
  const totals = getHeldMoneyTotals(record);
  if (
    !Number.isSafeInteger(totals.received) ||
    !Number.isSafeInteger(totals.paid) ||
    !Number.isSafeInteger(totals.returned) ||
    !Number.isSafeInteger(totals.remaining) ||
    totals.remaining < 0
  )
    return null;
  return record;
}

function assertRecord(value: HeldMoneyRecord, uid: string) {
  const parsed = parseHeldMoneyRecord(value, uid);
  if (!parsed)
    throw new Error('Số tiền đóng hoặc trả lại không được vượt số đang giữ.');
  return parsed;
}

function sameEntry(a: HeldMoneyEntry, b: HeldMoneyEntry) {
  return (
    a.id === b.id &&
    a.kind === b.kind &&
    a.amount === b.amount &&
    a.occurredAt === b.occurredAt &&
    a.note === b.note
  );
}

function sameRecord(a: HeldMoneyRecord, b: HeldMoneyRecord) {
  return (
    a.id === b.id &&
    a.ownerId === b.ownerId &&
    a.senderName === b.senderName &&
    a.purpose === b.purpose &&
    a.createdAt === b.createdAt &&
    a.updatedAt === b.updatedAt &&
    a.entries.length === b.entries.length &&
    a.entries.every((entry, index) => sameEntry(entry, b.entries[index]))
  );
}

function sorted(records: HeldMoneyRecord[]) {
  return [...records].sort((a, b) => b.updatedAt - a.updatedAt);
}

async function readCache(uid: string) {
  const saved = await getEncryptedItem(uid, heldMoneyStorageKey(uid));
  if (!saved) return [];
  let values: unknown;
  try {
    values = JSON.parse(saved);
  } catch {
    throw new Error('Chưa đọc được sổ đóng hộ trên thiết bị.');
  }
  if (!Array.isArray(values))
    throw new Error('Dữ liệu sổ đóng hộ trên thiết bị không hợp lệ.');
  return sorted(
    values.flatMap((value) => {
      const record = parseHeldMoneyRecord(value, uid);
      return record ? [record] : [];
    }),
  );
}

async function writeCache(uid: string, records: HeldMoneyRecord[]) {
  await setEncryptedItem(
    uid,
    heldMoneyStorageKey(uid),
    JSON.stringify(sorted(records)),
  );
}

async function readRemote(uid: string) {
  const snapshot = await withTimeout(
    getDocsFromServer(
      collection(getFirestore(), 'financeAccounts', uid, 'heldFunds'),
    ),
  );
  return sorted(
    snapshot.docs.map((item) => {
      const record = parseHeldMoneyRecord(item.data(), uid);
      if (!record || record.id !== item.id)
        throw new Error('Dữ liệu sổ đóng hộ trên tài khoản không hợp lệ.');
      return record;
    }),
  );
}

export function readHeldMoney(uid: string): Promise<HeldMoneyReadResult> {
  requireUid(uid);
  return enqueue(uid, async () => {
    try {
      const records = await readRemote(uid);
      try {
        await writeCache(uid, records);
        return { records, synced: true };
      } catch {
        return { records, synced: true };
      }
    } catch (error) {
      const records = await readCache(uid);
      if (records.length === 0 && error instanceof Error) throw error;
      return { records, synced: false };
    }
  });
}

async function mutate(
  uid: string,
  id: string,
  change: (current: HeldMoneyRecord | null) => HeldMoneyRecord | null,
): Promise<HeldMoneyRecord | null> {
  requireUid(uid);
  if (!ID.test(id)) throw new Error('Mã khoản đóng hộ không hợp lệ.');
  return enqueue(uid, async () => {
    const result = await withTimeout(
      runTransaction(getFirestore(), async (transaction) => {
        const ref = recordPath(uid, id);
        const snapshot = await transaction.get(ref);
        const current = snapshot.exists()
          ? parseHeldMoneyRecord(snapshot.data(), uid)
          : null;
        if (snapshot.exists() && !current)
          throw new Error('Dữ liệu sổ đóng hộ trên tài khoản không hợp lệ.');
        const next = change(current);
        if (next) {
          const valid = assertRecord(next, uid);
          if (valid.id !== id)
            throw new Error('Mã khoản đóng hộ không hợp lệ.');
          if (!current || !sameRecord(current, valid))
            transaction.set(ref, valid);
          return valid;
        }
        if (current) transaction.delete(ref);
        return null;
      }),
    );
    try {
      const cached = await readCache(uid);
      await writeCache(
        uid,
        result
          ? [result, ...cached.filter((record) => record.id !== id)]
          : cached.filter((record) => record.id !== id),
      );
    } catch {
      // The cloud write is authoritative; the next read rebuilds the cache.
    }
    return result;
  });
}

export function createHeldMoneyRecord(uid: string, record: HeldMoneyRecord) {
  const valid = assertRecord(record, uid);
  if (valid.entries.length !== 1 || valid.entries[0].kind !== 'received')
    throw new Error('Cần ghi tiền đã nhận khi tạo khoản đóng hộ.');
  return mutate(uid, valid.id, (current) => {
    if (current) {
      if (sameRecord(current, valid)) return current;
      throw new HeldMoneyConflictError();
    }
    return valid;
  });
}

export function updateHeldMoneyDetails(
  uid: string,
  expected: HeldMoneyRecord,
  senderName: string,
  purpose: string,
) {
  return mutate(uid, expected.id, (current) => {
    if (!current) throw new HeldMoneyConflictError();
    if (
      current.senderName === senderName.trim() &&
      current.purpose === purpose.trim()
    )
      return current;
    if (!sameRecord(current, expected)) throw new HeldMoneyConflictError();
    return {
      ...current,
      senderName: senderName.trim(),
      purpose: purpose.trim(),
      updatedAt: Math.max(Date.now(), current.updatedAt + 1),
    };
  });
}

export function addHeldMoneyEntry(
  uid: string,
  recordId: string,
  entry: HeldMoneyEntry,
) {
  const valid = parseEntry(entry);
  if (!valid) throw new Error('Mục lịch sử chưa hợp lệ.');
  return mutate(uid, recordId, (current) => {
    if (!current) throw new HeldMoneyConflictError();
    const existing = current.entries.find(({ id }) => id === valid.id);
    if (existing) {
      if (sameEntry(existing, valid)) return current;
      throw new HeldMoneyConflictError();
    }
    return {
      ...current,
      entries: [...current.entries, valid],
      updatedAt: Math.max(Date.now(), current.updatedAt + 1),
    };
  });
}

export function updateHeldMoneyEntry(
  uid: string,
  recordId: string,
  expected: HeldMoneyEntry,
  next: HeldMoneyEntry,
) {
  const valid = parseEntry(next);
  if (!valid || valid.id !== expected.id)
    throw new Error('Mục lịch sử chưa hợp lệ.');
  return mutate(uid, recordId, (current) => {
    if (!current) throw new HeldMoneyConflictError();
    const existing = current.entries.find(({ id }) => id === expected.id);
    if (!existing) throw new HeldMoneyConflictError();
    if (sameEntry(existing, valid)) return current;
    if (!sameEntry(existing, expected)) throw new HeldMoneyConflictError();
    return {
      ...current,
      entries: current.entries.map((entry) =>
        entry.id === valid.id ? valid : entry,
      ),
      updatedAt: Math.max(Date.now(), current.updatedAt + 1),
    };
  });
}

export function deleteHeldMoneyEntry(
  uid: string,
  recordId: string,
  expected: HeldMoneyEntry,
) {
  return mutate(uid, recordId, (current) => {
    if (!current) throw new HeldMoneyConflictError();
    const existing = current.entries.find(({ id }) => id === expected.id);
    if (!existing) return current;
    if (!sameEntry(existing, expected)) throw new HeldMoneyConflictError();
    return {
      ...current,
      entries: current.entries.filter(({ id }) => id !== expected.id),
      updatedAt: Math.max(Date.now(), current.updatedAt + 1),
    };
  });
}

export function deleteHeldMoneyRecord(uid: string, expected: HeldMoneyRecord) {
  return mutate(uid, expected.id, (current) => {
    if (!current) return null;
    if (!sameRecord(current, expected)) throw new HeldMoneyConflictError();
    return null;
  });
}
