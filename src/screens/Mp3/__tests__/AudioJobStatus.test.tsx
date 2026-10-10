import { fireEvent, render, screen } from '@testing-library/react-native';
import { AudioJobStatus } from '../AudioJobStatus';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');

it('shows upload progress compactly and lets the user cancel it', () => {
  const onCancel = jest.fn();
  render(
    <AudioJobStatus
      job={{ label: 'Đang sao lưu audio lên kho miễn phí…', progress: 0.37 }}
      onCancel={onCancel}
    />,
  );

  expect(
    screen.getByText('Đang sao lưu audio lên kho miễn phí… 37%'),
  ).toBeTruthy();
  expect(
    screen.getByRole('progressbar', { name: 'Tiến trình 37%' }),
  ).toBeTruthy();
  expect(screen.queryByText('Giữ ứng dụng mở trong lúc xử lý.')).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'Hủy thao tác' }));
  expect(onCancel).toHaveBeenCalledTimes(1);
});

it('keeps delete status compact when there is no measurable progress', () => {
  render(
    <AudioJobStatus
      job={{ label: 'Đang xóa file trên máy…', progress: null }}
      onCancel={jest.fn()}
    />,
  );

  expect(screen.getByText('Đang xóa file trên máy…')).toBeTruthy();
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(screen.getByRole('button', { name: 'Hủy thao tác' })).toBeTruthy();
});
