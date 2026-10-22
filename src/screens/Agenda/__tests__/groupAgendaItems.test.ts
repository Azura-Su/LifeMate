import type { AgendaItem } from '../../../types/agenda';
import { groupAgendaItems } from '../../../utils/agenda';

function item(id: string, dueAt: Date, completed = false): AgendaItem {
  return {
    id,
    ownerId: 'u1',
    title: id,
    details: '',
    dueAt: dueAt.getTime(),
    completed,
    reminderAt: null,
    updatedAt: 1,
  };
}

it('groups tasks into overdue, today, upcoming and done, keeping order', () => {
  const now = new Date(2026, 9, 21, 12);
  const groups = groupAgendaItems(
    [
      item('late', new Date(2026, 9, 20, 9)),
      item('morning', new Date(2026, 9, 21, 8)),
      item('next', new Date(2026, 9, 22, 8)),
      item('done', new Date(2026, 9, 19, 8), true),
      item('evening', new Date(2026, 9, 21, 20)),
    ],
    now,
  );
  expect(groups.map((g) => [g.key, g.items.map((i) => i.id)])).toEqual([
    ['overdue', ['late']],
    ['today', ['morning', 'evening']],
    ['upcoming', ['next']],
    ['done', ['done']],
  ]);
});

it('omits empty groups', () => {
  const groups = groupAgendaItems(
    [item('a', new Date(2026, 9, 25))],
    new Date(2026, 9, 21),
  );
  expect(groups.map((g) => g.key)).toEqual(['upcoming']);
});
