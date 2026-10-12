export type LoanRepayment = {
  id: string;
  amount: number;
  receivedAt: number;
  financeTransactionId: string;
  status: 'pending' | 'posted';
};

export type LoanRecord = {
  id: string;
  ownerId: string;
  borrowerName: string;
  principalAmount: number;
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

export function getLoanOutstandingAmount(loan: LoanRecord) {
  return Math.max(0, loan.principalAmount - getLoanRepaidAmount(loan));
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
