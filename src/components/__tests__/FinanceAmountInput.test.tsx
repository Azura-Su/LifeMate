import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FinanceAmountInput } from '../FinanceAmountInput';
import { FinanceAmountWords } from '../FinanceAmountWords';

function AmountForm() {
  const [amount, setAmount] = useState('');
  return (
    <>
      <FinanceAmountInput
        accessibilityLabel="Số tiền"
        value={amount}
        onChangeText={setAmount}
        compact
      />
      <FinanceAmountWords value={amount} />
    </>
  );
}

it('formats the amount in the field and reads it underneath while typing', () => {
  render(<AmountForm />);
  fireEvent.changeText(screen.getByLabelText('Số tiền'), '100000');

  expect(screen.getByLabelText('Số tiền').props.value).toBe('100.000');
  expect(screen.getByText('đ')).toBeTruthy();
  expect(screen.getByText('Một trăm nghìn đồng')).toBeTruthy();

  fireEvent.changeText(screen.getByLabelText('Số tiền'), '100.0000');
  expect(screen.getByLabelText('Số tiền').props.value).toBe('1.000.000');
  expect(screen.getByText('Một triệu đồng')).toBeTruthy();

  fireEvent.changeText(screen.getByLabelText('Số tiền'), '');
  expect(screen.getByLabelText('Số tiền').props.value).toBe('');
  expect(screen.queryByText('Một triệu đồng')).toBeNull();
});

it('passes plain digits back to form state', () => {
  const onChangeText = jest.fn();
  render(
    <FinanceAmountInput
      accessibilityLabel="Số tiền"
      value="22222"
      onChangeText={onChangeText}
    />,
  );
  fireEvent.changeText(screen.getByLabelText('Số tiền'), '22.2223');
  expect(onChangeText).toHaveBeenCalledWith('222223');
});
