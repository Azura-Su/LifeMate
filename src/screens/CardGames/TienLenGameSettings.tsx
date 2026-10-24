import { Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { AppTextInput } from '../../components/AppTextInput';
import { colors, spacing } from '../../theme';
import { SOUTH_FINISH_MODES } from '../../services/cardGames/tienLenConfig';
import type { SouthConfig } from '../../types/tienLen';
import { styles } from './CardGamesScreen.styles';

const MODE_INFO: Record<SouthConfig['finishMode'], { hint: string }> = {
  'first-winner': {
    hint: 'Người còn bài trả theo số lá cho người nhất.',
  },
  continue: {
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
      <View style={s.group}>
        <View style={s.groupHeading}>
          <View style={s.groupIcon}>
            <Feather name="flag" size={13} color={colors.earth} />
          </View>
          <Text style={s.groupTitle}>Kết thúc ván</Text>
        </View>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Chế độ kết thúc ván"
          style={s.modes}
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
                  style={[s.mode, on && s.modeOn]}
                >
                  <View style={[s.radio, on && s.radioOn]}>
                    {on && <View style={s.radioDot} />}
                  </View>
                  <View style={s.modeCopy}>
                    <Text style={[s.modeTitle, on && s.modeTitleOn]}>
                      {mode.label}
                    </Text>
                    <Text style={s.hint}>{info.hint}</Text>
                  </View>
                </Pressable>
              );
            })}
        </View>
      </View>
      <View style={s.group}>
        <View style={s.groupHeading}>
          <View style={s.groupIcon}>
            <Feather name="dollar-sign" size={13} color={colors.earth} />
          </View>
          <Text style={s.groupTitle}>Mức phạt</Text>
        </View>
        {rates.map((rate, index) => (
          <View key={rate.key} style={[s.row, index > 0 && s.rowLine]}>
            <View style={s.modeCopy}>
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
      {!validFine && (
        <Text accessibilityRole="alert" style={styles.error}>
          Tiền chặt 2 từ 0 đến 1.000.000.000 đ/lá.
        </Text>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  container: { gap: spacing.sm },
  group: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  groupHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    paddingBottom: 8,
  },
  groupIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunlightSoft,
  },
  groupTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  modes: { gap: 6 },
  mode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  modeOn: { borderColor: colors.earth, backgroundColor: colors.sunlightSoft },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.earth },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.earth,
  },
  modeCopy: { flex: 1, gap: 1 },
  modeTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  modeTitleOn: { fontWeight: '700' },
  hint: { fontSize: 11, lineHeight: 15, color: colors.muted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 6,
  },
  rowLine: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 104,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background,
    paddingRight: 8,
  },
  inputInvalid: { borderColor: colors.danger },
  input: {
    flex: 1,
    height: 34,
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
