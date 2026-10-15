import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme';
import type { FinanceTransaction } from '../../types/finance';
import { formatFinanceAmount, formatFinanceDate } from '../../utils/finance';
import type { PendingSharedExpense } from '../../utils/sharedExpense';

type Props = {
  items: PendingSharedExpense[];
  onOpen: (transaction: FinanceTransaction) => void;
};

export function FinancePendingSharedExpenses({ items, onOpen }: Props) {
  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Chưa nhận từ các tháng trước</Text>
      {items.map(({ transaction, remaining, pendingPeople }) => {
        const shared = transaction.sharedExpense;
        if (!shared) return null;
        const people = pendingPeople.join(', ');
        const title = transaction.note || transaction.category;
        const date = formatFinanceDate(new Date(transaction.createdAt));
        return (
          <Pressable
            key={transaction.id}
            accessibilityRole="button"
            accessibilityLabel={`Xem khoản chưa nhận ${title}: ${formatFinanceAmount(remaining)}`}
            onPress={() => onOpen(transaction)}
            style={styles.row}
          >
            <View style={styles.details}>
              <Text numberOfLines={1} style={styles.title}>
                {title}
              </Text>
              <Text numberOfLines={1} style={styles.meta}>
                {people} · {date}
              </Text>
            </View>
            <Text numberOfLines={1} style={styles.amount}>
              {formatFinanceAmount(remaining)}
            </Text>
            <Feather name="chevron-right" size={15} color={colors.muted} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.skySoft,
  },
  heading: { color: colors.sky, fontSize: 11, fontWeight: '700' },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  details: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 10 },
  amount: { color: colors.earth, fontSize: 12, fontWeight: '700' },
});
