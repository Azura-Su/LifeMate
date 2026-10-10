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

    expect(screen.getByLabelText('Ngày công việc').props.value).toBe(
      '09/10/2026',
    );
    expect(screen.getByLabelText('Giờ công việc').props.value).toBe('23:59');
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
