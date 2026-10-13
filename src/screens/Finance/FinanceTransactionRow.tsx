import Feather from '@expo/vector-icons/Feather';
import { memo } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { colors } from '../../theme';
import {
  isLoanLedgerTransaction,
  type FinanceTransaction,
} from '../../types/finance';
import type { LoanRecord } from '../../types/loan';
import {
  formatFinanceAmount,
  formatFinanceDate,
  getFinanceReportContribution,
  getFinanceTransactionCategoryLabel,
} from '../../utils/finance';
import { styles } from './FinanceScreen.styles';

type Props = {
  transaction: FinanceTransaction;
  // Receive the row's transaction so parents can pass stable callbacks and
  // unchanged rows skip re-rendering (e.g. on each search keystroke).
  onDelete: (transaction: FinanceTransaction) => void;
  onEdit?: (transaction: FinanceTransaction) => void;
  onOpenLoan?: (loanId: string) => void;
  loan?: LoanRecord;
  canDeleteLinkedExpense?: boolean;
  deleting?: boolean;
};

export const FinanceTransactionRow = memo(function FinanceTransactionRow({
  transaction,
  onDelete,
  onEdit,
  onOpenLoan,
  loan,
  canDeleteLinkedExpense = false,
  deleting = false,
}: Props) {
  const contribution = getFinanceReportContribution(transaction);
  const income = contribution.kind === 'income';
  const isRepayment = transaction.incomeSource === 'loan_repayment';
  const incoming = income || isRepayment;
  const linkedLoanTransaction = isLoanLedgerTransaction(transaction);
  const linkedLoanLending = transaction.expenseSource === 'loan_lending';
  const advanceNote = transaction.advanceId
    ? loan?.advances?.find(({ id }) => id === transaction.advanceId)?.note
    : undefined;
  const lendingNote =
    linkedLoanLending && loan
      ? transaction.advanceId
        ? advanceNote
        : loan.note
      : undefined;
  const title = linkedLoanLending
    ? loan
      ? `Cho ${loan.borrowerName} vay`
      : transaction.note || 'Khoản cho vay đã xóa'
    : transaction.incomeSource === 'loan_repayment' && loan
      ? `Nhận lại tiền từ ${loan.borrowerName}`
      : transaction.note || transaction.category;
  const category =
    transaction.incomeSource === 'loan_repayment'
      ? 'Cho vay'
      : getFinanceTransactionCategoryLabel(transaction);
  const date = formatFinanceDate(new Date(transaction.createdAt));
  const metadata =
    transaction.note || linkedLoanTransaction ? `${category} · ${date}` : date;
  return (
    <View style={styles.transaction}>
      <View
        style={[
          styles.transactionIcon,
          incoming ? styles.incomeIcon : styles.expenseIcon,
        ]}
      >
        <Feather
          name={incoming ? 'arrow-down-left' : 'arrow-up-right'}
          size={18}
          color={incoming ? colors.success : colors.sunlight}
        />
      </View>
      <View style={styles.transactionText}>
        <Text numberOfLines={2} style={styles.transactionTitle}>
          {title}
        </Text>
        {!!lendingNote && (
          <Text numberOfLines={1} style={styles.transactionNote}>
            {lendingNote}
          </Text>
        )}
        <Text numberOfLines={1} style={styles.transactionNote}>
          {metadata}
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[
            styles.transactionAmount,
            income ? styles.income : styles.expense,
          ]}
        >
          {isRepayment ? 'Giảm chi ' : income ? '+' : '−'}
          {formatFinanceAmount(transaction.amount)}
        </Text>
      </View>
      {linkedLoanTransaction && loan ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Xem khoản vay của ${loan.borrowerName}`}
          accessibilityHint="Mở khoản vay liên kết trong sổ cho vay."
          accessibilityState={{ disabled: !onOpenLoan || !transaction.loanId }}
          disabled={!onOpenLoan || !transaction.loanId}
          hitSlop={8}
          onPress={() => {
            if (transaction.loanId) onOpenLoan?.(transaction.loanId);
          }}
          style={styles.deleteButton}
        >
          <Feather name="link" size={16} color={colors.sky} />
        </Pressable>
      ) : !linkedLoanTransaction && onEdit ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sửa giao dịch ${transaction.note || transaction.category}`}
          accessibilityState={{ disabled: deleting }}
          disabled={deleting}
          hitSlop={8}
          onPress={() => onEdit(transaction)}
          style={styles.deleteButton}
        >
          <Feather name="edit-2" size={16} color={colors.muted} />
        </Pressable>
      ) : null}
      {(!linkedLoanTransaction || canDeleteLinkedExpense) && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Xóa giao dịch ${transaction.note || transaction.category}`}
          accessibilityState={{ disabled: deleting, busy: deleting }}
          disabled={deleting}
          hitSlop={8}
          onPress={() => onDelete(transaction)}
          style={styles.deleteButton}
        >
          {deleting ? (
            <ActivityIndicator size="small" color={colors.earth} />
          ) : (
            <Feather name="trash-2" size={16} color={colors.muted} />
          )}
        </Pressable>
      )}
    </View>
  );
});
