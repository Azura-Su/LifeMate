import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  Text,
  type StyleProp,
  type TextStyle,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { colors } from '../../theme';
import {
  canPlaySamSelection,
  canPlayTienLenNorthSelection,
  canPlayTienLenSelection,
} from '../../services/cardGames/tienLenRules';
import type {
  CardGameRoom,
  GameIntent,
  SamView,
  TienLenNorthView,
  TienLenView,
} from '../../types/cardGame';
import { PlayingCard, cardLabel } from './PlayingCard';
import { CardGameMoneyCounter } from './CardGameMoneyCounter';
import { CardGameWinnerEffects } from './CardGameWinnerEffects';
import { CardGameCollectingHand } from './CardGameCollectingHand';
import { CardGameAvatarImage } from './CardGameAvatarImage';
import { styles } from './CardGamesScreen.styles';
import { useCardRoundPresentation } from './useCardRoundPresentation';
import { useCardMotionAnchors } from './useCardMotionAnchors';
import {
  getConfirmedPasses,
  getHandStackLayout,
  getSecondsRemaining,
  claimCardPresentation,
  getOpponentsInSeatOrder,
} from './cardTableMotion';

const seenDealAnimations = new Set<string>();
const scorePartLabels: Record<string, string> = {
  'remaining-cards': 'Bài còn',
  'remaining-two': '2 còn',
  'cut-two': 'Chặt 2',
  'sam-report': 'Báo Sâm',
};
type ClimbingTableView = TienLenView & {
  step?: SamView['step'];
  reportOrder?: string[];
  reported?: string[];
  reportedSam?: boolean;
  callUid?: string | null;
  samOutcome?: SamView['samOutcome'];
  cutTwoFees?: TienLenView['cutTwoFees'];
};

type TablePlaySnapshot = {
  key: string;
  uid: string;
  cards: number[];
};

