import type { ReactNode } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../../theme';
import type { CardScoreMatch } from '../../types/cardScore';
import { calculatePlayerTotals } from '../../utils/cardScore';
import { CardScoreTable } from './CardScoreTable';
import { styles } from './CardScoreScreen.styles';

export function CardScoreHistoryCard({
  match,
  date,
  expanded,
  busy,
  canManage,
  onToggle,
  onResume,
  onDelete,
  onAudit,
  children,
}: {
  match: CardScoreMatch;
  date: string;
  expanded: boolean;
  busy: boolean;
  canManage: boolean;
  onToggle: () => void;
  onResume: () => void;
  onDelete: () => void;
  onAudit: () => void;
  children?: ReactNode;
}) {
  if (match.deletedAt) return null;
  const totals = calculatePlayerTotals(match.players, match.rounds);
  const legacy = !!match.onlineRoomId && !match.sharedVersion;
  const openLabel = `Mở lại bàn ${match.title}`;
  return (
    <View testID={`card-score-history-${match.id}`} style={styles.historyCard}>
      <View style={styles.historyTopLine}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Xem lịch sử bàn ${match.title}`}
          accessibilityState={{ expanded }}
          onPress={onToggle}
          style={styles.historyTitleButton}
        >
          <Text numberOfLines={2} style={styles.historyTitle}>
            {match.title}
          </Text>
          <Text style={styles.historySubtitle}>
            {date} · {match.rounds.length} ván
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Xem bảng điểm bàn ${match.title}`}
          accessibilityState={{ expanded }}
          onPress={onToggle}
          style={styles.historyResume}
        >
          <Feather
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.earth}
          />
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Xem lịch sử bàn ${date}`}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={styles.historyMain}
      >
        <View
          testID={`card-score-history-scores-${match.id}`}
          style={styles.historyScores}
        >
          {match.players.map((player) => (
            <View key={player.id} style={styles.historyScoreChip}>
              <Text numberOfLines={1} style={styles.historyScoreName}>
                {player.name}
              </Text>
              <Text
                style={[
                  styles.historyScoreValue,
                  (totals[player.id] ?? 0) > 0 && styles.positive,
                  (totals[player.id] ?? 0) < 0 && styles.negative,
                ]}
              >
                {totals[player.id] > 0 ? '+' : ''}
                {totals[player.id] ?? 0}
              </Text>
            </View>
          ))}
        </View>
        {legacy && (
          <Text style={styles.historySubtitle}>Bản lưu trên thiết bị</Text>
        )}
      </Pressable>
      <View style={styles.historyActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Lịch sử sửa/xóa"
          onPress={onAudit}
          style={styles.historyTextAction}
        >
          <Feather name="clock" size={14} color={colors.muted} />
          <Text style={styles.historyActionText}>Lịch sử</Text>
        </Pressable>
        <View style={styles.historyActionSpacer} />
        {(canManage || (match.localFinished && match.status === 'active')) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={openLabel}
            disabled={busy}
            accessibilityState={{ disabled: busy }}
            onPress={onResume}
            style={[styles.historyTextAction, busy && styles.disabledAction]}
          >
            <Feather name="rotate-ccw" size={14} color={colors.earth} />
            <Text style={styles.historyActionText}>Mở lại bàn</Text>
          </Pressable>
        )}
        {canManage && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Xóa lịch sử bàn ${date}`}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={onDelete}
            style={[styles.historyDelete, busy && styles.disabledAction]}
          >
            <Feather name="trash-2" size={16} color={colors.danger} />
          </Pressable>
        )}
      </View>
      {expanded && (
        <View
          testID={`card-score-history-detail-${match.id}`}
          style={styles.historyRounds}
        >
          <CardScoreTable
            match={match}
            totals={totals}
            busy={busy}
            readOnly
            allowDelete={false}
            onEditRound={() => undefined}
            onDeleteRound={() => undefined}
            hint={
              match.localFinished
                ? 'Bạn đã kết thúc trên thiết bị này · chỉ xem'
                : legacy
                  ? 'Bản lưu trên thiết bị · chỉ xem'
                  : 'Bàn đã kết thúc'
            }
          />
          {!match.rounds.length && (
            <Text style={styles.historySubtitle}>
              Bàn chưa có ván được ghi điểm.
            </Text>
          )}
          {children}
        </View>
      )}
    </View>
  );
}
