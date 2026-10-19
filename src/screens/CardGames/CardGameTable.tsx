import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import type { CardGameRoom, GameIntent } from '../../types/cardGame';
import { PlayingCard, cardLabel } from './PlayingCard';
import { styles } from './CardGamesScreen.styles';

export function CardGameTable({
  room,
  uid,
  serverTime,
  active,
  disabled,
  busy,
  onAction,
}: {
  room: CardGameRoom;
  uid: string;
  serverTime: number;
  active: boolean;
  disabled: boolean;
  busy: boolean;
  onAction: (action: GameIntent) => void;
}) {
  const game = room.game!;
  const [selected, setSelected] = useState<number[]>([]);
  const [sortBySuit, setSortBySuit] = useState(false);
  const [now, setNow] = useState(Date.now());
  const handKey = game.hand.join(',');
  useEffect(() => {
    setSelected((old) =>
      old.filter((c) => handKey.split(',').includes(String(c))),
    );
  }, [handKey]);
  useEffect(() => {
    setSelected([]);
  }, [room.matchId]);
  const offset = useMemo(() => serverTime - Date.now(), [serverTime]);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  const seconds = Math.max(
    0,
    Math.ceil(((game.deadline ?? now) - now - offset) / 1000),
  );
  const mine = game.turn === uid;
  const hand = [...game.hand].sort((a, b) =>
    sortBySuit ? (a % 4) - (b % 4) || a - b : a - b,
  );
  const current =
    room.members.find((p) => p.uid === game.turn)?.name ?? 'Người chơi đã rời';
  const mySeat = game.players.find((p) => p.uid === uid);
  const canAct =
    !disabled && !mySeat?.finished && !mySeat?.forfeited && seconds > 0;
  return (
    <>
      <ScrollView
        testID="game-table-scroll"
        style={styles.grow}
        contentContainerStyle={styles.tableScrollable}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.opponents}>
          {game.players
            .filter((p) => p.uid !== uid)
            .map((p) => {
              const member = room.members.find((m) => m.uid === p.uid);
              return (
                <View
                  key={p.uid}
                  style={[
                    styles.opponent,
                    game.turn === p.uid && styles.currentOpponent,
                  ]}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {member?.name.slice(0, 1).toUpperCase() ?? '—'}
                    </Text>
                  </View>
                  <Text numberOfLines={2} style={styles.opponentName}>
                    {member?.name ?? 'Đã rời phòng'}
                  </Text>
                  <Text style={styles.subtitle}>
                    {p.forfeited
                      ? 'Bỏ cuộc'
                      : p.finished
                        ? 'Đã về'
                        : `${p.count} lá`}
                  </Text>
                  {game.passed.includes(p.uid) && (
                    <Text style={styles.subtitle}>Bỏ lượt</Text>
                  )}
                </View>
              );
            })}
        </View>
        <View style={styles.board}>
          <Text style={styles.centerText}>
            {game.table
              ? `${room.members.find((p) => p.uid === game.table?.uid)?.name ?? 'Người chơi'} vừa đánh`
              : 'Vòng mới'}
          </Text>
          {game.table ? (
            <View style={styles.tableCards}>
              {game.table.cards.map((c) => (
                <PlayingCard key={c} card={c} />
              ))}
            </View>
          ) : (
            <Text style={styles.centerText}>Chọn bài để mở vòng</Text>
          )}
          <Text accessibilityLiveRegion="polite" style={styles.turnText}>
            {seconds === 0
              ? 'Đang chuyển lượt…'
              : mine
                ? `Lượt của bạn · ${seconds}s`
                : `Lượt ${current} · ${seconds}s`}
          </Text>
          {mine && game.openingCard !== null && (
            <Text style={styles.centerText}>
              Bộ mở cần có {cardLabel(game.openingCard)}
            </Text>
          )}
        </View>
        <View style={styles.handSection}>
          <View style={styles.handHeading}>
            <Text style={styles.name}>Bài của bạn · {hand.length}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đổi cách sắp bài"
              onPress={() => setSortBySuit(!sortBySuit)}
              style={styles.sort}
            >
              <Text style={styles.sortText}>
                Xếp theo {sortBySuit ? 'số' : 'chất'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.hand}>
            {hand.map((card) => (
              <PlayingCard
                key={card}
                card={card}
                selected={selected.includes(card)}
                disabled={disabled || !active}
                onPress={() =>
                  setSelected((old) =>
                    old.includes(card)
                      ? old.filter((c) => c !== card)
                      : [...old, card],
                  )
                }
              />
            ))}
          </View>
          {!hand.length && (
            <Text style={styles.body}>
              Bạn đã hết bài. Đợi các bạn chơi xong ván nhé.
            </Text>
          )}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <View style={styles.grow}>
          <Button
            compact
            variant="secondary"
            title="Bỏ lượt"
            disabled={!canAct || !mine || !game.table}
            onPress={() => onAction({ type: 'pass' })}
          />
        </View>
        <View style={styles.grow}>
          <Button
            compact
            title={`Đánh ${selected.length} lá`}
            loading={busy}
            disabled={
              !canAct || !selected.length || (!mine && selected.length !== 8)
            }
            onPress={() =>
              onAction({
                type: 'play',
                cards: [...selected].sort((a, b) => a - b),
              })
            }
          />
        </View>
      </View>
    </>
  );
}
