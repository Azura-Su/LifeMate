import { fireEvent, render, screen } from '@testing-library/react-native';
import { AudioNameDialog } from '../AudioNameDialog';

it('lets the user replace a generated name and rejects a blank title', () => {
  const save = jest.fn();
  const close = jest.fn();
  render(
    <AudioNameDialog
      initialTitle="generated-123"
      renaming={false}
      busy={false}
      error={null}
      onSave={save}
      onClose={close}
    />,
  );
  const field = screen.getByLabelText('Tên âm thanh');
  fireEvent.changeText(field, '  ');
  fireEvent.press(screen.getByText('Lưu âm thanh'));
  expect(screen.getByRole('alert')).toHaveTextContent(/1 đến 120/);
  expect(save).not.toHaveBeenCalled();
  fireEvent.changeText(field, '  Nhạc buổi sáng  ');
  fireEvent.press(screen.getByText('Lưu âm thanh'));
  expect(save).toHaveBeenCalledWith('Nhạc buổi sáng');
  fireEvent.press(screen.getByText('Hủy'));
  expect(close).toHaveBeenCalled();
});

it('allows renaming an existing file and prevents duplicate saves while busy', () => {
  const save = jest.fn();
  render(
    <AudioNameDialog
      initialTitle="Tên cũ"
      renaming
      busy
      error={null}
      onSave={save}
      onClose={jest.fn()}
    />,
  );
  expect(screen.getByText('Đổi tên âm thanh')).toBeTruthy();
  expect(screen.getByLabelText('Tên âm thanh')).toHaveProp('value', 'Tên cũ');
  fireEvent.press(screen.getByText('Lưu tên'));
  expect(save).not.toHaveBeenCalled();
});
