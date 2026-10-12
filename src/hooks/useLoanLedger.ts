import { useCallback, useEffect, useRef, useState } from 'react';
import type { LoanRecord } from '../types/loan';
import { getLoanOutstandingAmount, getLoanPendingAmount } from '../types/loan';
import {
  cacheLoanRecord,
  clearRepaymentAttempt,
  correctLoanPrincipal,
  deleteLoanData,
  getOrCreateRepaymentAttempt,
  LoanDataConflictError,
  readLoanData,
  recordLoanRepaymentAtomically,
  saveLoanData,
} from '../services/finance/loanStorage';
import { reconcileLoanReminders } from '../services/finance/loanReminders';
import { useAuthStore } from '../store/authStore';
import { useFinanceStore } from '../store/financeStore';

const emptyLoans: LoanRecord[] = [];

export function useLoanLedger(uid: string | null) {
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'local' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [correctableDeletedLoanIds, setCorrectableDeletedLoanIds] = useState<
    string[]
  >([]);
  const [boundUid, setBoundUid] = useState<string | null>(uid);
  const loansRef = useRef<LoanRecord[]>([]);
  const uidRef = useRef<string | null>(uid);
  const busyIds = useRef(new Set<string>());
  const loadRequest = useRef(0);

  const publish = useCallback((next: LoanRecord[]) => {
    loansRef.current = next;
    setLoans(next);
  }, []);

  const captureSession = useCallback((owner: string) => {
    const user = useAuthStore.getState().user;
    return () =>
      uidRef.current === owner &&
      user?.uid === owner &&
      useAuthStore.getState().user === user;
  }, []);

  const load = useCallback(
    async (refreshFinance = false) => {
      const currentUid = uid;
      const request = ++loadRequest.current;
      uidRef.current = currentUid;
      if (!currentUid) {
        publish([]);
        setCorrectableDeletedLoanIds([]);
        setSyncStatus(null);
        setLoading(false);
        setError(null);
        return;
      }
      const isActive = captureSession(currentUid);
      const isCurrentLoad = () => request === loadRequest.current && isActive();
      if (!isCurrentLoad()) return;
      setLoading(true);
      setError(null);
      try {
        const result = await readLoanData(currentUid);
        if (!isCurrentLoad()) return;
        publish(result.loans);
        setCorrectableDeletedLoanIds(result.correctableDeletedLoanIds ?? []);
        setSyncStatus(result.synced ? 'synced' : 'local');
        const financeStore = useFinanceStore.getState();
        if (financeStore.uid === currentUid) {
          for (const transaction of result.committedTransactions) {
            if (!isCurrentLoad()) return;
            try {
              await financeStore.addCommitted(currentUid, transaction);
            } catch {
              // Firestore already committed the linked entry. Finance will
              // pick it up from the server the next time its list is loaded.
            }
          }
        }
        if (!isCurrentLoad()) return;
        if (refreshFinance && useFinanceStore.getState().uid === currentUid)
          await useFinanceStore.getState().load(currentUid);
        if (!isCurrentLoad()) return;
        await reconcileLoanReminders(currentUid, result.loans);
      } catch {
        if (isCurrentLoad())
          setError('Chưa tải được sổ cho mượn. Hãy thử lại.');
      } finally {
        if (isCurrentLoad()) setLoading(false);
      }
    },
    [captureSession, publish, uid],
  );

  useEffect(() => {
    uidRef.current = uid;
    setBoundUid(uid);
    publish([]);
    setCorrectableDeletedLoanIds([]);
    void load();
    return () => {
      loadRequest.current += 1;
      uidRef.current = null;
    };
  }, [load, publish, uid]);

  const save = useCallback(
    async (loan: LoanRecord, requestReminderPermission = false) => {
      if (
        !uid ||
        uidRef.current !== uid ||
        useAuthStore.getState().user?.uid !== uid ||
        loan.ownerId !== uid
      )
        throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
      const isActive = captureSession(uid);
      const assertActive = () => {
        if (!isActive()) throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
      };
      setError(null);
      const result = await saveLoanData(uid, loan);
      assertActive();
      publish(result.loans);
      setSyncStatus(result.synced ? 'synced' : 'local');
      const financeStore = useFinanceStore.getState();
      if (financeStore.uid === uid) {
        for (const transaction of result.committedTransactions) {
          assertActive();
          try {
            await financeStore.addCommitted(uid, transaction);
          } catch {
            assertActive();
            setError(
              'Khoản đã lưu; Tài chính sẽ cập nhật khi tải lại danh sách.',
            );
          }
        }
      }
      assertActive();
      const reminderStatus = await reconcileLoanReminders(
        uid,
        result.loans,
        requestReminderPermission,
        requestReminderPermission ? loan.id : undefined,
      );
      assertActive();
      if (requestReminderPermission && loan.remindOnDueDate) {
        if (reminderStatus === 'denied')
          setError('Khoản đã lưu, nhưng thiết bị chưa cho phép thông báo.');
        else if (reminderStatus === 'past')
          setError('Khoản đã lưu; ngày hẹn đã qua nên không đặt được nhắc.');
      }
    },
    [captureSession, publish, uid],
  );

  const remove = useCallback(
    async (loanId: string) => {
      if (
        !uid ||
        uidRef.current !== uid ||
        useAuthStore.getState().user?.uid !== uid
      )
        throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
      const isActive = captureSession(uid);
      const assertActive = () => {
        if (!isActive()) throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
      };
      const busyKey = `delete:${loanId}`;
      if (
        busyIds.current.has(busyKey) ||
        busyIds.current.has(`repay:${loanId}`) ||
        busyIds.current.has(`correct:${loanId}`)
      )
        throw new Error('Đang xử lý khoản này. Vui lòng chờ.');
      busyIds.current.add(busyKey);
      try {
        const loan = loansRef.current.find(({ id }) => id === loanId);
        if (!loan) throw new Error('Không tìm thấy khoản cho mượn.');
        const result = await deleteLoanData(uid, loanId);
        assertActive();
        await clearRepaymentAttempt(uid, loanId).catch(() => undefined);
        assertActive();
        publish(result.loans);
        setSyncStatus(result.synced ? 'synced' : 'local');
        if (
          result.deletedLendingTransactionId &&
          useFinanceStore.getState().uid === uid
        )
          await useFinanceStore.getState().load(uid);
        assertActive();
        await reconcileLoanReminders(uid, result.loans).catch(
          () =>
            isActive() &&
            setError(
              'Đã xóa khoản, nhưng chưa hủy được nhắc hạn trên thiết bị.',
            ),
        );
      } finally {
        busyIds.current.delete(busyKey);
      }
    },
    [captureSession, publish, uid],
  );

  const correctPrincipal = useCallback(
    async (loanId: string, amount: number) => {
      if (
        !uid ||
        uidRef.current !== uid ||
        useAuthStore.getState().user?.uid !== uid
      )
        throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
      const isActive = captureSession(uid);
      const assertActive = () => {
        if (!isActive()) throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
      };
      const busyKey = `correct:${loanId}`;
      if (
        busyIds.current.has(busyKey) ||
        busyIds.current.has(`repay:${loanId}`) ||
        busyIds.current.has(`delete:${loanId}`)
      )
        throw new Error('Đang xử lý khoản này. Vui lòng chờ.');
      const loan = loansRef.current.find(({ id }) => id === loanId);
      if (!loan) throw new Error('Không tìm thấy khoản cho mượn.');
      busyIds.current.add(busyKey);
      try {
        const result = await correctLoanPrincipal(
          uid,
          loanId,
          amount,
          loan.updatedAt,
        );
        assertActive();
        publish(result.loans);
        setSyncStatus('synced');
        const financeStore = useFinanceStore.getState();
        if (financeStore.uid === uid) {
          for (const transaction of result.committedTransactions) {
            assertActive();
            await financeStore.addCommitted(uid, transaction).catch(() => {
              if (isActive())
                setError(
                  'Đã sửa khoản vay; hãy tải lại Tài chính để cập nhật.',
                );
            });
          }
        }
        assertActive();
        await reconcileLoanReminders(uid, result.loans).catch(
          () =>
            isActive() &&
            setError('Đã sửa khoản vay, nhưng chưa cập nhật được nhắc hạn.'),
        );
      } finally {
        busyIds.current.delete(busyKey);
      }
    },
    [captureSession, publish, uid],
  );

  const recordRepayment = useCallback(
    async (loanId: string, amount: number) => {
      if (
        !uid ||
        uidRef.current !== uid ||
        useAuthStore.getState().user?.uid !== uid
      )
        throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
      const isActive = captureSession(uid);
      const assertActive = () => {
        if (!isActive()) throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
      };
      const busyKey = `repay:${loanId}`;
      if (
        busyIds.current.has(busyKey) ||
        busyIds.current.has(`delete:${loanId}`) ||
        busyIds.current.has(`correct:${loanId}`)
      )
        throw new Error('Đang ghi nhận khoản nhận lại. Vui lòng chờ.');
      busyIds.current.add(busyKey);
      try {
        const financeStore = useFinanceStore.getState();
        if (financeStore.uid !== uid)
          throw new Error('Tài chính đang tải. Hãy thử lại sau ít phút.');
        const loan = loansRef.current.find(({ id }) => id === loanId);
        if (!loan || loan.cancelledAt !== null)
          throw new Error('Không tìm thấy khoản cho mượn đang mở.');
        let repayment = loan.repayments.find(
          ({ status }) => status === 'pending',
        );
        if (!repayment) {
          const available =
            getLoanOutstandingAmount(loan) - getLoanPendingAmount(loan);
          if (
            !Number.isSafeInteger(amount) ||
            amount <= 0 ||
            amount > available
          )
            throw new Error('Số tiền nhận lại vượt quá số còn phải thu.');
          repayment = await getOrCreateRepaymentAttempt(
            uid,
            loanId,
            amount,
            loan.repayments,
          );
        }

        assertActive();
        let committed: Awaited<
          ReturnType<typeof recordLoanRepaymentAtomically>
        >;
        try {
          committed = await recordLoanRepaymentAtomically(
            uid,
            loanId,
            repayment,
          );
        } catch (cause) {
          if (cause instanceof LoanDataConflictError)
            await clearRepaymentAttempt(uid, loanId);
          throw cause;
        }
        assertActive();
        const nextLoans = [
          committed.loan,
          ...loansRef.current.filter(({ id }) => id !== committed.loan.id),
        ].sort((a, b) => b.updatedAt - a.updatedAt);
        publish(nextLoans);
        setSyncStatus('synced');
        await reconcileLoanReminders(uid, nextLoans).catch(
          () =>
            isActive() &&
            setError('Đã nhận tiền, nhưng chưa cập nhật được nhắc hạn.'),
        );

        let localCacheSaved = true;
        try {
          const cached = await cacheLoanRecord(uid, committed.loan);
          if (isActive()) publish(cached.loans);
        } catch {
          localCacheSaved = false;
        }
        assertActive();
        await financeStore.addCommitted(uid, committed.transaction);
        assertActive();
        await clearRepaymentAttempt(uid, loanId);
        assertActive();
        if (!localCacheSaved)
          setError(
            'Đã ghi nhận khoản trả; bản trên thiết bị sẽ được làm mới khi mở lại sổ.',
          );
      } finally {
        busyIds.current.delete(busyKey);
      }
    },
    [captureSession, publish, uid],
  );

  const matchesAccount = boundUid === uid;
  return {
    loans: matchesAccount ? loans : emptyLoans,
    loading: !!uid && (!matchesAccount || loading),
    syncStatus: matchesAccount ? syncStatus : null,
    error: matchesAccount ? error : null,
    correctableDeletedLoanIds: matchesAccount ? correctableDeletedLoanIds : [],
    load,
    save,
    remove,
    correctPrincipal,
    recordRepayment,
  };
}
