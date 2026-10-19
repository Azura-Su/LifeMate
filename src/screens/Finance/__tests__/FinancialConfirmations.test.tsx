import type { ComponentProps } from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SharedExpenseModal } from '../SharedExpenseModal';
import { LoanLedgerModal } from '../LoanLedgerModal';
import type { FinanceTransaction } from '../../../types/finance';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../../services/finance/loanStorage', () => ({
  getPendingAdvanceAttempt: jest.fn(),
  getPendingNewLoanAttempt: jest.fn(),
  reserveNewLoanAttempt: jest.fn(),
  LoanDataConflictError: class extends Error {},
}));
const transaction: FinanceTransaction = {
  id: 'shared',
  ownerId: 'alice',
  type: 'expense',
  amount: 200,
  category: 'Ăn uống',
  note: 'Shared',
  createdAt: Date.now(),
  sharedExpense: {
    participants: [{ id: 'an', name: 'An', owedAmount: 100 }],
    receipts: [
      {
        id: 'receipt',
        participantId: 'an',
        amount: 20,
        receivedAt: Date.now(),
        note: '',
      },
    ],
  },
};
afterEach(() => jest.restoreAllMocks());

describe.each(['shared receipt', 'loan'] as const)(
  '%s confirmations',
  (kind) => {
    it.each([
      'current',
      'hidden',
      'reopened',
      'unmounted',
      'owner changed',
    ] as const)('accepts only current interactions: %s', async (state) => {
      const remove = jest.fn(async () => {});
      const loanProps: ComponentProps<typeof LoanLedgerModal> = {
        visible: true,
        addRequestId: 0,
        uid: 'alice',
        loading: false,
        financeLoading: false,
        syncStatus: 'synced',
        error: null,
        loans: [
          {
            id: 'loan',
            ownerId: 'alice',
            borrowerName: 'An',
            principalAmount: 100,
            lentAt: Date.now(),
            dueAt: null,
            remindOnDueDate: false,
            note: '',
            repayments: [],
            cancelledAt: null,
            updatedAt: 1,
          },
        ],
        onRefresh: jest.fn(async () => true),
        onSave: jest.fn(),
        onDeleteLoan: remove,
        onCorrectPrincipal: jest.fn(),
        onRecordRepayment: jest.fn(),
        onDeleteRepayment: jest.fn(),
        onUpdateRepayment: jest.fn(),
        onRecordAdvance: jest.fn(),
        onUpdateAdvance: jest.fn(),
        onDeleteAdvance: jest.fn(),
        onDeleteInitialEntry: jest.fn(),
      };
      const element = (visible = true, owner = 'alice') =>
        kind === 'shared receipt' ? (
          <SharedExpenseModal
            visible={visible}
            transaction={{ ...transaction, ownerId: owner }}
            onClose={jest.fn()}
            onEditExpense={jest.fn()}
            onSaveReceipt={jest.fn()}
            onRemoveReceipt={remove}
          />
        ) : (
          <LoanLedgerModal {...loanProps} visible={visible} uid={owner} />
        );
      let confirm: (() => void) | undefined;
      jest
        .spyOn(Alert, 'alert')
        .mockImplementation((_title, _message, buttons) => {
          confirm = buttons?.find(
            (button) => button.style === 'destructive',
          )?.onPress;
        });
      const view = render(element());
      fireEvent.press(
        screen.getByRole('button', {
          name:
            kind === 'shared receipt'
              ? 'Xóa lần nhận từ An'
              : 'Xóa khoản cho vay của An',
        }),
      );
      expect(confirm).toBeDefined();
      if (state === 'unmounted') view.unmount();
      else if (state === 'owner changed') view.rerender(element(true, 'bob'));
      else if (state !== 'current') {
        view.rerender(element(false));
        if (state === 'reopened') view.rerender(element(true));
      }
      await act(async () => confirm?.());
      expect(remove).toHaveBeenCalledTimes(state === 'current' ? 1 : 0);
    });
  },
);
