import Feather from '@expo/vector-icons/Feather';
import type { Dispatch, SetStateAction } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppTextInput } from '../../components/AppTextInput';
import { FinanceAmountInput } from '../../components/FinanceAmountInput';
import type { SharedExpense } from '../../types/finance';
import { formatFinanceAmount, parseFinanceAmount } from '../../utils/finance';
import { getSharedExpensePersonTotals } from '../../utils/sharedExpense';
import {
  previewExpenseSplit,
  type ExpenseSplitDraft,
  type ExpenseSplitMode,
} from '../../utils/sharedExpenseSplit';
import { colors, fontSize, radius, spacing, typography } from '../../theme';
import { actionIconStyles } from '../../theme/actionIcons';

const MODES: { value: ExpenseSplitMode; label: string }[] = [
  { value: 'equal', label: 'Chia đều' },
  { value: 'portions', label: 'Theo suất' },
  { value: 'manual', label: 'Tự nhập' },
];

export function SharedExpenseSplitEditor({
  draft,
  onChange,
  gross,
  existing,
  disabled,
  onAddPerson,
}: {
  draft: ExpenseSplitDraft;
  onChange: Dispatch<SetStateAction<ExpenseSplitDraft>>;
  gross: number | null;
  existing?: SharedExpense;
  disabled: boolean;
  onAddPerson: () => void;
}) {
  const preview = previewExpenseSplit(gross, draft);
  const totalOwed = preview.people.reduce(
    (sum, p) => sum + (parseFinanceAmount(p.amount) ?? 0),
    0,
  );
  const selectMode = (mode: ExpenseSplitMode) =>
    onChange((current) => ({
      ...current,
      mode,
      people:
        mode === 'manual'
          ? previewExpenseSplit(gross, current).people
          : current.people,
    }));
  const setPerson = (
    id: string,
    patch: Partial<ExpenseSplitDraft['people'][number]>,
  ) =>
    onChange((current) => ({
      ...current,
      people: current.people.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  const overTotal = gross !== null && totalOwed > gross;
  return (
    <View style={styles.content}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Cách chia khoản chi"
        style={styles.modes}
      >
        {MODES.map((mode) => (
          <Pressable
            key={mode.value}
            accessibilityRole="radio"
            accessibilityLabel={mode.label}
            accessibilityState={{
              checked: draft.mode === mode.value,
              disabled,
            }}
            disabled={disabled}
            onPress={() => selectMode(mode.value)}
            style={[styles.mode, draft.mode === mode.value && styles.selected]}
          >
            <Text
              style={[
                styles.modeText,
                draft.mode === mode.value && styles.selectedText,
              ]}
            >
              {mode.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {draft.mode === 'equal' && (
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel="Tính cả phần của tôi"
          accessibilityState={{ checked: draft.includeMe, disabled }}
          disabled={disabled}
          onPress={() =>
            onChange((current) => ({
              ...current,
              includeMe: !current.includeMe,
            }))
          }
          style={styles.row}
        >
          <Text style={typography.small}>
            Tính cả phần của tôi · chia{' '}
            {draft.people.length + (draft.includeMe ? 1 : 0)} người
          </Text>
          <Feather
            name={draft.includeMe ? 'check-circle' : 'circle'}
            size={18}
            color={draft.includeMe ? colors.success : colors.muted}
          />
        </Pressable>
      )}
      {draft.mode === 'portions' && (
        <View style={styles.row}>
          <Text style={typography.small}>Suất của tôi (0 nếu chỉ trả hộ)</Text>
          <AppTextInput
            accessibilityLabel="Số suất của tôi"
            value={draft.myPortions}
            maxLength={7}
            keyboardType="decimal-pad"
            editable={!disabled}
            onChangeText={(myPortions) =>
              onChange((current) => ({ ...current, myPortions }))
            }
            style={[styles.input, styles.portions]}
          />
        </View>
      )}
      {preview.people.map((person, index) => {
        const received = existing
          ? getSharedExpensePersonTotals(existing, person.id).received
          : 0;
        return (
          <View key={person.id} style={styles.person}>
            <View style={styles.nameRow}>
              <AppTextInput
                accessibilityLabel={`Tên người ${index + 1}`}
                placeholder={`Người ${index + 1}`}
                placeholderTextColor={colors.muted}
                value={person.name}
                maxLength={100}
                editable={!disabled}
                onChangeText={(name) => setPerson(person.id, { name })}
                style={[styles.input, styles.name]}
              />
              {draft.mode === 'portions' && (
                <AppTextInput
                  accessibilityLabel={`Số suất người ${index + 1}`}
                  placeholder="Suất"
                  placeholderTextColor={colors.muted}
                  value={person.portions}
                  maxLength={7}
                  keyboardType="decimal-pad"
                  editable={!disabled}
                  onChangeText={(portions) =>
                    setPerson(person.id, { portions })
                  }
                  style={[styles.input, styles.portionsSmall]}
                />
              )}
              <View style={styles.amount}>
                <FinanceAmountInput
                  accessibilityLabel={`Số tiền người ${index + 1} cần trả`}
                  value={person.amount}
                  onChangeText={(amount) => setPerson(person.id, { amount })}
                  editable={!disabled && draft.mode === 'manual'}
                  compact
                />
              </View>
              {received === 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Bỏ người ${index + 1}`}
                  disabled={disabled}
                  onPress={() =>
                    onChange((current) => ({
                      ...current,
                      people: current.people.filter((p) => p.id !== person.id),
                    }))
                  }
                  style={actionIconStyles.deleteCompact}
                >
                  <Feather name="x" size={16} color={colors.danger} />
                </Pressable>
              )}
            </View>
            {received > 0 && (
              <Text style={styles.hint}>
                Đã nhận {formatFinanceAmount(received)}
              </Text>
            )}
            {received > (parseFinanceAmount(person.amount) ?? 0) && (
              <Text accessibilityRole="alert" style={styles.error}>
                Phần mới thấp hơn số đã nhận. Hãy điều chỉnh cách chia.
              </Text>
            )}
          </View>
        );
      })}
      <View style={styles.footer}>
        {draft.people.length < 20 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thêm người cần trả lại"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={onAddPerson}
            style={({ pressed }) => [styles.add, pressed && styles.pressed]}
          >
            <Feather name="user-plus" size={14} color={colors.earth} />
            <Text style={styles.modeText}>Thêm người</Text>
          </Pressable>
        )}
        {gross !== null && !preview.error && (
          <Text
            style={[styles.summary, overTotal ? styles.error : styles.hint]}
          >
            {overTotal
              ? 'Tổng tiền cần trả lại vượt số đã chi.'
              : `Phần của tôi dự kiến: ${formatFinanceAmount(gross - totalOwed)}`}
          </Text>
        )}
      </View>
      {preview.error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {preview.error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm },
  modes: { flexDirection: 'row', gap: spacing.sm },
  mode: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  selected: {
    backgroundColor: colors.sunlightSoft,
    borderColor: colors.sunlightBorder,
  },
  modeText: {
    fontSize: fontSize.small,
    fontWeight: '600',
    color: colors.earth,
  },
  selectedText: { color: colors.sunlight },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 36,
    gap: spacing.sm,
  },
  person: { gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { flex: 1.1, minWidth: 0 },
  amount: { flex: 1, minWidth: 0 },
  input: {
    minHeight: 46,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: fontSize.small,
  },
  portions: { width: 64, textAlign: 'center' },
  portionsSmall: { width: 52, textAlign: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  add: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  summary: { flex: 1, textAlign: 'right' },
  pressed: { opacity: 0.65 },
  hint: { ...typography.small },
  error: { ...typography.small, color: colors.danger },
});
