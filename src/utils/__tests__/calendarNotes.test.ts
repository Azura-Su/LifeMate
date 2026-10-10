import { getCalendarNoteDateKey, makeCalendarNoteId } from '../calendarNotes';

it('recognizes both legacy and uniquely identified notes for the same date', () => {
  expect(getCalendarNoteDateKey('calendar-day-2026-10-09')).toBe('2026-10-09');
  expect(getCalendarNoteDateKey('calendar-day-2026-10-09-meeting')).toBe(
    '2026-10-09',
  );
  expect(getCalendarNoteDateKey('personal-note')).toBeNull();
});

it('creates a unique id that retains the date key for calendar indexing', () => {
  const firstId = makeCalendarNoteId('2026-10-09');
  const secondId = makeCalendarNoteId('2026-10-09');

  expect(firstId).not.toBe(secondId);
  expect(getCalendarNoteDateKey(firstId)).toBe('2026-10-09');
});
