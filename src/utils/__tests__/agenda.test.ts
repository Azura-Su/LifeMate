import { getAgendaForDate, getTodaysAgenda } from '../agenda';
import type { AgendaItem } from '../../types/agenda';

const date = new Date(2026, 9, 9);
const item = (id: string, dueAt: Date, completed = false): AgendaItem => ({
  id,
  ownerId: 'u1',
  title: id,
  details: '',
  dueAt: dueAt.getTime(),
  completed,
  reminderAt: null,
  updatedAt: 1,
});

it('returns pending agenda items for the selected local date in due-time order', () => {
  const rows = [
    item('later', new Date(2026, 9, 9, 17)),
    item('earlier', new Date(2026, 9, 9, 9)),
    item('next-day', new Date(2026, 9, 10, 8)),
    item('complete', new Date(2026, 9, 9, 12), true),
  ];
  expect(getAgendaForDate(rows, date).map((row) => row.id)).toEqual([
    'earlier',
    'later',
  ]);
  expect(getTodaysAgenda(rows, date)).toEqual(getAgendaForDate(rows, date));
});
