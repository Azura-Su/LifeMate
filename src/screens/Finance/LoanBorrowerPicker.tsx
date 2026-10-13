import Feather from '@expo/vector-icons/Feather';
import { useMemo, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppTextInput } from '../../components/AppTextInput';
import { colors, typography } from '../../theme';
import type { LoanRecord } from '../../types/loan';
import {
  getLoanOutstandingAmount,
  getLoanPendingAmount,
  getLoanStatus,
} from '../../types/loan';
import { formatFinanceAmount, formatFinanceDate } from '../../utils/finance';
import { loanStyles } from './LoanLedgerModal.styles';

export type LoanEntryMode = 'new' | 'advance';

export function loanBorrowerKey(name: string) {
  return name
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('vi');
}

type Props = {
  loans: LoanRecord[];
  name: string;
  mode: LoanEntryMode;
  selectedLoanId: string | null;
  disabled: boolean;
  loading: boolean;
  onNameChange: (name: string) => void;
  onModeChange: (mode: LoanEntryMode) => void;
  onLoanSelect: (loanId: string) => void;
};

export function LoanBorrowerPicker({
  loans,
  name,
  mode,
  selectedLoanId,
  disabled,
  loading,
  onNameChange,
  onModeChange,
  onLoanSelect,
}: Props) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const borrowers = useMemo(() => {
    const grouped = new Map<
      string,
      { name: string; loans: LoanRecord[]; updatedAt: number }
    >();
    for (const loan of loans) {
      const key = loanBorrowerKey(loan.borrowerName);
      const current = grouped.get(key);
      if (current) {
        current.loans.push(loan);
        current.updatedAt = Math.max(current.updatedAt, loan.updatedAt);
      } else
        grouped.set(key, {
          name: loan.borrowerName,
          loans: [loan],
          updatedAt: loan.updatedAt,
        });
    }
    return [...grouped.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [loans]);
  const key = loanBorrowerKey(name);
  const borrower = borrowers.find((item) => item.key === key);
  const openLoans = (borrower?.loans ?? [])
    .filter((loan) => getLoanStatus(loan) === 'open')
    .sort((a, b) => a.lentAt - b.lentAt || a.id.localeCompare(b.id));
  const suggestions = borrowers
    .filter((item) => item.key.includes(key) && item.key !== key)
    .slice(0, 4);
  const outstanding = openLoans.reduce(
    (sum, loan) => sum + getLoanOutstandingAmount(loan),
    0,
  );

  return (
    <View style={styles.section}>
      <View style={loanStyles.formField}>
        <Text style={loanStyles.fieldLabel}>Người vay</Text>
        <AppTextInput
          accessibilityLabel="Tên người vay"
          placeholder="Nhập hoặc chọn người vay"
          placeholderTextColor={colors.muted}
          value={name}
          maxLength={100}
          editable={!disabled}
          onFocus={() => setShowSuggestions(true)}
          onChangeText={(value) => {
            setShowSuggestions(true);
            onNameChange(value);
          }}
          style={loanStyles.input}
        />
      </View>
      {loading && !disabled && (
        <Text accessibilityLiveRegion="polite" style={styles.caption}>
          Đang cập nhật dữ liệu…
        </Text>
      )}
      {showSuggestions && !disabled && suggestions.length > 0 && (
        <View style={styles.suggestions}>
          <Text style={styles.caption}>Người đã vay</Text>
          {suggestions.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={`Chọn người vay ${item.name}`}
              onPress={() => {
                onNameChange(item.name);
                setShowSuggestions(false);
                Keyboard.dismiss();
              }}
              style={styles.suggestion}
            >
              <Feather name="user" size={15} color={colors.earth} />
              <Text style={styles.suggestionName}>{item.name}</Text>
              <Text style={styles.caption}>{item.loans.length} khoản</Text>
            </Pressable>
          ))}
        </View>
      )}
      {borrower && (
        <Text style={styles.caption}>
          {openLoans.length > 0
            ? `${openLoans.length} khoản chưa trả · còn ${formatFinanceAmount(outstanding)}`
            : `Đã có ${borrower.loans.length} khoản trước đây`}
        </Text>
      )}
      {(openLoans.length > 0 || mode === 'advance') && (
        <>
          <View style={styles.modeRow} accessibilityRole="tablist">
            {(
              [
                ['new', 'Khoản riêng'],
                ['advance', 'Cộng khoản cũ'],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{
                  selected: mode === value,
                  disabled: disabled || (value === 'advance' && loading),
                }}
                disabled={disabled || (value === 'advance' && loading)}
                onPress={() => {
                  setShowSuggestions(false);
                  Keyboard.dismiss();
                  onModeChange(value);
                }}
                style={[
                  styles.modeButton,
                  mode === value && styles.modeSelected,
                ]}
              >
                <Text
                  style={[
                    styles.modeText,
                    mode === value && styles.modeTextSelected,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          {mode === 'new' ? (
            <Text style={styles.caption}>
              Theo dõi riêng số tiền, hạn trả và các lần nhận lại.
            </Text>
          ) : (
            <>
              <Text style={loanStyles.fieldLabel}>Chọn khoản muốn cộng</Text>
              {openLoans.length === 0 && (
                <Text style={styles.caption}>
                  Không còn khoản đang mở. Chọn Khoản riêng để tiếp tục.
                </Text>
              )}
              {openLoans.map((loan, index) => {
                const pending = getLoanPendingAmount(loan) > 0;
                const selected = loan.id === selectedLoanId;
                return (
                  <Pressable
                    key={loan.id}
                    accessibilityRole="radio"
                    accessibilityLabel={`Khoản ${index + 1} ngày ${formatFinanceDate(new Date(loan.lentAt))}, còn ${formatFinanceAmount(getLoanOutstandingAmount(loan))}${loan.note ? `, ${loan.note}` : ''}`}
                    accessibilityState={{
                      checked: selected,
                      disabled: disabled || loading || pending,
                    }}
                    disabled={disabled || loading || pending}
                    onPress={() => {
                      Keyboard.dismiss();
                      onLoanSelect(loan.id);
                    }}
                    style={[
                      styles.loanOption,
                      selected && styles.loanSelected,
                      pending && styles.unavailable,
                    ]}
                  >
                    <View style={styles.optionHeading}>
                      <Feather
                        name={selected ? 'check-circle' : 'circle'}
                        size={17}
                        color={selected ? colors.earth : colors.muted}
                      />
                      <Text style={styles.optionTitle}>
                        Khoản {index + 1} ·{' '}
                        {formatFinanceDate(new Date(loan.lentAt))}
                      </Text>
                    </View>
                    <Text style={styles.optionAmount}>
                      Còn {formatFinanceAmount(getLoanOutstandingAmount(loan))}
                    </Text>
                    <Text style={styles.caption}>
                      Ban đầu {formatFinanceAmount(loan.principalAmount)} ·{' '}
                      {loan.dueAt === null
                        ? 'Chưa hẹn trả'
                        : `Hẹn ${formatFinanceDate(new Date(loan.dueAt))}`}
                    </Text>
                    {!!loan.note && (
                      <Text numberOfLines={2} style={styles.caption}>
                        {loan.note}
                      </Text>
                    )}
                    {pending && (
                      <Text style={styles.caption}>
                        Đang chờ đồng bộ lần nhận tiền
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  caption: { ...typography.small, fontSize: 12 },
  suggestions: {
    padding: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  suggestion: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  suggestionName: {
    ...typography.small,
    flex: 1,
    color: colors.ink,
    fontWeight: '600',
  },
  modeRow: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: 12,
    backgroundColor: colors.skySoft,
  },
  modeButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: 9,
  },
  modeSelected: { backgroundColor: colors.surface },
  modeText: { ...typography.small, textAlign: 'center', fontWeight: '600' },
  modeTextSelected: { color: colors.earth },
  loanOption: {
    padding: 12,
    gap: 3,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  loanSelected: {
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySoft,
  },
  unavailable: { opacity: 0.65 },
  optionHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  optionTitle: {
    ...typography.small,
    flex: 1,
    color: colors.ink,
    fontWeight: '600',
  },
  optionAmount: { ...typography.body, color: colors.earth, fontWeight: '700' },
});
