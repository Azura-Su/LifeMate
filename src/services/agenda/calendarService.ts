import * as Calendar from 'expo-calendar/next';
import type { AgendaItem } from '../../types/agenda';

export function addAgendaItemToCalendar(item: AgendaItem) {
  const startDate = new Date(item.dueAt);
  const endDate = new Date(item.dueAt + 60 * 60 * 1000);
  return Calendar.createEventInCalendarAsync({
    title: item.title,
    notes: item.details,
    startDate,
    endDate,
  });
}
