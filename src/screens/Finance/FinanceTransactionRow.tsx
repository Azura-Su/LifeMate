import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../../theme';
import type { FinanceTransaction } from '../../types/finance';
import { formatFinanceAmount } from '../../utils/finance';
import { styles } from './FinanceScreen.styles';

type Props = {
  transaction: FinanceTransaction;
  onDelete: () => void;
};

export function FinanceTransactionRow({ transaction, onDelete }: Props) {
  const income = transaction.type === 'income';
  const date = new Date(transaction.createdAt).toLocaleDateString('vi-VN');
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
        <Text numberOfLines={1} style={styles.transactionTitle}>
          {transaction.note || transaction.category}
        </Text>
        <Text numberOfLines={1} style={styles.transactionNote}>
          {transaction.note ? `${transaction.category} · ${date}` : date}
        </Text>
      </View>
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Xóa giao dịch ${transaction.note || transaction.category}`}
        hitSlop={8}
        onPress={onDelete}
        style={styles.deleteButton}
      >
        <Feather name="trash-2" size={16} color={colors.muted} />
      </Pressable>
    </View>
  );
}
