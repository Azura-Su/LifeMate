import { useEffect, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { DialogModal } from '../../components/DialogModal';
import { DialogCloseButton } from '../../components/DialogCloseButton';
import { gameRequest } from '../../services/cardGames/gameApi';
import { getGameDeviceSessionId } from '../../services/cardGames/gameDeviceSession';
import { useAuthStore } from '../../store/authStore';
import { colors, fontSize, spacing, typography } from '../../theme';
import type {
  CardScoreAuditChange,
  CardScoreAuditEntry,
  CardScoreMatch,
} from '../../types/cardScore';

function describe(change: CardScoreAuditChange) {
  if (change.kind === 'table-delete') return 'Đã xóa bảng điểm';
  if (change.kind === 'table-restore') return 'Đã khôi phục bảng điểm';
  if (change.kind === 'settings') {
    const details: string[] = [];
    if (change.after.title)
      details.push(`Tên bàn: ${change.before.title} → ${change.after.title}`);
    if (change.after.players)
      details.push(
        `Người chơi: ${(change.before.players ?? []).map((p) => p.name).join(', ')} → ${change.after.players.map((p) => p.name).join(', ')}`,
      );
    if (change.after.status)
      details.push(
        change.after.status === 'finished' ? 'Kết thúc bàn' : 'Mở lại bàn',
      );
    if (change.after.seatOrder) details.push('Thay đổi thứ tự chỗ ngồi');
    if (change.after.dealerPlayerId) details.push('Thay đổi người chia bài');
    return details.join('\n');
  }
  const verb = {
    'round-add': 'Thêm',
    'round-edit': 'Sửa',
    'round-delete': 'Xóa',
  }[change.kind];
  const scores = change.players
    .map((player) => {
      const old = change.before?.scores[player.id] ?? 0,
        next = change.after?.scores[player.id] ?? 0;
      return `${player.name}: ${change.kind === 'round-edit' ? `${old} → ${next}` : change.kind === 'round-delete' ? old : next}`;
    })
    .join('\n');
  return `${verb} ván ${change.roundNumber}\n${scores}`;
}

const KIND = {
  'round-add': {
    label: 'Thêm',
    icon: 'plus',
    color: colors.success,
    soft: colors.successSoft,
  },
  'round-edit': {
    label: 'Sửa',
    icon: 'edit-2',
    color: colors.sunlight,
    soft: colors.sunlightSoft,
  },
  'round-delete': {
    label: 'Xóa',
    icon: 'trash-2',
    color: colors.danger,
    soft: colors.dangerSoft,
  },
  settings: {
    label: 'Cài đặt',
    icon: 'settings',
    color: colors.earth,
    soft: colors.skySoft,
  },
  'table-delete': {
    label: 'Xóa bảng',
    icon: 'trash-2',
    color: colors.danger,
    soft: colors.dangerSoft,
  },
  'table-restore': {
    label: 'Khôi phục',
    icon: 'rotate-ccw',
    color: colors.success,
    soft: colors.successSoft,
  },
} as const;

function formatTime(at: number) {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} · ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function signed(n: number) {
  return n > 0 ? `+${n}` : String(n);
}

function scoreColor(n: number) {
  return n > 0 ? colors.success : n < 0 ? colors.danger : colors.muted;
}

function ChangeBlock({ change }: { change: CardScoreAuditChange }) {
  const kind = KIND[change.kind];
  const isRound =
    change.kind === 'round-add' ||
    change.kind === 'round-edit' ||
    change.kind === 'round-delete';
  const title = isRound
    ? `${kind.label} ván ${change.roundNumber}`
    : describe(change).split('\n')[0];
  const details = isRound ? [] : describe(change).split('\n').slice(1);
  return (
    <View style={auditStyles.change}>
      <View style={auditStyles.changeHeading}>
        <View style={[auditStyles.kindChip, { backgroundColor: kind.soft }]}>
          <Feather name={kind.icon} size={11} color={kind.color} />
          <Text style={[auditStyles.kindText, { color: kind.color }]}>
            {kind.label}
          </Text>
        </View>
        <Text style={auditStyles.changeTitle}>{title}</Text>
      </View>
      {isRound && (
        <View
          style={[
            auditStyles.scoreTable,
            change.kind === 'round-delete' && auditStyles.deletedTable,
          ]}
        >
          {change.players.map((player, i) => {
            const old = change.before?.scores[player.id] ?? 0;
            const next = change.after?.scores[player.id] ?? 0;
            const value = change.kind === 'round-delete' ? old : next;
            const changed = change.kind === 'round-edit' && old !== next;
            return (
              <View
                key={player.id}
                accessible
                accessibilityLabel={
                  change.kind === 'round-edit'
                    ? `${player.name}: ${old} → ${next}`
                    : `${player.name}: ${value}`
                }
                style={[
                  auditStyles.scoreRow,
                  i > 0 && auditStyles.scoreRowLine,
                ]}
              >
                <Text numberOfLines={1} style={auditStyles.playerName}>
                  {player.name}
                </Text>
                {changed && (
                  <>
                    <Text style={auditStyles.oldScore}>{signed(old)}</Text>
                    <Feather
                      name="arrow-right"
                      size={12}
                      color={colors.muted}
                    />
                  </>
                )}
                <Text
                  style={[
                    auditStyles.score,
                    { color: scoreColor(value) },
                    change.kind === 'round-delete' && auditStyles.deletedScore,
                  ]}
                >
                  {signed(value)}
                </Text>
              </View>
            );
          })}
        </View>
      )}
      {details.map((line, i) => (
        <Text key={i} style={auditStyles.detail}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function AuditContent({
  uid,
  epoch,
  match,
}: {
  uid: string;
  epoch: number;
  match: CardScoreMatch;
}) {
  const [events, setEvents] = useState<CardScoreAuditEntry[]>(
    match.audit ?? [],
  );
  const [before, setBefore] = useState<number | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(!!match.sharedVersion);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!match.sharedVersion) return;
    const controller = new AbortController();
    const current = () =>
      !controller.signal.aborted &&
      useAuthStore.getState().user?.uid === uid &&
      useAuthStore.getState().sessionEpoch === epoch;
    setLoading(true);
    setError(null);
    void getGameDeviceSessionId()
      .then((sessionId) =>
        gameRequest(
          uid,
          { type: 'score-history', sessionId, tableId: match.id, before },
          controller.signal,
        ),
      )
      .then((result) => {
        if (!current()) return;
        setEvents((previous) =>
          before === null
            ? result.events
            : [
                ...previous,
                ...result.events.filter(
                  (entry) => !previous.some((old) => old.id === entry.id),
                ),
              ],
        );
        setCursor(result.nextBefore);
      })
      .catch((cause) => {
        if (current())
          setError((cause as Error).message || 'Chưa tải được lịch sử.');
      })
      .finally(() => {
        if (current()) setLoading(false);
      });
    return () => controller.abort();
  }, [uid, epoch, match.id, match.sharedVersion, before, retry]);
  const ownerEvents = events.filter((entry) => !!entry.actorUid);
  return (
    <>
      <Text style={auditStyles.subtitle}>{match.title}</Text>
      <ScrollView
        testID="score-audit-scroll"
        style={auditStyles.scroll}
        contentContainerStyle={auditStyles.list}
      >
        <View style={auditStyles.list} onStartShouldSetResponder={() => true}>
          {ownerEvents.map((entry) => (
            <View key={entry.id} style={auditStyles.entry}>
              <View style={auditStyles.eventHeading}>
                <View style={auditStyles.eventIcon}>
                  <Text style={auditStyles.eventInitial}>
                    {entry.actorName.slice(0, 1).toUpperCase() || '?'}
                  </Text>
                </View>
                <Text numberOfLines={1} style={auditStyles.actor}>
                  {entry.actorName}
                </Text>
                <Text style={auditStyles.time}>{formatTime(entry.at)}</Text>
              </View>
              {entry.changes.map((change, index) => (
                <ChangeBlock key={index} change={change} />
              ))}
            </View>
          ))}
          {!ownerEvents.length && !loading && !error && (
            <View style={auditStyles.empty}>
              <Feather name="clock" size={24} color={colors.muted} />
              <Text style={auditStyles.emptyTitle}>
                {cursor === null
                  ? 'Chưa có chỉnh sửa'
                  : 'Chưa có chỉnh sửa trong phần đã tải'}
              </Text>
              <Text style={auditStyles.emptyText}>
                {cursor === null
                  ? 'Các thao tác sửa và xóa của chủ phòng sẽ hiển thị tại đây.'
                  : 'Chọn “Xem thay đổi trước” để tải lịch sử cũ hơn.'}
              </Text>
            </View>
          )}
          {loading && <ActivityIndicator color={colors.earth} />}
          {error && (
            <>
              <Text style={auditStyles.error}>{error}</Text>
              <Button
                title="Tải lại lịch sử"
                compact
                variant="secondary"
                onPress={() => setRetry((value) => value + 1)}
              />
            </>
          )}
          {cursor !== null && !error && (
            <Button
              title="Xem thay đổi trước"
              compact
              variant="secondary"
              disabled={loading}
              onPress={() => setBefore(cursor)}
            />
          )}
        </View>
      </ScrollView>
    </>
  );
}
export function CardScoreAuditDialog({
  uid,
  epoch,
  match,
  onClose,
}: {
  uid?: string;
  epoch: number;
  match: CardScoreMatch | null;
  onClose: () => void;
}) {
  const { height } = useWindowDimensions();
  if (!uid || !match) return null;
  return (
    <DialogModal
      onRequestClose={onClose}
      onBackdropPress={onClose}
      style={[auditStyles.dialog, { height: Math.min(height * 0.85, 640) }]}
    >
      <View style={auditStyles.heading}>
        <Text style={auditStyles.title}>Lịch sử sửa/xóa</Text>
        <DialogCloseButton
          accessibilityLabel="Đóng lịch sử sửa/xóa"
          onPress={onClose}
        />
      </View>
      <AuditContent
        key={`${uid}:${epoch}:${match.id}`}
        uid={uid}
        epoch={epoch}
        match={match}
      />
    </DialogModal>
  );
}
const auditStyles = StyleSheet.create({
  dialog: { padding: spacing.lg, gap: spacing.sm, maxHeight: '100%' },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: { ...typography.dialogTitle, flex: 1 },
  subtitle: { color: colors.muted, fontSize: fontSize.small },
  scroll: { flex: 1, minHeight: 0 },
  list: { gap: spacing.md, paddingVertical: spacing.sm },
  entry: {
    padding: spacing.md,
    gap: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  eventHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eventIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.skySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventInitial: { color: colors.earth, fontSize: 13, fontWeight: '700' },
  actor: {
    flex: 1,
    color: colors.ink,
    fontSize: fontSize.small,
    fontWeight: '700',
  },
  time: {
    color: colors.muted,
    fontSize: fontSize.caption,
    fontVariant: ['tabular-nums'],
  },
  change: { gap: spacing.sm },
  changeHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  kindChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  kindText: { fontSize: 11, fontWeight: '700' },
  changeTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  scoreTable: {
    borderRadius: 12,
    backgroundColor: colors.skySoft,
    paddingHorizontal: spacing.md,
  },
  deletedTable: { opacity: 0.75 },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
  },
  scoreRowLine: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  playerName: { flex: 1, color: colors.ink, fontSize: fontSize.small },
  oldScore: {
    color: colors.muted,
    fontSize: fontSize.small,
    textDecorationLine: 'line-through',
    fontVariant: ['tabular-nums'],
  },
  score: {
    minWidth: 36,
    textAlign: 'right',
    fontSize: fontSize.small,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  deletedScore: { textDecorationLine: 'line-through' },
  detail: { color: colors.muted, fontSize: fontSize.label, lineHeight: 18 },
  empty: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyTitle: { color: colors.ink, fontSize: fontSize.body, fontWeight: '600' },
  emptyText: {
    color: colors.muted,
    fontSize: fontSize.small,
    textAlign: 'center',
  },
  error: { color: colors.danger, fontSize: fontSize.small },
});
