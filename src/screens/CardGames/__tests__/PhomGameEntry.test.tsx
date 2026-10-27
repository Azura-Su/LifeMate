import { fireEvent, render, screen } from '@testing-library/react-native';
import { PhomGameEntry } from '../PhomGameEntry';
jest.mock('@expo/vector-icons/Feather', () => 'Feather');

it('selects Phỏm without rendering a duplicate room action', () => {
  const onToggle = jest.fn();
  render(<PhomGameEntry expanded onToggle={onToggle} onRules={jest.fn()} />);
  expect(
    screen.getByRole('button', { name: 'Chọn Phỏm' }).props.accessibilityState,
  ).toMatchObject({ selected: true });
  expect(screen.queryByRole('button', { name: 'Tạo phòng' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Vào phòng có sẵn' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Chọn Phỏm' }));
  expect(onToggle).toHaveBeenCalledTimes(1);
});

it('opens Phỏm rules independently from game selection', () => {
  const onRules = jest.fn();
  render(
    <PhomGameEntry expanded={false} onToggle={jest.fn()} onRules={onRules} />,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Xem luật Phỏm' }));
  expect(onRules).toHaveBeenCalledTimes(1);
});
