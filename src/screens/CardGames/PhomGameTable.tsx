import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { DialogModal } from '../../components/DialogModal';
import { ModalHeader } from '../../components/ModalHeader';
import type { CardGameRoom, GameIntent } from '../../types/cardGame';
import type { PhomAction, PhomView } from '../../types/phom';
import { canSendPhomCard, phomRank } from '../../services/cardGames/phomCards';
import { phomOptions } from '../../services/cardGames/phomConfig';
import { getHandStackLayout, getSecondsRemaining } from './cardTableMotion';
import { PlayingCard } from './PlayingCard';
import {
  PhomMiniCards,
  PhomResults,
  PhomSeat,
  phomMoney,
} from './PhomTableParts';
import { phomStyles as s } from './PhomTable.styles';
import { styles } from './CardGamesScreen.styles';

export function PhomGameTable({
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
  const game = room.game as PhomView;
  const { width, height } = useWindowDimensions(),
    landscape = width > height;
  const [selected, setSelected] = useState<number[]>([]),
    [groups, setGroups] = useState<number[][]>([]);
  const [sendOpen, setSendOpen] = useState(false),
    [sortSuit, setSortSuit] = useState(false);
  const [publicOpen, setPublicOpen] = useState(false);
  const [availableHeight, setAvailableHeight] = useState(0);
  const [handWidth, setHandWidth] = useState(0),
    [now, setNow] = useState(Date.now());
  const receipt = useRef({ key: '', at: Date.now() });
  const clockKey = `${room.id}:${room.matchId}:${game.turn}:${game.deadline}:${serverTime}`;
  if (receipt.current.key !== clockKey)
    receipt.current = { key: clockKey, at: Date.now() };
  const handKey = game.hand.join(',');
  useEffect(() => {
    setSelected([]);
    setGroups([]);
    setSendOpen(false);
  }, [room.id, room.matchId, handKey, game.step, game.turn]);
  useEffect(() => {
    if (!active) {
      setSendOpen(false);
      setPublicOpen(false);
    }
    if (!active || game.status !== 'playing') return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [active, game.status]);
  const seconds = getSecondsRemaining(
    game.deadline,
    serverTime,
    receipt.current.at,
    Math.max(now, receipt.current.at),
  );
  const playing = game.status === 'playing',
    own = game.players.find((p) => p.uid === uid)!;
  const seats = playing
    ? game.players.map((participant) => ({ uid: participant.uid, participant }))
    : room.members.map((member) => ({ uid: member.uid, member }));
  const member = room.members.find((p) => p.uid === uid),
    myTurn = playing && game.turn === uid;
  const canAct =
    myTurn && seconds > 0 && active && room.controller && !disabled && !busy;
  const hand = [...game.hand].sort((a, b) =>
    sortSuit
      ? (a % 4) - (b % 4) || phomRank(a) - phomRank(b)
      : phomRank(a) - phomRank(b) || (a % 4) - (b % 4),
  );
  const stack = getHandStackLayout(handWidth || width - 64, hand.length);
  const destinations =
    selected.length === 1
      ? game.players
          .filter((p) => p.uid !== uid && p.laid && !p.forfeited)
          .flatMap((p) =>
            p.melds.flatMap((meld, index) =>
              canSendPhomCard(meld, selected[0])
                ? [{ player: p, index, meld }]
                : [],
            ),
          )
      : [];
  const ownPublic =
    playing && (own.discards.length > 0 || own.melds.length > 0) ? (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.publicRow}
        testID="phom-own-public-cards"
      >
        {own.discards.length > 0 && (
          <>
            <Text style={s.caption}>Đã đánh</Text>
            <PhomMiniCards cards={own.discards} />
          </>
        )}
        {own.melds.map((g, i) => (
          <View style={s.meld} key={i}>
            <PhomMiniCards cards={g} />
          </View>
        ))}
      </ScrollView>
    ) : null;
  function submit(
    phomAction: PhomAction,
    extra: Partial<Extract<GameIntent, { type: 'play' }>> = {},
  ) {
    if (canAct)
      onAction({
        type: 'play',
        phomAction,
        cards: ['discard', 'send'].includes(phomAction) ? selected : [],
        ...extra,
      });
  }
  return (
    <View
      testID="phom-table"
      style={s.root}
      onLayout={(event) => setAvailableHeight(event.nativeEvent.layout.height)}
    >
      <View testID="phom-board" style={[s.board, landscape && s.compactBoard]}>
        <ScrollView
          style={s.scroll}
          contentContainerStyle={[
            s.boardContent,
            landscape && s.compactBoardContent,
          ]}
          nestedScrollEnabled
        >
          <View style={[s.seatRow, landscape && s.compactSeatRow]}>
            {seats
              .filter((seat) => seat.uid !== uid)
              .map((seat) => (
                <PhomSeat
                  key={seat.uid}
                  room={room}
                  seat={seat}
                  seconds={seconds}
                  landscape={landscape}
                  onPlayerPress={onPlayerPress}
                />
              ))}
          </View>
          {playing ? (
            <View style={[s.center, landscape && s.compactCenter]}>
              <View style={s.livePill}>
                <View style={s.liveDot} />
                <Text accessibilityLiveRegion="polite" style={s.live}>
                  {myTurn
                    ? 'Bạn đang đánh'
                    : `${game.players.find((p) => p.uid === game.turn)?.name ?? room.members.find((p) => p.uid === game.turn)?.name ?? 'Người chơi'} đang đánh`}
                </Text>
              </View>
              <View style={s.pileRow}>
                <View style={s.pile}>
                  <View style={[s.stock, landscape && s.compactStock]}>
                    <View style={s.stockInner}>
                      <Text style={s.stockMark}>◆</Text>
                    </View>
                  </View>
                  <Text style={s.caption}>Nọc {game.stockCount}</Text>
                </View>
                {game.lastDiscard && (
                  <View style={s.pile}>
                    <PlayingCard
                      card={game.lastDiscard.card}
                      stacked
                      compact={landscape}
                    />
                    <Text style={s.caption}>
                      {game.lastDiscard.chot ? 'Cây chốt' : 'Vừa đánh'}
                    </Text>
                  </View>
                )}
              </View>
              {!landscape && (
                <Text style={s.hint}>
                  {myTurn
                    ? game.step === 'draw'
                      ? 'Ăn lá vừa đánh hoặc bốc nọc'
                      : game.step === 'lay'
                        ? 'Hạ phỏm trước khi đánh lá cuối'
                        : 'Chọn một lá để đánh'
                    : 'Chờ đến lượt của bạn'}
                </Text>
              )}
            </View>
          ) : (
            <PhomResults game={game} />
          )}
        </ScrollView>
      </View>
      <View
        testID="phom-hand-panel"
        style={[
          s.handPanel,
          landscape && s.compactPanel,
          {
            maxHeight: Math.max(
              140,
              (availableHeight || height - 100) * (landscape ? 0.62 : 0.5),
            ),
          },
        ]}
      >
        <View style={s.handHeading}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Thông tin người chơi ${member?.name ?? 'Bạn'}`}
            onPress={() => onPlayerPress?.(uid)}
            disabled={!onPlayerPress}
            style={
              landscape
                ? { flexShrink: 1, maxWidth: 200 }
                : { flex: 1, minWidth: 0 }
            }
          >
            <Text numberOfLines={1} style={s.name}>
              {member?.name ?? 'Bạn'}{' '}
              <Text style={s.caption}>· {phomMoney(member?.balance ?? 0)}</Text>
            </Text>
          </Pressable>
          {landscape && playing && (
            <View style={{ flex: 1, minWidth: 0 }}>{ownPublic}</View>
          )}
          {myTurn && (
            <Text
              accessibilityLabel={`Còn ${seconds} giây`}
              style={[s.timer, seconds <= 5 && s.timerUrgent]}
            >
              {seconds}s
            </Text>
          )}
          {playing && (
            <View style={s.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Bài đã đánh và phỏm trên bàn"
                onPress={() => setPublicOpen(true)}
                style={s.chip}
                hitSlop={6}
              >
                <Text style={s.chipText}>Bài bàn</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={sortSuit ? 'Xếp số' : 'Xếp chất'}
                onPress={() => setSortSuit((v) => !v)}
                style={s.chip}
                hitSlop={6}
              >
                <Text style={s.chipText}>
                  {sortSuit ? 'Xếp số' : 'Xếp chất'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
        {playing ? (
          <>
            <View style={landscape ? s.playRow : s.handBody}>
              <ScrollView
                style={landscape ? s.handArea : s.handBody}
                nestedScrollEnabled
              >
                {!landscape && ownPublic}
                <ScrollView
                  horizontal
                  style={s.handScroll}
                  onLayout={(event) =>
                    setHandWidth(event.nativeEvent.layout.width)
                  }
                  contentContainerStyle={s.hand}
                >
                  {hand.map((card, index) => (
                    <PlayingCard
                      key={card}
                      card={card}
                      stacked
                      compact={landscape || stack.compact}
                      stackIndex={index}
                      stackOverlap={stack.overlap}
                      stackLast={index === hand.length - 1}
                      selected={selected.includes(card)}
                      disabled={!canAct || groups.flat().includes(card)}
                      onPress={() =>
                        setSelected((current) =>
                          current.includes(card)
                            ? current.filter((c) => c !== card)
                            : [...current, card],
                        )
                      }
                    />
                  ))}
                </ScrollView>
                {groups.length > 0 && (
                  <ScrollView horizontal contentContainerStyle={s.row}>
                    {groups.map((g, i) => (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Bỏ phỏm đang xếp ${i + 1}`}
                        key={i}
                        onPress={() =>
                          setGroups((current) =>
                            current.filter((_, j) => j !== i),
                          )
                        }
                        style={s.meld}
                      >
                        <PhomMiniCards cards={g} />
                        <Text>×</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </ScrollView>
              {myTurn && (
                <View style={[s.actions, landscape && s.compactActions]}>
                  {game.step === 'draw' ? (
                    <>
                      <View style={[s.action, landscape && s.compactAction]}>
                        <Button
                          compact
                          title="Ăn bài"
                          disabled={!canAct || !game.canEat}
                          onPress={() => submit('eat')}
                        />
                      </View>
                      <View style={[s.action, landscape && s.compactAction]}>
                        <Button
                          compact
                          title="Bốc bài"
                          disabled={!canAct}
                          onPress={() => submit('draw')}
                        />
                      </View>
                    </>
                  ) : game.step === 'lay' ? (
                    <>
                      <View style={[s.action, landscape && s.compactAction]}>
                        <Button
                          compact
                          title={groups.length ? 'Hạ phỏm đã xếp' : 'Hạ phỏm'}
                          disabled={!canAct}
                          onPress={() =>
                            submit(
                              'lay',
                              groups.length ? { melds: groups } : {},
                            )
                          }
                        />
                      </View>
                      <View style={[s.action, landscape && s.compactAction]}>
                        <Button
                          compact
                          variant="secondary"
                          title="Xếp phỏm đã chọn"
                          disabled={
                            !canAct || selected.length < 3 || groups.length >= 3
                          }
                          onPress={() => {
                            setGroups((current) => [...current, selected]);
                            setSelected([]);
                          }}
                        />
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={[s.action, landscape && s.compactAction]}>
                        <Button
                          compact
                          title="Đánh 1 lá"
                          disabled={
                            !canAct ||
                            selected.length !== 1 ||
                            own.eaten.includes(selected[0])
                          }
                          onPress={() => submit('discard')}
                        />
                      </View>
                      {phomOptions(room.phomConfig).send &&
                        own.laid &&
                        own.melds.length > 0 && (
                          <View
                            style={[s.action, landscape && s.compactAction]}
                          >
                            <Button
                              compact
                              variant="secondary"
                              title="Gửi bài"
                              disabled={!canAct || destinations.length === 0}
                              onPress={() => setSendOpen(true)}
                            />
                          </View>
                        )}
                    </>
                  )}
                  {game.canU && (
                    <View style={[s.action, landscape && s.compactAction]}>
                      <Button
                        compact
                        title="Ù"
                        disabled={!canAct}
                        onPress={() => submit('u')}
                      />
                    </View>
                  )}
                </View>
              )}
            </View>
          </>
        ) : (
          <>
            <Text style={s.hint}>
              {room.members.filter((p) => p.ready).length}/{room.members.length}{' '}
              sẵn sàng
            </Text>
            <Button
              compact
              title={member?.ready ? 'Bỏ sẵn sàng' : 'Sẵn sàng'}
              loading={busy}
              disabled={disabled || !active || !room.controller}
              onPress={() => onAction({ type: 'ready', ready: !member?.ready })}
            />
          </>
        )}
      </View>
      <DialogModal
        visible={publicOpen && active}
        onRequestClose={() => setPublicOpen(false)}
        supportedOrientations={[
          'portrait',
          'landscape-left',
          'landscape-right',
        ]}
        style={styles.ruleCard}
      >
        <ModalHeader
          title="Bài đã đánh và phỏm"
          accessibilityLabel="Đóng bài trên bàn"
          onClose={() => setPublicOpen(false)}
        />
        <ScrollView
          style={styles.ruleScroll}
          contentContainerStyle={s.scrollContent}
        >
          {game.players.map((p) => (
            <View style={s.result} key={p.uid}>
              <Text style={s.name}>
                {p.name ??
                  room.members.find((m) => m.uid === p.uid)?.name ??
                  'Người chơi'}
                {p.uid === uid ? ' (Bạn)' : ''}
              </Text>
              <Text style={s.caption}>Đã đánh</Text>
              <ScrollView horizontal>
                <PhomMiniCards cards={p.discards} />
              </ScrollView>
              <Text style={s.caption}>
                {p.laid ? (p.melds.length ? 'Phỏm đã hạ' : 'Móm') : 'Chưa hạ'}
              </Text>
              {p.melds.map((g, i) => (
                <ScrollView horizontal key={i}>
                  <PhomMiniCards cards={g} />
                </ScrollView>
              ))}
            </View>
          ))}
        </ScrollView>
      </DialogModal>
      <DialogModal
        visible={sendOpen && canAct}
        onRequestClose={() => setSendOpen(false)}
        supportedOrientations={[
          'portrait',
          'landscape-left',
          'landscape-right',
        ]}
        style={styles.ruleCard}
      >
        <ModalHeader
          title="Gửi bài"
          accessibilityLabel="Đóng chọn phỏm gửi"
          onClose={() => setSendOpen(false)}
        />
        <ScrollView
          style={styles.ruleScroll}
          contentContainerStyle={s.scrollContent}
        >
          {destinations.map(({ player, index, meld }) => (
            <Pressable
              key={`${player.uid}:${index}`}
              accessibilityRole="button"
              accessibilityLabel={`Gửi vào phỏm ${index + 1} của ${player.name ?? room.members.find((p) => p.uid === player.uid)?.name ?? 'Người chơi'}`}
              style={s.result}
              onPress={() => {
                submit('send', { targetUid: player.uid, meldIndex: index });
                setSendOpen(false);
              }}
            >
              <Text style={s.name}>
                {player.name ??
                  room.members.find((p) => p.uid === player.uid)?.name}{' '}
                · Phỏm {index + 1}
              </Text>
              <PhomMiniCards cards={meld} />
            </Pressable>
          ))}
        </ScrollView>
      </DialogModal>
    </View>
  );
}
