import type { PrepChecklist, PrepChecklistItem } from '../types/prepChecklist';
import { parseDateKey } from './vietnameseCalendar';

export const MAX_CHECKLIST_TITLE_LENGTH = 80;
export const MAX_CHECKLIST_ITEM_NAME_LENGTH = 120;
export const MAX_CHECKLIST_QUANTITY_LENGTH = 80;
export const MAX_CHECKLIST_ITEMS = 200;

export function isValidChecklistDateKey(value: unknown): value is string {
  return typeof value === 'string' && parseDateKey(value) !== null;
}

const ID = /^[A-Za-z0-9_-]{1,128}$/;

export function validatePrepChecklistTitle(title: string) {
  const value = title.trim();
  if (!value) return 'Nhập tên danh sách.';
  if (value.length > MAX_CHECKLIST_TITLE_LENGTH)
    return `Tên danh sách không được quá ${MAX_CHECKLIST_TITLE_LENGTH} ký tự.`;
  return null;
}

export function validatePrepChecklistItem(name: string, quantity: string) {
  const value = name.trim();
  const amount = quantity.trim();
  if (!value) return 'Nhập tên mục cần chuẩn bị.';
  if (value.length > MAX_CHECKLIST_ITEM_NAME_LENGTH)
    return `Tên mục không được quá ${MAX_CHECKLIST_ITEM_NAME_LENGTH} ký tự.`;
  if (amount.length > MAX_CHECKLIST_QUANTITY_LENGTH)
    return `Số lượng không được quá ${MAX_CHECKLIST_QUANTITY_LENGTH} ký tự.`;
  return null;
}

export function isPrepChecklistItem(
  value: unknown,
): value is PrepChecklistItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    ID.test(item.id) &&
    typeof item.name === 'string' &&
    item.name.trim().length > 0 &&
    item.name.length <= MAX_CHECKLIST_ITEM_NAME_LENGTH &&
    typeof item.quantity === 'string' &&
    item.quantity.length <= MAX_CHECKLIST_QUANTITY_LENGTH &&
    typeof item.checked === 'boolean'
  );
}

export function isPrepChecklist(value: unknown): value is PrepChecklist {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const checklist = value as Record<string, unknown>;
  return (
    typeof checklist.id === 'string' &&
    ID.test(checklist.id) &&
    typeof checklist.title === 'string' &&
    validatePrepChecklistTitle(checklist.title) === null &&
    Array.isArray(checklist.items) &&
    checklist.items.length <= MAX_CHECKLIST_ITEMS &&
    checklist.items.every(isPrepChecklistItem) &&
    (checklist.scheduledDateKey === undefined ||
      isValidChecklistDateKey(checklist.scheduledDateKey)) &&
    typeof checklist.createdAt === 'number' &&
    Number.isFinite(checklist.createdAt) &&
    checklist.createdAt > 0 &&
    typeof checklist.updatedAt === 'number' &&
    Number.isFinite(checklist.updatedAt) &&
    checklist.updatedAt > 0
  );
}
