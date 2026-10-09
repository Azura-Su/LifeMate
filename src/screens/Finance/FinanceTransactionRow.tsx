import Feather from '@expo/vector-icons/Feather';
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../../theme';
import type { FinanceTransaction } from '../../types/finance';
import { formatFinanceAmount, formatFinanceDate } from '../../utils/finance';
import { styles } from './FinanceScreen.styles';

type Props = {
  transaction: FinanceTransaction;
  // Receive the row's transaction so parents can pass stable callbacks and
  // unchanged rows skip re-rendering (e.g. on each search keystroke).
  onDelete: (transaction: FinanceTransaction) => void;
  onEdit?: (transaction: FinanceTransaction) => void;
};

export const FinanceTransactionRow = memo(function FinanceTransactionRow({
  transaction,
  onDelete,
  onEdit,
}: Props) {
  const income = transaction.type === 'income';
  const date = formatFinanceDate(new Date(transaction.createdAt));
  return (
    <View style={styles.transaction}>
      <View
        style={[
          styles.transactionIcon,
          income ? styles.incomeIcon : styles.expenseIcon,
        ]}
      >
        <Feather
          name={income ? 'arrow-down-left' : 'arrow-up-right'}
          size={18}
          color={income ? colors.success : colors.sunlight}
        />
      </View>
      <View style={styles.transactionText}>
        <Text numberOfLines={2} style={styles.transactionTitle}>
          {transaction.note || transaction.category}
        </Text>
        <Text numberOfLines={1} style={styles.transactionNote}>
          {transaction.note ? `${transaction.category} · ${date}` : date}
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[
            styles.transactionAmount,
            income ? styles.income : styles.expense,
          ]}
        >
          {income ? '+' : '−'}
          {formatFinanceAmount(transaction.amount)}
        </Text>
      </View>
      {onEdit && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sửa giao dịch ${transaction.note || transaction.category}`}
          hitSlop={8}
          onPress={() => onEdit(transaction)}
          style={styles.deleteButton}
        >
          <Feather name="edit-2" size={16} color={colors.muted} />
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Xóa giao dịch ${transaction.note || transaction.category}`}
        hitSlop={8}
        onPress={() => onDelete(transaction)}
        style={styles.deleteButton}
      >
        <Feather name="trash-2" size={16} color={colors.muted} />
      </Pressable>
    </View>
  );
});
