import { render, screen } from '@testing-library/react-native';
import type { LifeNote } from '../../../types/note';
import { HomeTodayCard } from '../HomeTodayCard';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');

it('includes a birthday note from a prior year in today’s summary', () => {
  const birthday: LifeNote = {
    id: 'calendar-day-2025-09-26-birthday',
    ownerId: 'u1',
    title: 'Sinh nhật vợ',
    body: 'Mua bánh',
    updatedAt: 1,
  };
  render(
    <HomeTodayCard
      date={new Date(2026, 8, 26)}
      checklists={[]}
      checklistsLoading={false}
      notes={[birthday]}
      notesLoading={false}
      agendaItems={[]}
      agendaLoading={false}
      onOpenCalendar={jest.fn()}
      onOpenTasks={jest.fn()}
    />,
  );

  expect(screen.getByText('Sinh nhật vợ')).toBeTruthy();
  expect(
    screen.getByRole('button', {
      name: /Lịch hôm nay có 1 mục: Ghi chú: Sinh nhật vợ/,
    }),
  ).toBeTruthy();
});
