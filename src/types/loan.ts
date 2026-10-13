export type LoanRepayment = {
  id: string;
  amount: number;
  receivedAt: number;
  financeTransactionId: string;
  status: 'pending' | 'posted';
};

export type LoanAdvance = {
  id: string;
  amount: number;
  lentAt: number;
  /** Optional for advances recorded before per-advance descriptions were added. */
  note?: string;
  financeTransactionId: string;
};

export type LoanRecord = {
  id: string;
  ownerId: string;
  borrowerName: string;
  principalAmount: number;
  advances?: LoanAdvance[];
  additionalAmount?: number;
  /** Verified by Firestore rules as repayments are appended; absent on older loans. */
  recordedRepaymentAmount?: number;
  /** Used by Firestore rules to verify which existing advance was edited. */
  lastEditedAdvanceIndex?: number;
  /** Used by Firestore rules to verify which existing repayment was edited. */
  lastEditedRepaymentIndex?: number;
  lentAt: number;
  dueAt: number | null;
  remindOnDueDate: boolean;
  note: string;
  repayments: LoanRepayment[];
  cancelledAt: number | null;
  updatedAt: number;
};

export function getLoanRepaidAmount(loan: LoanRecord) {
  return loan.repayments
    .filter((repayment) => repayment.status === 'posted')
    .reduce((total, repayment) => total + repayment.amount, 0);
}

export function getLoanTotalAmount(loan: LoanRecord) {
  return loan.principalAmount + (loan.additionalAmount ?? 0);
}

export function canSetLoanTotalAmount(loan: LoanRecord, total: number) {
  if (!Number.isSafeInteger(total)) return false;
  const received = loan.repayments.reduce(
    (sum, repayment) => sum + repayment.amount,
    0,
  );
  return (
    total >= received &&
    (loan.recordedRepaymentAmount !== undefined ||
      loan.repayments.length === 0 ||
      total >= getLoanTotalAmount(loan))
  );
}

export function getLoanOutstandingAmount(loan: LoanRecord) {
  return Math.max(0, getLoanTotalAmount(loan) - getLoanRepaidAmount(loan));
}

export function getLoanPendingAmount(loan: LoanRecord) {
  return loan.repayments
    .filter((repayment) => repayment.status === 'pending')
    .reduce((total, repayment) => total + repayment.amount, 0);
}

export function getLoanStatus(loan: LoanRecord) {
  if (loan.cancelledAt !== null) return 'cancelled' as const;
  if (getLoanOutstandingAmount(loan) === 0) return 'settled' as const;
  return 'open' as const;
}
