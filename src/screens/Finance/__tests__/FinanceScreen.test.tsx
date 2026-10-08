import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FinanceScreen } from '../FinanceScreen';
import { useAuthStore } from '../../../store/authStore';
import { useFinanceStore } from '../../../store/financeStore';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);

beforeEach(async () => {
  await AsyncStorage.clear();
  useAuthStore.getState().setUser({
    uid: 'finance-user',
    email: 'person@example.com',
    displayName: null,
  });
  useFinanceStore.setState({
    uid: null,
    transactions: [],
    loading: false,
    error: null,
  });
});

it('shows a clear empty state and zero month totals', async () => {
  render(<FinanceScreen />);
  expect(await screen.findByText('Chưa có giao dịch nào')).toBeTruthy();
  expect(screen.getByText('Thu vào')).toBeTruthy();
  expect(screen.getByText('Chi ra')).toBeTruthy();
  expect(screen.getByText('Còn lại trong tháng')).toBeTruthy();
});

it('records salary and updates the persisted month overview', async () => {
  render(<FinanceScreen />);
  fireEvent.press(
    await screen.findByRole('button', { name: 'Thêm giao dịch' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Thu nhập' }));
  fireEvent.changeText(screen.getByLabelText('Số tiền'), '25000000');
  fireEvent.changeText(screen.getByLabelText('Ghi chú'), 'Lương tháng này');
  fireEvent.press(screen.getByRole('button', { name: 'Lưu giao dịch' }));

  expect(await screen.findByText('Lương tháng này')).toBeTruthy();
  expect(screen.getAllByText('25.000.000 ₫').length).toBeGreaterThan(0);
  expect(
    await AsyncStorage.getItem('lifemate:finance:v1:finance-user'),
  ).not.toBeNull();
});
