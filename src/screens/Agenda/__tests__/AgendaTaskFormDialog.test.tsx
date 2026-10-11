import { fireEvent, render, screen } from '@testing-library/react-native';
import { AgendaTaskFormDialog } from '../AgendaTaskFormDialog';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');

it('keeps a task created late today on the selected date', () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 9, 9, 23, 30));
  try {
    render(
      <AgendaTaskFormDialog
        visible
        initialDate={new Date(2026, 9, 9)}
        onClose={jest.fn()}
        onSave={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Chọn ngày công việc, 09/10/2026' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Chọn giờ công việc, 23:59' }),
    ).toBeTruthy();
  } finally {
    jest.useRealTimers();
  }
});

it('closes the task dialog from an X button instead of a footer cancel action', () => {
  const onClose = jest.fn();
  render(
    <AgendaTaskFormDialog
      visible
      onClose={onClose}
      onSave={jest.fn().mockResolvedValue(undefined)}
    />,
  );

  expect(screen.queryByText('Hủy')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Đóng việc cần làm' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('suggests a different time when another task already uses that time', () => {
  const task = (id: string, completed: boolean) => ({
    id,
    ownerId: 'user-1',
    title: id,
    details: '',
    dueAt: new Date(2030, 0, 2, 9, 0).getTime(),
    completed,
    reminderAt: null,
    updatedAt: 1,
  });
  const props = {
    visible: true,
    initialDate: new Date(2030, 0, 2),
    onClose: jest.fn(),
    onSave: jest.fn().mockResolvedValue(undefined),
  };
  const { rerender } = render(
    <AgendaTaskFormDialog {...props} existingItems={[task('done', true)]} />,
  );
  expect(
    screen.getByRole('button', { name: 'Chọn giờ công việc, 10:00' }),
  ).toBeTruthy();

  rerender(<AgendaTaskFormDialog {...props} visible={false} />);
  rerender(
    <AgendaTaskFormDialog {...props} existingItems={[task('open', false)]} />,
  );
  expect(
    screen.getByRole('button', { name: 'Chọn giờ công việc, 10:00' }),
  ).toBeTruthy();
});
