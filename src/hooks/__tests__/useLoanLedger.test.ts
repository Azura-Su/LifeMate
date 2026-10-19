import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useLoanLedger } from '../useLoanLedger';
import { useAuthStore } from '../../store/authStore';
import {
  cacheLoanRecord,
  clearRepaymentAttempt,
  deleteLoanData,
  readLoanData,
  saveLoanData,
} from '../../services/finance/loanStorage';
import { reconcileLoanReminders } from '../../services/finance/loanReminders';
import type { LoanRecord } from '../../types/loan';
import type { FinanceTransaction } from '../../types/finance';

const mockFinanceAddCommitted = jest.fn<Promise<void>, unknown[]>();
const mockFinanceLoad = jest.fn<Promise<void>, unknown[]>();
jest.mock('../../store/financeStore', () => ({
  useFinanceStore: {
    getState: () => ({
      uid: 'u1',
      addCommitted: mockFinanceAddCommitted,
      load: mockFinanceLoad,
    }),
  },
}));
jest.mock('../../services/finance/loanStorage', () => ({
  readLoanData: jest.fn(),
  saveLoanData: jest.fn(),
  deleteLoanData: jest.fn(),
  clearRepaymentAttempt: jest.fn(),
  cacheLoanRecord: jest.fn(),
  correctLoanPrincipal: jest.fn(),
  getOrCreateRepaymentAttempt: jest.fn(),
  recordLoanRepaymentAtomically: jest.fn(),
  LoanDataConflictError: class extends Error {},
}));
jest.mock('../../services/finance/loanReminders', () => ({
  reconcileLoanReminders: jest.fn().mockResolvedValue('granted'),
}));

const loan: LoanRecord = {
  id: 'loan-1',
  ownerId: 'u1',
  borrowerName: 'An',
  principalAmount: 1000,
  lentAt: 1791432000000,
  dueAt: 1791691200000,
  remindOnDueDate: true,
  note: '',
  repayments: [],
  cancelledAt: null,
  updatedAt: 1791432000000,
};
const transaction: FinanceTransaction = {
  id: 'loan-lending-loan-1',
  ownerId: 'u1',
  type: 'expense',
  amount: 1000,
  category: 'Cho mượn',
  note: 'An',
  createdAt: loan.lentAt,
};
const loaded = { loans: [loan], synced: true, committedTransactions: [] };

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

beforeEach(() => {
  useAuthStore.setState({
    user: { uid: 'u1', email: null, displayName: null },
  });
  mockFinanceAddCommitted.mockResolvedValue(undefined);
  mockFinanceLoad.mockResolvedValue(undefined);
  jest.mocked(readLoanData).mockResolvedValue(loaded);
  jest.mocked(saveLoanData).mockResolvedValue(loaded);
  jest.mocked(deleteLoanData).mockResolvedValue({ ...loaded, loans: [] });
  jest.mocked(clearRepaymentAttempt).mockResolvedValue(undefined);
  jest.mocked(cacheLoanRecord).mockResolvedValue(loaded);
});

it('finishes loading after a profile refresh replaces the user for the same UID', async () => {
  const reading = deferred();
  jest.mocked(readLoanData).mockImplementationOnce(async () => {
    await reading.promise;
    return loaded;
  });
  const { result } = renderHook(() => useLoanLedger('u1'));
  await waitFor(() => expect(result.current.loading).toBe(true));
  act(() => {
    useAuthStore
      .getState()
      .setUser({ uid: 'u1', email: 'new@example.com', displayName: 'Updated' });
  });
  await act(async () => reading.resolve());
  expect(result.current.loading).toBe(false);
  expect(result.current.loans).toEqual([loan]);
});

it('discards a load from a previous login even when the same UID logs in again', async () => {
  const reading = deferred();
  jest.mocked(readLoanData).mockImplementationOnce(async () => {
    await reading.promise;
    return loaded;
  });
  const { result } = renderHook(() => useLoanLedger('u1'));
  act(() => {
    useAuthStore.getState().setUser(null);
    useAuthStore
      .getState()
      .setUser({ uid: 'u1', email: null, displayName: null });
  });
  await act(async () => reading.resolve());
  expect(result.current.loading).toBe(false);
  expect(result.current.loans).toEqual([]);
  expect(reconcileLoanReminders).not.toHaveBeenCalled();
});

it.each(['logout', 'unmount'] as const)(
  'does not schedule reminders after %s during a finance update',
  async (endSession) => {
    const financeWrite = deferred();
    mockFinanceAddCommitted.mockReturnValueOnce(financeWrite.promise);
    jest.mocked(readLoanData).mockResolvedValueOnce({
      ...loaded,
      committedTransactions: [transaction],
    });
    const { unmount } = renderHook(() => useLoanLedger('u1'));
    await waitFor(() => expect(mockFinanceAddCommitted).toHaveBeenCalled());

    if (endSession === 'unmount') unmount();
    else
      act(() => {
        useAuthStore.getState().setUser(null);
      });
    await act(async () => {
      financeWrite.resolve();
    });

    expect(reconcileLoanReminders).not.toHaveBeenCalled();
  },
);

it('does not schedule a newly saved loan after logout during its finance update', async () => {
  const { result } = renderHook(() => useLoanLedger('u1'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  jest.mocked(reconcileLoanReminders).mockClear();
  const financeWrite = deferred();
  mockFinanceAddCommitted.mockReturnValueOnce(financeWrite.promise);
  jest.mocked(saveLoanData).mockResolvedValueOnce({
    ...loaded,
    committedTransactions: [transaction],
  });
  let saving!: Promise<unknown>;
  act(() => {
    saving = result.current.save(loan).catch((error: unknown) => error);
  });
  await waitFor(() => expect(mockFinanceAddCommitted).toHaveBeenCalled());
  act(() => {
    useAuthStore.getState().setUser(null);
  });
  await act(async () => {
    financeWrite.resolve();
    await saving;
  });

  expect(reconcileLoanReminders).not.toHaveBeenCalled();
});

it('does not publish a deletion or schedule reminders after logout during retry cleanup', async () => {
  const { result } = renderHook(() => useLoanLedger('u1'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  jest.mocked(reconcileLoanReminders).mockClear();
  const cleanup = deferred();
  jest.mocked(clearRepaymentAttempt).mockReturnValueOnce(cleanup.promise);
  let removing!: Promise<unknown>;
  act(() => {
    removing = result.current.remove(loan.id).catch((error: unknown) => error);
  });
  await waitFor(() => expect(clearRepaymentAttempt).toHaveBeenCalled());
  act(() => {
    useAuthStore.getState().setUser(null);
  });
  await act(async () => {
    cleanup.resolve();
    await removing;
  });

  expect(result.current.loans).toEqual([loan]);
  expect(reconcileLoanReminders).not.toHaveBeenCalled();
});

it('refreshes Finance together with the ledger when explicitly opened or refreshed', async () => {
  const { result } = renderHook(() => useLoanLedger('u1'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(mockFinanceLoad).not.toHaveBeenCalled();
  const updated = {
    ...loan,
    principalAmount: 2000,
    updatedAt: loan.updatedAt + 1,
  };
  jest
    .mocked(readLoanData)
    .mockResolvedValueOnce({ ...loaded, loans: [updated] });

  await act(async () => {
    await result.current.load(true);
  });

  expect(result.current.loans).toEqual([updated]);
  expect(mockFinanceLoad).toHaveBeenCalledWith('u1');
});
