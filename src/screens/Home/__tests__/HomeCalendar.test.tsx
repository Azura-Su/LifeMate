import { fireEvent, render, screen } from '@testing-library/react-native';
import type { LifeNote } from '../../../types/note';
import { HomeCalendar } from '../HomeCalendar';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');

it('shows the selected solar date with its Vietnamese lunar date and holiday', () => {
  const onSelect = jest.fn();
  render(
    <HomeCalendar selectedDate={new Date(2026, 1, 17)} onSelect={onSelect} />,
  );

  const tet = screen.getByTestId('calendar-day-2026-02-17');
  expect(tet.props.accessibilityLabel).toContain('17 tháng 2, ngày âm 1/1');
  expect(tet.props.accessibilityLabel).toContain('Tết Nguyên Đán');
  expect(tet.props.accessibilityState.selected).toBe(true);
});

it('marks dates that have a saved note', () => {
  render(
    <HomeCalendar
      selectedDate={new Date(2026, 9, 9)}
      noteDateKeys={['2026-10-09']}
      onSelect={jest.fn()}
    />,
  );
  expect(screen.getByTestId('calendar-note-dot-2026-10-09')).toBeTruthy();
  expect(
    screen.getByTestId('calendar-day-2026-10-09').props.accessibilityLabel,
  ).toContain('có ghi chú');
});

it('marks the next year date for a saved birthday note', () => {
  const birthday: LifeNote = {
    id: 'calendar-day-2025-09-26-birthday',
    ownerId: 'u1',
    title: 'Sinh nhật vợ',
    body: '',
    updatedAt: 1,
  };
  render(
    <HomeCalendar
      selectedDate={new Date(2026, 8, 26)}
      notes={[birthday]}
      onSelect={jest.fn()}
    />,
  );

  expect(screen.getByTestId('calendar-note-dot-2026-09-26')).toBeTruthy();
});

it('marks the lunar anniversary date in a later year for a Giỗ note', () => {
  const anniversary: LifeNote = {
    id: 'calendar-day-2026-04-26-anniversary',
    ownerId: 'u1',
    title: 'Giỗ ông',
    body: '',
    updatedAt: 1,
  };
  render(
    <HomeCalendar
      selectedDate={new Date(2027, 3, 16)}
      notes={[anniversary]}
      onSelect={jest.fn()}
    />,
  );

  expect(screen.getByTestId('calendar-note-dot-2027-04-16')).toBeTruthy();
  expect(screen.queryByTestId('calendar-note-dot-2027-04-26')).toBeNull();
});

it('changes the selected date when moving months and supports picking a day', () => {
  const onSelect = jest.fn();
  render(
    <HomeCalendar selectedDate={new Date(2026, 0, 31)} onSelect={onSelect} />,
  );

  fireEvent.press(screen.getByRole('button', { name: 'Tháng sau' }));
  expect(onSelect).toHaveBeenLastCalledWith(new Date(2026, 1, 28));

  fireEvent.press(screen.getByTestId('calendar-day-2026-01-01'));
  expect(onSelect).toHaveBeenLastCalledWith(new Date(2026, 0, 1));
});

it('opens a year picker from the year label and jumps to a chosen year', () => {
  const onSelect = jest.fn();
  render(
    <HomeCalendar selectedDate={new Date(2026, 9, 15)} onSelect={onSelect} />,
  );

  fireEvent.press(screen.getByRole('button', { name: 'Mở chọn năm 2026' }));
  expect(screen.getByText('2016 – 2027')).toBeTruthy();
  expect(screen.queryByTestId('calendar-day-2026-10-15')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: '12 năm sau' }));
  fireEvent.press(screen.getByRole('button', { name: 'Chọn năm 2030' }));

  expect(onSelect).toHaveBeenCalledWith(new Date(2030, 9, 15));
  expect(screen.queryByRole('button', { name: 'Chọn năm 2030' })).toBeNull();
});

it('clamps February 29 when choosing a non-leap year', () => {
  const onSelect = jest.fn();
  render(
    <HomeCalendar selectedDate={new Date(2024, 1, 29)} onSelect={onSelect} />,
  );

  fireEvent.press(screen.getByRole('button', { name: 'Mở chọn năm 2024' }));
  fireEvent.press(screen.getByRole('button', { name: 'Chọn năm 2025' }));
  expect(onSelect).toHaveBeenCalledWith(new Date(2025, 1, 28));
});

it('changes only the visible year when calendar navigation is controlled separately', () => {
  const onSelect = jest.fn();
  const onMonthChange = jest.fn();
  render(
    <HomeCalendar
      selectedDate={new Date(2026, 9, 15)}
      monthDate={new Date(2026, 9, 15)}
      onSelect={onSelect}
      onMonthChange={onMonthChange}
    />,
  );

  fireEvent.press(screen.getByRole('button', { name: 'Mở chọn năm 2026' }));
  fireEvent.press(screen.getByRole('button', { name: 'Chọn năm 2027' }));
  expect(onMonthChange).toHaveBeenCalledWith(new Date(2027, 9, 15));
  expect(onSelect).not.toHaveBeenCalled();
});

it('limits year pages to the supported calendar range', () => {
  const onSelect = jest.fn();
  const { rerender } = render(
    <HomeCalendar selectedDate={new Date(1800, 0, 1)} onSelect={onSelect} />,
  );

  fireEvent.press(screen.getByRole('button', { name: 'Mở chọn năm 1800' }));
  expect(
    screen.getByRole('button', { name: '12 năm trước' }).props
      .accessibilityState.disabled,
  ).toBe(true);
  expect(screen.queryByRole('button', { name: 'Chọn năm 1799' })).toBeNull();

  rerender(
    <HomeCalendar selectedDate={new Date(2200, 11, 1)} onSelect={onSelect} />,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Về hôm nay' }));
  fireEvent.press(screen.getByRole('button', { name: 'Mở chọn năm 2200' }));
  expect(
    screen.getByRole('button', { name: '12 năm sau' }).props.accessibilityState
      .disabled,
  ).toBe(true);
  expect(screen.queryByRole('button', { name: 'Chọn năm 2201' })).toBeNull();
});

it('keeps dates outside the lunar conversion range disabled at both ends', () => {
  const onSelect = jest.fn();
  const { rerender } = render(
    <HomeCalendar selectedDate={new Date(1800, 0, 1)} onSelect={onSelect} />,
  );

  const previousMonth = screen.getByRole('button', { name: 'Tháng trước' });
  expect(previousMonth.props.accessibilityState.disabled).toBe(true);
  expect(
    screen.getByTestId('calendar-day-1799-12-29').props.accessibilityState
      .disabled,
  ).toBe(true);
  fireEvent.press(previousMonth);
  fireEvent.press(screen.getByTestId('calendar-day-1799-12-29'));
  expect(onSelect).not.toHaveBeenCalled();

  rerender(
    <HomeCalendar selectedDate={new Date(2200, 11, 1)} onSelect={onSelect} />,
  );
  expect(
    screen.getByRole('button', { name: 'Tháng sau' }).props.accessibilityState
      .disabled,
  ).toBe(true);
  expect(
    screen.getByTestId('calendar-day-2201-01-01').props.accessibilityState
      .disabled,
  ).toBe(true);
  fireEvent.press(screen.getByRole('button', { name: 'Tháng sau' }));
  fireEvent.press(screen.getByTestId('calendar-day-2201-01-01'));
  expect(onSelect).not.toHaveBeenCalled();
});
