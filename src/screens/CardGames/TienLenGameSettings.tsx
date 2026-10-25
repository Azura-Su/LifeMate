import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppTextInput } from '../../components/AppTextInput';
import { colors, spacing } from '../../theme';
import { SOUTH_FINISH_MODES } from '../../services/cardGames/tienLenConfig';
import type { SouthConfig } from '../../types/tienLen';
import { styles } from './CardGamesScreen.styles';

const MODE_INFO: Record<
  SouthConfig['finishMode'],
  { short: string; hint: string }
> = {
  'first-winner': {
    short: 'Dừng khi có người nhất',
    hint: 'Người còn bài trả theo số lá cho người nhất.',
  },
  continue: {
    short: 'Đánh đến hết ván',
    hint: 'Chơi tiếp đến khi chỉ còn một người có bài.',
  },
};

export function TienLenGameSettings({
  finishMode,
  onFinishMode,
  amountPerCard,
  onAmountPerCard,
  cutTwoAmount,
  onCutTwoAmount,
  disabled,
}: {
  finishMode: SouthConfig['finishMode'];
  onFinishMode: (mode: SouthConfig['finishMode']) => void;
  amountPerCard: string;
  onAmountPerCard: (value: string) => void;
  cutTwoAmount: string;
  onCutTwoAmount: (value: string) => void;
  disabled: boolean;
}) {
  const validFine =
    cutTwoAmount !== '' &&
    Number.isSafeInteger(Number(cutTwoAmount)) &&
    Number(cutTwoAmount) <= 1_000_000_000;
  const rates = [
    {
      key: 'card',
      title: 'Phạt mỗi lá còn lại',
      hint: 'Người nhất nhận',
      unit: 'đ/lá',
      label: 'Số tiền trừ cho mỗi lá còn lại',
      value: amountPerCard,
      onChange: onAmountPerCard,
      placeholder: '1',
      invalid: false,
    },
    {
      key: 'two',
      title: 'Phạt chặt 2',
      hint: 'Người bị chặt trả · 0 là tắt',
      unit: 'đ/lá',
      label: 'Số tiền phạt cho mỗi lá 2 bị chặt',
      value: cutTwoAmount,
      onChange: onCutTwoAmount,
      placeholder: '0',
      invalid: !validFine,
    },
  ];
  return (
    <View style={s.container}>
      <View style={s.section}>
        <Text style={s.label}>Kết thúc ván</Text>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Chế độ kết thúc ván"
          style={s.segment}
        >
          {[...SOUTH_FINISH_MODES]
            .sort((a) => (a.value === 'first-winner' ? -1 : 1))
            .map((mode) => {
              const on = finishMode === mode.value;
              const info = MODE_INFO[mode.value];
              return (
                <Pressable
                  key={mode.value}
                  accessibilityRole="radio"
                  accessibilityLabel={mode.label}
                  accessibilityHint={info.hint}
                  accessibilityState={{ checked: on, disabled }}
                  disabled={disabled}
                  onPress={() => onFinishMode(mode.value)}
                  style={[s.segmentItem, on && s.segmentOn]}
                >
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    style={[s.segmentText, on && s.segmentTextOn]}
                  >
                    {info.short}
                  </Text>
                </Pressable>
              );
            })}
        </View>
        <Text style={s.hint}>{MODE_INFO[finishMode].hint}</Text>
      </View>
      <View style={s.section}>
        <Text style={s.label}>Mức phạt</Text>
        <View style={s.card}>
          {rates.map((rate, index) => (
            <View key={rate.key} style={[s.row, index > 0 && s.rowLine]}>
              <View style={s.rowCopy}>
                <Text style={s.rowTitle}>{rate.title}</Text>
                <Text style={s.hint}>{rate.hint}</Text>
              </View>
              <View style={[s.inputBox, rate.invalid && s.inputInvalid]}>
                <AppTextInput
                  accessibilityLabel={rate.label}
                  value={rate.value}
                  onChangeText={(v) =>
                    rate.onChange(v.replace(/\D/g, '').slice(0, 10))
                  }
                  keyboardType="number-pad"
                  editable={!disabled}
                  selectTextOnFocus
                  placeholder={rate.placeholder}
                  style={s.input}
                />
                <Text style={s.unit}>{rate.unit}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
      {!validFine && (
        <Text accessibilityRole="alert" style={styles.error}>
          Tiền chặt 2 từ 0 đến 1.000.000.000 đ/lá.
        </Text>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  container: { gap: spacing.md },
  section: { gap: 6 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  segment: {
    flexDirection: 'row',
    padding: 3,
    gap: 3,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.line,
  },
  segmentItem: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: 9,
  },
  segmentOn: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  segmentTextOn: { color: colors.earth, fontWeight: '700' },
  hint: { fontSize: 11, lineHeight: 15, color: colors.muted },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 8,
  },
  rowLine: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  rowCopy: { flex: 1, gap: 1 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 96,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background,
    paddingRight: 8,
  },
  inputInvalid: { borderColor: colors.danger },
  input: {
    flex: 1,
    height: 32,
    paddingHorizontal: 8,
    paddingVertical: 0,
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  unit: { fontSize: 11, color: colors.muted },
});
