import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  checklistStorageKey,
  createPrepChecklist,
  deletePrepChecklist,
  duplicatePrepChecklist,
  readPrepChecklists,
  updatePrepChecklist,
} from '../checklistStorage';
import { setEncryptedItem } from '../../security/encryptedLocalStorage';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);

beforeEach(async () => {
  await AsyncStorage.clear();
});

it('persists encrypted checklists per account for offline use', async () => {
  const created = await createPrepChecklist('user-1', {
    title: 'Mua sắm',
    items: [{ name: 'Nước', quantity: '2 chai' }],
  });

  expect(await readPrepChecklists('user-1')).toEqual([created]);
  expect(await readPrepChecklists('user-2')).toEqual([]);
  expect(checklistStorageKey('user-1')).not.toBe(checklistStorageKey('user-2'));
  expect(await AsyncStorage.getItem(checklistStorageKey('user-1'))).toMatch(
    /^lifemate:aes-gcm:v1:/,
  );
});

it('serializes concurrent edits and validates checklist content', async () => {
  const [first, second] = await Promise.all([
    createPrepChecklist('user-1', { title: 'Du lịch' }),
    createPrepChecklist('user-1', { title: 'Về quê' }),
  ]);
  const updated = await updatePrepChecklist('user-1', {
    ...first,
    items: [
      { id: 'passport', name: 'Giấy tờ tùy thân', quantity: '', checked: true },
    ],
  });

  expect(await readPrepChecklists('user-1')).toEqual([second, updated]);
  await expect(createPrepChecklist('user-1', { title: '  ' })).rejects.toThrow(
    'tên',
  );
});

it('duplicates a checklist as an independent unchecked copy and deletes it', async () => {
  const source = await createPrepChecklist('user-1', {
    title: 'Đi du lịch',
    items: [{ name: 'Vé xe', quantity: '2 vé' }],
  });
  const checked = await updatePrepChecklist('user-1', {
    ...source,
    items: source.items.map((item) => ({ ...item, checked: true })),
  });

  const copy = await duplicatePrepChecklist('user-1', checked.id);
  expect(copy.id).not.toBe(checked.id);
  expect(copy.title).toBe('Đi du lịch (bản mới)');
  expect(copy.items[0]).toMatchObject({ name: 'Vé xe', quantity: '2 vé' });
  expect(copy.items[0].checked).toBe(false);

  await deletePrepChecklist('user-1', checked.id);
  expect(await readPrepChecklists('user-1')).toEqual([copy]);
});

it('rejects corrupted saved data without replacing it', async () => {
  await setEncryptedItem('user-1', checklistStorageKey('user-1'), '{broken');

  await expect(readPrepChecklists('user-1')).rejects.toThrow('đọc được');
  expect(await AsyncStorage.getItem(checklistStorageKey('user-1'))).toMatch(
    /^lifemate:aes-gcm:v1:/,
  );
});
