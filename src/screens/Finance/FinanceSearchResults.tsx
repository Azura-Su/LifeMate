import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, Text, View } from 'react-native';
import type { FinanceTransaction } from '../../types/finance';
import type { LoanRecord } from '../../types/loan';
import { colors, typography } from '../../theme';
import { FinanceTransactionDayGroups } from './FinanceTransactionDayGroups';
import { styles } from './FinanceScreen.styles';

type Props = {
  transactions: FinanceTransaction[];
  busy: boolean;
  onDelete: (transaction: FinanceTransaction) => void;
  onEdit: (transaction: FinanceTransaction) => void;
  onOpenLoan: (loanId: string) => void;
  loansById: ReadonlyMap<string, LoanRecord>;
  canDeleteLinkedExpense?: (transaction: FinanceTransaction) => boolean;
  deletingIds?: ReadonlySet<string>;
};

export function FinanceSearchResults({
  transactions,
  busy,
  onDelete,
  onEdit,
  onOpenLoan,
  loansById,
  canDeleteLinkedExpense,
  deletingIds,
}: Props) {
  const sorted = [...transactions].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <View style={styles.searchResults}>
      {busy ? (
        <ActivityIndicator color={colors.earth} />
      ) : sorted.length > 0 ? (
        <FinanceTransactionDayGroups
          transactions={sorted}
          deletingIds={deletingIds}
          onDelete={onDelete}
          onEdit={onEdit}
          loansById={loansById}
          onOpenLoan={onOpenLoan}
          canDeleteLinkedExpense={canDeleteLinkedExpense}
        />
      ) : (
        <View style={styles.empty}>
          <Feather name="search" size={22} color={colors.sky} />
          <Text style={styles.emptyTitle}>Không tìm thấy giao dịch</Text>
          <Text style={typography.small}>
            Thử từ khóa khác hoặc xóa nội dung tìm kiếm.
          </Text>
        </View>
      )}
    </View>
  );
}
