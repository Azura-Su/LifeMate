import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { FinanceTransactionDialog } from '../FinanceTransactionDialog';
import type { FinanceTransaction } from '../../../types/finance';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
const onSave = jest.fn().mockResolvedValue(undefined);
const onClose = jest.fn();
const props = { visible: true, initialDate: '29/10/2026', onSave, onClose };
const newBill = (amount = '100000') => {
  render(<FinanceTransactionDialog {...props} />);
  fireEvent.changeText(screen.getByLabelText('Số tiền'), amount);
  fireEvent.press(screen.getByRole('switch', { name: 'Có người cần trả lại' }));
  fireEvent.changeText(screen.getByLabelText('Tên người 1'), 'An');
};
const addBinh = () => {
  fireEvent.press(
    screen.getByRole('button', { name: 'Thêm người cần trả lại' }),
  );
  fireEvent.changeText(screen.getByLabelText('Tên người 2'), 'Bình');
};
const select = (name: string) =>
  fireEvent.press(screen.getByRole('radio', { name }));
beforeEach(() => jest.clearAllMocks());

it('equal split recalculates for people, total and self inclusion, saving exact debts', async () => {
  newBill();
  select('Chia đều');
  expect(screen.getByLabelText('Số tiền người 1 cần trả').props.value).toBe(
    '50.000',
  );
  expect(screen.getByLabelText('Số tiền người 1 cần trả').props.editable).toBe(
    false,
  );
  addBinh();
  expect(screen.getByText('Phần của tôi dự kiến: 33.334 ₫')).toBeTruthy();
  fireEvent.press(screen.getByRole('switch', { name: 'Tính cả phần của tôi' }));
  expect(screen.getByLabelText('Số tiền người 1 cần trả').props.value).toBe(
    '50.000',
  );
  expect(screen.getByText('Phần của tôi dự kiến: 0 ₫')).toBeTruthy();
  fireEvent.press(screen.getByRole('switch', { name: 'Tính cả phần của tôi' }));
  fireEvent.press(screen.getByRole('button', { name: 'Bỏ người 2' }));
  expect(screen.getByLabelText('Số tiền người 1 cần trả').props.value).toBe(
    '50.000',
  );
  addBinh();
  fireEvent.changeText(screen.getByLabelText('Số tiền'), '300001');
  fireEvent.press(screen.getByRole('button', { name: 'Lưu giao dịch' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(onSave.mock.calls[0][0].sharedExpense).toEqual({
    participants: [
      { id: expect.any(String), name: 'An', owedAmount: 100000 },
      { id: expect.any(String), name: 'Bình', owedAmount: 100000 },
    ],
    receipts: [],
  });
});

it('portion mode accepts comma/dot decimals and zero self, then manual captures displayed amounts', async () => {
  newBill('100001');
  addBinh();
  select('Theo suất');
  fireEvent.changeText(screen.getByLabelText('Số suất của tôi'), '0');
  fireEvent.changeText(screen.getByLabelText('Số suất người 1'), '1,5');
  fireEvent.changeText(screen.getByLabelText('Số suất người 2'), '0.5');
  expect(screen.getByLabelText('Số tiền người 1 cần trả').props.value).toBe(
    '75.001',
  );
  expect(screen.getByLabelText('Số tiền người 2 cần trả').props.value).toBe(
    '25.000',
  );
  select('Tự nhập');
  expect(screen.getByLabelText('Số tiền người 1 cần trả').props.value).toBe(
    '75.001',
  );
  expect(screen.getByLabelText('Số tiền người 1 cần trả').props.editable).toBe(
    true,
  );
  fireEvent.changeText(
    screen.getByLabelText('Số tiền người 1 cần trả'),
    '50000',
  );
  expect(screen.getByText('Phần của tôi dự kiến: 25.001 ₫')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Lưu giao dịch' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(
    onSave.mock.calls[0][0].sharedExpense.participants.map(
      (p: { owedAmount: number }) => p.owedAmount,
    ),
  ).toEqual([50000, 25000]);
});

it.each(['0', '-1', '1.001', 'abc', '10000'])(
  'blocks invalid other portions %s and clears stale calculations',
  (portions) => {
    newBill();
    select('Theo suất');
    expect(screen.getByLabelText('Số tiền người 1 cần trả').props.value).toBe(
      '50.000',
    );
    fireEvent.changeText(screen.getByLabelText('Số suất người 1'), portions);
    expect(screen.getByLabelText('Số tiền người 1 cần trả').props.value).toBe(
      '',
    );
    expect(
      screen.getByRole('button', { name: 'Lưu giao dịch' }).props
        .accessibilityState.disabled,
    ).toBe(true);
    fireEvent.press(screen.getByRole('button', { name: 'Lưu giao dịch' }));
    expect(onSave).not.toHaveBeenCalled();
  },
);

it('blocks rounding to zero debt for a tiny bill', () => {
  newBill('1');
  addBinh();
  select('Chia đều');
  expect(screen.getByText(/Số tiền quá nhỏ/)).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Lưu giao dịch' }).props
      .accessibilityState.disabled,
  ).toBe(true);
});

const existing: FinanceTransaction = {
  id: 'bill',
  ownerId: 'u',
  type: 'expense',
  amount: 500000,
  category: 'Ăn uống',
  note: '',
  createdAt: new Date(2026, 9, 29).getTime(),
  sharedExpense: {
    participants: [
      { id: 'an', name: 'An', owedAmount: 300000 },
      { id: 'binh', name: 'Bình', owedAmount: 100000 },
    ],
    receipts: [
      {
        id: 'r',
        participantId: 'an',
        amount: 250000,
        receivedAt: new Date(2026, 9, 29).getTime(),
        note: 'Đã trả',
      },
    ],
  },
};
it('opens saved amounts manually, protects repaid people and preserves receipts after recalculation', async () => {
  render(<FinanceTransactionDialog {...props} initialTransaction={existing} />);
  expect(
    screen.getByRole('radio', { name: 'Tự nhập' }).props.accessibilityState
      .checked,
  ).toBe(true);
  expect(screen.getByLabelText('Số tiền người 1 cần trả').props.value).toBe(
    '300.000',
  );
  expect(screen.queryByRole('button', { name: 'Bỏ người 1' })).toBeNull();
  select('Chia đều');
  fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  expect(
    screen.getByText('Không thể giảm phần cần trả thấp hơn số đã nhận.'),
  ).toBeTruthy();
  expect(onSave).not.toHaveBeenCalled();
  select('Theo suất');
  fireEvent.changeText(screen.getByLabelText('Số suất của tôi'), '0');
  fireEvent.changeText(screen.getByLabelText('Số suất người 1'), '3');
  fireEvent.changeText(screen.getByLabelText('Số suất người 2'), '2');
  fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(onSave.mock.calls[0][0].sharedExpense).toEqual({
    participants: [
      { id: 'an', name: 'An', owedAmount: 300000 },
      { id: 'binh', name: 'Bình', owedAmount: 200000 },
    ],
    receipts: existing.sharedExpense!.receipts,
  });
  expect(onSave.mock.calls[0][1]).toBe('bill');
});

it('resets split settings on close/reopen and never saves a split on income', async () => {
  const view = render(<FinanceTransactionDialog {...props} />);
  fireEvent.changeText(screen.getByLabelText('Số tiền'), '100000');
  fireEvent.press(screen.getByRole('switch', { name: 'Có người cần trả lại' }));
  fireEvent.changeText(screen.getByLabelText('Tên người 1'), 'An');
  select('Chia đều');
  fireEvent.press(screen.getByRole('button', { name: 'Thu nhập' }));
  expect(screen.queryByRole('radio', { name: 'Chia đều' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Lưu giao dịch' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(onSave.mock.calls[0][0].sharedExpense).toBeUndefined();
  view.rerender(<FinanceTransactionDialog {...props} visible={false} />);
  view.rerender(<FinanceTransactionDialog {...props} />);
  fireEvent.press(screen.getByRole('switch', { name: 'Có người cần trả lại' }));
  expect(
    screen.getByRole('radio', { name: 'Tự nhập' }).props.accessibilityState
      .checked,
  ).toBe(true);
  expect(screen.getByLabelText('Tên người 1').props.value).toBe('');
});
