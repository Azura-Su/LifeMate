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

it('repeats Giỗ notes on the same Vietnamese lunar date in later lunar years', () => {
  const anniversary = {
    id: 'calendar-day-2026-04-26-anniversary', // Lunar 10/3/2026.
    title: '  GIỖ: ông nội',
  };

  expect(isCalendarNoteForDate(anniversary, '2026-04-26')).toBe(true);
  expect(isCalendarNoteForDate(anniversary, '2027-04-16')).toBe(true);
  expect(isCalendarNoteForDate(anniversary, '2027-04-26')).toBe(false);
  expect(isCalendarNoteForDate(anniversary, '2025-04-07')).toBe(false);
  expect(
    isCalendarNoteForDate(
      { ...anniversary, title: 'Giống ông nội' },
      '2027-04-16',
    ),
  ).toBe(false);
  expect(
    isCalendarNoteForDate(
      { ...anniversary, title: 'Giỗ sinh nhật ông' },
      '2027-04-26',
    ),
  ).toBe(false);
});

it('uses only the regular lunar month in later years for a Giỗ saved in a leap month', () => {
  const anniversary = {
    id: 'calendar-day-2004-03-21-anniversary', // Lunar 1/2 nhuận/2004.
    title: 'Giỗ bà',
  };

  expect(isCalendarNoteForDate(anniversary, '2004-03-21')).toBe(true);
  expect(isCalendarNoteForDate(anniversary, '2004-02-20')).toBe(false);
  expect(isCalendarNoteForDate(anniversary, '2005-03-10')).toBe(true);
});

it('uses lunar day 29 when a Giỗ on day 30 has no day 30 the next year', () => {
  const anniversary = {
    id: 'calendar-day-2026-05-16-anniversary', // Lunar 30/3/2026.
    title: 'Giỗ mẹ',
  };

  expect(isCalendarNoteForDate(anniversary, '2027-05-05')).toBe(true);
  expect(isCalendarNoteForDate(anniversary, '2027-05-04')).toBe(false);
});

it('ignores unsupported or malformed dates when matching Giỗ notes', () => {
  const anniversary = {
    id: 'calendar-day-2026-04-26-anniversary',
    title: 'Giỗ ông',
  };

  expect(isCalendarNoteForDate(anniversary, '2201-01-01')).toBe(false);
  expect(isCalendarNoteForDate(anniversary, '2027-02-30')).toBe(false);
  expect(
    isCalendarNoteForDate(
      { ...anniversary, id: 'calendar-day-1799-04-26-anniversary' },
      '2027-04-16',
    ),
  ).toBe(false);
});
