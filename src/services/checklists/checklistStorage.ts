import { randomUUID } from 'expo-crypto';
import type {
  PrepChecklist,
  PrepChecklistItem,
} from '../../types/prepChecklist';
import {
  isPrepChecklist,
  isValidChecklistDateKey,
  MAX_CHECKLIST_ITEMS,
  MAX_CHECKLIST_TITLE_LENGTH,
  validatePrepChecklistItem,
  validatePrepChecklistTitle,
} from '../../utils/prepChecklists';
import {
  getEncryptedItem,
  setEncryptedItem,
} from '../security/encryptedLocalStorage';

const queues = new Map<string, Promise<unknown>>();

export function checklistStorageKey(uid: string) {
  return `lifemate:prep-checklists:v1:${encodeURIComponent(uid)}`;
}

function requireUid(uid: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid))
    throw new Error('Không tìm thấy tài khoản đang đăng nhập.');
}

function enqueue<T>(uid: string, operation: () => Promise<T>): Promise<T> {
  const key = checklistStorageKey(uid);
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  queues.set(key, next);
  void next
    .finally(() => {
      if (queues.get(key) === next) queues.delete(key);
    })
    .catch(() => undefined);
  return next;
}

async function readLists(uid: string): Promise<PrepChecklist[]> {
  const saved = await getEncryptedItem(uid, checklistStorageKey(uid));
  if (saved === null) return [];
  let value: unknown;
  try {
    value = JSON.parse(saved);
  } catch {
    throw new Error('Chưa đọc được danh sách trên thiết bị.');
  }
  if (
    !Array.isArray(value) ||
    !value.every((checklist) => isPrepChecklist(checklist))
  ) {
    throw new Error('Dữ liệu danh sách trên thiết bị không hợp lệ.');
  }
  return value;
}

async function writeLists(uid: string, lists: PrepChecklist[]) {
  await setEncryptedItem(uid, checklistStorageKey(uid), JSON.stringify(lists));
}

function createItem(input: {
  name: string;
  quantity?: string;
}): PrepChecklistItem {
  const error = validatePrepChecklistItem(input.name, input.quantity ?? '');
  if (error) throw new Error(error);
  return {
    id: randomUUID(),
    name: input.name.trim(),
    quantity: input.quantity?.trim() ?? '',
    checked: false,
  };
}

export function readPrepChecklists(uid: string) {
  requireUid(uid);
  return enqueue(uid, () => readLists(uid));
}

export function createPrepChecklist(
  uid: string,
  input: {
    title: string;
    items?: { name: string; quantity?: string }[];
  },
) {
  requireUid(uid);
  const titleError = validatePrepChecklistTitle(input.title);
  if (titleError) return Promise.reject(new Error(titleError));
  if ((input.items?.length ?? 0) > MAX_CHECKLIST_ITEMS)
    return Promise.reject(
      new Error(`Danh sách đã đủ ${MAX_CHECKLIST_ITEMS} mục.`),
    );
  const now = Date.now();
  const checklist: PrepChecklist = {
    id: randomUUID(),
    title: input.title.trim(),
    items: (input.items ?? []).map(createItem),
    createdAt: now,
    updatedAt: now,
  };
  return enqueue(uid, async () => {
    const lists = await readLists(uid);
    await writeLists(uid, [checklist, ...lists]);
    return checklist;
  });
}

export function updatePrepChecklist(uid: string, checklist: PrepChecklist) {
  requireUid(uid);
  if (!isPrepChecklist(checklist))
    return Promise.reject(new Error('Thông tin danh sách không hợp lệ.'));
  return enqueue(uid, async () => {
    const lists = await readLists(uid);
    const index = lists.findIndex((item) => item.id === checklist.id);
    if (index < 0) throw new Error('Không tìm thấy danh sách cần cập nhật.');
    const updated = { ...checklist, updatedAt: Date.now() };
    lists[index] = updated;
    await writeLists(uid, lists);
    return updated;
  });
}

export function setPrepChecklistDate(
  uid: string,
  checklistId: string,
  scheduledDateKey: string | null,
) {
  requireUid(uid);
  if (scheduledDateKey !== null && !isValidChecklistDateKey(scheduledDateKey))
    return Promise.reject(new Error('Ngày gắn vào danh sách không hợp lệ.'));

  return enqueue(uid, async () => {
    const lists = await readLists(uid);
    const index = lists.findIndex((item) => item.id === checklistId);
    if (index < 0) throw new Error('Không tìm thấy danh sách cần cập nhật.');

    const updated: PrepChecklist = { ...lists[index], updatedAt: Date.now() };
    if (scheduledDateKey === null) delete updated.scheduledDateKey;
    else updated.scheduledDateKey = scheduledDateKey;
    lists[index] = updated;
    await writeLists(uid, lists);
    return updated;
  });
}

export function deletePrepChecklist(uid: string, checklistId: string) {
  requireUid(uid);
  return enqueue(uid, async () => {
    const lists = await readLists(uid);
    const remaining = lists.filter((item) => item.id !== checklistId);
    if (remaining.length !== lists.length) await writeLists(uid, remaining);
    return remaining;
  });
}

export function duplicatePrepChecklist(uid: string, checklistId: string) {
  requireUid(uid);
  return enqueue(uid, async () => {
    const lists = await readLists(uid);
    const original = lists.find((item) => item.id === checklistId);
    if (!original) throw new Error('Không tìm thấy danh sách cần dùng lại.');
    const suffix = ' (bản mới)';
    const title = `${original.title.slice(0, MAX_CHECKLIST_TITLE_LENGTH - suffix.length).trimEnd()}${suffix}`;
    const now = Date.now();
    const duplicate: PrepChecklist = {
      id: randomUUID(),
      title,
      items: original.items.map((item) => ({
        ...item,
        id: randomUUID(),
        checked: false,
      })),
      createdAt: now,
      updatedAt: now,
    };
    await writeLists(uid, [duplicate, ...lists]);
    return duplicate;
  });
}
