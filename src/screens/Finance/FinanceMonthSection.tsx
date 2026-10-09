import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../../theme';
import type { FinanceTransaction } from '../../types/finance';
import { formatFinanceAmount } from '../../utils/finance';
import { FinanceTransactionRow } from './FinanceTransactionRow';
import { styles } from './FinanceScreen.styles';

type Props = {
  year: number;
  month: number;
  transactions: FinanceTransaction[];
  income: number;
  expense: number;
  balance: number;
  onDelete: (transaction: FinanceTransaction) => void;
  onEdit: (transaction: FinanceTransaction) => void;
  onAdd: () => void;
};

export function FinanceMonthSection({
  year,
  month,
  transactions,
  income,
  expense,
  balance,
  onDelete,
  onEdit,
  onAdd,
}: Props) {
  return (
    <View style={styles.monthSection}>
      <View style={styles.monthHeader}>
        <View style={styles.monthTextBlock}>
          <Text accessibilityRole="header" style={styles.monthTitle}>
            Tháng {month}
          </Text>
          <Text numberOfLines={1} style={styles.monthTotals}>
            Thu {formatFinanceAmount(income)} · Chi{' '}
            {formatFinanceAmount(expense)}
          </Text>
        </View>
        <View style={styles.monthBalanceBlock}>
          <Text style={styles.monthBalanceLabel}>Còn lại</Text>
          <Text style={styles.monthBalance}>
            {formatFinanceAmount(balance)}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Thêm khoản thu tháng ${month} năm ${year}`}
          onPress={onAdd}
          style={styles.monthAddButton}
        >
          <Feather name="plus" size={18} color={colors.earth} />
        </Pressable>
      </View>
      <View style={styles.transactionList}>
        {transactions.map((transaction) => (
          <FinanceTransactionRow
            key={transaction.id}
            transaction={transaction}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        ))}
      </View>
    </View>
  );
}
