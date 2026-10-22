import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import type { AgendaItem } from '../../../types/agenda';
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

function task(id: string, title: string, dueAt: number): AgendaItem {
  return {
    id,
    ownerId: 'u1',
    title,
    details: '',
    dueAt,
    reminderAt: null,
    completed: false,
    updatedAt: 1,
  };
}

it('lists overdue tasks and completes a task from Home', async () => {
  const onCompleteTask = jest.fn().mockResolvedValue(undefined);
  render(
    <HomeTodayCard
      date={new Date(2026, 9, 21)}
      checklists={[]}
      checklistsLoading={false}
      notes={[]}
      notesLoading={false}
      agendaItems={[
        task('late', 'Nộp hồ sơ', new Date(2026, 9, 19, 9, 0).getTime()),
        task(
          'today',
          'Đóng tiền điện',
          new Date(2026, 9, 21, 18, 30).getTime(),
        ),
      ]}
      agendaLoading={false}
      onOpenCalendar={jest.fn()}
      onOpenTasks={jest.fn()}
      onCompleteTask={onCompleteTask}
    />,
  );

  expect(screen.getByText('1 việc quá hạn')).toBeTruthy();
  expect(screen.getByText('19/10')).toBeTruthy();
  expect(screen.getByText('18:30')).toBeTruthy();
  fireEvent.press(
    screen.getByRole('checkbox', { name: 'Hoàn thành Nộp hồ sơ' }),
  );
  await waitFor(() => expect(onCompleteTask).toHaveBeenCalledWith('late'));
});

it('shows a task again after completion is undone elsewhere', async () => {
  const item = task(
    'today',
    'Đóng tiền điện',
    new Date(2026, 9, 21, 18, 30).getTime(),
  );
  let finish!: () => void;
  const onCompleteTask = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const props = {
    date: new Date(2026, 9, 21),
    checklists: [],
    checklistsLoading: false,
    notes: [],
    notesLoading: false,
    agendaLoading: false,
    onOpenCalendar: jest.fn(),
    onOpenTasks: jest.fn(),
    onCompleteTask,
  };
  const view = render(<HomeTodayCard {...props} agendaItems={[item]} />);
  fireEvent.press(
    screen.getByRole('checkbox', { name: 'Hoàn thành Đóng tiền điện' }),
  );
  expect(screen.queryByText(item.title)).toBeNull();
  view.rerender(
    <HomeTodayCard {...props} agendaItems={[{ ...item, completed: true }]} />,
  );
  await act(async () => finish());
  expect(screen.queryByText(item.title)).toBeNull();
  view.rerender(
    <HomeTodayCard {...props} agendaItems={[{ ...item, updatedAt: 2 }]} />,
  );
  expect(
    screen.getByRole('checkbox', { name: 'Hoàn thành Đóng tiền điện' }),
  ).toBeTruthy();
});

it('restores an optimistically hidden task when completion fails', async () => {
  const item = task(
    'today',
    'Đóng tiền điện',
    new Date(2026, 9, 21, 18, 30).getTime(),
  );
  render(
    <HomeTodayCard
      date={new Date(2026, 9, 21)}
      checklists={[]}
      checklistsLoading={false}
      notes={[]}
      notesLoading={false}
      agendaItems={[item]}
      agendaLoading={false}
      onOpenCalendar={jest.fn()}
      onOpenTasks={jest.fn()}
      onCompleteTask={jest.fn().mockRejectedValue(new Error('offline'))}
    />,
  );
  fireEvent.press(
    screen.getByRole('checkbox', { name: 'Hoàn thành Đóng tiền điện' }),
  );
  await waitFor(() =>
    expect(
      screen.getByText('Chưa cập nhật được công việc. Hãy thử lại.'),
    ).toBeTruthy(),
  );
  expect(
    screen.getByRole('checkbox', { name: 'Hoàn thành Đóng tiền điện' }),
  ).toBeTruthy();
});