export function CardGameTable({
  room,
  uid,
  serverTime,
  active,
  disabled,
  busy,
  dealAnimationKey,
  resultAnimationKey,
  onAction,
  onPlayerPress,
}: {
  room: CardGameRoom;
  uid: string;
  serverTime: number;
  active: boolean;
  disabled: boolean;
  busy: boolean;
  dealAnimationKey?: string | null;
  resultAnimationKey?: string | null;
  onAction: (action: GameIntent) => void;
  onPlayerPress?: (uid: string) => void;
}) {
  const game = room.game as unknown as ClimbingTableView;
  const balanceUnit =
    room.gameKind === 'north' || room.gameKind === 'sam' ? 'điểm' : 'đ';
  const { width, height } = useWindowDimensions();
  // Native orientation can take a moment to settle after the match starts.
  // Keep the portrait layout until the viewport itself has rotated.
  const landscape = width > height;
  const { anchorRef, measureAnchors, originFor } = useCardMotionAnchors(
    `${width}:${height}`,
  );
  const [handLayout, setHandLayout] = useState({ viewport: 0, width: 0 });
  const [selected, setSelected] = useState<number[]>([]);
  const [seatHeights, setSeatHeights] = useState({ top: 60, side: 60 });
  const [sortBySuit, setSortBySuit] = useState(false);
  const [activeDealAnimationKey, setActiveDealAnimationKey] = useState<
    string | null
  >(null);
  const [now, setNow] = useState(Date.now());
  const handKey = game.hand.join(',');
  const tablePlayKey = game.table
    ? `${room.id}:${room.matchId ?? ''}:${game.table.uid}:${game.table.cards.join(',')}`
    : null;
  const dealMatchId = useRef(room.matchId);
  const hasPlayedTableThisMatch = useRef(false);
  if (dealMatchId.current !== room.matchId) {
    dealMatchId.current = room.matchId;
    hasPlayedTableThisMatch.current = false;
  }
  if (game.table) hasPlayedTableThisMatch.current = true;
  const previousTablePlayKey = useRef(tablePlayKey);
  const previousTablePlay = useRef<TablePlaySnapshot | null>(null);
  const [exitingTablePlay, setExitingTablePlay] =
    useState<TablePlaySnapshot | null>(null);
  const previousRoom = useRef<CardGameRoom | null>(room);
  const previousViewport = useRef(`${width}:${height}:${active}`);
  const [passAnimations, setPassAnimations] = useState<
    { key: string; uid: string }[]
  >([]);
  useEffect(() => {
    const viewport = `${width}:${height}:${active}`;
    if (
      !active ||
      previousViewport.current !== viewport ||
      previousRoom.current?.id !== room.id ||
      previousRoom.current?.matchId !== room.matchId ||
      room.game?.status !== 'playing'
    ) {
      setPassAnimations([]);
    } else {
      const passed = getConfirmedPasses(previousRoom.current, room);
      if (passed.length) {
        setPassAnimations((current) => [
          ...current,
          ...passed.map((playerUID) => ({
            key: `${room.id}:${room.matchId}:${room.version}:${playerUID}`,
            uid: playerUID,
          })),
        ]);
      }
    }
    previousRoom.current = room;
    previousViewport.current = viewport;
  }, [room, active, width, height]);
  const finishExitingTablePlay = useCallback((key: string) => {
    setExitingTablePlay((current) => (current?.key === key ? null : current));
  }, []);
  const finishPassAnimation = useCallback((key: string) => {
    setPassAnimations((current) =>
      current.filter((event) => event.key !== key),
    );
  }, []);
  const animateTablePlay =
    tablePlayKey !== null && previousTablePlayKey.current !== tablePlayKey;
  if (previousTablePlayKey.current !== tablePlayKey) {
    previousTablePlayKey.current = tablePlayKey;
  }
  const previousTableMatch = useRef(`${room.id}:${room.matchId}`);
  useEffect(() => {
    const match = `${room.id}:${room.matchId}`;
    if (previousTableMatch.current !== match) {
      previousTableMatch.current = match;
      setExitingTablePlay(null);
      previousTablePlay.current =
        game.table && tablePlayKey
          ? {
              key: tablePlayKey,
              uid: game.table.uid,
              cards: [...game.table.cards],
            }
          : null;
      return;
    }
    if (!tablePlayKey || !game.table) {
      if (previousTablePlay.current) {
        setExitingTablePlay(previousTablePlay.current);
        previousTablePlay.current = null;
      }
      return;
    }

    if (
      previousTablePlay.current &&
      previousTablePlay.current.key !== tablePlayKey
    ) {
      setExitingTablePlay(previousTablePlay.current);
    }
    previousTablePlay.current = {
      key: tablePlayKey,
      uid: game.table.uid,
      cards: [...game.table.cards],
    };
  }, [game.table, tablePlayKey, room.id, room.matchId]);
  useEffect(() => {
    setSelected((old) =>
      old.filter((c) => handKey.split(',').includes(String(c))),
    );
  }, [handKey]);
  useEffect(() => {
    setSelected([]);
  }, [room.matchId]);
  const dealContext = useRef({ active, tablePlayKey, game });
  dealContext.current = { active, tablePlayKey, game };
  const handDealDelay = useRef(0);
  const dealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const context = dealContext.current;
    if (
      !dealAnimationKey ||
      seenDealAnimations.has(dealAnimationKey) ||
      !context.active ||
      context.tablePlayKey ||
      context.game.status !== 'playing'
    ) {
      setActiveDealAnimationKey(null);
      return;
    }
    seenDealAnimations.add(dealAnimationKey);
    if (seenDealAnimations.size > 32) {
      const oldestKey = seenDealAnimations.values().next().value;
      if (oldestKey) seenDealAnimations.delete(oldestKey);
    }
    setActiveDealAnimationKey(dealAnimationKey);
    handDealDelay.current =
      650 +
      context.game.players.reduce((sum, p) => sum + p.count, 0) * 45 +
      280;
    const duration =
      handDealDelay.current +
      Math.max(0, context.game.hand.length - 1) * 35 +
      240;
    const timer = setTimeout(() => {
      if (dealTimer.current === timer) dealTimer.current = null;
      setActiveDealAnimationKey((current) =>
        current === dealAnimationKey ? null : current,
      );
    }, duration);
    dealTimer.current = timer;
    return () => {
      clearTimeout(timer);
      if (dealTimer.current === timer) dealTimer.current = null;
    };
  }, [dealAnimationKey]);
  const dealViewport = useRef(`${width}:${height}`);
  useEffect(() => {
    const viewport = `${width}:${height}`;
    if (!active || tablePlayKey || dealViewport.current !== viewport) {
      if (dealTimer.current !== null) clearTimeout(dealTimer.current);
      dealTimer.current = null;
      setActiveDealAnimationKey(null);
    }
    dealViewport.current = viewport;
  }, [active, tablePlayKey, width, height]);
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
  const seconds = getSecondsRemaining(
    game.deadline,
    serverClock.time,
    serverClock.receivedAt,
    now,
  );
  const mine = game.turn === uid;
  const turnPulse = useRef(new Animated.Value(1)).current;
  const urgentTurn = active && seconds > 0 && seconds <= 5;
  useEffect(() => {
    turnPulse.setValue(1);
    if (!urgentTurn) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(turnPulse, {
          toValue: 1.06,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(turnPulse, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [urgentTurn, game.turn, turnPulse]);
  const roundFinished = game.status !== 'playing';
  const {
    matchKey,
    animateResult: animateRound,
    collection,
    finishCollection,
  } = useCardRoundPresentation(
    room,
    active,
    `${width}:${height}`,
    resultAnimationKey,
  );
  const roundCleanup = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    roundCleanup.stopAnimation();
    if (!collection) {
      roundCleanup.setValue(roundFinished ? 1 : 0);
      return;
    }
    roundCleanup.setValue(0);
    const cleanup = Animated.sequence([
      Animated.delay(500),
      Animated.timing(roundCleanup, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    cleanup.start(({ finished }) => {
      if (finished) finishCollection(collection.key);
    });
    return () => cleanup.stop();
  }, [collection, finishCollection, roundFinished, roundCleanup]);
  const outgoingCardsOpacity = roundCleanup.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const [displayedHand, setDisplayedHand] = useState(game.hand);
  const lastHandLayout = useRef({ matchId: room.matchId, key: handKey });
  useLayoutEffect(() => {
    const previous = lastHandLayout.current;
    if (previous.matchId === room.matchId && previous.key === handKey) return;
    if (previous.matchId === room.matchId && active && !roundFinished) {
      if (Platform.OS === 'android')
        UIManager.setLayoutAnimationEnabledExperimental?.(true);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    lastHandLayout.current = { matchId: room.matchId, key: handKey };
    setDisplayedHand(game.hand);
  }, [game.hand, handKey, room.matchId, active, roundFinished]);
  const hand = [...displayedHand].sort((a, b) =>
    sortBySuit ? (a % 4) - (b % 4) || a - b : a - b,
  );
  const collectionHand = collection
    ? [...collection.hand].sort((a, b) =>
        sortBySuit ? (a % 4) - (b % 4) || a - b : a - b,
      )
    : [];
  const handWidth =
    handLayout.viewport === width
      ? Math.max(0, handLayout.width - 4)
      : Math.max(0, width - (landscape ? 236 : 40));
  const { compact: compactHand, overlap: stackOverlap } = getHandStackLayout(
    handWidth,
    hand.length,
  );
  const mySeat = game.players.find((p) => p.uid === uid);
  const myMember = room.members.find((member) => member.uid === uid);
  const winnerUID =
    game.status === 'finished'
      ? game.result?.ranking.find(
          (player) => player.rank === 1 && !player.labels.includes('forfeit'),
        )?.uid
      : undefined;
  const myBalance =
    mySeat?.balance ??
    room.members.find((member) => member.uid === uid)?.balance ??
    0;
  const ownResult = game.result?.ranking.find((entry) => entry.uid === uid);
  const scoreBreakdown = (ownResult?.breakdown ?? [])
    .filter((item) => item.amount !== 0)
    .map(
      (item) =>
        `${scorePartLabels[item.kind] ?? item.kind} ${item.amount > 0 ? '+' : ''}${item.amount.toLocaleString('vi-VN')} ${balanceUnit}`,
    )
    .join(' · ');
  const latestCut = game.cutTwoFees?.at(-1);
  const canAct =
    active &&
    !disabled &&
    !activeDealAnimationKey &&
    !mySeat?.finished &&
    !mySeat?.forfeited &&
    seconds > 0;
  const isSamReporting =
    room.gameKind === 'sam' && game.step === 'report-sam';
  const isSam = room.gameKind === 'sam';
  const samCallerName = game.callUid
    ? game.players.find((player) => player.uid === game.callUid)?.name ??
      room.members.find((member) => member.uid === game.callUid)?.name ??
      'Người chơi'
    : null;
  const samCallStatus =
    isSam && samCallerName
      ? game.samOutcome === 'success'
        ? `${samCallerName} báo Sâm thành công`
        : game.samOutcome === 'failed'
          ? `${samCallerName} báo Sâm thất bại · ván tiếp tục`
          : game.samOutcome === 'aborted'
            ? `${samCallerName} rời bàn · báo Sâm đã hủy`
            : `${samCallerName} đã báo Sâm`
      : null;
  const canPlay =
    canAct &&
    (room.gameKind === 'north'
      ? canPlayTienLenNorthSelection(
          selected,
          game as unknown as TienLenNorthView,
          uid,
        )
      : room.gameKind === 'sam'
        ? canPlaySamSelection(selected, game as unknown as SamView, uid)
        : canPlayTienLenSelection(selected, game, uid));
  const timerTone =
    seconds <= 2
      ? styles.criticalTurnTimer
      : seconds <= 5
        ? styles.urgentTurnTimer
        : seconds <= 10
          ? styles.warningTurnTimer
          : styles.normalTurnTimer;
  const turnColor =
    seconds <= 5
      ? colors.danger
      : seconds <= 10
        ? colors.sunlight
        : colors.success;
  const turnSoftColor =
    seconds <= 5
      ? colors.dangerSoft
      : seconds <= 10
        ? colors.sunlightSoft
        : colors.successSoft;
  const turnKey = `${game.turn ?? ''}:${game.deadline ?? ''}`;
  const turnTotal = useRef({ key: '', total: 1 });
  if (turnTotal.current.key !== turnKey) {
    turnTotal.current = { key: turnKey, total: Math.max(seconds, 1) };
  } else if (seconds > turnTotal.current.total) {
    turnTotal.current.total = seconds;
  }
  const turnProgress = Math.max(
    0,
    Math.min(1, seconds / turnTotal.current.total),
  );
  const turnProgressBar = (
    <View pointerEvents="none" style={styles.turnProgressTrack}>
      <View
        style={[
          styles.turnProgressFill,
          {
            width: `${turnProgress * 100}%`,
            backgroundColor: turnColor,
          },
        ]}
      />
    </View>
  );
  const seatPlayers = roundFinished
    ? room.members.map(
        (member) =>
          game.players.find((player) => player.uid === member.uid) ?? {
            uid: member.uid,
            name: member.name,
            balance: member.balance,
            count: 0,
            finished: false,
            forfeited: false,
          },
      )
    : game.players;
  const portraitSeatWidth = Math.min(180, Math.max(108, (width - 48) * 0.46));
  const fourPlayerPortrait = !landscape && seatPlayers.length === 4;
  // Side seats sit right below the measured top seat so cards never overlap.
  const portraitSideTop = 6 + seatHeights.top + 8;
  const fourPlayerLandscape = landscape && seatPlayers.length === 4;
  const changeSortOrder = () => {
    if (Platform.OS === 'android') {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSortBySuit((current) => !current);
  };
  const opponents = getOpponentsInSeatOrder(seatPlayers, uid).map((p) => {
    const member = room.members.find((m) => m.uid === p.uid);
    const inCurrentMatch = game.players.some((player) => player.uid === p.uid);
    const finalBalance = p.balance ?? member?.balance ?? 0;
    const result = game.result?.ranking.find((entry) => entry.uid === p.uid);
    const delta = result?.moneyDelta ?? 0;
    const isWinner = roundFinished && winnerUID === p.uid;
    const playerName = p.name ?? member?.name ?? 'Người chơi';
    const isPlayingTurn = !roundFinished && game.turn === p.uid;
    return (
      <View
        key={p.uid}
        testID={`opponent-${p.uid}`}
        style={[
          styles.opponent,
          fourPlayerPortrait && styles.portraitFourOpponent,
          landscape && styles.landscapeOpponent,
          fourPlayerLandscape && styles.landscapeFourOpponent,
          isPlayingTurn && styles.currentOpponent,
          isPlayingTurn &&
            !landscape &&
            seconds > 0 &&
            styles.currentOpponentWithProgress,
          isPlayingTurn &&
            seconds > 0 && {
              borderColor: turnColor,
              backgroundColor: turnSoftColor,
              shadowColor: turnColor,
            },
        ]}
      >
        {isPlayingTurn && !landscape && seconds > 0 && turnProgressBar}
        <View
          style={[
            styles.opponentIdentityRow,
            fourPlayerPortrait && styles.portraitFourIdentityRow,
          ]}
          testID={`opponent-identity-${p.uid}`}
        >
          <View
            style={[
              styles.opponentMain,
              fourPlayerPortrait && styles.portraitFourOpponentMain,
            ]}
          >
            <View
              style={styles.opponentAvatarColumn}
              testID={`opponent-avatar-column-${p.uid}`}
            >
              <View
                ref={anchorRef(`seat:${p.uid}`)}
                onLayout={measureAnchors}
                style={[
                  styles.avatarAnchor,
                  fourPlayerPortrait && styles.portraitFourAvatarAnchor,
                  landscape && styles.landscapeAvatarAnchor,
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ảnh người chơi ${playerName}`}
                  disabled={!onPlayerPress || !member}
                  onPress={() => onPlayerPress?.(p.uid)}
                  style={[
                    styles.avatar,
                    styles.opponentAvatar,
                    fourPlayerPortrait && styles.portraitFourAvatar,
                    landscape && styles.landscapeAvatar,
                    isPlayingTurn &&
                      seconds > 0 && [
                        styles.activeTurnAvatar,
                        { borderColor: turnColor },
                      ],
                    isWinner && styles.winnerAvatar,
                  ]}
                >
                  <Text style={styles.avatarText}>
                    {(p.name ?? member?.name)?.slice(0, 1).toUpperCase() ?? '—'}
                  </Text>
                  <CardGameAvatarImage
                    uid={p.uid}
                    url={member?.avatarUrl}
                    name={playerName}
                    size={fourPlayerPortrait ? 34 : landscape ? 32 : 36}
                  />
                </Pressable>
                {isPlayingTurn && seconds > 0 && (
                  <Animated.Text
                    accessibilityLiveRegion="polite"
                    accessibilityLabel={`Lượt ${p.name ?? member?.name ?? 'người chơi'}, còn ${seconds} giây`}
                    testID={`opponent-turn-timer-${p.uid}`}
                    style={[
                      styles.avatarTurnTimer,
                      timerTone,
                      { transform: [{ scale: turnPulse }] },
                    ]}
                  >
                    {seconds}
                  </Animated.Text>
                )}
                {roundFinished && member && (
                  <Text
                    accessibilityLabel={
                      member.ready
                        ? member.uid === room.host
                          ? 'Chủ phòng đã sẵn sàng'
                          : 'Đã sẵn sàng'
                        : member.uid === room.host
                          ? 'Chủ phòng chưa sẵn sàng'
                          : 'Chưa sẵn sàng'
                    }
                    testID={`player-ready-${p.uid}`}
                    numberOfLines={1}
                    style={[
                      member.ready ? styles.readyCheck : styles.readyHidden,
                    ]}
                  >
                    {member.ready ? '✓' : ''}
                  </Text>
                )}
                {isWinner && (
                  <View
                    pointerEvents="none"
                    accessible={false}
                    testID={`winner-crown-${p.uid}`}
                    style={styles.winnerCrown}
                  >
                    <FontAwesome6
                      name="crown"
                      size={12}
                      color={colors.sunlight}
                    />
                  </View>
                )}
                {isWinner && (
                  <CardGameWinnerEffects
                    playerUID={p.uid}
                    animationKey={`${matchKey}:${p.uid}`}
                    animate={animateRound}
                  />
                )}
              </View>
            </View>
            <View
              style={[
                styles.opponentCopy,
                fourPlayerPortrait && styles.portraitFourOpponentCopy,
                landscape && styles.landscapeOpponentCopy,
              ]}
              testID={`opponent-copy-${p.uid}`}
            >
              {isPlayingTurn && (
                <Text
                  testID={`active-player-${p.uid}`}
                  numberOfLines={1}
                  style={[styles.activePlayerBadge, { color: turnColor }]}
                >
                  Đang đánh
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Thông tin người chơi ${playerName}`}
                disabled={!onPlayerPress || !member}
                onPress={() => onPlayerPress?.(p.uid)}
                style={{ alignSelf: 'stretch' }}
              >
                <Text
                  testID={`opponent-name-${p.uid}`}
                  accessibilityLabel={playerName}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                  style={[
                    styles.opponentName,
                    fourPlayerPortrait && styles.portraitFourOpponentName,
                    landscape && styles.landscapeOpponentName,
                    isPlayingTurn && styles.activePlayerName,
                    isPlayingTurn && seconds > 0 && { color: turnColor },
                  ]}
                >
                  {playerName}
                </Text>
              </Pressable>
              <View style={styles.opponentMetaRow}>
                {isSam && p.count === 1 && !p.finished && !p.forfeited && (
                  <Text
                    testID={`sam-one-${p.uid}`}
                    style={styles.samBadge}
                  >
                    Báo một
                  </Text>
                )}
                {isSam && game.callUid === p.uid && (
                  <Text
                    testID={`sam-caller-${p.uid}`}
                    style={styles.samBadge}
                  >
                    {game.samOutcome === 'failed'
                      ? 'Sâm thất bại'
                      : game.samOutcome === 'success'
                        ? 'Sâm thành công'
                        : game.samOutcome === 'aborted'
                          ? 'Báo Sâm đã hủy'
                          : 'Đã báo Sâm'}
                  </Text>
                )}
                {game.status === 'playing' ? (
                  <Text
                    numberOfLines={1}
                    testID={`remaining-cards-${p.uid}`}
                    style={[
                      styles.subtitle,
                      styles.opponentMeta,
                      styles.opponentCount,
                      fourPlayerPortrait && styles.portraitFourOpponentMeta,
                      landscape && styles.landscapeOpponentMeta,
                    ]}
                  >
                    {p.forfeited
                      ? `Bỏ cuộc · Còn ${p.count} lá`
                      : `Còn ${p.count} lá`}
                  </Text>
                ) : (roundFinished && !inCurrentMatch) || p.forfeited ? (
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.subtitle,
                      styles.opponentMeta,
                      styles.opponentCount,
                      fourPlayerPortrait && styles.portraitFourOpponentMeta,
                      landscape && styles.landscapeOpponentMeta,
                    ]}
                  >
                    {roundFinished && !inCurrentMatch
                      ? 'Chờ ván mới'
                      : 'Bỏ cuộc'}
                  </Text>
                ) : null}
                <CardGameMoneyCounter
                  key={`${room.id}:${room.matchId ?? ''}:${p.uid}`}
                  testID={`opponent-balance-${p.uid}`}
                  balance={finalBalance}
                  delta={delta}
                  unit={balanceUnit}
                  animate={animateRound}
                  animationKey={`${room.id}:${room.matchId ?? ''}:${p.uid}`}
                  balanceStyle={[
                    styles.subtitle,
                    styles.opponentMeta,
                    styles.opponentBalance,
                    fourPlayerPortrait && styles.portraitFourOpponentMeta,
                    landscape && styles.landscapeOpponentMeta,
                  ]}
                />
              </View>
              <AnimatedPassLabel
                visible={game.passed.includes(p.uid)}
                style={[
                  styles.subtitle,
                  styles.opponentMeta,
                  styles.opponentCount,
                  landscape && styles.landscapeOpponentMeta,
                ]}
              />
            </View>
          </View>
        </View>
      </View>
    );
  });
  const playedBy = game.table
    ? (game.players.find((p) => p.uid === game.table?.uid)?.name ??
      room.members.find((p) => p.uid === game.table?.uid)?.name ??
      'Người chơi')
    : null;
  const board = (
    <View
      style={[
        styles.board,
        fourPlayerPortrait && styles.portraitFourBoard,
        fourPlayerPortrait && {
          paddingTop: Math.max(150, portraitSideTop + seatHeights.side + 16),
        },
        landscape && styles.landscapeBoard,
      ]}
    >
      <View style={styles.boardCenter}>
        {!roundFinished && latestCut && (
          <Text accessibilityLiveRegion="polite" style={styles.subtitle}>
            {game.players.find((p) => p.uid === latestCut.to)?.name ??
              room.members.find((p) => p.uid === latestCut.to)?.name ??
              'Người chơi'}{' '}
            chặt {latestCut.count} lá 2 · +
            {latestCut.amount.toLocaleString('vi-VN')} đ
          </Text>
        )}
        {roundFinished && !collection ? (
          <CollectedDeck
            key={`${room.id}:${room.matchId ?? ''}`}
            landscape={landscape}
            animate={animateRound}
            animationKey={matchKey}
          />
        ) : (
          (!landscape || !game.table) &&
          !activeDealAnimationKey && (
            <Text
              style={[styles.centerText, game.table && styles.boardPlayLabel]}
            >
              {isSamReporting
                ? 'Báo Sâm trước khi bắt đầu'
                : playedBy
                  ? `${playedBy} vừa đánh`
                  : 'Vòng mới'}
            </Text>
          )
        )}
        {samCallStatus && (
          <Text testID="sam-call-status" style={styles.samCallStatus}>
            {samCallStatus}
          </Text>
        )}
        {activeDealAnimationKey &&
          !game.table &&
          !hasPlayedTableThisMatch.current && (
            <>
              <ShuffleDeck key={activeDealAnimationKey} />
              <DealFlightLayer
                key={`deal:${activeDealAnimationKey}`}
                players={game.players}
                uid={uid}
                width={width}
                fourPlayer={game.players.length === 4}
                destinationFor={(playerUID, fallback) =>
                  originFor(
                    playerUID === uid ? 'hand' : `seat:${playerUID}`,
                    fallback,
                  )
                }
              />
            </>
          )}
        {exitingTablePlay && (
          <ExitingTablePlay
            key={exitingTablePlay.key}
            play={exitingTablePlay}
            onFinished={finishExitingTablePlay}
          />
        )}
        {passAnimations.map((passAnimation) => {
          const offsets = getPassCardFlightOffsets(
            game.players,
            uid,
            passAnimation.uid,
            landscape,
            game.table ? 56 + (game.table.cards.length - 1) * 24 : 56,
          );
          return (
            <PassCardFlight
              key={passAnimation.key}
              eventKey={passAnimation.key}
              target={offsets.target}
              origin={originFor(
                passAnimation.uid === uid
                  ? 'hand'
                  : `seat:${passAnimation.uid}`,
                offsets.origin,
              )}
              onFinished={finishPassAnimation}
            />
          );
        })}
        <View
          ref={anchorRef('table')}
          onLayout={measureAnchors}
          style={styles.tablePlayAnchor}
          pointerEvents="none"
        >
          {game.table ? (
            <Animated.View
              testID="outgoing-table-cards"
              style={[styles.tableCards, { opacity: outgoingCardsOpacity }]}
            >
              {game.table.cards.map((c, index) => (
                <PlayedCardArrival
                  key={`${room.matchId ?? ''}:${game.table!.uid}:${c}`}
                  card={c}
                  animate={animateTablePlay}
                  index={index}
                  cardsCount={game.table!.cards.length}
                  origin={originFor(
                    game.table!.uid === uid
                      ? 'hand'
                      : `seat:${game.table!.uid}`,
                    getPlayedCardOrigin(game.players, uid, game.table!.uid),
                  )}
                />
              ))}
            </Animated.View>
          ) : null}
        </View>
        <View style={styles.boardFooter}>
          {!roundFinished && seconds === 0 && (
            <View testID="board-turn-indicator" style={styles.turnIndicator}>
              <Text accessibilityLiveRegion="polite" style={styles.turnText}>
                Đang chuyển lượt…
              </Text>
            </View>
          )}
          {!roundFinished && mine && game.openingCard !== null && (
            <Text style={styles.openingHint}>
              Bộ mở cần có {cardLabel(game.openingCard)}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
  const roundAction = (
    <Button
      compact
      pressScale={0.97}
      variant={myMember?.ready ? 'secondary' : 'primary'}
      title={myMember?.ready ? 'Bỏ sẵn sàng' : 'Sẵn sàng'}
      loading={busy}
      disabled={disabled || !!collection}
      onPress={() => onAction({ type: 'ready', ready: !myMember?.ready })}
    />
  );
  const handSection = (
    <View
      testID="hand-area"
      ref={anchorRef('hand')}
      onLayout={measureAnchors}
      style={[
        styles.handSection,
        landscape && styles.landscapeHandSection,
        roundFinished && styles.finishedHandArea,
        roundFinished && landscape && styles.landscapeFinishedHandArea,
        !roundFinished && mine && seconds > 0 && styles.activeHandArea,
        !roundFinished &&
          mine &&
          seconds > 0 && {
            borderColor: turnColor,
            backgroundColor: turnSoftColor,
          },
      ]}
    >
      {!roundFinished && mine && seconds > 0 && turnProgressBar}
      {roundFinished ? (
        <Animated.View
          pointerEvents={collection ? 'none' : 'auto'}
          accessibilityElementsHidden={!!collection}
          importantForAccessibility={
            collection ? 'no-hide-descendants' : 'auto'
          }
          style={[
            styles.handReadyContent,
            { opacity: collection ? roundCleanup : 1 },
          ]}
        >
          <View testID="hand-ready-action" style={styles.handReadyAction}>
            <View style={styles.handReadyPlayer}>
              <Pressable
                testID="own-player-status"
                style={styles.ownAvatarAnchor}
                accessibilityRole="button"
                accessibilityLabel={`Thông tin người chơi ${myMember?.name ?? 'Bạn'}`}
                disabled={!onPlayerPress || !myMember}
                onPress={() => onPlayerPress?.(uid)}
              >
                <View
                  style={[
                    styles.avatar,
                    styles.ownRoundAvatar,
                    winnerUID === uid && styles.winnerAvatar,
                  ]}
                >
                  <Text style={styles.avatarText}>
                    {myMember?.name.slice(0, 1).toUpperCase() ?? 'Bạn'}
                  </Text>
                  <CardGameAvatarImage
                    uid={uid}
                    url={myMember?.avatarUrl}
                    name={myMember?.name ?? 'Bạn'}
                    size={36}
                  />
                  {winnerUID === uid && (
                    <CardGameWinnerEffects
                      playerUID={uid}
                      animationKey={`${matchKey}:${uid}`}
                      animate={animateRound}
                    />
                  )}
                </View>
                {myMember && (
                  <Text
                    accessibilityLabel={
                      myMember.ready
                        ? myMember.uid === room.host
                          ? 'Chủ phòng đã sẵn sàng'
                          : 'Đã sẵn sàng'
                        : myMember.uid === room.host
                          ? 'Chủ phòng chưa sẵn sàng'
                          : 'Chưa sẵn sàng'
                    }
                    testID={`player-ready-${uid}`}
                    numberOfLines={1}
                    style={[
                      myMember.ready ? styles.readyCheck : styles.readyHidden,
                    ]}
                  >
                    {myMember.ready ? '✓' : ''}
                  </Text>
                )}
                {winnerUID === uid && (
                  <View
                    pointerEvents="none"
                    accessible={false}
                    testID={`winner-crown-${uid}`}
                    style={styles.winnerCrown}
                  >
                    <FontAwesome6
                      name="crown"
                      size={12}
                      color={colors.sunlight}
                    />
                  </View>
                )}
              </Pressable>
              <View style={styles.handReadyCopy}>
                {ownResult && (
                  <Text
                    testID={`round-feedback-${uid}`}
                    style={
                      ownResult.rank === 1
                        ? styles.roundWinFeedback
                        : styles.roundLossFeedback
                    }
                  >
                    {ownResult.rank === 1 ? 'Thắng' : 'Thua'}
                  </Text>
                )}
                <CardGameMoneyCounter
                  key={`${room.id}:${room.matchId ?? ''}:${uid}`}
                  testID="own-balance"
                  balance={myBalance}
                  delta={ownResult?.moneyDelta ?? 0}
                  unit={balanceUnit}
                  animate={animateRound}
                  animationKey={`${room.id}:${room.matchId ?? ''}:${uid}`}
                />
                {!!scoreBreakdown && (
                  <Text testID={`score-breakdown-${uid}`} style={styles.subtitle}>
                    {scoreBreakdown}
                  </Text>
                )}
              </View>
            </View>
            {roundAction}
          </View>
          <Text style={styles.readySummary}>
            {room.members.filter((p) => p.ready).length}/{room.members.length}{' '}
            sẵn sàng{myMember?.ready ? ' · Chờ mọi người' : ''}
          </Text>
        </Animated.View>
      ) : (
        <>
          <View
            testID="hand-heading"
            style={[
              styles.handHeading,
              landscape && styles.landscapeHandHeading,
            ]}
          >
            <View
              accessibilityLabel={`Bài của bạn, ${hand.length} lá, số dư bàn ${myBalance} ${balanceUnit === 'đ' ? 'đồng' : balanceUnit}`}
              style={styles.handSummary}
              testID="hand-summary"
            >
              <Text numberOfLines={1} style={styles.handTitle}>
                {`Bài ${hand.length} · Dư`}
              </Text>
              <CardGameMoneyCounter
                key={`${room.id}:${room.matchId ?? ''}:${uid}`}
                testID="own-balance"
                balance={myBalance}
                delta={ownResult?.moneyDelta ?? 0}
                unit={balanceUnit}
                animate={animateRound}
                animationKey={`${room.id}:${room.matchId ?? ''}:${uid}`}
                balanceStyle={styles.ownBalanceText}
              />
              {isSam && game.status === 'playing' && hand.length === 1 && (
                <Text testID="sam-one-own" style={styles.samBadge}>
                  Báo một
                </Text>
              )}
            </View>
            {!roundFinished && mine && seconds > 0 && (
              <Animated.Text
                accessibilityLiveRegion="polite"
                accessibilityLabel={`Lượt của bạn, còn ${seconds} giây`}
                testID="hand-turn-timer"
                style={[
                  styles.turnTimer,
                  styles.handTurnTimer,
                  landscape && styles.landscapeHandTurnTimer,
                  timerTone,
                  { transform: [{ scale: turnPulse }] },
                ]}
              >
                {`Lượt bạn · ${seconds}s`}
              </Animated.Text>
            )}
            {!roundFinished && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đổi cách sắp bài"
                onPress={changeSortOrder}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.sort,
                  landscape && styles.landscapeSort,
                  pressed && styles.sortPressed,
                ]}
                testID="hand-sort"
              >
                <Text style={styles.sortText}>
                  Xếp {sortBySuit ? 'số' : 'chất'}
                </Text>
              </Pressable>
            )}
          </View>
          <Animated.View
            testID="outgoing-hand"
            onLayout={({ nativeEvent }) =>
              setHandLayout({
                viewport: width,
                width: nativeEvent.layout.width,
              })
            }
            style={[
              styles.hand,
              styles.stackedHand,
              landscape && styles.landscapeStackedHand,
              { opacity: outgoingCardsOpacity },
            ]}
          >
            {hand.map((card, index) => (
              <PlayingCard
                key={card}
                card={card}
                selected={selected.includes(card)}
                disabled={
                  disabled ||
                  !active ||
                  roundFinished ||
                  !!activeDealAnimationKey
                }
                stacked
                compact={compactHand}
                stackIndex={index}
                stackOverlap={stackOverlap}
                stackLast={index === hand.length - 1}
                dealAnimationKey={
                  activeDealAnimationKey === `${room.id}:${room.matchId ?? ''}`
                    ? activeDealAnimationKey
                    : undefined
                }
                dealIndex={index}
                dealDelayMs={handDealDelay.current}
                onPress={() =>
                  setSelected((old) =>
                    old.includes(card)
                      ? old.filter((c) => c !== card)
                      : [...old, card],
                  )
                }
              />
            ))}
          </Animated.View>
          {!roundFinished && !hand.length && (
            <Text style={styles.body}>
              Bạn đã hết bài. Đợi các bạn chơi xong ván nhé.
            </Text>
          )}
        </>
      )}
      {collection && (
        <CardGameCollectingHand
          cards={collectionHand}
          progress={roundCleanup}
          compact={compactHand}
          overlap={
            getHandStackLayout(handWidth, collection.hand.length).overlap
          }
        />
      )}
    </View>
  );
  const passButton = (
    <Button
      compact
      pressScale={0.97}
      variant="secondary"
      title={isSamReporting ? 'Bỏ qua' : 'Bỏ lượt'}
      disabled={!canAct || !mine || (!isSamReporting && !game.table)}
      onPress={() => {
        setSelected([]);
        if (isSamReporting)
          onAction({ type: 'game-action', gameAction: { type: 'pass-report' } });
        else if (room.gameKind === 'sam')
          onAction({ type: 'game-action', gameAction: { type: 'pass' } });
        else onAction({ type: 'pass' });
      }}
    />
  );
  const playButton = (
    <Button
      compact
      pressScale={0.97}
      title={isSamReporting ? 'Báo Sâm' : `Đánh ${selected.length} lá`}
      loading={busy}
      disabled={
        isSamReporting ? !canAct || !mine : !canPlay
      }
      onPress={() => {
        if (isSamReporting) {
          onAction({ type: 'game-action', gameAction: { type: 'call-sam' } });
          return;
        }
        const cards = [...selected].sort((a, b) => a - b);
        if (room.gameKind === 'sam')
          onAction({ type: 'game-action', gameAction: { type: 'play', cards } });
        else onAction({ type: 'play', cards });
      }}
    />
  );
  const finishedSpacer = <View style={{ width: 100 }} />;
  if (landscape)
    return (
      <View testID="game-table-landscape" style={styles.landscapeTable}>
        {fourPlayerLandscape ? (
          <View style={styles.landscapeFourOpponentLayer}>
            <View
              testID="landscape-opponent-top"
              style={[
                styles.landscapeOpponentSlot,
                styles.landscapeOpponentTop,
              ]}
            >
              {opponents[1]}
            </View>
            <View
              testID="landscape-opponent-left"
              style={[
                styles.landscapeOpponentSlot,
                styles.landscapeOpponentLeft,
              ]}
            >
              {opponents[0]}
            </View>
            <View
              testID="landscape-opponent-right"
              style={[
                styles.landscapeOpponentSlot,
                styles.landscapeOpponentRight,
              ]}
            >
              {opponents[2]}
            </View>
          </View>
        ) : (
          <View style={styles.landscapeOpponents}>{opponents}</View>
        )}
        {board}
        <View style={styles.landscapeBottom}>
          <View
            testID="landscape-pass-action"
            style={styles.landscapePassAction}
          >
            {roundFinished ? finishedSpacer : passButton}
          </View>
          {handSection}
          <View
            testID="landscape-play-action"
            style={styles.landscapePlayAction}
          >
            {roundFinished ? null : playButton}
          </View>
        </View>
      </View>
    );
  return (
    <>
      <ScrollView
        testID="game-table-scroll"
        style={styles.grow}
        contentContainerStyle={styles.tableScrollable}
        keyboardShouldPersistTaps="handled"
      >
        {fourPlayerPortrait ? (
          <View
            testID="portrait-four-player-table"
            style={styles.portraitFourPlayerTable}
          >
            {board}
            <View
              testID="portrait-opponent-top"
              onLayout={(e) => {
                const top = Math.round(e.nativeEvent.layout.height);
                setSeatHeights((h) => (h.top === top ? h : { ...h, top }));
              }}
              style={[
                styles.portraitOpponentSlot,
                styles.portraitOpponentTop,
                {
                  width: portraitSeatWidth,
                  transform: [{ translateX: -portraitSeatWidth / 2 }],
                },
              ]}
            >
              {opponents[1]}
            </View>
            <View
              testID="portrait-opponent-left"
              onLayout={(e) => {
                const side = Math.round(e.nativeEvent.layout.height);
                setSeatHeights((h) => (h.side >= side ? h : { ...h, side }));
              }}
              style={[
                styles.portraitOpponentSlot,
                styles.portraitOpponentLeft,
                { width: portraitSeatWidth, top: portraitSideTop },
              ]}
            >
              {opponents[0]}
            </View>
            <View
              testID="portrait-opponent-right"
              onLayout={(e) => {
                const side = Math.round(e.nativeEvent.layout.height);
                setSeatHeights((h) => (h.side >= side ? h : { ...h, side }));
              }}
              style={[
                styles.portraitOpponentSlot,
                { width: portraitSeatWidth },
                styles.portraitOpponentRight,
                { top: portraitSideTop },
              ]}
            >
              {opponents[2]}
            </View>
          </View>
        ) : (
          <>
            <View style={styles.opponents}>{opponents}</View>
            {board}
          </>
        )}
        {handSection}
      </ScrollView>
      <View style={styles.footer}>
        {!roundFinished && (
          <>
            <View style={styles.grow}>{passButton}</View>
            <View style={styles.grow}>{playButton}</View>
          </>
        )}
      </View>
    </>
  );
}

function CollectedDeck({
  landscape,
  animate,
  animationKey,
}: {
  landscape: boolean;
  animate: boolean;
  animationKey: string;
}) {
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate || !claimCardPresentation(`deck:${animationKey}`)) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.spring(progress, {
      toValue: 1,
      speed: 18,
      bounciness: 3,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, animate, animationKey]);

  return (
    <Animated.View
      accessible={false}
      testID="collected-deck"
      style={[
        styles.collectedDeck,
        landscape && styles.landscapeCollectedDeck,
        {
          opacity: progress,
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.88, 1],
              }),
            },
          ],
        },
      ]}
    >
      <View
        style={[
          styles.collectedDeckCard,
          styles.collectedDeckBack,
          styles.collectedDeckBottom,
        ]}
      />
      <View
        style={[
          styles.collectedDeckCard,
          styles.collectedDeckBack,
          styles.collectedDeckMiddle,
        ]}
      />
      <View
        style={[
          styles.collectedDeckCard,
          styles.collectedDeckTop,
          styles.collectedDeckBack,
        ]}
      >
        <Text style={styles.collectedDeckMark}>◆</Text>
      </View>
    </Animated.View>
  );
}

