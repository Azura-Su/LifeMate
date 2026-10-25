import Feather from '@expo/vector-icons/Feather';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { colors } from '../../theme';
import type { CardGameRoom, GameIntent, TanView } from '../../types/cardGame';
import { PlayingCard, cardLabel } from './PlayingCard';
import { CardGameAvatarImage } from './CardGameAvatarImage';
import { getSecondsRemaining } from './cardTableMotion';
import { tanStyles as styles } from './TanGameTable.styles';

const rank = (card: number) => Math.floor(card / 4);
const suit = (card: number) => card % 4;
const tanRank = (card: number) => (rank(card) + 1) % 13;
function canDefend(card: number, attackCard: number, trumpSuit: number) {
  if (suit(card) === suit(attackCard)) return tanRank(card) > tanRank(attackCard);
  return suit(card) === trumpSuit && suit(attackCard) !== trumpSuit;
}

export function TanGameTable({
  room,
  uid,
  serverTime,
  active,
  disabled,
  busy,
  onAction,
  onPlayerPress,
}: {
  room: CardGameRoom;
  uid: string;
  serverTime: number;
  active: boolean;
  disabled: boolean;
  busy: boolean;
  onAction: (action: GameIntent) => void;
  onPlayerPress?: (uid: string) => void;
}) {
  const game = room.game as TanView;
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const [selected, setSelected] = useState<number | null>(null);
  const [selectedAttack, setSelectedAttack] = useState(0);
  const [now, setNow] = useState(Date.now());
  const handKey = game.hand.join(',');
  const serverClock = useMemo(
    () => ({ time: serverTime, receivedAt: Date.now() }),
    [serverTime],
  );
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  useEffect(() => {
    setSelected(null);
    setSelectedAttack(0);
  }, [room.id, room.matchId, room.version, handKey]);

  const seconds = getSecondsRemaining(
    game.deadline,
    serverClock.time,
    serverClock.receivedAt,
    now,
  );
  const mine = game.turn === uid;
  const canAct =
    active &&
    !disabled &&
    !busy &&
    game.status === 'playing' &&
    mine &&
    seconds > 0;
  const targetIndex = useMemo(() => {
    if (
      selectedAttack >= 0 &&
      selectedAttack < game.table.length &&
      game.table[selectedAttack].defenseCard === null
    )
      return selectedAttack;
    return game.table.findIndex((entry) => entry.defenseCard === null);
  }, [game.table, selectedAttack]);
  const target = targetIndex >= 0 ? game.table[targetIndex] : null;
  const attackRanks = new Set(
    game.table.flatMap((entry) => [
      tanRank(entry.attackCard),
      ...(entry.defenseCard === null ? [] : [tanRank(entry.defenseCard)]),
    ]),
  );
  const mayAttack =
    game.step === 'attack' &&
    selected !== null &&
    game.table.length < game.maxAttackCards &&
    (!game.table.length || attackRanks.has(tanRank(selected)));
  const mayDefend =
    game.step === 'defend' &&
    target !== null &&
    selected !== null &&
    canDefend(selected, target.attackCard, game.trumpSuit);
  const members = room.members;
  const readyCount = members.filter((member) => member.ready).length;
  const memberInfo = (playerUid: string) =>
    members.find((member) => member.uid === playerUid);
  const ownMember = memberInfo(uid);
  const nameOf = (playerUid: string | null) =>
    playerUid ? memberInfo(playerUid)?.name ?? 'Người chơi' : '—';
  const pointsPerCard = room.variantConfig?.pointsPerCard ?? 1;
  const resultRanking = game.result?.ranking ?? [];
  const naturalFinishers = resultRanking.filter(
    (result) => !result.labels.includes('forfeit'),
  );
  const lastFinisher = naturalFinishers.at(-1);
  const lastCards = lastFinisher?.remainingCards ?? 0;
  const naturalFinisherCount = naturalFinishers.length;
  const tanScoreExplanation =
    game.result?.reason === 'all-out'
      ? 'Tất cả đã hết bài: 0 điểm.'
      : !lastFinisher || naturalFinisherCount < 2
        ? 'Không đủ người kết thúc tự nhiên để chia điểm: 0 điểm.'
        : `Người thua còn ${lastCards} lá: −${(lastCards * (naturalFinisherCount - 1) * pointsPerCard).toLocaleString('vi-VN')} điểm (${lastCards} × (${naturalFinisherCount}−1) × ${pointsPerCard}); mỗi người về trước +${(lastCards * pointsPerCard).toLocaleString('vi-VN')} điểm. Người bỏ cuộc không chia điểm; bài nhặt chỉ tính nếu còn trên tay lúc kết thúc.`;

  const players = (
    <View style={[styles.players, landscape && styles.playersLandscape]}>
      {game.players
        .filter((player) => player.uid !== uid)
        .map((player) => {
          const member = memberInfo(player.uid);
          const activeTurn = game.turn === player.uid;
          return (
            <Pressable
              key={player.uid}
              accessibilityRole="button"
              accessibilityLabel={`Người chơi ${member?.name ?? 'Người chơi'}, còn ${player.count} lá`}
              onPress={() => onPlayerPress?.(player.uid)}
              style={[styles.player, activeTurn && styles.playerActive]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(member?.name ?? '?').slice(0, 1).toUpperCase()}
                </Text>
                <CardGameAvatarImage
                  uid={player.uid}
                  url={member?.avatarUrl}
                  name={member?.name ?? 'Người chơi'}
                  size={34}
                />
              </View>
              <View style={styles.playerCopy}>
                <Text numberOfLines={1} style={styles.playerName}>
                  {member?.name ?? 'Người chơi'}
                </Text>
                <Text style={styles.playerMeta}>
                  {player.finished
                    ? 'Đã hết bài'
                    : player.forfeited
                      ? 'Bỏ cuộc'
                      : `${player.count} lá`}
                </Text>
              </View>
              {activeTurn && <View style={styles.turnDot} />}
            </Pressable>
          );
        })}
    </View>
  );

  const center = (
    <View style={[styles.board, landscape && styles.boardLandscape]}>
      <View style={styles.trumpBadge}>
        <Feather name="star" size={14} color={colors.sunlight} />
        <Text style={styles.trumpText}>
          Chủ {['♠', '♣', '♦', '♥'][game.trumpSuit]} · Nọc {game.stockCount}
        </Text>
        {game.trumpCard !== null && (
          <Text style={styles.trumpText}>Lá chủ cuối: {cardLabel(game.trumpCard)}</Text>
        )}
      </View>
      <Text style={styles.status}>
        {game.status !== 'playing'
          ? 'Ván đã kết thúc'
          : game.step === 'attack'
            ? `Lượt tấn · ${nameOf(game.attackerUid)}`
            : `Lượt đỡ · ${nameOf(game.defenderUid)}`}
      </Text>
      {game.status === 'playing' && (
        <Text style={styles.timer}>
          {mine ? `Lượt của bạn · ${seconds}s` : `Lượt ${nameOf(game.turn)} · ${seconds}s`}
        </Text>
      )}
      <View style={styles.table}>
        {game.table.length === 0 ? (
          <View style={styles.emptyTable}>
            <Text style={styles.emptyTableText}>Chưa có lá trên bàn</Text>
          </View>
        ) : (
          game.table.map((entry, index) => {
            const focused = game.step === 'defend' && targetIndex === index;
            return (
              <Pressable
                key={`${index}:${entry.attackCard}`}
                accessibilityRole="button"
                accessibilityLabel={`Lá tấn ${index + 1}: ${cardLabel(entry.attackCard)}${entry.defenseCard === null ? ', chưa đỡ' : `, đỡ bằng ${cardLabel(entry.defenseCard)}`}`}
                accessibilityState={{ selected: focused }}
                disabled={game.step !== 'defend' || entry.defenseCard !== null}
                onPress={() => setSelectedAttack(index)}
                style={[styles.trick, focused && styles.trickFocused]}
              >
                <View style={styles.trickCard}>
                  <Text style={styles.trickName}>{nameOf(entry.attackerUid)}</Text>
                  <PlayingCard card={entry.attackCard} />
                </View>
                <Text style={styles.trickArrow}>→</Text>
                <View style={styles.trickCard}>
                  <Text style={styles.trickName}>
                    {entry.defenseCard === null ? 'Chưa đỡ' : nameOf(game.defenderUid)}
                  </Text>
                  {entry.defenseCard === null ? (
                    <View style={styles.uncovered}>
                      <Feather name="minus" size={18} color={colors.muted} />
                    </View>
                  ) : (
                    <PlayingCard card={entry.defenseCard} />
                  )}
                </View>
              </Pressable>
            );
          })
        )}
      </View>
      {game.table.length > 0 && game.step === 'attack' && (
        <Text style={styles.hint}>
          Tấn thêm lá cùng hạng với một lá trên bàn
        </Text>
      )}
      {game.step === 'defend' && target && (
        <Text style={styles.hint}>Chọn lá tấn cần đỡ, rồi chọn bài trên tay</Text>
      )}
      {game.status !== 'playing' && !!game.result?.ranking.length && (
        <View testID="tan-results" style={styles.results}>
          <Text style={styles.resultTitle}>Điểm ván</Text>
          <Text testID="tan-score-explanation" style={styles.resultExplanation}>
            {tanScoreExplanation}
          </Text>
          {game.result.ranking.map((result) => {
            const member = memberInfo(result.uid);
            const player = game.players.find((item) => item.uid === result.uid);
            const name =
              result.name ?? player?.name ?? member?.name ?? nameOf(result.uid);
            const balance = player?.balance ?? member?.balance;
            const delta = result.moneyDelta ?? 0;
            const signedDelta = `${delta > 0 ? '+' : ''}${delta.toLocaleString('vi-VN')}`;
            return (
              <View
                key={result.uid}
                style={styles.resultRow}
                accessibilityLabel={`${name}, ${signedDelta} điểm${balance === undefined ? '' : `, tổng ${balance.toLocaleString('vi-VN')} điểm`}`}
              >
                <Text style={styles.resultRank}>#{result.rank}</Text>
                <View style={styles.resultCopy}>
                  <Text numberOfLines={1} style={styles.resultName}>
                    {name}
                  </Text>
                  {balance !== undefined && (
                    <Text
                      testID={`tan-result-balance-${result.uid}`}
                      style={styles.resultBalance}
                    >
                      Tổng {balance.toLocaleString('vi-VN')} điểm
                    </Text>
                  )}
                </View>
                <Text
                  testID={`tan-result-delta-${result.uid}`}
                  style={[
                    styles.resultDelta,
                    delta > 0 && styles.resultPositive,
                    delta < 0 && styles.resultNegative,
                  ]}
                >
                  {signedDelta} điểm
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );

  const ownHand = (
    <View
      style={[
        styles.handPanel,
        landscape && styles.handPanelLandscape,
        landscape && { width: Math.min(310, Math.max(220, width * 0.32)) },
      ]}
    >
      <View style={styles.handHeading}>
        <Text style={styles.handTitle}>Bài của bạn · {game.hand.length}</Text>
        {game.status === 'playing' && (
          <Text style={styles.handMeta}>{mine ? 'Đến lượt bạn' : `Chờ ${nameOf(game.turn)}`}</Text>
        )}
      </View>
      <ScrollView
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.handCards}
      >
        {game.hand
          .slice()
          .sort((a, b) => a - b)
          .map((card) => (
            <PlayingCard
              key={card}
              card={card}
              selected={selected === card}
              disabled={!canAct || game.step === 'finished'}
              onPress={() =>
                setSelected((current) => (current === card ? null : card))
              }
            />
          ))}
      </ScrollView>
      <View style={styles.actions}>
        {game.status === 'finished' || game.status === 'cancelled' ? (
          <>
            <Text style={styles.finishedText}>
              {readyCount}/{members.length} sẵn sàng
            </Text>
            <Button
              compact
              variant={ownMember?.ready ? 'secondary' : 'primary'}
              title={ownMember?.ready ? 'Bỏ sẵn sàng' : 'Sẵn sàng'}
              loading={busy}
              disabled={disabled || !active}
              onPress={() =>
                onAction({ type: 'ready', ready: !ownMember?.ready })
              }
            />
          </>
        ) : game.step === 'attack' ? (
          <>
            <Button
              compact
              variant="secondary"
              title="Bỏ lượt"
              disabled={!canAct || game.table.length === 0}
              onPress={() =>
                onAction({
                  type: 'game-action',
                  gameAction: { type: 'pass-attack' },
                })
              }
            />
            <Button
              compact
              title="Tấn 1 lá"
              loading={busy}
              disabled={!canAct || !mayAttack}
              onPress={() => {
                if (selected !== null)
                  onAction({
                    type: 'game-action',
                    gameAction: { type: 'attack', card: selected },
                  });
              }}
            />
          </>
        ) : game.step === 'defend' ? (
          <>
            <Button
              compact
              variant="secondary"
              title="Nhận bài"
              disabled={!canAct}
              onPress={() =>
                onAction({ type: 'game-action', gameAction: { type: 'take' } })
              }
            />
            <Button
              compact
              title={target ? `Đỡ lá ${targetIndex + 1}` : 'Đỡ bài'}
              loading={busy}
              disabled={!canAct || !mayDefend || !target}
              onPress={() => {
                if (selected !== null && targetIndex >= 0)
                  onAction({
                    type: 'game-action',
                    gameAction: {
                      type: 'defend',
                      index: targetIndex,
                      card: selected,
                    },
                  });
              }}
            />
          </>
        ) : (
          <Text style={styles.finishedText}>Ván đã kết thúc</Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.root, landscape && styles.rootLandscape]}>
      {!landscape && players}
      {center}
      {landscape && players}
      {ownHand}
    </View>
  );
}
