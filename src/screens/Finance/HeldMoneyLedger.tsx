import Feather from '@expo/vector-icons/Feather';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { DialogModal } from '../../components/DialogModal';
import type { useHeldMoneyLedger } from '../../hooks/useHeldMoneyLedger';
import { newHeldMoneyId } from '../../services/finance/heldMoneyStorage';
import { colors } from '../../theme';
import type {
  HeldMoneyEntry,
  HeldMoneyEntryKind,
  HeldMoneyRecord,
} from '../../types/heldMoney';
import { getHeldMoneyTotals } from '../../types/heldMoney';
import {
  formatFinanceAmount,
  formatFinanceDate,
  parseFinanceAmount,
  parseFinanceDate,
} from '../../utils/finance';
import {
  HeldMoneyEntryDialog,
  HeldMoneyRecordDialog,
  type HeldMoneyEntryDraft,
  type HeldMoneyRecordDraft,
} from './HeldMoneyDialogs';
import { heldStyles as styles } from './HeldMoneyLedger.styles';

type Ledger = ReturnType<typeof useHeldMoneyLedger>;
type MenuTarget = { record: HeldMoneyRecord; entry: HeldMoneyEntry };
type EntryTarget = {
  record: HeldMoneyRecord;
  entry: HeldMoneyEntry | null;
  kind: HeldMoneyEntryKind;
  attemptId: string;
};

const entryLabels = {
  received: 'Đã nhận',
  paid: 'Đã đóng',
  returned: 'Đã trả lại',
} as const;

function requiredText(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`Nhập ${label.toLowerCase()}.`);
  return trimmed;
}

function requiredAmount(value: string) {
  const typed = value
    .trim()
    .replace(/\s*[₫đ]\s*$/u, '')
    .trim();
  if (!/^(?:\d+|\d{1,3}(?:[., ]\d{3})+)$/.test(typed))
    throw new Error('Số tiền chỉ gồm chữ số hoặc dấu phân cách hàng nghìn.');
  const amount = parseFinanceAmount(value);
  if (amount === null) throw new Error('Nhập số tiền lớn hơn 0.');
  return amount;
}

function requiredDate(value: string) {
  const date = parseFinanceDate(value);
  if (date === null)
    throw new Error('Ngày không hợp lệ. Nhập dạng DD/MM/YYYY.');
  return date;
}

