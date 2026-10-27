import { StyleSheet, Text, View } from 'react-native';
import { AppTextInput } from '../../components/AppTextInput';
import { colors, spacing } from '../../theme';
import { variantGameInfo } from './VariantGameEntry';

const maxPoints = 1_000_000_000;

export function VariantCreateSettings({
  game,
  disabled,
  points,
  onPointsChange,
  remainingTwoPoints,
  onRemainingTwoPointsChange,
  cutTwoPoints,
  onCutTwoPointsChange,
  samCallPoints,
  onSamCallPointsChange,
}: {
  game: keyof typeof variantGameInfo;
  disabled: boolean;
  points: string;
  onPointsChange: (value: string) => void;
  remainingTwoPoints: string;
  onRemainingTwoPointsChange: (value: string) => void;
  cutTwoPoints: string;
  onCutTwoPointsChange: (value: string) => void;
  samCallPoints: string;
  onSamCallPointsChange: (value: string) => void;
}) {
  const info = variantGameInfo[game];
  const rows = [
    {
      label: info.pointLabel,
      value: points,
      onChange: onPointsChange,
      minimum: 1,
    },
    ...(game === 'north'
      ? [
          {
            label: 'Điểm cộng cho mỗi lá 2 còn lại',
            value: remainingTwoPoints,
            onChange: onRemainingTwoPointsChange,
            minimum: 0,
          },
          {
            label: 'Điểm chặt một lá 2 bằng tứ quý',
            value: cutTwoPoints,
            onChange: onCutTwoPointsChange,
            minimum: 0,
          },
        ]
      : []),
    ...(game === 'sam'
      ? [
          {
            label: 'Điểm báo Sâm với mỗi người',
            value: samCallPoints,
            onChange: onSamCallPointsChange,
            minimum: 0,
          },
        ]
      : []),
  ];

  return (
    <View style={panel.container}>
      <Text style={panel.hint}>{info.note}</Text>
      {rows.map((row) => {
        const amount = row.value === '' ? NaN : Number(row.value);
        const isValid =
          Number.isSafeInteger(amount) &&
          amount >= row.minimum &&
          amount <= maxPoints;
        return (
          <View key={row.label} style={panel.row}>
            <Text style={panel.rowLabel}>{row.label}</Text>
            <View style={[panel.inputBox, !isValid && panel.inputInvalid]}>
              <AppTextInput
                accessibilityLabel={`${row.label} ${info.name}`}
                value={row.value}
                onChangeText={(value) =>
                  row.onChange(value.replace(/\D/g, '').slice(0, 10))
                }
                keyboardType="number-pad"
                editable={!disabled}
                selectTextOnFocus
                style={panel.input}
              />
              <Text style={panel.unit}>điểm</Text>
            </View>
          </View>
        );
      })}
      <Text style={panel.hint}>
        Điểm nội bộ, chỉ áp dụng cho phòng và ván mới.
      </Text>
    </View>
  );
}

const panel = StyleSheet.create({
  container: { gap: spacing.sm },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowLabel: { flex: 1, color: colors.ink, fontSize: 13 },
  inputBox: {
    width: 112,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingRight: spacing.sm,
    backgroundColor: colors.background,
  },
  inputInvalid: { borderColor: colors.danger },
  input: { flex: 1, textAlign: 'right', color: colors.ink, fontSize: 14 },
  unit: { color: colors.muted, fontSize: 11 },
});
