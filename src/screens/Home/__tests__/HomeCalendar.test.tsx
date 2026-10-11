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
