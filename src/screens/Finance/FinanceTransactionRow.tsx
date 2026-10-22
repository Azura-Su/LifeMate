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
import { getSharedExpenseTotals } from '../../utils/sharedExpense';
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
  /** Draw a hairline above the row (rows after the first in a group). */
  divider?: boolean;
};

export const FinanceTransactionRow = memo(function FinanceTransactionRow({
  transaction,
  onDelete,
  onEdit,
  onOpenLoan,
  loan,
  canDeleteLinkedExpense = false,
  deleting = false,
  divider = false,
}: Props) {
  const contribution = getFinanceReportContribution(transaction);
  const income = contribution.kind === 'income';
  const isRepayment = transaction.incomeSource === 'loan_repayment';
  const sharedReceipt = transaction.sharedExpenseReceipt;
  const sharedRemaining = transaction.sharedExpense
    ? getSharedExpenseTotals(transaction.sharedExpense).remaining
    : null;
  const incoming = income || isRepayment || !!sharedReceipt;
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
  const title = sharedReceipt
    ? `${sharedReceipt.participantName} trả lại`
    : linkedLoanLending
      ? loan
        ? `Cho ${loan.borrowerName} vay`
        : transaction.note || 'Khoản cho vay đã xóa'
      : transaction.incomeSource === 'loan_repayment' && loan
        ? `Nhận lại tiền từ ${loan.borrowerName}`
        : transaction.note || transaction.category;
  const category = sharedReceipt
    ? `Giảm chi ${transaction.category}`
    : transaction.incomeSource === 'loan_repayment'
      ? 'Cho vay'
      : getFinanceTransactionCategoryLabel(transaction);
  const date = formatFinanceDate(new Date(transaction.createdAt));
  const metadata =
    transaction.note || linkedLoanTransaction || sharedReceipt
      ? `${category} · ${date}`
      : date;
  return (
    <View style={[styles.transaction, divider && styles.transactionDivider]}>
      <View
        style={[
          styles.transactionIcon,
          incoming ? styles.incomeIcon : styles.expenseIcon,
        ]}
      >
        <Feather
          name={incoming ? 'arrow-down-left' : 'arrow-up-right'}
          size={16}
          color={incoming ? colors.success : colors.sunlight}
        />
      </View>
      <Pressable
        accessibilityRole={
          transaction.sharedExpense || sharedReceipt ? 'button' : undefined
        }
        accessibilityLabel={
          transaction.sharedExpense || sharedReceipt
            ? `Xem chi tiết ${title}`
            : undefined
        }
        disabled={!onEdit || (!transaction.sharedExpense && !sharedReceipt)}
        onPress={() => onEdit?.(transaction)}
        style={styles.transactionText}
      >
        <Text numberOfLines={2} style={styles.transactionTitle}>
          {title}
        </Text>
        {!!lendingNote && (
          <Text numberOfLines={1} style={styles.transactionNote}>
            {lendingNote}
          </Text>
        )}
        <View style={styles.transactionMetaRow}>
          <Text numberOfLines={1} style={styles.transactionMeta}>
            {metadata}
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={[
              styles.transactionAmount,
              incoming ? styles.income : styles.expense,
            ]}
          >
            {isRepayment || sharedReceipt ? 'Giảm chi ' : income ? '+' : '−'}
            {formatFinanceAmount(transaction.amount)}
          </Text>
        </View>
        {sharedRemaining !== null && (
          <Text style={styles.transactionNote}>
            {sharedRemaining > 0
              ? `Còn chờ ${formatFinanceAmount(sharedRemaining)}`
              : 'Đã nhận đủ'}
          </Text>
        )}
      </Pressable>
      {linkedLoanTransaction && loan ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Xem khoản vay của ${loan.borrowerName}`}
          accessibilityHint="Mở khoản vay liên kết trong mục Cho vay."
          accessibilityState={{ disabled: !onOpenLoan || !transaction.loanId }}
          disabled={!onOpenLoan || !transaction.loanId}
          hitSlop={8}
          onPress={() => {
            if (transaction.loanId) onOpenLoan?.(transaction.loanId);
          }}
          style={styles.rowAction}
        >
          <Feather name="link" size={16} color={colors.sky} />
        </Pressable>
      ) : !linkedLoanTransaction && onEdit ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${transaction.sharedExpense || sharedReceipt ? 'Mở chi tiết' : 'Sửa giao dịch'} ${transaction.note || transaction.category}`}
          accessibilityState={{ disabled: deleting }}
          disabled={deleting}
          hitSlop={8}
          onPress={() => onEdit(transaction)}
          style={styles.rowAction}
        >
          <Feather
            name={
              transaction.sharedExpense || sharedReceipt
                ? 'chevron-right'
                : 'edit-2'
            }
            size={16}
            color={colors.earth}
          />
        </Pressable>
      ) : null}
      {!sharedReceipt && (!linkedLoanTransaction || canDeleteLinkedExpense) && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Xóa giao dịch ${transaction.note || transaction.category}`}
          accessibilityState={{ disabled: deleting, busy: deleting }}
          disabled={deleting}
          hitSlop={8}
          onPress={() => onDelete(transaction)}
          style={styles.rowAction}
        >
          {deleting ? (
            <ActivityIndicator size="small" color={colors.earth} />
          ) : (
            <Feather name="trash-2" size={16} color={colors.danger} />
          )}
        </Pressable>
      )}
    </View>
  );
});
