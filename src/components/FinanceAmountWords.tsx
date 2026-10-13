import { StyleSheet, Text } from 'react-native';
import { colors } from '../theme';
import { formatFinanceAmountWords } from '../utils/financeAmountWords';

export function FinanceAmountWords({ value }: { value: string }) {
  const words = formatFinanceAmountWords(value);
  return words ? (
    <Text accessibilityLabel={`Số tiền bằng chữ: ${words}`} style={styles.text}>
      {words}
    </Text>
  ) : null;
}

const styles = StyleSheet.create({
  text: { fontSize: 11, lineHeight: 16, color: colors.earth },
});
