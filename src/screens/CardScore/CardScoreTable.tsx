import Feather from '@expo/vector-icons/Feather';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { colors, layout } from '../../theme';
import { actionIconStyles } from '../../theme/actionIcons';
import type { CardScoreMatch, CardScoreRound } from '../../types/cardScore';
import { calculateRoundTotal } from '../../utils/cardScore';

type Props = {
  match: CardScoreMatch;
  totals: Record<string, number>;
  busy: boolean;
  onEditRound: (round: CardScoreRound, index: number) => void;
  onDeleteRound: (round: CardScoreRound, index: number) => void;
};

const ROUND_COLUMN_WIDTH = 44;
const ROUND_ACTION_COLUMN_WIDTH = 44;
const MIN_PLAYER_COLUMN_WIDTH = 54;

const scoreLabel = (score: number) => (score > 0 ? `+${score}` : `${score}`);

export function CardScoreTable({
  match,
  totals,
  busy,
  onEditRound,
  onDeleteRound,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const orderedPlayers = match.seatOrder
    .map((playerId) => match.players.find((player) => player.id === playerId))
    .filter((player) => player !== undefined);
  const cardContentWidth =
    Math.min(windowWidth, layout.contentMaxWidth) - layout.screenGutter * 2 - 2;
  const preferredPlayerWidth =
    (cardContentWidth - ROUND_COLUMN_WIDTH - ROUND_ACTION_COLUMN_WIDTH) /
    orderedPlayers.length;
  const playerColumnWidth = Math.max(
    MIN_PLAYER_COLUMN_WIDTH,
    preferredPlayerWidth,
  );
  const tableWidth =
    ROUND_COLUMN_WIDTH +
    playerColumnWidth * orderedPlayers.length +
    ROUND_ACTION_COLUMN_WIDTH;

  return (
    <View style={styles.card}>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View testID="card-score-table-grid" style={{ width: tableWidth }}>
          <View style={[styles.row, styles.headerRow]}>
            <View style={[styles.roundColumn, { width: ROUND_COLUMN_WIDTH }]}>
              <Text style={styles.headerText}>Ván</Text>
            </View>
            {orderedPlayers.map((player) => (
              <View
                key={player.id}
                testID={`card-score-player-column-${player.id}`}
                style={[styles.playerColumn, { width: playerColumnWidth }]}
              >
                <View
                  testID={`card-score-player-header-content-${player.id}`}
                  style={styles.playerHeaderContent}
                >
                  <Text
                    numberOfLines={1}
                    accessibilityLabel={
                      player.id === match.dealerPlayerId
                        ? `${player.name}, người chia bài`
                        : player.name
                    }
                    style={[
                      styles.headerPlayer,
                      player.id === match.dealerPlayerId &&
                        styles.dealerHeaderPlayer,
                    ]}
                  >
                    {player.name}
                  </Text>
                </View>
              </View>
            ))}
            <View
              style={[
                styles.roundActionColumn,
                styles.roundActionHeader,
                { width: ROUND_ACTION_COLUMN_WIDTH },
              ]}
            />
          </View>

          {match.rounds.map((round, index) => {
            const roundTotal = calculateRoundTotal(match.players, round);
            const invalidRound = roundTotal !== 0;
            return (
              <View
                key={round.id}
                testID={`card-score-round-${index + 1}`}
                style={[
                  styles.row,
                  invalidRound
                    ? styles.invalidRound
                    : index % 2 === 0 && styles.alternateRow,
                ]}
              >
                <View
                  style={[styles.roundColumn, { width: ROUND_COLUMN_WIDTH }]}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Sửa điểm ván ${index + 1}`}
                    accessibilityState={{ disabled: busy }}
                    disabled={busy}
                    onPress={() => onEditRound(round, index)}
                    style={[
                      styles.roundNumberButton,
                      busy && styles.disabledAction,
                    ]}
                  >
                    <Text style={styles.roundNumber}>{index + 1}</Text>
                  </Pressable>
                </View>
                {orderedPlayers.map((player) => {
                  const score = round.scores[player.id] ?? 0;
                  return (
                    <Pressable
                      key={player.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Sửa điểm ván ${index + 1} của ${player.name}: ${scoreLabel(score)}`}
                      accessibilityState={{ disabled: busy }}
                      disabled={busy}
                      onPress={() => onEditRound(round, index)}
                      style={[
                        styles.playerCell,
                        { width: playerColumnWidth },
                        busy && styles.disabledAction,
                      ]}
                    >
                      <Text
                        style={[
                          styles.score,
                          score < 0 && styles.negative,
                          score > 0 && styles.positive,
                        ]}
                      >
                        {scoreLabel(score)}
                      </Text>
                    </Pressable>
                  );
                })}
                <View
                  style={[
                    styles.roundActionColumn,
                    { width: ROUND_ACTION_COLUMN_WIDTH },
                  ]}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Xóa điểm ván ${index + 1}`}
                    accessibilityState={{ disabled: busy }}
                    disabled={busy}
                    onPress={() => onDeleteRound(round, index)}
                    style={[
                      styles.deleteRoundButton,
                      busy && styles.disabledAction,
                    ]}
                  >
                    <Feather name="x" size={14} color={colors.danger} />
                  </Pressable>
                </View>
              </View>
            );
          })}

          <View style={[styles.row, styles.totalRow]}>
            <View style={[styles.roundColumn, { width: ROUND_COLUMN_WIDTH }]}>
              <Text style={styles.totalLabel}>Tổng</Text>
            </View>
            {orderedPlayers.map((player) => {
              const total = totals[player.id] ?? 0;
              return (
                <View
                  key={player.id}
                  style={[
                    styles.playerCell,
                    styles.totalCell,
                    { width: playerColumnWidth },
                  ]}
                >
                  <Text
                    style={[
                      styles.total,
                      total < 0 && styles.negative,
                      total > 0 && styles.positive,
                    ]}
                  >
                    {scoreLabel(total)}
                  </Text>
                </View>
              );
            })}
            <View
              style={[
                styles.roundActionColumn,
                { width: ROUND_ACTION_COLUMN_WIDTH },
              ]}
            />
          </View>
        </View>
      </ScrollView>
      <View style={styles.hint}>
        <Text style={styles.hintText}>
          Tên người chia bài được tô màu · chạm điểm để sửa
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  disabledAction: { opacity: 0.45 },
  row: {
    minHeight: 43,
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  headerRow: { minHeight: 52, backgroundColor: colors.skySoft },
  alternateRow: { backgroundColor: colors.background },
  invalidRound: { backgroundColor: colors.dangerSoft },
  roundColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.line,
  },
  roundActionColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.line,
  },
  roundActionHeader: { backgroundColor: colors.skySoft },
  playerColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.line,
  },
  playerHeaderContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  headerPlayer: {
    width: '100%',
    color: colors.ink,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  dealerHeaderPlayer: { color: colors.earth },
  roundNumberButton: {
    minWidth: 27,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.skySoft,
  },
  roundNumber: { color: colors.sky, fontSize: 11, fontWeight: '700' },
  deleteRoundButton: {
    ...actionIconStyles.deleteCompact,
  },
  playerCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.line,
  },
  score: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  negative: { color: colors.danger },
  positive: { color: colors.success },
  totalRow: {
    minHeight: 48,
    borderBottomWidth: 0,
    backgroundColor: colors.sunlightFaint,
  },
  totalLabel: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  totalCell: { borderRightWidth: 0 },
  total: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  hint: { paddingHorizontal: 10, paddingVertical: 8, gap: 3 },
  hintText: { color: colors.muted, fontSize: 10, lineHeight: 14 },
});
