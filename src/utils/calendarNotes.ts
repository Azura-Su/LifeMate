import {
  MAX_SOLAR_YEAR,
  MIN_SOLAR_YEAR,
  solarToLunar,
} from './vietnameseCalendar';

const CALENDAR_NOTE_PREFIX = 'calendar-day-';

// Day notes live in the regular notes store but are shown only in the calendar.
export function isCalendarNote(noteId: string) {
  return noteId.startsWith(CALENDAR_NOTE_PREFIX);
}

export function getCalendarNoteDateKey(noteId: string): string | null {
  const match = /^calendar-day-(\d{4}-\d{2}-\d{2})(?:-|$)/.exec(noteId);
  return match?.[1] ?? null;
}

export function isAnnualCalendarNote(title: string) {
  const normalizedTitle = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return (
    normalizedTitle.includes('sinh nhat') ||
    normalizedTitle.includes('birthday')
  );
}

export function isLunarAnnualCalendarNote(title: string) {
  return /^giỗ(?:$|[^A-Za-zÀ-ỹ])/i.test(title.trimStart());
}

function parseDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  )
    return null;
  return { year, month, day };
}

export function isCalendarNoteForDate(
  note: { id: string; title: string },
  dateKey: string,
) {
  const sourceDateKey = getCalendarNoteDateKey(note.id);
  if (!sourceDateKey) return false;
  if (sourceDateKey === dateKey) return true;

  const sourceDate = parseDateKey(sourceDateKey);
  const targetDate = parseDateKey(dateKey);
  if (!sourceDate || !targetDate) return false;

  if (isLunarAnnualCalendarNote(note.title)) {
    if (
      sourceDate.year < MIN_SOLAR_YEAR ||
      sourceDate.year > MAX_SOLAR_YEAR ||
      targetDate.year < MIN_SOLAR_YEAR ||
      targetDate.year > MAX_SOLAR_YEAR
    )
      return false;
    const sourceLunar = solarToLunar(
      sourceDate.day,
      sourceDate.month,
      sourceDate.year,
    );
    const targetLunar = solarToLunar(
      targetDate.day,
      targetDate.month,
      targetDate.year,
    );
    if (
      targetLunar.year <= sourceLunar.year ||
      targetLunar.month !== sourceLunar.month ||
      targetLunar.leapMonth
    )
      return false;
    if (targetLunar.day === sourceLunar.day) return true;
    if (sourceLunar.day !== 30 || targetLunar.day !== 29) return false;

    // A 30th-day anniversary falls on the final day of a 29-day lunar month.
    const nextDate = new Date(
      Date.UTC(targetDate.year, targetDate.month - 1, targetDate.day + 1),
    );
    if (nextDate.getUTCFullYear() > MAX_SOLAR_YEAR) return false;
    return (
      solarToLunar(
        nextDate.getUTCDate(),
        nextDate.getUTCMonth() + 1,
        nextDate.getUTCFullYear(),
      ).day === 1
    );
  }

  if (!isAnnualCalendarNote(note.title) || targetDate.year < sourceDate.year)
    return false;
  if (
    sourceDate.month === targetDate.month &&
    sourceDate.day === targetDate.day
  )
    return true;

  const targetIsLeapYear =
    targetDate.year % 4 === 0 &&
    (targetDate.year % 100 !== 0 || targetDate.year % 400 === 0);
  return (
    sourceDate.month === 2 &&
    sourceDate.day === 29 &&
    targetDate.month === 2 &&
    targetDate.day === 28 &&
    !targetIsLeapYear
  );
}

export function makeCalendarNoteId(dateKey: string): string {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  return `${CALENDAR_NOTE_PREFIX}${dateKey}-${suffix}`;
}
