import { render, screen } from '@testing-library/react-native';
import { CardGameMoneyCounter } from '../CardGameMoneyCounter';

it.each([
  { unit: 'đ' as const, label: 'đồng' },
  { unit: 'điểm' as const, label: 'điểm' },
])('formats $unit for balances, deltas and screen readers', ({ unit, label }) => {
  render(
    <CardGameMoneyCounter
      balance={12}
      delta={5}
      unit={unit}
      animate
      testID="balance"
      animationKey={`money-counter-${unit}`}
    />,
  );

  expect(screen.getByTestId('balance')).toHaveTextContent(`+7 ${unit}`);
  expect(screen.getByTestId('balance').props.accessibilityLabel).toBe(
    `Số dư 7 ${label}`,
  );
  expect(screen.getByTestId('balance-delta')).toHaveTextContent(`+5 ${unit}`);
  expect(screen.getByTestId('balance-delta').props.children.props.accessibilityLabel).toBe(
    `Thay đổi +5 ${label}`,
  );
});
