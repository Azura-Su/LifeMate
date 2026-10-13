import { Text, View } from 'react-native';
import type { FinanceTransaction } from '../../types/finance';
import type { LoanRecord } from '../../types/loan';
import { formatFinanceDate } from '../../utils/finance';
import { FinanceTransactionRow } from './FinanceTransactionRow';
import { styles } from './FinanceScreen.styles';

type Props = {
  transactions: FinanceTransaction[];
  onDelete: (transaction: FinanceTransaction) => void;
  onEdit: (transaction: FinanceTransaction) => void;
  onOpenLoan: (loanId: string) => void;
  loansById: ReadonlyMap<string, LoanRecord>;
  canDeleteLinkedExpense?: (transaction: FinanceTransaction) => boolean;
  deletingIds?: ReadonlySet<string>;
};

export function FinanceTransactionDayGroups({
  transactions,
  onDelete,
  onEdit,
  onOpenLoan,
  loansById,
  canDeleteLinkedExpense,
  deletingIds,
}: Props) {
  const dailyGroups = new Map<
    string,
    { date: Date; transactions: FinanceTransaction[] }
  >();
  for (const transaction of transactions) {
    const date = new Date(transaction.createdAt);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const group = dailyGroups.get(key);
    if (group) group.transactions.push(transaction);
    else dailyGroups.set(key, { date, transactions: [transaction] });
  }

  return [...dailyGroups.entries()].map(([key, group]) => {
    const weekday = new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long',
    }).format(group.date);
    const dateLabel = `${weekday.charAt(0).toLocaleUpperCase('vi-VN')}${weekday.slice(1)} · ${formatFinanceDate(group.date)}`;
    return (
      <View key={key} style={styles.transactionDayGroup}>
        <View style={styles.transactionDayHeader}>
          <Text accessibilityRole="header" style={styles.transactionDayTitle}>
            {dateLabel}
          </Text>
          <Text style={styles.transactionDayCount}>
            {group.transactions.length} khoản
          </Text>
        </View>
        {group.transactions.map((transaction) => (
          <FinanceTransactionRow
            key={transaction.id}
            transaction={transaction}
            deleting={deletingIds?.has(transaction.id)}
            onDelete={onDelete}
            onEdit={onEdit}
            loan={
              transaction.loanId
                ? loansById.get(transaction.loanId)
                : undefined
            }
            onOpenLoan={onOpenLoan}
            canDeleteLinkedExpense={canDeleteLinkedExpense?.(transaction)}
          />
        ))}
      </View>
    );
  });
}