export function HeldMoneyLedger({
  uid,
  ledger,
  addRequestId,
}: {
  uid: string | null;
  ledger: Ledger;
  addRequestId: number;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [recordFormVisible, setRecordFormVisible] = useState(false);
  const [recordTarget, setRecordTarget] = useState<HeldMoneyRecord | null>(
    null,
  );
  const [createAttempt, setCreateAttempt] = useState<{
    id: string;
    entryId: string;
    createdAt: number;
  } | null>(null);
  const [entryTarget, setEntryTarget] = useState<EntryTarget | null>(null);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const handledRequest = useRef(addRequestId);

  function openCreate() {
    setRecordTarget(null);
    setCreateAttempt({
      id: newHeldMoneyId(),
      entryId: newHeldMoneyId(),
      createdAt: Date.now(),
    });
    setRecordFormVisible(true);
  }

  useEffect(() => {
    if (handledRequest.current === addRequestId) return;
    handledRequest.current = addRequestId;
    openCreate();
  }, [addRequestId]);

  useEffect(() => {
    setExpandedId(null);
    setRecordFormVisible(false);
    setEntryTarget(null);
    setMenuTarget(null);
  }, [uid]);

  async function saveRecord(draft: HeldMoneyRecordDraft) {
    if (!uid) throw new Error('Bạn cần đăng nhập để dùng sổ đóng hộ.');
    const senderName = requiredText(draft.senderName, 'người đưa tiền');
    const purpose = requiredText(draft.purpose, 'nội dung đóng hộ');
    if (recordTarget) {
      await ledger.editDetails(recordTarget, senderName, purpose);
      return;
    }
    if (!createAttempt) throw new Error('Hãy mở lại form tạo khoản đóng hộ.');
    const record: HeldMoneyRecord = {
      id: createAttempt.id,
      ownerId: uid,
      senderName,
      purpose,
      createdAt: createAttempt.createdAt,
      updatedAt: createAttempt.createdAt,
      entries: [
        {
          id: createAttempt.entryId,
          kind: 'received',
          amount: requiredAmount(draft.amount),
          occurredAt: requiredDate(draft.date),
          note: draft.note.trim(),
        },
      ],
    };
    await ledger.create(record);
    setExpandedId(record.id);
  }

  function openEntry(
    record: HeldMoneyRecord,
    entry: HeldMoneyEntry | null = null,
    kind: HeldMoneyEntryKind = 'paid',
  ) {
    setEntryTarget({
      record,
      entry,
      kind: entry?.kind ?? kind,
      attemptId: entry?.id ?? newHeldMoneyId(),
    });
  }

  async function saveEntry(draft: HeldMoneyEntryDraft) {
    if (!entryTarget) throw new Error('Hãy mở lại form ghi nhận.');
    const entry: HeldMoneyEntry = {
      id: entryTarget.attemptId,
      kind: draft.kind,
      amount: requiredAmount(draft.amount),
      occurredAt: requiredDate(draft.date),
      note: draft.note.trim(),
    };
    if (entryTarget.entry)
      await ledger.editEntry(entryTarget.record.id, entryTarget.entry, entry);
    else await ledger.addEntry(entryTarget.record.id, entry);
  }

  function confirmDeleteRecord(record: HeldMoneyRecord) {
    Alert.alert(
      'Xóa khoản đóng hộ?',
      `Xóa khoản của ${record.senderName} và toàn bộ lịch sử nhận, đóng hộ liên quan?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => {
            void ledger
              .removeRecord(record)
              .catch((cause) =>
                Alert.alert(
                  'Chưa xóa được',
                  (cause as Error).message || 'Vui lòng thử lại.',
                ),
              );
          },
        },
      ],
    );
  }

  function confirmDeleteEntry(target: MenuTarget) {
    setMenuTarget(null);
    Alert.alert(
      'Xóa mục lịch sử?',
      'Số còn giữ sẽ được tính lại sau khi xóa.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => {
            void ledger
              .removeEntry(target.record.id, target.entry)
              .catch((cause) =>
                Alert.alert(
                  'Chưa xóa được',
                  (cause as Error).message || 'Vui lòng thử lại.',
                ),
              );
          },
        },
      ],
    );
  }

  const totalRemaining = ledger.records.reduce(
    (sum, record) => sum + getHeldMoneyTotals(record).remaining,
    0,
  );

  return (
    <View style={styles.root}>
      {(ledger.records.length > 0 ||
        (ledger.synced !== null && !ledger.error)) && (
        <View style={styles.summary} accessibilityRole="summary">
          <Text style={styles.summaryLabel}>Tổng tiền đang giữ hộ</Text>
          <Text
            style={[
              styles.summaryAmount,
              totalRemaining < 0 && styles.negativeAmount,
            ]}
          >
            {formatFinanceAmount(totalRemaining)}
          </Text>
          <Text style={styles.summaryHint}>
            {ledger.records.length} khoản đóng hộ · Không tính vào thu chi cá
            nhân
          </Text>
        </View>
      )}

      {!!ledger.error && (
        <View style={styles.card}>
          <Text accessibilityRole="alert" style={styles.error}>
            {ledger.error}
          </Text>
          <Button
            compact
            variant="secondary"
            title="Tải lại"
            onPress={() => void ledger.load()}
          />
        </View>
      )}

      {(ledger.loading || ledger.synced === null) &&
        ledger.records.length === 0 &&
        !ledger.error && (
          <ActivityIndicator
            accessibilityLabel="Đang tải sổ đóng hộ"
            color={colors.earth}
          />
        )}

      {!ledger.loading &&
        ledger.synced !== null &&
        ledger.records.length === 0 &&
        !ledger.error && (
          <View style={styles.empty}>
            <Feather name="inbox" size={29} color={colors.sky} />
            <Text style={styles.emptyTitle}>
              {ledger.synced
                ? 'Chưa có khoản đóng hộ'
                : 'Chưa có khoản trên thiết bị'}
            </Text>
            <Text style={styles.emptyText}>
              {ledger.synced
                ? 'Ghi tiền người khác đưa, rồi trừ dần khi bạn thanh toán giúp.'
                : 'Kết nối mạng và tải lại để xem đầy đủ sổ đóng hộ.'}
            </Text>
            <Button compact title="Tạo khoản đóng hộ" onPress={openCreate} />
          </View>
        )}

      {ledger.records.map((record) => {
        const totals = getHeldMoneyTotals(record);
        const expanded = expandedId === record.id;
        const entries = [...record.entries].sort(
          (a, b) => b.occurredAt - a.occurredAt,
        );
        const receivedEntries = entries.filter(
          (entry) => entry.kind === 'received',
        );
        const outgoingEntries = entries.filter(
          (entry) => entry.kind !== 'received',
        );
        return (
          <View key={record.id} style={styles.card}>
            <View>
              <View style={styles.cardHeader}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${expanded ? 'Thu gọn' : 'Mở'} khoản đóng hộ ${record.purpose} của ${record.senderName}`}
                  accessibilityState={{ expanded }}
                  onPress={() => setExpandedId(expanded ? null : record.id)}
                  style={styles.cardTitleGroup}
                >
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {record.senderName}
                  </Text>
                  <Feather
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={17}
                    color={colors.earth}
                  />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Xóa khoản đóng hộ ${record.purpose} của ${record.senderName}`}
                  accessibilityState={{ disabled: ledger.busy }}
                  disabled={ledger.busy}
                  hitSlop={8}
                  onPress={() => confirmDeleteRecord(record)}
                  style={styles.deleteAction}
                >
                  <Feather name="trash-2" size={16} color={colors.danger} />
                </Pressable>
              </View>
              <View style={styles.purposeRow}>
                <Text style={styles.purpose} numberOfLines={2}>
                  {record.purpose}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Sửa thông tin khoản đóng hộ của ${record.senderName}`}
                  accessibilityState={{ disabled: ledger.busy }}
                  disabled={ledger.busy}
                  hitSlop={8}
                  onPress={() => {
                    setRecordTarget(record);
                    setRecordFormVisible(true);
                  }}
                  style={styles.editDetailsIcon}
                >
                  <Feather name="edit-2" size={14} color={colors.earth} />
                </Pressable>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Còn giữ ${formatFinanceAmount(totals.remaining)}. ${expanded ? 'Thu gọn' : 'Xem lịch sử'}`}
              onPress={() => setExpandedId(expanded ? null : record.id)}
              style={styles.balanceBox}
            >
              <Text style={styles.balanceLabel}>Còn giữ để đóng hộ</Text>
              <Text
                style={[
                  styles.balanceAmount,
                  totals.remaining < 0 && styles.negativeAmount,
                ]}
              >
                {formatFinanceAmount(totals.remaining)}
              </Text>
              {totals.remaining < 0 && (
                <Text style={styles.balanceHint}>Đã ứng trước phần chênh lệch</Text>
              )}
            </Pressable>
            <View style={styles.totalsRow}>
              <Text style={styles.totalText}>
                Đã nhận{' '}
                <Text style={styles.totalValue}>
                  {formatFinanceAmount(totals.received)}
                </Text>
              </Text>
              <Text style={styles.totalText}>
                Đã đóng{' '}
                <Text style={styles.totalValue}>
                  {formatFinanceAmount(totals.paid)}
                </Text>
              </Text>
              {totals.returned > 0 && (
                <Text style={styles.totalText}>
                  Trả lại{' '}
                  <Text style={styles.totalValue}>
                    {formatFinanceAmount(totals.returned)}
                  </Text>
                </Text>
              )}
            </View>
            {expanded && (
              <View style={styles.histories}>
                <HeldMoneyHistorySection
                  title="Lịch sử gửi thêm"
                  emptyMessage="Chưa có lần nhận tiền."
                  addLabel={`Ghi nhận tiền ${record.senderName} gửi thêm`}
                  entries={receivedEntries}
                  busy={ledger.busy}
                  onAdd={() => openEntry(record, null, 'received')}
                  onOpenEntry={(entry) => setMenuTarget({ record, entry })}
                />
                <HeldMoneyHistorySection
                  title="Lịch sử đóng hộ"
                  emptyMessage="Chưa đóng hộ hoặc trả lại tiền."
                  addLabel={`Ghi nhận đóng hộ hoặc trả lại tiền cho ${record.senderName}`}
                  entries={outgoingEntries}
                  busy={ledger.busy}
                  onAdd={() => openEntry(record, null, 'paid')}
                  onOpenEntry={(entry) => setMenuTarget({ record, entry })}
                />
              </View>
            )}
          </View>
        );
      })}

      <HeldMoneyRecordDialog
        visible={recordFormVisible}
        initial={recordTarget}
        busy={ledger.busy}
        onClose={() => setRecordFormVisible(false)}
        onSave={saveRecord}
      />
      <HeldMoneyEntryDialog
        visible={!!entryTarget}
        initial={entryTarget?.entry ?? null}
        initialKind={entryTarget?.kind ?? 'paid'}
        remaining={formatFinanceAmount(
          entryTarget ? getHeldMoneyTotals(entryTarget.record).remaining : 0,
        )}
        busy={ledger.busy}
        onClose={() => setEntryTarget(null)}
        onSave={saveEntry}
      />
      <DialogModal
        visible={!!menuTarget}
        onRequestClose={() => setMenuTarget(null)}
        style={styles.dialog}
      >
        <View style={styles.dialogHeader}>
          <Text accessibilityRole="header" style={styles.dialogTitle}>
            Mục lịch sử
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng tùy chọn"
            onPress={() => setMenuTarget(null)}
            style={styles.menuButton}
          >
            <Feather name="x" size={18} color={colors.earth} />
          </Pressable>
        </View>
        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sửa"
            onPress={() => {
              if (!menuTarget) return;
              openEntry(menuTarget.record, menuTarget.entry);
              setMenuTarget(null);
            }}
            style={styles.actionButton}
          >
            <Text style={styles.actionText}>Sửa</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xóa"
            onPress={() => menuTarget && confirmDeleteEntry(menuTarget)}
            style={[styles.actionButton, styles.deleteButton]}
          >
            <Text style={[styles.actionText, styles.deleteText]}>Xóa</Text>
          </Pressable>
        </View>
      </DialogModal>
    </View>
  );
}

function HeldMoneyHistorySection({
  title,
  emptyMessage,
  addLabel,
  entries,
  busy,
  onAdd,
  onOpenEntry,
}: {
  title: string;
  emptyMessage: string;
  addLabel: string;
  entries: HeldMoneyEntry[];
  busy: boolean;
  onAdd: () => void;
  onOpenEntry: (entry: HeldMoneyEntry) => void;
}) {
  return (
    <View style={styles.history}>
      <View style={styles.historyHeader}>
        <Text accessibilityRole="header" style={styles.historyTitle}>
          {title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={onAdd}
          style={styles.addEntryButton}
        >
          <Feather name="plus" size={19} color={colors.earth} />
        </Pressable>
      </View>
      {entries.length === 0 && (
        <Text style={styles.historyEmpty}>{emptyMessage}</Text>
      )}
      {entries.map((entry) => (
        <View
          key={entry.id}
          style={[
            styles.entry,
            entry.kind === 'received' && styles.entryIncoming,
          ]}
        >
          <View style={styles.entryIcon}>
            <Feather
              name={
                entry.kind === 'received'
                  ? 'arrow-down-left'
                  : entry.kind === 'paid'
                    ? 'check'
                    : 'corner-up-right'
              }
              size={15}
              color={entry.kind === 'received' ? colors.success : colors.earth}
            />
          </View>
          <View style={styles.entryMain}>
            <View style={styles.entryTop}>
              <Text style={styles.entryTitle}>{entryLabels[entry.kind]}</Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[
                  styles.entryAmount,
                  entry.kind === 'received' && styles.entryReceived,
                ]}
              >
                {entry.kind === 'received' ? '+' : '−'}
                {formatFinanceAmount(entry.amount)}
              </Text>
            </View>
            <Text numberOfLines={2} style={styles.entryDetail}>
              {formatFinanceDate(new Date(entry.occurredAt))}
              {entry.note ? ` · ${entry.note}` : ''}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Tùy chọn mục ${entryLabels[entry.kind]} ${formatFinanceAmount(entry.amount)}`}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => onOpenEntry(entry)}
            style={styles.entryMenu}
          >
            <Feather name="more-vertical" size={16} color={colors.earth} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}
