import { useCallback, useEffect, useRef, useState } from 'react';
import type { HeldMoneyEntry, HeldMoneyRecord } from '../types/heldMoney';
import {
  addHeldMoneyEntry,
  createHeldMoneyRecord,
  deleteHeldMoneyEntry,
  deleteHeldMoneyRecord,
  readHeldMoney,
  updateHeldMoneyDetails,
  updateHeldMoneyEntry,
} from '../services/finance/heldMoneyStorage';

export function useHeldMoneyLedger(uid: string | null, active: boolean) {
  const [records, setRecords] = useState<HeldMoneyRecord[]>([]);
  const [recordsOwner, setRecordsOwner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [synced, setSynced] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uidRef = useRef(uid);
  const requestRef = useRef(0);
  uidRef.current = uid;

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    if (!uid) {
      setRecords([]);
      setSynced(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await readHeldMoney(uid);
      if (request === requestRef.current && uidRef.current === uid) {
        setRecords(result.records);
        setRecordsOwner(uid);
        setSynced(result.synced);
      }
    } catch (cause) {
      if (request === requestRef.current && uidRef.current === uid) {
        setSynced(false);
        setError((cause as Error).message || 'Chưa tải được sổ đóng hộ.');
      }
    } finally {
      if (request === requestRef.current && uidRef.current === uid)
        setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    ++requestRef.current;
    setRecords([]);
    setRecordsOwner(null);
    setSynced(null);
    setError(null);
    setLoading(false);
    setBusy(false);
  }, [uid]);

  useEffect(() => {
    if (active) void load();
  }, [active, load]);

  const perform = useCallback(
    async (operation: (owner: string) => Promise<HeldMoneyRecord | null>) => {
      if (!uid) throw new Error('Bạn cần đăng nhập để dùng sổ đóng hộ.');
      ++requestRef.current;
      setLoading(false);
      setBusy(true);
      setError(null);
      try {
        const record = await operation(uid);
        if (uidRef.current !== uid)
          throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
        setRecords((current) =>
          record
            ? [
                record,
                ...(recordsOwner === uid ? current : []).filter(
                  ({ id }) => id !== record.id,
                ),
              ].sort((a, b) => b.updatedAt - a.updatedAt)
            : current,
        );
        setRecordsOwner(uid);
        setSynced(true);
        return record;
      } catch (cause) {
        const message =
          (cause as Error).message || 'Chưa lưu được khoản đóng hộ.';
        if (uidRef.current === uid) setError(message);
        throw new Error(message);
      } finally {
        if (uidRef.current === uid) setBusy(false);
      }
    },
    [recordsOwner, uid],
  );

  const create = useCallback(
    (record: HeldMoneyRecord) =>
      perform((owner) => createHeldMoneyRecord(owner, record)),
    [perform],
  );
  const editDetails = useCallback(
    (expected: HeldMoneyRecord, senderName: string, purpose: string) =>
      perform((owner) =>
        updateHeldMoneyDetails(owner, expected, senderName, purpose),
      ),
    [perform],
  );
  const addEntry = useCallback(
    (recordId: string, entry: HeldMoneyEntry) =>
      perform((owner) => addHeldMoneyEntry(owner, recordId, entry)),
    [perform],
  );
  const editEntry = useCallback(
    (recordId: string, expected: HeldMoneyEntry, next: HeldMoneyEntry) =>
      perform((owner) => updateHeldMoneyEntry(owner, recordId, expected, next)),
    [perform],
  );
  const removeEntry = useCallback(
    (recordId: string, expected: HeldMoneyEntry) =>
      perform((owner) => deleteHeldMoneyEntry(owner, recordId, expected)),
    [perform],
  );
  const removeRecord = useCallback(
    async (expected: HeldMoneyRecord) => {
      await perform((owner) => deleteHeldMoneyRecord(owner, expected));
      if (uidRef.current === uid)
        setRecords((current) => current.filter(({ id }) => id !== expected.id));
    },
    [perform, uid],
  );

  return {
    records: recordsOwner === uid ? records : [],
    loading,
    busy,
    synced,
    error,
    load,
    create,
    editDetails,
    addEntry,
    editEntry,
    removeEntry,
    removeRecord,
  };
}
