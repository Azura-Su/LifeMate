import { fireEvent, render, screen } from '@testing-library/react-native';
import { PhomGameEntry } from '../PhomGameEntry';
import {
  DEFAULT_PHOM_CONFIG,
  PHOM_RATES,
} from '../../../services/cardGames/phomConfig';
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
it('allows each independent rate including zero, blocks blank values and sends validated configuration', () => {
  const create = jest.fn();
  render(
    <PhomGameEntry
      expanded
      disabled={false}
      busy={false}
      onToggle={jest.fn()}
      onRules={jest.fn()}
      onCreate={create}
      onJoin={jest.fn()}
    />,
  );
  for (const [i, rate] of PHOM_RATES.entries())
    fireEvent.changeText(
      screen.getByLabelText(`Mức ${rate.label}`),
      String(i * 10),
    );
  fireEvent.press(screen.getByText('Tạo phòng Phỏm'));
  expect(create).toHaveBeenCalledWith({
    ...Object.fromEntries(PHOM_RATES.map((r, i) => [r.key, i * 10])),
    options: { tai: false, send: true, uDen: true },
  });
  fireEvent.changeText(screen.getByLabelText('Mức Ù'), '');
  expect(screen.getByRole('button', { name: 'Tạo phòng Phỏm' })).toBeDisabled();
  expect(
    screen.getByText('Nhập số nguyên từ 0 đến 1.000.000.000 cho từng loại.'),
  ).toBeTruthy();
});
it('joins by code without requiring creation settings and retains the generic room flow', () => {
  const join = jest.fn();
  render(
    <PhomGameEntry
      expanded
      disabled={false}
      busy={false}
      onToggle={jest.fn()}
      onRules={jest.fn()}
      onCreate={jest.fn()}
      onJoin={join}
    />,
  );
  expect(screen.getByLabelText('Mức Nhì').props.value).toBe(
    String(DEFAULT_PHOM_CONFIG.second),
  );
  fireEvent.press(screen.getByText('Tham gia'));
  fireEvent.changeText(screen.getByLabelText('Mã phòng Phỏm'), 'abcdefgh');
  fireEvent.press(screen.getByText('Vào phòng Phỏm'));
  expect(join).toHaveBeenCalledWith('ABCDEFGH');
});
it('configures tai, sending and u liability independently before creating a room', () => {
  const create = jest.fn();
  render(
    <PhomGameEntry
      expanded
      disabled={false}
      busy={false}
      onToggle={jest.fn()}
      onRules={jest.fn()}
      onCreate={create}
      onJoin={jest.fn()}
    />,
  );
  expect(screen.getByRole('switch', { name: 'Tái' })).not.toBeChecked();
  expect(screen.getByRole('switch', { name: 'Gửi bài' })).toBeChecked();
  expect(screen.getByRole('switch', { name: 'Ù đền' })).toBeChecked();
  fireEvent(screen.getByRole('switch', { name: 'Tái' }), 'valueChange', true);
  fireEvent(
    screen.getByRole('switch', { name: 'Gửi bài' }),
    'valueChange',
    false,
  );
  fireEvent(
    screen.getByRole('switch', { name: 'Ù đền' }),
    'valueChange',
    false,
  );
  fireEvent.press(screen.getByText('Tạo phòng Phỏm'));
  expect(create).toHaveBeenCalledWith({
    ...DEFAULT_PHOM_CONFIG,
    options: { tai: true, send: false, uDen: false },
  });
  fireEvent.press(screen.getByLabelText('Khôi phục mức mặc định'));
  expect(screen.getByRole('switch', { name: 'Tái' })).not.toBeChecked();
  expect(screen.getByRole('switch', { name: 'Gửi bài' })).toBeChecked();
});
