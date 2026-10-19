import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';
import { HomeDayDetailsCard } from '../HomeDayDetailsCard';
import type { LifeNote } from '../../../types/note';
import { getCalendarNoteDateKey } from '../../../utils/calendarNotes';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');

it('shows the date and holiday, then opens and updates an existing day note', async () => {
  const date = new Date(2026, 3, 26);
  const dateKey = '2026-04-26';
  const existing: LifeNote = {
    id: `calendar-day-${dateKey}`,
    ownerId: 'u1',
    title: 'Gọi cho gia đình',
    body: 'Nhớ gọi trước 7 giờ tối.',
    updatedAt: 1,
  };
  const onSave = jest.fn().mockResolvedValue(undefined);
  const onSaved = jest.fn();
  render(
    <HomeDayDetailsCard
      date={date}
      uid="u1"
      notes={[existing]}
      synced
      onSave={onSave}
      onDelete={jest.fn().mockResolvedValue(undefined)}
      onSaved={onSaved}
    />,
  );

  expect(screen.getByText('Giỗ Tổ Hùng Vương')).toBeTruthy();
  expect(screen.getByText('Gọi cho gia đình')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Lưu lại' })).toBeNull();
  fireEvent.press(
    screen.getByRole('button', { name: 'Mở ghi chú: Gọi cho gia đình' }),
  );
  expect(screen.getByLabelText('Nội dung ghi chú trong ngày').props.value).toBe(
    'Nhớ gọi trước 7 giờ tối.',
  );
  expect(screen.getAllByText(/Âm lịch .* năm/)).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Đóng ghi chú' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Lưu lại' })).toBeNull();
  fireEvent.changeText(
    screen.getByLabelText('Tiêu đề ghi chú ngày'),
    'Gọi cho cả nhà',
  );
  fireEvent.changeText(
    screen.getByLabelText('Nội dung ghi chú trong ngày'),
    'Đã gọi cho gia đình',
  );
  expect(screen.getByRole('button', { name: 'Lưu lại' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Lưu lại' }));

  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('button', { name: 'Lưu lại' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Đóng ghi chú' })).toBeNull();
  expect(onSaved).toHaveBeenCalledTimes(1);
  expect(onSave).toHaveBeenCalledWith(
    'u1',
    expect.objectContaining({
      id: existing.id,
      title: 'Gọi cho cả nhà',
      body: 'Đã gọi cho gia đình',
    }),
    existing,
  );
});

it('creates a new account-scoped note without reusing the date’s existing note id', async () => {
  const existing: LifeNote = {
    id: 'calendar-day-2026-10-09',
    ownerId: 'u1',
    title: 'Gọi điện',
    body: 'Cho mẹ',
    updatedAt: 1,
  };
  const onSave = jest.fn().mockResolvedValue(undefined);
  render(
    <HomeDayDetailsCard
      date={new Date(2026, 9, 9)}
      uid="u1"
      notes={[existing]}
      synced
      onSave={onSave}
      onDelete={jest.fn().mockResolvedValue(undefined)}
    />,
  );

  fireEvent.press(
    screen.getByRole('button', { name: 'Thêm ghi chú cho ngày này' }),
  );
  fireEvent.changeText(
    screen.getByLabelText('Tiêu đề ghi chú ngày'),
    'Hẹn khám',
  );
  fireEvent.changeText(
    screen.getByLabelText('Nội dung ghi chú trong ngày'),
    'Hẹn khám lúc 10 giờ',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Lưu lại' }));

  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  const saved = onSave.mock.calls[0][1] as LifeNote;
  expect(onSave).toHaveBeenCalledWith(
    'u1',
    expect.objectContaining({
      title: 'Hẹn khám',
      body: 'Hẹn khám lúc 10 giờ',
    }),
    null,
  );
  expect(saved.id).not.toBe(existing.id);
  expect(getCalendarNoteDateKey(saved.id)).toBe('2026-10-09');
});

it('shows multiple note titles and opens only the selected note body', () => {
  const notes: LifeNote[] = [
    {
      id: 'calendar-day-2026-10-09',
      ownerId: 'u1',
      title: 'Gọi điện',
      body: 'Gọi cho gia đình',
      updatedAt: 1,
    },
    {
      id: 'calendar-day-2026-10-09-class',
      ownerId: 'u1',
      title: 'Lớp học',
      body: 'Mang theo tài liệu',
      updatedAt: 2,
    },
  ];
  render(
    <HomeDayDetailsCard
      date={new Date(2026, 9, 9)}
      uid="u1"
      notes={notes}
      synced
      onSave={jest.fn().mockResolvedValue(undefined)}
      onDelete={jest.fn().mockResolvedValue(undefined)}
    />,
  );

  expect(screen.getByText('Ghi chú')).toBeTruthy();
  expect(screen.getByText('2')).toBeTruthy();
  expect(screen.getByText('Gọi điện')).toBeTruthy();
  expect(screen.getByText('Lớp học')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Lưu lại' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Mở ghi chú: Lớp học' }));
  expect(screen.getByLabelText('Nội dung ghi chú trong ngày').props.value).toBe(
    'Mang theo tài liệu',
  );
});

it('shows a saved birthday note on the same date in a later year', () => {
  const birthday: LifeNote = {
    id: 'calendar-day-2025-09-26-birthday',
    ownerId: 'u1',
    title: 'Sinh nhật vợ',
    body: 'Mua bánh',
    updatedAt: 1,
  };
  render(
    <HomeDayDetailsCard
      date={new Date(2026, 8, 26)}
      uid="u1"
      notes={[birthday]}
      synced
      onSave={jest.fn().mockResolvedValue(undefined)}
      onDelete={jest.fn().mockResolvedValue(undefined)}
    />,
  );

  expect(
    screen.getByRole('button', { name: 'Mở ghi chú: Sinh nhật vợ' }),
  ).toBeTruthy();
});

it('creates a Giỗ note that reappears by lunar date and edits the original note', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const onDelete = jest.fn().mockResolvedValue(undefined);
  const { rerender } = render(
    <HomeDayDetailsCard
      date={new Date(2026, 3, 26)}
      uid="u1"
      notes={[]}
      synced
      onSave={onSave}
      onDelete={onDelete}
    />,
  );

  fireEvent.press(
    screen.getByRole('button', { name: 'Thêm ghi chú cho ngày này' }),
  );
  fireEvent.changeText(
    screen.getByLabelText('Tiêu đề ghi chú ngày'),
    'Giỗ ông',
  );
  expect(
    screen.getByText('Lặp hằng năm theo ngày âm lịch của ghi chú.'),
  ).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Lưu lại' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  const saved = onSave.mock.calls[0][1] as LifeNote;
  expect(getCalendarNoteDateKey(saved.id)).toBe('2026-04-26');

  rerender(
    <HomeDayDetailsCard
      date={new Date(2027, 3, 16)}
      uid="u1"
      notes={[saved]}
      synced
      onSave={onSave}
      onDelete={onDelete}
    />,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Mở ghi chú: Giỗ ông' }));
  fireEvent.changeText(
    screen.getByLabelText('Nội dung ghi chú trong ngày'),
    'Nhớ chuẩn bị hoa',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Lưu lại' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
  expect(onSave.mock.calls[1][1]).toEqual(
    expect.objectContaining({ id: saved.id, body: 'Nhớ chuẩn bị hoa' }),
  );
});

it('asks before deleting one day note and removes only the selected note', async () => {
  const note: LifeNote = {
    id: 'calendar-day-2026-10-09-trip',
    ownerId: 'u1',
    title: 'Chuẩn bị chuyến đi',
    body: 'Đặt vé tàu',
    updatedAt: 2,
  };
  const onDelete = jest.fn().mockResolvedValue(undefined);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  try {
    render(
      <HomeDayDetailsCard
        date={new Date(2026, 9, 9)}
        uid="u1"
        notes={[note]}
        synced
        onSave={jest.fn().mockResolvedValue(undefined)}
        onDelete={onDelete}
      />,
    );

    fireEvent.press(
      screen.getByRole('button', {
        name: 'Xóa ghi chú: Chuẩn bị chuyến đi',
      }),
    );
    expect(alert).toHaveBeenCalledWith(
      'Xóa ghi chú?',
      '“Chuẩn bị chuyến đi” sẽ bị xóa.',
      expect.any(Array),
    );
    expect(onDelete).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0]?.[2];
    buttons?.find((button) => button.text === 'Xóa')?.onPress?.();
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('u1', note.id));
  } finally {
    alert.mockRestore();
  }
});
