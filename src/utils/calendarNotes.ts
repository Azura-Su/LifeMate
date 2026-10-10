const CALENDAR_NOTE_PREFIX = 'calendar-day-';

// Day notes live in the regular notes store but are shown only in the calendar.
export function isCalendarNote(noteId: string) {
  return noteId.startsWith(CALENDAR_NOTE_PREFIX);
}

export function getCalendarNoteDateKey(noteId: string): string | null {
  const match = /^calendar-day-(\d{4}-\d{2}-\d{2})(?:-|$)/.exec(noteId);
  return match?.[1] ?? null;
}

export function makeCalendarNoteId(dateKey: string): string {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  return `${CALENDAR_NOTE_PREFIX}${dateKey}-${suffix}`;
}
