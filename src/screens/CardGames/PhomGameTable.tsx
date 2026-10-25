import type React from 'react';
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
import {
  canSendPhomCard,
  getPhomEatHint,
  phomRank,
} from '../../services/cardGames/phomCards';
import { phomOptions } from '../../services/cardGames/phomConfig';
import {
  getHandStackLayout,
  getOpponentsInSeatOrder,
  getSecondsRemaining,
} from './cardTableMotion';
import { PlayingCard } from './PlayingCard';
import {
  PhomMiniCards,
  PhomPublicCards,
  PhomResults,
  PhomSeat,
  phomMoney,
} from './PhomTableParts';
import { phomStyles as s } from './PhomTable.styles';
import { PhomPlayerResultDialog } from './PhomPlayerResultDialog';
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
  const [resultPlayerUid, setResultPlayerUid] = useState<string | null>(null);
  const [availableHeight, setAvailableHeight] = useState(0);
  const [handWidth, setHandWidth] = useState(0),
    [now, setNow] = useState(Date.now());
  const receipt = useRef({ key: '', at: Date.now() });
  const clockKey = `${room.id}:${room.matchId}:${game.turn}:${game.deadline}:${serverTime}`;
  if (receipt.current.key !== clockKey)
    receipt.current = { key: clockKey, at: Date.now() };
  const handKey = game.hand.join(',');
  useEffect(() => {
    setResultPlayerUid(null);
  }, [room.id, room.matchId, active, game.status]);
  useEffect(() => {
    setSelected([]);
    setGroups([]);
    setSendOpen(false);
  }, [room.id, room.matchId, handKey, game.step, game.turn]);
  useEffect(() => {
    if (!active) setSendOpen(false);
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
  const canSuggestEat =
    canAct && game.step === 'draw' && game.canEat && !!game.lastDiscard;
  const eatHintCards = canSuggestEat
    ? getPhomEatHint(game.hand, own.eaten, game.lastDiscard!.card)
    : [];
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
  const act = (key: string, node: React.ReactNode) => (
    <View key={key} style={landscape ? undefined : s.action}>
      {node}
    </View>
  );
  const secondaryActions =
    game.step === 'draw'
      ? [
          act(
            'eat',
            <Button
              compact
              variant="secondary"
              title="Ăn bài"
              disabled={!canAct || !game.canEat}
              onPress={() => submit('eat')}
            />,
          ),
        ]
      : game.step === 'lay'
        ? [
            act(
              'group',
              <Button
                compact
                variant="secondary"
                title="Gom phỏm"
                disabled={!canAct || selected.length < 3 || groups.length >= 3}
                onPress={() => {
                  setGroups((current) => [...current, selected]);
                  setSelected([]);
                }}
              />,
            ),
          ]
        : phomOptions(room.phomConfig).send && own?.laid && own.melds.length > 0
          ? [
              act(
                'send',
                <Button
                  compact
                  variant="secondary"
                  title="Gửi bài"
                  disabled={!canAct || destinations.length === 0}
                  onPress={() => setSendOpen(true)}
                />,
              ),
            ]
          : [];
  const primaryActions = [
    game.step === 'draw'
      ? act(
          'draw',
          <Button
            compact
            title="Bốc bài"
            disabled={!canAct}
            onPress={() => submit('draw')}
          />,
        )
      : game.step === 'lay'
        ? act(
            'lay',
            <Button
              compact
              title={groups.length ? 'Hạ phỏm' : 'Hạ tự động'}
              disabled={!canAct}
              onPress={() =>
                submit('lay', groups.length ? { melds: groups } : {})
              }
            />,
          )
        : act(
            'discard',
            <Button
              compact
              title="Đánh 1 lá"
              disabled={
                !canAct ||
                selected.length !== 1 ||
                !!own?.eaten.includes(selected[0])
              }
              onPress={() => submit('discard')}
            />,
          ),
    ...(game.canU
      ? [
          act(
            'u',
            <Button
              compact
              title="Ù"
              disabled={!canAct}
              onPress={() => submit('u')}
            />,
          ),
        ]
      : []),
  ];
  const readyCount = (
    <Text style={s.hint}>
      {room.members.filter((p) => p.ready).length}/{room.members.length} sẵn
      sàng
    </Text>
  );
  const readyButton = (
    <Button
      compact
      title={member?.ready ? 'Bỏ sẵn sàng' : 'Sẵn sàng'}
      loading={busy}
      disabled={disabled || !active || !room.controller}
      onPress={() => onAction({ type: 'ready', ready: !member?.ready })}
    />
  );
  const ownPublic =
    playing && (own.discards.length > 0 || own.melds.length > 0) ? (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.publicRow}
        testID="phom-own-public-cards"
      >
        <Text style={s.caption}>
          {own.melds.length > 0 ? 'Phỏm' : 'Đã đánh'}
        </Text>
        <PhomPublicCards discards={own.discards} melds={own.melds} />
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
  const opponents = getOpponentsInSeatOrder<(typeof seats)[number]>(
    seats,
    uid,
  ).filter((seat) => seat.uid !== uid);
  const cross = opponents.length === 3 && playing;
  const seatView = (seat: (typeof seats)[number], inCross: boolean) => (
    <PhomSeat
      key={seat.uid}
      room={room}
      seat={seat}
      seconds={seconds}
      landscape={landscape || !playing}
      dense={inCross && !landscape}
      onPlayerPress={onPlayerPress}
    />
  );
  const centerView = (
    <View
      style={[
        s.center,
        landscape && !cross && s.compactCenter,
        cross && landscape && s.crossCenterInner,
      ]}
    >
      <View style={s.livePill}>
        <View style={s.liveDot} />
        <Text accessibilityLiveRegion="polite" style={s.live}>
          {myTurn
            ? 'Bạn đang đánh'
            : `${game.players.find((p) => p.uid === game.turn)?.name ?? room.members.find((p) => p.uid === game.turn)?.name ?? 'Người chơi'} đang đánh`}
        </Text>
      </View>
      <View style={s.pile}>
        <View style={s.pileStack}>
          <View style={[s.stock, landscape && s.compactStock]}>
            <View style={s.stockInner}>
              <Text style={s.stockMark}>◆</Text>
            </View>
          </View>
          {game.lastDiscard && (
            <View style={s.discardOnStock}>
              <PlayingCard
                card={game.lastDiscard.card}
                stacked
                compact={landscape}
                hinted={canSuggestEat}
              />
            </View>
          )}
        </View>
        <View style={s.meta}>
          <Text style={s.caption}>Nọc {game.stockCount}</Text>
          {game.lastDiscard && (
            <>
              <Text style={s.dot}>•</Text>
              <Text
                accessibilityLiveRegion="polite"
                style={canSuggestEat ? s.eatHint : s.caption}
              >
                {canSuggestEat
                  ? game.lastDiscard.chot
                    ? 'Ăn chốt được'
                    : 'Ăn được'
                  : game.lastDiscard.chot
                    ? 'Cây chốt'
                    : 'Vừa đánh'}
              </Text>
            </>
          )}
        </View>
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
  );
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
            cross && s.crossContent,
            !playing && !cross && s.finishedContent,
          ]}
          nestedScrollEnabled
        >
          {cross ? (
            <>
              <View style={s.crossTop}>{seatView(opponents[1], false)}</View>
              {landscape ? (
                <View style={s.crossMiddle}>
                  <View style={s.crossSide}>
                    {seatView(opponents[0], true)}
                  </View>
                  <View style={s.crossCenter}>
                    {playing ? (
                      centerView
                    ) : landscape ? (
                      <PhomResults
                        game={game}
                        onPlayerResultPress={
                          active ? setResultPlayerUid : undefined
                        }
                      />
                    ) : null}
                  </View>
                  <View style={s.crossSide}>
                    {seatView(opponents[2], true)}
                  </View>
                </View>
              ) : (
                <>
                  <View style={s.crossSidesRow}>
                    <View style={s.crossSidePortrait}>
                      {seatView(opponents[0], false)}
                    </View>
                    <View style={s.crossSidePortrait}>
                      {seatView(opponents[2], false)}
                    </View>
                  </View>
                  {playing && centerView}
                </>
              )}
              {!playing && !landscape && (
                <PhomResults
                  game={game}
                  onPlayerResultPress={active ? setResultPlayerUid : undefined}
                />
              )}
            </>
          ) : (
            <View
              style={
                !playing
                  ? landscape
                    ? s.finishedSplit
                    : s.finishedStack
                  : landscape
                    ? s.compactInner
                    : s.stack
              }
            >
              <View
                style={
                  playing
                    ? [s.seatRow, landscape && s.compactSeatRow]
                    : landscape
                      ? s.finishedSeatsCol
                      : s.finishedSeatsRow
                }
              >
                {opponents.map((seat) =>
                  !playing && landscape ? (
                    <View key={seat.uid} style={s.finishedSeatSlot}>
                      {seatView(seat, false)}
                    </View>
                  ) : (
                    seatView(seat, false)
                  ),
                )}
              </View>
              {playing ? (
                centerView
              ) : (
                <View style={landscape ? s.finishedResults : undefined}>
                  <PhomResults
                    game={game}
                    onPlayerResultPress={
                      active ? setResultPlayerUid : undefined
                    }
                  />
                </View>
              )}
            </View>
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
        {!(landscape && playing) && (
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
                <Text style={s.caption}>
                  · {phomMoney(member?.balance ?? 0)}
                </Text>
              </Text>
            </Pressable>
            {!playing && (
              <>
                <View style={{ flex: 1 }} />
                {readyCount}
                <View style={[s.readyButton, !landscape && { width: 132 }]}>
                  {readyButton}
                </View>
              </>
            )}
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
        )}
        {playing ? (
          <>
            <View style={landscape ? s.playRow : s.handBody}>
              {landscape && (
                <View style={s.sideActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Thông tin người chơi ${member?.name ?? 'Bạn'}`}
                    onPress={() => onPlayerPress?.(uid)}
                    disabled={!onPlayerPress}
                  >
                    <Text numberOfLines={1} style={s.name}>
                      {member?.name ?? 'Bạn'}
                    </Text>
                    <Text style={s.caption}>
                      {phomMoney(member?.balance ?? 0)}
                    </Text>
                  </Pressable>
                  {myTurn && secondaryActions}
                </View>
              )}
              <ScrollView
                style={landscape ? s.handArea : s.handBody}
                nestedScrollEnabled
              >
                {ownPublic}
                {myTurn && game.step === 'lay' && (
                  <Text style={s.groupHint}>
                    {groups.length
                      ? 'Bấm Hạ phỏm để hạ các bộ đã gom.'
                      : 'Chọn từ 3 lá để gom phỏm, hoặc bấm Hạ tự động.'}
                  </Text>
                )}
                <ScrollView
                  horizontal
                  style={s.handScroll}
                  onLayout={(event) =>
                    setHandWidth(event.nativeEvent.layout.width)
                  }
                  contentContainerStyle={[s.hand, landscape && s.compactHand]}
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
                      hinted={eatHintCards.includes(card)}
                      accessibilityHint={
                        eatHintCards.includes(card)
                          ? 'Có thể ghép phỏm với lá vừa đánh'
                          : undefined
                      }
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
                        accessibilityLabel={`Bỏ phỏm đã gom ${i + 1}`}
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
              {landscape ? (
                <View style={s.sideActions}>
                  <View style={s.sideTop}>
                    {myTurn && (
                      <Text
                        accessibilityLabel={`Còn ${seconds} giây`}
                        style={[s.timer, seconds <= 5 && s.timerUrgent]}
                      >
                        {seconds}s
                      </Text>
                    )}
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
                  {myTurn && primaryActions}
                </View>
              ) : (
                myTurn && (
                  <View style={s.actions}>
                    {secondaryActions}
                    {primaryActions}
                  </View>
                )
              )}
            </View>
          </>
        ) : null}
      </View>
      {resultPlayerUid && active && game.status === 'finished' && (
        <PhomPlayerResultDialog
          game={game}
          uid={resultPlayerUid}
          onClose={() => setResultPlayerUid(null)}
        />
      )}
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
