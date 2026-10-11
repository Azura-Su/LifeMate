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

function renderCard(
  overrides: Partial<React.ComponentProps<typeof HomeFinanceCard>> = {},
) {
  return render(
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
        canViewFinance
        onOpenFinance={jest.fn()}
        {...overrides}
      />
    </SafeAreaProvider>,
  );
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
  expect(screen.getByText('Chưa có giao dịch trong ngày này.')).toBeTruthy();
});

it('opens the month picker to choose any date without expanding the Home card', () => {
  renderCard();

  fireEvent.press(screen.getByRole('button', { name: 'Chọn ngày, hôm nay' }));

  expect(screen.getByTestId('home-finance-picker')).toBeTruthy();
  fireEvent.press(screen.getByTestId('home-finance-picker-day-2026-10-20'));

  expect(screen.queryByTestId('home-finance-picker')).toBeNull();
  expect(screen.getByText('20 thg 10')).toBeTruthy();
  expect(
    screen.getByRole('button', {
      name: 'Chọn ngày, Thứ Ba, 20 tháng 10',
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
  expect(screen.getByText('28 thg 2')).toBeTruthy();
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

it('does not reveal amounts or activity marks while finance is locked', () => {
  const onOpenFinance = jest.fn();
  renderCard({ canViewFinance: false, onOpenFinance });

  expect(screen.queryByText('300.000 ₫')).toBeNull();
  expect(screen.queryByTestId('home-finance-day-2026-10-11')).toBeNull();
  expect(screen.queryByRole('button', { name: /Chọn ngày/ })).toBeNull();
  fireEvent.press(
    screen.getByRole('button', { name: 'Mở Tài chính để xác thực' }),
  );
  expect(onOpenFinance).toHaveBeenCalledTimes(1);
});