function getPlayedCardOrigin(
  players: TienLenView['players'],
  currentUID: string,
  playerUID: string,
) {
  if (playerUID === currentUID) return { x: 0, y: 34 };
  const opponents = getOpponentsInSeatOrder(players, currentUID);
  if (opponents.length !== 3) return { x: 0, y: -34 };
  const seat = opponents.findIndex((player) => player.uid === playerUID);
  if (seat === 0) return { x: -52, y: 0 };
  if (seat === 1) return { x: 0, y: -42 };
  return { x: 52, y: 0 };
}

export function getPassCardFlightOffsets(
  players: TienLenView['players'],
  currentUID: string,
  playerUID: string,
  landscape: boolean,
  playedWidth = 56,
) {
  const opponents = getOpponentsInSeatOrder(players, currentUID);
  const clearance = playedWidth / 2 + 32;
  if (playerUID === currentUID) {
    return {
      origin: { x: 0, y: landscape ? 72 : 126 },
      target: { x: landscape ? clearance : 0, y: landscape ? 24 : 78 },
    };
  }

  if (opponents.length !== 3) {
    return {
      origin: { x: 0, y: landscape ? -72 : -126 },
      target: { x: landscape ? -clearance : 0, y: landscape ? -24 : -78 },
    };
  }

  const seat = opponents.findIndex((player) => player.uid === playerUID);
  if (seat === 1) {
    return {
      origin: { x: 0, y: landscape ? -72 : -126 },
      target: { x: landscape ? -clearance : 0, y: landscape ? -24 : -78 },
    };
  }

  const direction = seat === 0 ? -1 : 1;
  return {
    origin: { x: direction * (clearance + (landscape ? 60 : 42)), y: 0 },
    target: { x: direction * clearance, y: 0 },
  };
}

