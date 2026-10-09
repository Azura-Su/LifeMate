import type { AgendaItem } from '../types/agenda';

export function formatAgendaDate(date: Date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export function formatAgendaTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function parseAgendaDateTime(dateText: string, timeText: string) {
  const date = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateText.trim());
  const time = /^(\d{2}):(\d{2})$/.exec(timeText.trim());
  if (!date || !time) return null;
  const [, dayText, monthText, yearText] = date;
  const [, hourText, minuteText] = time;
  const year = Number(yearText),
    month = Number(monthText),
    day = Number(dayText);
  const hour = Number(hourText),
    minute = Number(minuteText);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59
  )
    return null;
  const value = new Date(year, month - 1, day, hour, minute, 0, 0);
  return value.getFullYear() === year &&
    value.getMonth() === month - 1 &&
    value.getDate() === day
    ? value.getTime()
    : null;
}

export function getTodaysAgenda(items: AgendaItem[], now = new Date()) {
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  ).getTime();
  return items
    .filter(
      (item) => !item.completed && item.dueAt >= start && item.dueAt < end,
    )
    .sort((a, b) => a.dueAt - b.dueAt);
}
