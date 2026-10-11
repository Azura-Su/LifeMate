import {
  isPrepChecklist,
  validatePrepChecklistItem,
  validatePrepChecklistTitle,
} from '../prepChecklists';
import type { PrepChecklist } from '../../types/prepChecklist';

const checklist: PrepChecklist = {
  id: 'trip-list',
  title: 'Đi du lịch',
  items: [
    { id: 'item-1', name: 'Sạc điện thoại', quantity: '2 cái', checked: false },
  ],
  createdAt: 1,
  updatedAt: 1,
};

it('accepts valid checklist records and rejects malformed persisted data', () => {
  expect(isPrepChecklist(checklist)).toBe(true);
  expect(isPrepChecklist({ ...checklist, items: [{ name: 'Thiếu ID' }] })).toBe(
    false,
  );
  expect(isPrepChecklist({ ...checklist, title: ' '.repeat(4) })).toBe(false);
});

it('validates names and accepts free-form quantities', () => {
  expect(validatePrepChecklistTitle('  Về quê  ')).toBeNull();
  expect(validatePrepChecklistTitle('   ')).toContain('tên');
  expect(validatePrepChecklistItem('  Nước uống ', '  2 chai ')).toBeNull();
  expect(validatePrepChecklistItem('  ', '')).toContain('mục');
});