function ShuffleDeck() {
  const [visible, setVisible] = useState(true);
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: 320,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(progress, {
        toValue: 0,
        duration: 320,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    animation.start(({ finished }) => {
      if (finished) setVisible(false);
    });
    return () => animation.stop();
  }, [progress]);

  if (!visible) return null;
  return (
    <View pointerEvents="none" style={styles.shuffleDeck} testID="shuffle-deck">
      {[-1, 0, 1].map((slot) => (
        <Animated.View
          key={slot}
          style={[
            styles.shuffleCard,
            {
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [slot * 3, slot * 15],
                  }),
                },
                {
                  rotate: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', `${slot * 8}deg`],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

function DealFlightLayer({
  players,
  uid,
  width,
  fourPlayer,
  destinationFor,
}: {
  players: TienLenView['players'];
  uid: string;
  width: number;
  fourPlayer: boolean;
  destinationFor: (
    uid: string,
    fallback: { x: number; y: number },
  ) => { x: number; y: number };
}) {
  const [visible, setVisible] = useState(true);
  const flights: { uid: string; cardIndex: number; order: number }[] = [];
  const maxCards = Math.max(0, ...players.map((player) => player.count));
  for (let cardIndex = 0; cardIndex < maxCards; cardIndex += 1) {
    players.forEach((player) => {
      if (cardIndex < player.count) {
        flights.push({ uid: player.uid, cardIndex, order: flights.length });
      }
    });
  }
  const flightCount = flights.length;
  const opponents = getOpponentsInSeatOrder(players, uid);

  useEffect(() => {
    const finish = Animated.delay(650 + flightCount * 45 + 260);
    finish.start(({ finished }) => {
      if (finished) setVisible(false);
    });
    return () => finish.stop();
  }, [flightCount]);

  if (!visible || !flights.length) return null;
  return (
    <View pointerEvents="none" style={styles.dealFlightLayer}>
      {flights.map((flight) => {
        const opponentIndex = opponents.findIndex(
          (player) => player.uid === flight.uid,
        );
        const origin =
          flight.uid === uid
            ? { x: 0, y: 76 }
            : fourPlayer && opponentIndex === 0
              ? { x: -width * 0.3, y: 0 }
              : fourPlayer && opponentIndex === 1
                ? { x: 0, y: -58 }
                : fourPlayer
                  ? { x: width * 0.3, y: 0 }
                  : { x: 0, y: -70 };
        return (
          <DealFlightCard
            key={`${flight.uid}:${flight.cardIndex}`}
            playerUID={flight.uid}
            cardIndex={flight.cardIndex}
            order={flight.order}
            origin={destinationFor(flight.uid, origin)}
          />
        );
      })}
    </View>
  );
}

function DealFlightCard({
  playerUID,
  cardIndex,
  order,
  origin,
}: {
  playerUID: string;
  cardIndex: number;
  order: number;
  origin: { x: number; y: number };
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const destination = useRef(origin);
  const started = useRef(false);
  if (!started.current) destination.current = origin;
  useEffect(() => {
    const delay = Animated.delay(650 + order * 45);
    let animation: Animated.CompositeAnimation | null = null;
    delay.start(({ finished }) => {
      if (!finished) return;
      started.current = true;
      animation = Animated.timing(progress, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      animation.start();
    });
    return () => {
      delay.stop();
      animation?.stop();
    };
  }, [order, progress]);

  return (
    <Animated.View
      testID={`deal-flight-${playerUID}-${cardIndex}`}
      style={[
        styles.dealFlightCard,
        {
          opacity: progress.interpolate({
            inputRange: [0, 0.84, 1],
            outputRange: [1, 1, 0],
          }),
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [
                  0,
                  destination.current.x * 0.52,
                  destination.current.x,
                ],
              }),
            },
            {
              translateY: progress.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [
                  0,
                  destination.current.y * 0.52 - 10,
                  destination.current.y,
                ],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.96, 0.78],
              }),
            },
          ],
        },
      ]}
    >
      <Text style={styles.dealFlightMark}>◆</Text>
    </Animated.View>
  );
}

function ExitingTablePlay({
  play,
  onFinished,
}: {
  play: TablePlaySnapshot;
  onFinished: (key: string) => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 320,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) onFinished(play.key);
    });
    return () => animation.stop();
  }, [onFinished, play.key, progress]);

  return (
    <Animated.View
      pointerEvents="none"
      testID="exiting-table-cards"
      style={[
        styles.exitingTableCards,
        {
          opacity: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0],
          }),
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.82],
              }),
            },
          ],
        },
      ]}
    >
      {play.cards.map((card, index) => (
        <View
          key={card}
          style={{
            zIndex: index + 1,
            marginRight: index < play.cards.length - 1 ? -32 : 0,
          }}
        >
          <PlayingCard card={card} stacked />
        </View>
      ))}
    </Animated.View>
  );
}

