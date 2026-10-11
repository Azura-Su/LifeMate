import {
  getCalendarNoteDateKey,
  isAnnualCalendarNote,
  isCalendarNoteForDate,
  makeCalendarNoteId,
} from '../calendarNotes';

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

it('recognizes birthday notes with Vietnamese accents, without accents, or in English', () => {
  expect(isAnnualCalendarNote('Sinh nhật vợ')).toBe(true);
  expect(isAnnualCalendarNote('SINH NHAT mẹ')).toBe(true);
  expect(isAnnualCalendarNote('Birthday mẹ')).toBe(true);
  expect(isAnnualCalendarNote('Gọi cho gia đình')).toBe(false);
});

it('repeats birthday notes by solar month and day in the source year and later', () => {
  const birthday = {
    id: 'calendar-day-2025-09-26-birthday',
    title: 'Sinh nhật vợ',
  };

  expect(isCalendarNoteForDate(birthday, '2025-09-26')).toBe(true);
  expect(isCalendarNoteForDate(birthday, '2026-09-26')).toBe(true);
  expect(isCalendarNoteForDate(birthday, '2026-09-25')).toBe(false);
  expect(isCalendarNoteForDate(birthday, '2024-09-26')).toBe(false);
  expect(
    isCalendarNoteForDate({ ...birthday, title: 'Kỷ niệm' }, '2026-09-26'),
  ).toBe(false);
});

it('keeps February 29 birthdays on February 28 in non-leap years', () => {
  expect(
    isCalendarNoteForDate(
      {
        id: 'calendar-day-2024-02-29-birthday',
        title: 'Sinh nhật',
      },
      '2025-02-28',
    ),
  ).toBe(true);
});
