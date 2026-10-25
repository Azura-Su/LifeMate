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
it('shows mandatory three-feed liability and configures replay liability only with tai enabled', () => {
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
  expect(screen.getByText(/Đền cấp 3 cây luôn bắt buộc/)).toBeTruthy();
  expect(screen.getAllByRole('switch')).toHaveLength(2);
  expect(screen.queryByRole('switch', { name: /Ù đền/ })).toBeNull();
  fireEvent(screen.getByRole('switch', { name: 'Tái' }), 'valueChange', true);
  expect(screen.getAllByRole('switch')).toHaveLength(3);
  expect(screen.getByRole('switch', { name: 'Ù đền do tái' })).toBeChecked();
  expect(screen.getByRole('switch', { name: 'Ù đền do tái' })).toHaveProp(
    'accessibilityHint',
    'A ăn chốt của B khiến B được tái; nếu B ù trong chính lượt thêm đó thì A phải đền.',
  );
  fireEvent(
    screen.getByRole('switch', { name: 'Gửi bài' }),
    'valueChange',
    false,
  );
  fireEvent(
    screen.getByRole('switch', { name: 'Ù đền do tái' }),
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
  expect(screen.queryByRole('switch', { name: /Ù đền/ })).toBeNull();
  fireEvent.press(screen.getByText('Tạo phòng Phỏm'));
  expect(create).toHaveBeenLastCalledWith({
    ...DEFAULT_PHOM_CONFIG,
    options: { tai: false, send: true, uDen: true },
  });
  fireEvent(screen.getByRole('switch', { name: 'Tái' }), 'valueChange', true);
  expect(screen.getByRole('switch', { name: 'Ù đền do tái' })).toBeChecked();
});

it.each([true, false])(
  'preserves dormant replay liability %s through tai toggles and creation',
  (uDen) => {
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
    fireEvent(screen.getByRole('switch', { name: 'Tái' }), 'valueChange', true);
    fireEvent(
      screen.getByRole('switch', { name: 'Ù đền do tái' }),
      'valueChange',
      uDen,
    );
    fireEvent(
      screen.getByRole('switch', { name: 'Tái' }),
      'valueChange',
      false,
    );
    expect(screen.queryByRole('switch', { name: /Ù đền/ })).toBeNull();
    expect(screen.getAllByRole('switch')).toHaveLength(2);
    expect(screen.getByText(/Đền cấp 3 cây luôn bắt buộc/)).toBeTruthy();
    fireEvent(screen.getByRole('switch', { name: 'Tái' }), 'valueChange', true);
    expect(screen.getByRole('switch', { name: 'Ù đền do tái' })).toHaveProp(
      'value',
      uDen,
    );
    fireEvent(
      screen.getByRole('switch', { name: 'Tái' }),
      'valueChange',
      false,
    );
    fireEvent.changeText(screen.getByLabelText('Mức Đền (mỗi người)'), '0');
    fireEvent.press(screen.getByText('Tạo phòng Phỏm'));
    expect(create).toHaveBeenCalledWith({
      ...DEFAULT_PHOM_CONFIG,
      den: 0,
      options: { tai: false, send: true, uDen },
    });
  },
);

it.each(['disabled', 'busy'] as const)(
  'keeps liability controls and reset disabled while %s',
  (reason) => {
    const props = {
      expanded: true,
      disabled: false,
      busy: false,
      onToggle: jest.fn(),
      onRules: jest.fn(),
      onCreate: jest.fn(),
      onJoin: jest.fn(),
    };
    const view = render(<PhomGameEntry {...props} />);
    fireEvent(screen.getByRole('switch', { name: 'Tái' }), 'valueChange', true);
    fireEvent.changeText(screen.getByLabelText('Mức Đền (mỗi người)'), '0');
    view.rerender(<PhomGameEntry {...props} {...{ [reason]: true }} />);
    for (const control of screen.getAllByRole('switch')) {
      expect(control).toBeDisabled();
      fireEvent(control, 'valueChange', false);
      expect(control).toBeChecked();
    }
    expect(screen.getByLabelText('Khôi phục mức mặc định')).toBeDisabled();
    fireEvent.press(screen.getByLabelText('Khôi phục mức mặc định'));
    expect(screen.getByLabelText('Mức Đền (mỗi người)')).toHaveProp(
      'value',
      '0',
    );
    expect(screen.getByLabelText('Mức Đền (mỗi người)')).toHaveProp(
      'editable',
      false,
    );
    expect(screen.getByRole('switch', { name: 'Tái' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Ù đền do tái' })).toBeChecked();
    expect(screen.getByText(/Đền cấp 3 cây luôn bắt buộc/)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Tạo phòng Phỏm' }),
    ).toBeDisabled();
    expect(props.onCreate).not.toHaveBeenCalled();
  },
);
