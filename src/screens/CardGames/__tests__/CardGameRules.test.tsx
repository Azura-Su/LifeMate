import { render, screen } from '@testing-library/react-native';
import { CardGameRules } from '../CardGameRules';
import { DEFAULT_PHOM_CONFIG } from '../../../services/cardGames/phomConfig';
import type { PhomConfig } from '../../../types/phom';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');

it('explains mandatory three-feed liability and the causal extra-turn rule before joining', () => {
  render(<CardGameRules visible onClose={jest.fn()} gameKind="phom" />);
  expect(
    screen.getByText(/Cấp đủ 3 lá cho người ù luôn phải đền/),
  ).toBeTruthy();
  expect(
    screen.getByText(
      /A ăn chốt của B khiến B được tái; nếu B ù trong chính lượt thêm đó thì A phải đền/,
    ),
  ).toBeTruthy();
  expect(screen.queryByText(/người ăn chốt gần nhất/)).toBeNull();
  expect(screen.queryByText(/Tắt Ù đền thì/)).toBeNull();
  expect(screen.queryByRole('switch')).toBeNull();
});

it.each([
  { tai: false, send: true, uDen: true },
  { tai: false, send: false, uDen: false },
  { tai: true, send: true, uDen: true },
  { tai: true, send: false, uDen: false },
])(
  'shows only applicable room options for %j while retaining mandatory liability at den zero',
  (options) => {
    render(
      <CardGameRules
        visible
        onClose={jest.fn()}
        gameKind="phom"
        phomConfig={{ ...DEFAULT_PHOM_CONFIG, den: 0, options }}
      />,
    );
    expect(screen.getByText(/Đền cấp 3 cây luôn bắt buộc/)).toBeTruthy();
    expect(
      screen.getByText(`Tái: ${options.tai ? 'Bật' : 'Tắt'}`),
    ).toBeTruthy();
    expect(
      screen.getByText(`Gửi bài: ${options.send ? 'Bật' : 'Tắt'}`),
    ).toBeTruthy();
    if (options.tai) {
      expect(
        screen.getByText(`Ù đền do tái: ${options.uDen ? 'Bật' : 'Tắt'}`),
      ).toBeTruthy();
    } else {
      expect(screen.queryByText(/^Ù đền/)).toBeNull();
    }
    expect(screen.getByText('Đền (mỗi người): 0')).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
  },
);

it.each([true, false])(
  'resolves tai independently in current and pending summaries (current tai %s)',
  (tai) => {
    const phomConfig: PhomConfig = {
      ...DEFAULT_PHOM_CONFIG,
      options: { tai, send: true, uDen: true },
    };
    const nextPhomConfig: PhomConfig = {
      ...DEFAULT_PHOM_CONFIG,
      den: 0,
      options: { tai: !tai, send: false, uDen: false },
    };
    render(
      <CardGameRules
        visible
        onClose={jest.fn()}
        gameKind="phom"
        phomConfig={phomConfig}
        nextPhomConfig={nextPhomConfig}
      />,
    );
    expect(screen.getByText('Luật ván hiện tại')).toBeTruthy();
    expect(screen.getByText('Luật ván tới')).toBeTruthy();
    expect(screen.getAllByText(/Đền cấp 3 cây luôn bắt buộc/)).toHaveLength(2);
    expect(
      screen.getByText(`Ù đền do tái: ${tai ? 'Bật' : 'Tắt'}`),
    ).toBeTruthy();
    expect(screen.getAllByText(/^Ù đền/)).toHaveLength(1);
    expect(screen.getByText('Đền (mỗi người): 0')).toBeTruthy();
  },
);

it('keeps legacy default options and hides dormant replay liability in current and pending rules', () => {
  render(
    <CardGameRules
      visible
      onClose={jest.fn()}
      gameKind="phom"
      phomConfig={DEFAULT_PHOM_CONFIG}
      nextPhomConfig={{ ...DEFAULT_PHOM_CONFIG, den: 0 }}
    />,
  );
  expect(screen.getAllByText('Tái: Tắt')).toHaveLength(2);
  expect(screen.getAllByText('Gửi bài: Bật')).toHaveLength(2);
  expect(screen.getAllByText(/Đền cấp 3 cây luôn bắt buộc/)).toHaveLength(2);
  expect(screen.queryByText(/^Ù đền/)).toBeNull();
});
