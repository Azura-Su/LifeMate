import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { FinanceTransaction } from '../../../types/finance';
import { HomeFinanceCard } from '../HomeFinanceCard';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');

const today = new Date(2026, 9, 11, 12);
const transactions: FinanceTransaction[] = [
  {
    id: 'salary',
    ownerId: 'u1',
    type: 'income',
    amount: 300_000,
    category: 'Lương',
    note: '',
    createdAt: new Date(2026, 9, 11, 12).getTime(),
  },
  {
    id: 'lunch',
    ownerId: 'u1',
    type: 'expense',
    amount: 80_000,
    category: 'Ăn uống',
    note: '',
    createdAt: new Date(2026, 9, 11, 12).getTime(),
  },
  {
    id: 'bonus',
    ownerId: 'u1',
    type: 'income',
    amount: 40_000,
    category: 'Thưởng',
    note: '',
    createdAt: new Date(2026, 9, 12, 12).getTime(),
  },
];

function cardElement(
  overrides: Partial<React.ComponentProps<typeof HomeFinanceCard>> = {},
) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
      }}
    >
      <HomeFinanceCard
        today={today}
        transactions={transactions}
        loading={false}
        error={null}
        onOpenFinance={jest.fn()}
        {...overrides}
      />
    </SafeAreaProvider>
  );
}

function renderCard(
  overrides: Partial<React.ComponentProps<typeof HomeFinanceCard>> = {},
) {
  return render(cardElement(overrides));
}

it('shows both totals for today and updates them when another day is selected', () => {
  renderCard();

  expect(screen.getByText('300.000 ₫')).toBeTruthy();
  expect(screen.getByText('80.000 ₫')).toBeTruthy();
  expect(screen.getByText('Tài chính')).toBeTruthy();
  expect(screen.getByTestId('home-finance-heading-date')).toBeTruthy();
  expect(screen.queryByTestId('home-finance-summary-date')).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Chọn ngày, hôm nay' }),
  ).toBeTruthy();
  expect(screen.queryByTestId('home-finance-picker')).toBeNull();
  expect(screen.queryByTestId('home-finance-day-2026-10-12')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Chọn ngày, hôm nay' }));
  expect(
    screen.getByTestId('home-finance-picker-day-2026-10-11').props
      .accessibilityState.selected,
  ).toBe(true);
  fireEvent.press(screen.getByTestId('home-finance-picker-day-2026-10-12'));

  expect(screen.getByText('Tài chính')).toBeTruthy();
  expect(screen.getByText('40.000 ₫')).toBeTruthy();
  expect(screen.getByText('0 ₫')).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: /^Chọn ngày,/ }));
  fireEvent.press(screen.getByTestId('home-finance-picker-day-2026-10-13'));
  expect(screen.queryByText('Chưa có giao dịch trong ngày này.')).toBeNull();
});

it('opens the month picker to choose any date without expanding the Home card', () => {
  renderCard();

  fireEvent.press(screen.getByRole('button', { name: 'Chọn ngày, hôm nay' }));

  expect(screen.getByTestId('home-finance-picker')).toBeTruthy();
  fireEvent.press(screen.getByTestId('home-finance-picker-day-2026-10-20'));

  expect(screen.queryByTestId('home-finance-picker')).toBeNull();
  expect(screen.getByText('20/10')).toBeTruthy();
  expect(
    screen.getByRole('button', {
      name: /^Chọn ngày, Thứ Ba, 20 tháng 10/,
    }),
  ).toBeTruthy();
  expect(screen.getByText('Tài chính')).toBeTruthy();
});

it('changes month in the picker and can return to today', () => {
  renderCard({ today: new Date(2026, 2, 31, 12) });

  fireEvent.press(screen.getByRole('button', { name: 'Chọn ngày, hôm nay' }));
  fireEvent.press(screen.getByRole('button', { name: 'Tháng trước' }));

  expect(screen.getByTestId('home-finance-month-label').props.children).toMatch(
    /tháng 2/i,
  );
  fireEvent.press(screen.getByTestId('home-finance-picker-day-2026-02-28'));
  expect(screen.queryByTestId('home-finance-picker')).toBeNull();
  expect(screen.getByText('28/02')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Về hôm nay' }));
  fireEvent.press(screen.getByRole('button', { name: 'Chọn ngày, hôm nay' }));
  expect(
    screen.getByTestId('home-finance-picker-day-2026-03-31').props
      .accessibilityState.selected,
  ).toBe(true);
  expect(screen.getByTestId('home-finance-month-label').props.children).toMatch(
    /tháng 3/i,
  );
});

it('keeps the summary on today when the Home card remains mounted overnight', () => {
  const view = renderCard({
    today: new Date(2026, 9, 11, 23, 55),
    transactions: [],
  });

  view.rerender(
    cardElement({
      today: new Date(2026, 9, 12, 0, 5),
      transactions: [
        {
          id: 'after-midnight-expense',
          ownerId: 'u1',
          type: 'expense',
          amount: 125_000,
          category: 'Ăn uống',
          note: 'Ăn khuya',
          createdAt: new Date(2026, 9, 12, 0, 2).getTime(),
        },
      ],
    }),
  );

  expect(
    screen.getByRole('button', { name: 'Chọn ngày, hôm nay' }),
  ).toBeTruthy();
  expect(screen.getByText('125.000 ₫')).toBeTruthy();
});

it('always displays the Home summary and date picker', () => {
  renderCard();

  expect(screen.getByText('300.000 ₫')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Chọn ngày, hôm nay' }),
  ).toBeTruthy();
  expect(screen.queryByText('Tóm tắt trên Home đang ẩn')).toBeNull();
});
