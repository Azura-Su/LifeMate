import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { AppTextInput } from './AppTextInput';

const MAX_DIGITS = 16;

function amountDigits(value: string) {
  return value
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '')
    .slice(0, MAX_DIGITS);
}

export function FinanceAmountInput({
  accessibilityLabel,
  value,
  onChangeText,
  editable = true,
  compact = false,
}: {
  accessibilityLabel: string;
  value: string;
  onChangeText: (digits: string) => void;
  editable?: boolean;
  compact?: boolean;
}) {
  const formatted = amountDigits(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (
    <View style={[styles.container, !compact && styles.regularContainer]}>
      <AppTextInput
        accessibilityLabel={accessibilityLabel}
        value={formatted}
        onChangeText={(text) => onChangeText(amountDigits(text))}
        placeholder="0"
        placeholderTextColor={colors.muted}
        keyboardType="number-pad"
        maxLength={MAX_DIGITS + Math.floor((MAX_DIGITS - 1) / 3)}
        editable={editable}
        style={[styles.input, !compact && styles.regularInput]}
      />
      <Text style={[styles.suffix, !compact && styles.regularSuffix]}>đ</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  regularContainer: { minHeight: 50 },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingLeft: 12,
    paddingRight: 3,
    color: colors.ink,
    fontSize: 13,
  },
  regularInput: { minHeight: 48, paddingLeft: 14, fontSize: 16 },
  suffix: { paddingRight: 10, fontSize: 13, color: colors.muted },
  regularSuffix: { paddingRight: 14, fontSize: 16 },
});
