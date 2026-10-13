import { useCallback, useEffect, useRef, useState } from 'react';
import type { LoanAdvance, LoanRecord, LoanRepayment } from '../types/loan';
import { getLoanOutstandingAmount, getLoanPendingAmount } from '../types/loan';
import {
  cacheLoanRecord,
  clearRepaymentAttempt,
  clearAdvanceAttempt,
  correctLoanPrincipal,
  deleteLoanData,
  getOrCreateRepaymentAttempt,
  getOrCreateAdvanceAttempt,
  LoanDataConflictError,
  readLoanData,
  recordLoanRepaymentAtomically,
  removeLoanRepaymentAtomically,
  updateLoanRepaymentAtomically,
  recordLoanAdvanceAtomically,
  updateLoanAdvanceAtomically,
  removeLoanAdvanceAtomically,
  removeInitialLoanEntryAtomically,
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
        return false;
      }
      const isActive = captureSession(currentUid);
      const isCurrentLoad = () => request === loadRequest.current && isActive();
      if (!isCurrentLoad()) return false;
      setLoading(true);
      setError(null);
      try {
        const result = await readLoanData(currentUid);
        if (!isCurrentLoad()) return false;
        publish(result.loans);
        setCorrectableDeletedLoanIds(result.correctableDeletedLoanIds ?? []);
        setSyncStatus(result.synced ? 'synced' : 'local');
        const financeStore = useFinanceStore.getState();
        if (financeStore.uid === currentUid) {
          for (const transaction of result.committedTransactions) {
            if (!isCurrentLoad()) return false;
            try {
              await financeStore.addCommitted(currentUid, transaction);
            } catch {
              // Firestore already committed the linked entry. Finance will
              // pick it up from the server the next time its list is loaded.
            }
          }
        }
        if (!isCurrentLoad()) return false;
        if (refreshFinance && useFinanceStore.getState().uid === currentUid)
          await useFinanceStore.getState().load(currentUid);
        if (!isCurrentLoad()) return false;
        const finance = useFinanceStore.getState();
        const financeSynced =
          !refreshFinance ||
          (finance.uid === currentUid &&
            finance.syncStatus === 'synced' &&
            !finance.error);
        await reconcileLoanReminders(currentUid, result.loans);
        return result.synced && financeSynced;
      } catch {
        if (isCurrentLoad()) setError('Chưa tải được sổ cho vay. Hãy thử lại.');
        return false;
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
        busyIds.current.has(`advance:${loanId}`) ||
        busyIds.current.has(`editAdvance:${loanId}`) ||
        busyIds.current.has(`correct:${loanId}`)
      )
        throw new Error('Đang xử lý khoản này. Vui lòng chờ.');
      busyIds.current.add(busyKey);
      try {
        const loan = loansRef.current.find(({ id }) => id === loanId);
        if (!loan) throw new Error('Không tìm thấy khoản cho vay.');
        const result = await deleteLoanData(uid, loanId);
        assertActive();
        await clearRepaymentAttempt(uid, loanId).catch(() => undefined);
        await clearAdvanceAttempt(uid, loanId).catch(() => undefined);
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
    async (loanId: string, amount: number, note: string, lentAt: number) => {
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
        busyIds.current.has(`advance:${loanId}`) ||
        busyIds.current.has(`editAdvance:${loanId}`) ||
        busyIds.current.has(`delete:${loanId}`)
      )
        throw new Error('Đang xử lý khoản này. Vui lòng chờ.');
      const loan = loansRef.current.find(({ id }) => id === loanId);
      if (!loan) throw new Error('Không tìm thấy khoản cho vay.');
      busyIds.current.add(busyKey);
      try {
        const result = await correctLoanPrincipal(
          uid,
          loanId,
          { amount, note, lentAt },
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
        busyIds.current.has(`advance:${loanId}`) ||
        busyIds.current.has(`editAdvance:${loanId}`) ||
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
          throw new Error('Không tìm thấy khoản cho vay đang mở.');
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
        let financeCacheSaved = true;
        try {
          await financeStore.addCommitted(uid, committed.transaction);
        } catch {
          financeCacheSaved = false;
        }
        await clearRepaymentAttempt(uid, loanId).catch(() => undefined);
        assertActive();
        if (!localCacheSaved || !financeCacheSaved)
          setError(
            'Đã ghi nhận khoản trả; dữ liệu trên thiết bị sẽ được làm mới khi tải lại.',
          );
      } finally {
        busyIds.current.delete(busyKey);
      }
    },
    [captureSession, publish, uid],
  );

  const removeRepayment = useCallback(
    async (loanId: string, repayment: LoanRepayment) => {
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
        ['repay', 'advance', 'editAdvance', 'delete', 'correct'].some(
          (action) => busyIds.current.has(`${action}:${loanId}`),
        )
      )
        throw new Error('Đang xử lý khoản này. Vui lòng chờ.');
      const loan = loansRef.current.find(({ id }) => id === loanId);
      if (
        !loan ||
        !loan.repayments.some(
          (item) => item.id === repayment.id && item.status === 'posted',
        )
      )
        throw new Error('Lần nhận tiền đã thay đổi. Hãy tải lại sổ.');
      busyIds.current.add(busyKey);
      setError(null);
      try {
        let updated: LoanRecord;
        try {
          updated = await removeLoanRepaymentAtomically(uid, loanId, repayment);
        } catch (cause) {
          if (cause instanceof LoanDataConflictError) throw cause;
          const code =
            cause && typeof cause === 'object' && 'code' in cause
              ? String(cause.code)
              : '';
          if (
            code.includes('permission-denied') ||
            (cause instanceof Error &&
              cause.message.includes('permission-denied'))
          )
            throw new Error(
              'Máy chủ chưa cấp quyền xóa lần nhận tiền. Hãy cập nhật quyền đồng bộ rồi thử lại.',
            );
          throw new Error(
            'Chưa xác nhận được lần xóa. Hãy tải lại sổ trước khi thử lại để tránh thao tác trùng.',
          );
        }
        assertActive();
        loadRequest.current += 1;
        setLoading(false);
        const nextLoans = [
          updated,
          ...loansRef.current.filter(({ id }) => id !== loanId),
        ].sort((a, b) => b.updatedAt - a.updatedAt);
        publish(nextLoans);
        setSyncStatus('synced');
        await clearRepaymentAttempt(uid, loanId).catch(() => undefined);
        assertActive();
        let needsRefresh = false;
        try {
          await cacheLoanRecord(uid, updated);
        } catch {
          needsRefresh = true;
        }
        assertActive();
        if (useFinanceStore.getState().uid === uid) {
          try {
            await useFinanceStore.getState().load(uid);
            const finance = useFinanceStore.getState();
            if (finance.error || finance.syncStatus !== 'synced')
              needsRefresh = true;
          } catch {
            needsRefresh = true;
          }
        }
        assertActive();
        try {
          await reconcileLoanReminders(uid, nextLoans);
        } catch {
          needsRefresh = true;
        }
        if (needsRefresh && isActive())
          setError(
            'Đã xóa lần nhận tiền; kéo xuống đồng bộ nếu Tài chính hoặc nhắc hạn chưa cập nhật.',
          );
        assertActive();
      } finally {
        busyIds.current.delete(busyKey);
      }
    },
    [captureSession, publish, uid],
  );

  const recordAdvance = useCallback(
    async (loanId: string, amount: number, note: string, lentAt: number) => {
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
      const busyKey = `advance:${loanId}`;
      if (
        ['advance', 'editAdvance', 'repay', 'delete', 'correct'].some(
          (action) => busyIds.current.has(`${action}:${loanId}`),
        )
      )
        throw new Error('Đang xử lý khoản này. Vui lòng chờ.');
      busyIds.current.add(busyKey);
      setError(null);
      try {
        const loan = loansRef.current.find(({ id }) => id === loanId);
        if (!loan) throw new Error('Không tìm thấy khoản cho vay.');
        const attempt = await getOrCreateAdvanceAttempt(
          uid,
          loanId,
          amount,
          { note, lentAt },
          loan.advances,
        );
        assertActive();
        let committed: Awaited<ReturnType<typeof recordLoanAdvanceAtomically>>;
        try {
          committed = await recordLoanAdvanceAtomically(uid, loanId, attempt);
        } catch (cause) {
          if (cause instanceof LoanDataConflictError)
            await clearAdvanceAttempt(uid, loanId);
          throw cause instanceof LoanDataConflictError
            ? cause
            : new Error(
                'Chưa xác nhận được lần cho thêm. Hãy tải lại sổ hoặc thử lại đúng số tiền để tránh ghi trùng.',
              );
        }
        assertActive();
        // Invalidate a refresh started before this commit so it cannot publish older data.
        loadRequest.current += 1;
        setLoading(false);
        const nextLoans = [
          committed.loan,
          ...loansRef.current.filter(({ id }) => id !== loanId),
        ].sort((a, b) => b.updatedAt - a.updatedAt);
        publish(nextLoans);
        setSyncStatus('synced');
        // A confirmed Firestore write retires the retry ID even if local cache
        // or Finance state fails to update afterwards.
        await clearAdvanceAttempt(uid, loanId).catch(() => undefined);
        assertActive();
        // Once cloud commits, cache/notification errors must not look like a failed loan.
        try {
          await cacheLoanRecord(uid, committed.loan);
          assertActive();
          if (useFinanceStore.getState().uid === uid)
            await useFinanceStore
              .getState()
              .addCommitted(uid, committed.transaction);
          assertActive();
          await reconcileLoanReminders(uid, nextLoans);
        } catch {
          if (isActive())
            setError(
              'Đã cho vay thêm; kéo xuống đồng bộ nếu dữ liệu trên máy chưa cập nhật.',
            );
        }
        assertActive();
      } finally {
        busyIds.current.delete(busyKey);
      }
    },
    [captureSession, publish, uid],
  );

  const updateAdvance = useCallback(
    async (
      loanId: string,
      expectedAdvance: LoanAdvance,
      amount: number,
      note: string,
      lentAt: number,
    ) => {
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
      const busyKey = `editAdvance:${loanId}`;
      if (
        ['advance', 'editAdvance', 'repay', 'delete', 'correct'].some(
          (action) => busyIds.current.has(`${action}:${loanId}`),
        )
      )
        throw new Error('Đang xử lý khoản này. Vui lòng chờ.');
      busyIds.current.add(busyKey);
      setError(null);
      try {
        const result = await updateLoanAdvanceAtomically(
          uid,
          loanId,
          expectedAdvance,
          { amount, note, lentAt },
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
                  'Đã sửa lần cho vay; hãy tải lại Tài chính để cập nhật.',
                );
            });
          }
        }
        assertActive();
      } finally {
        busyIds.current.delete(busyKey);
      }
    },
    [captureSession, publish, uid],
  );

  const removeAdvance = useCallback(
    async (loanId: string, advance: LoanAdvance) => {
      if (
        !uid ||
        uidRef.current !== uid ||
        useAuthStore.getState().user?.uid !== uid
      )
        throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
      const isActive = captureSession(uid);
      const busyKey = `editAdvance:${loanId}`;
      if (
        ['advance', 'editAdvance', 'repay', 'delete', 'correct'].some(
          (action) => busyIds.current.has(`${action}:${loanId}`),
        )
      )
        throw new Error('Đang xử lý khoản này. Vui lòng chờ.');
      busyIds.current.add(busyKey);
      setError(null);
      try {
        const updated = await removeLoanAdvanceAtomically(uid, loanId, advance);
        if (!isActive()) throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
        loadRequest.current += 1;
        setLoading(false);
        const nextLoans = [
          updated,
          ...loansRef.current.filter(({ id }) => id !== loanId),
        ].sort((a, b) => b.updatedAt - a.updatedAt);
        publish(nextLoans);
        setSyncStatus('synced');
        await clearAdvanceAttempt(uid, loanId).catch(() => undefined);
        await cacheLoanRecord(uid, updated).catch(() => {
          if (isActive())
            setError('Đã xóa khoản vay thêm; kéo xuống để lưu trên thiết bị.');
        });
        if (useFinanceStore.getState().uid === uid) {
          await useFinanceStore.getState().load(uid);
          const finance = useFinanceStore.getState();
          if (
            isActive() &&
            (finance.syncStatus !== 'synced' ||
              finance.transactions.some(
                ({ id }) => id === advance.financeTransactionId,
              ))
          )
            setError('Đã xóa khoản vay thêm; kéo xuống để cập nhật Tài chính.');
        }
        if (isActive())
          await reconcileLoanReminders(uid, nextLoans).catch(() => {
            if (isActive())
              setError('Đã xóa khoản vay thêm; nhắc hạn chưa cập nhật.');
          });
      } finally {
        busyIds.current.delete(busyKey);
      }
    },
    [captureSession, publish, uid],
  );

  const removeInitialEntry = useCallback(
    async (loanId: string, expectedUpdatedAt: number) => {
      if (
        !uid ||
        uidRef.current !== uid ||
        useAuthStore.getState().user?.uid !== uid
      )
        throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
      const isActive = captureSession(uid);
      const busyKey = `correct:${loanId}`;
      if (
        ['advance', 'editAdvance', 'repay', 'delete', 'correct'].some(
          (action) => busyIds.current.has(`${action}:${loanId}`),
        )
      )
        throw new Error('Đang xử lý khoản này. Vui lòng chờ.');
      busyIds.current.add(busyKey);
      setError(null);
      try {
        const deletedAdvanceTransactionId = loansRef.current.find(
          ({ id }) => id === loanId,
        )?.advances?.[0]?.financeTransactionId;
        const result = await removeInitialLoanEntryAtomically(
          uid,
          loanId,
          expectedUpdatedAt,
        );
        if (!isActive()) throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
        loadRequest.current += 1;
        setLoading(false);
        const nextLoans = [
          result.loan,
          ...loansRef.current.filter(({ id }) => id !== loanId),
        ].sort((a, b) => b.updatedAt - a.updatedAt);
        publish(nextLoans);
        setSyncStatus('synced');
        await clearAdvanceAttempt(uid, loanId).catch(() => undefined);
        await cacheLoanRecord(uid, result.loan).catch(() => {
          if (isActive())
            setError('Đã xóa khoản ban đầu; kéo xuống để lưu trên thiết bị.');
        });
        if (useFinanceStore.getState().uid === uid) {
          await useFinanceStore.getState().load(uid);
          const finance = useFinanceStore.getState();
          if (
            isActive() &&
            (finance.syncStatus !== 'synced' ||
              finance.transactions.some(
                ({ id }) => id === deletedAdvanceTransactionId,
              ))
          )
            setError('Đã xóa khoản ban đầu; kéo xuống để cập nhật Tài chính.');
        }
        if (isActive())
          await reconcileLoanReminders(uid, nextLoans).catch(() => {
            if (isActive())
              setError('Đã xóa khoản ban đầu; nhắc hạn chưa cập nhật.');
          });
      } finally {
        busyIds.current.delete(busyKey);
      }
    },
    [captureSession, publish, uid],
  );

  const updateRepayment = useCallback(
    async (
      loanId: string,
      repayment: LoanRepayment,
      amount: number,
      receivedAt: number,
    ) => {
      if (
        !uid ||
        uidRef.current !== uid ||
        useAuthStore.getState().user?.uid !== uid
      )
        throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
      const isActive = captureSession(uid);
      const busyKey = `repay:${loanId}`;
      if (
        ['advance', 'editAdvance', 'repay', 'delete', 'correct'].some(
          (action) => busyIds.current.has(`${action}:${loanId}`),
        )
      )
        throw new Error('Đang xử lý khoản này. Vui lòng chờ.');
      busyIds.current.add(busyKey);
      setError(null);
      try {
        const result = await updateLoanRepaymentAtomically(
          uid,
          loanId,
          repayment,
          { amount, receivedAt },
        );
        if (!isActive()) throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
        loadRequest.current += 1;
        setLoading(false);
        const nextLoans = [
          result.loan,
          ...loansRef.current.filter(({ id }) => id !== loanId),
        ].sort((a, b) => b.updatedAt - a.updatedAt);
        publish(nextLoans);
        setSyncStatus('synced');
        await cacheLoanRecord(uid, result.loan).catch(() => {
          if (isActive())
            setError('Đã sửa lần nhận lại; kéo xuống để lưu trên thiết bị.');
        });
        if (useFinanceStore.getState().uid === uid) {
          await useFinanceStore
            .getState()
            .addCommitted(uid, result.transaction)
            .catch(() => {
              if (isActive())
                setError(
                  'Đã sửa lần nhận lại; kéo xuống để cập nhật Tài chính.',
                );
            });
        }
        if (isActive())
          await reconcileLoanReminders(uid, nextLoans).catch(() => {
            if (isActive())
              setError('Đã sửa lần nhận lại; nhắc hạn chưa cập nhật.');
          });
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
    removeRepayment,
    recordAdvance,
    updateAdvance,
    removeAdvance,
    removeInitialEntry,
    updateRepayment,
  };
}