function PassCardFlight({
  eventKey,
  origin,
  target,
  onFinished,
}: {
  eventKey: string;
  origin: { x: number; y: number };
  target: { x: number; y: number };
  onFinished: (key: string) => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const path = useRef({ origin, target }).current;
  useEffect(() => {
    const animation = Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(500),
      Animated.timing(progress, {
        toValue: 2,
        duration: 190,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    animation.start(({ finished }) => {
      if (finished) onFinished(eventKey);
    });
    return () => animation.stop();
  }, [eventKey, onFinished, progress]);

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      testID="pass-card-flight"
      style={[
        styles.passCardFlight,
        {
          opacity: progress.interpolate({
            inputRange: [0, 1, 1.2, 2],
            outputRange: [1, 1, 0.6, 0],
          }),
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1, 2],
                outputRange: [path.origin.x, path.target.x, path.target.x],
              }),
            },
            {
              translateY: progress.interpolate({
                inputRange: [0, 1, 2],
                outputRange: [path.origin.y, path.target.y, path.target.y],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 0.9, 1, 2],
                outputRange: [0.9, 0.9, 1.04, 0.85],
              }),
            },
            {
              rotate: progress.interpolate({
                inputRange: [0, 1, 2],
                outputRange: ['-8deg', '3deg', '0deg'],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.passCardBack}>
        <Text style={styles.passCardMark}>◆</Text>
      </View>
    </Animated.View>
  );
}

function PlayedCardArrival({
  card,
  animate,
  index,
  cardsCount,
  origin,
}: {
  card: number;
  animate: boolean;
  index: number;
  cardsCount: number;
  origin: { x: number; y: number };
}) {
  const initial = useRef({ animate, index, origin });
  const progress = useRef(
    new Animated.Value(initial.current.animate ? 0 : 1),
  ).current;
  useEffect(() => {
    if (!initial.current.animate) return;
    const animation = Animated.sequence([
      Animated.delay(initial.current.index * 35),
      Animated.timing(progress, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [progress]);

  return (
    <Animated.View
      testID={`played-card-arrival-${card}`}
      style={{
        zIndex: index + 1,
        marginRight: index < cardsCount - 1 ? -32 : 0,
        opacity: progress,
        transform: [
          {
            translateX: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [initial.current.origin.x, 0],
            }),
          },
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [initial.current.origin.y, 0],
            }),
          },
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.92, 1],
            }),
          },
        ],
      }}
    >
      <PlayingCard card={card} stacked />
    </Animated.View>
  );
}

function AnimatedPassLabel({
  visible,
  style,
}: {
  visible: boolean;
  style: StyleProp<TextStyle>;
}) {
  const [rendered, setRendered] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    if (visible) setRendered(true);
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 180 : 150,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setRendered(false);
    });
    return () => animation.stop();
  }, [progress, visible]);

  if (!rendered) return null;
  return (
    <Animated.View
      testID="passed-status"
      style={{
        opacity: progress,
        transform: [
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.92, 1],
            }),
          },
        ],
      }}
    >
      <Text style={style}>Bỏ lượt</Text>
    </Animated.View>
  );
}
