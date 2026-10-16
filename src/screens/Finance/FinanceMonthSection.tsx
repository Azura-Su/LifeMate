import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../../theme';
import type { FinanceTransaction } from '../../types/finance';
import type { LoanRecord } from '../../types/loan';
import { formatFinanceAmount } from '../../utils/finance';
import type { PendingSharedExpense } from '../../utils/sharedExpense';
import { FinancePendingSharedExpenses } from './FinancePendingSharedExpenses';
import { FinanceTransactionDayGroups } from './FinanceTransactionDayGroups';
import { styles } from './FinanceScreen.styles';

type Props = {
  year: number;
  month: number;
  transactions: FinanceTransaction[];
  income: number;
  expense: number;
  balance: number;
  pendingSharedExpenses: PendingSharedExpense[];
  onDelete: (transaction: FinanceTransaction) => void;
  onEdit: (transaction: FinanceTransaction) => void;
  canDeleteLinkedExpense?: (transaction: FinanceTransaction) => boolean;
  deletingIds?: ReadonlySet<string>;
  loansById: ReadonlyMap<string, LoanRecord>;
  onOpenLoan: (loanId: string) => void;
  onAdd: () => void;
};

export function FinanceMonthSection({
  year,
  month,
  transactions,
  income,
  expense,
  balance,
  pendingSharedExpenses,
  onDelete,
  onEdit,
  canDeleteLinkedExpense,
  deletingIds,
  loansById,
  onOpenLoan,
  onAdd,
}: Props) {
  const pendingAmount = pendingSharedExpenses.reduce(
    (sum, item) => sum + item.remaining,
    0,
  );
  const monthStart = new Date(year, month - 1, 1).getTime();
  const carriedExpenses = pendingSharedExpenses.filter(
    ({ transaction }) => transaction.createdAt < monthStart,
  );

  return (
    <View style={styles.monthSection}>
      <View style={styles.monthHeader}>
        <View style={styles.monthTitleRow}>
          <Text accessibilityRole="header" style={styles.monthTitle}>
            Tháng {month}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Thêm khoản thu tháng ${month} năm ${year}`}
            hitSlop={5}
            onPress={onAdd}
            style={styles.monthAddButton}
          >
            <Feather name="plus" size={20} color={colors.earth} />
          </Pressable>
        </View>
        <View testID="finance-month-stats" style={styles.monthStatsRow}>
          <View style={styles.monthStat}>
            <Text style={styles.monthStatLabel}>Thu</Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.monthStatValue, styles.monthIncomeValue]}
            >
              {formatFinanceAmount(income)}
            </Text>
          </View>
          <View style={styles.monthStat}>
            <Text style={styles.monthStatLabel}>Chi</Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.monthStatValue, styles.monthExpenseValue]}
            >
              {formatFinanceAmount(expense)}
            </Text>
          </View>
          <View style={[styles.monthStat, styles.monthBalanceStat]}>
            <Text style={styles.monthStatLabel}>Còn lại</Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.monthStatValue, styles.monthBalanceValue]}
            >
              {formatFinanceAmount(balance)}
            </Text>
          </View>
        </View>
        {pendingAmount > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Xem khoản còn chờ nhận: ${pendingSharedExpenses.length} khoản, ${formatFinanceAmount(pendingAmount)}`}
            onPress={() => {
              const pending = carriedExpenses[0] ?? pendingSharedExpenses[0];
              if (pending) onEdit(pending.transaction);
            }}
            style={styles.monthPendingRow}
          >
            <Text style={styles.monthPendingLabel}>
              Còn chờ nhận · {pendingSharedExpenses.length} khoản
            </Text>
            <Text style={styles.monthPendingAmount}>
              {formatFinanceAmount(pendingAmount)}
            </Text>
          </Pressable>
        )}
      </View>
      <FinancePendingSharedExpenses items={carriedExpenses} onOpen={onEdit} />
      {transactions.length > 0 && (
        <View style={styles.transactionList}>
          <FinanceTransactionDayGroups
            transactions={transactions}
            deletingIds={deletingIds}
            onDelete={onDelete}
            onEdit={onEdit}
            loansById={loansById}
            onOpenLoan={onOpenLoan}
            canDeleteLinkedExpense={canDeleteLinkedExpense}
          />
        </View>
      )}
    </View>
  );
}
