import Feather from '@expo/vector-icons/Feather';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen as NativeScreen } from 'react-native-screens';
import * as Clipboard from 'expo-clipboard';
import { AppTextInput } from '../../components/AppTextInput';
import { Button } from '../../components/Button';
import { DialogModal } from '../../components/DialogModal';
import { Screen } from '../../components/Screen';
import { useCardGame } from '../../hooks/useCardGame';
import { useCardGameOrientation } from '../../hooks/useCardGameOrientation';
import { useAuthStore } from '../../store/authStore';
import type { MainTabParams } from '../../navigation/types';
import { colors } from '../../theme';
import type { CardGameRoom, GameIntent } from '../../types/cardGame';
import { CardGameRules } from './CardGameRules';
import { CardGameTable } from './CardGameTable';
import { CardGameLobbyTable } from './CardGameLobbyTable';
import { CardGameAvatarImage } from './CardGameAvatarImage';
import { CardGamePlayerDialog } from './CardGamePlayerDialog';
import {
  getCachedRoomSnapshot,
  loadCachedRoomSnapshot,
  saveRoomSnapshot,
  clearCachedRoomSnapshot,
} from '../../services/cardGames/roomSnapshotCache';
import { styles } from './CardGamesScreen.styles';
import { CardHubHeader, CardHubModeTabs } from '../CardScore/CardHubChrome';
import { styles as cardHubStyles } from '../CardScore/CardScoreScreen.styles';

const reasons: Record<string, string> = {
  dragon: 'Tới trắng · Sảnh rồng',
  'four-twos': 'Tới trắng · Tứ quý 2',
  'six-pairs': 'Tới trắng · Sáu đôi',
  'played-out': 'Ván đã kết thúc',
  forfeit: 'Ván kết thúc có người bỏ cuộc',
  'all-disconnected': 'Ván đã hủy',
};
const labels: Record<string, string> = {
  cong: 'Cóng',
  forfeit: 'Bỏ cuộc',
  'remaining-twos': 'Thối 2',
  'remaining-quad': 'Thối tứ quý',
  'remaining-pairs': 'Thối đôi thông',
  'instant-win': 'Tới trắng',
};
const seenRemovals = new Set<string>();

export function CardGamesScreen({
  navigation,
  route,
}: BottomTabScreenProps<MainTabParams, 'CardGames'>) {
  const user = useAuthStore((s) => s.user);
  const epoch = useAuthStore((s) => s.sessionEpoch);
  const [selectedPlayerUid, setSelectedPlayerUid] = useState<string | null>(
    null,
  );
  const kickConfirmation = useRef<symbol | null>(null);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const scrollRef = useRef<ScrollView>(null);
  const codeInputFocused = useRef(false);
  const playerName = user?.displayName?.trim().slice(0, 30) || 'Người chơi';
  const [code, setCode] = useState('');
  const [amountPerCard, setAmountPerCard] = useState('1');
  const [selectedGame, setSelectedGame] = useState<'south' | null>(null);
  const [connectRequested, setConnectRequested] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [leavingRoom, setLeavingRoom] = useState(false);
  const [roomRejoinPending, setRoomRejoinPending] = useState(false);
  const [roomCodePopupVisible, setRoomCodePopupVisible] = useState(false);
  const [rejoinCode, setRejoinCode] = useState<string | null>(
    route.params?.roomCode ?? null,
  );
  const [queuedRoomIntent, setQueuedRoomIntent] = useState<GameIntent | null>(
    null,
  );
  const {
    enabled,
    active,
    uid,
    state,
    session,
    sessionInitializationError,
    retrySessionInitialization,
  } = useCardGame(connectRequested);
  const lastKnownRoomUid = useRef(uid);
  const [lastKnownRoom, setLastKnownRoom] = useState<{
    room: CardGameRoom;
    serverTime: number;
  } | null>(() => {
    const cached =
      uid && route.params?.roomCode
        ? getCachedRoomSnapshot(uid, route.params.roomCode)
        : null;
    return cached?.room
      ? { room: cached.room, serverTime: cached.serverTime }
      : null;
  });
  useEffect(() => {
    if (lastKnownRoomUid.current === uid) return;
    lastKnownRoomUid.current = uid;
    setLastKnownRoom(null);
    setRejoinCode(null);
    setRoomCodePopupVisible(false);
  }, [uid]);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const keyboardSubscription = Keyboard.addListener('keyboardDidShow', () => {
      if (!codeInputFocused.current) return;
      requestAnimationFrame(() =>
        scrollRef.current?.scrollToEnd({ animated: true }),
      );
    });
    return () => keyboardSubscription.remove();
  }, []);
  const [roomEntryMode, setRoomEntryMode] = useState<'create' | 'join'>(
    'create',
  );
  const [rules, setRules] = useState(false);
  const [copyNote, setCopyNote] = useState(false);
  const serverRoom = active ? state?.snapshot?.room : null;
  // Capture before effects: a newly received removal must cancel queued rejoin,
  // while a later deliberate entry may proceed after its notice was handled.
  const removalWasHandled =
    !!uid &&
    !!state?.snapshot?.removal &&
    seenRemovals.has(`${uid}:${state.snapshot.removal.id}`);
  const currentServerTime = state?.snapshot?.serverTime ?? 0;
  const expectedRejoinCode = route.params?.roomCode ?? rejoinCode;
  const matchingMemorySnapshot =
    uid && expectedRejoinCode
      ? getCachedRoomSnapshot(uid, expectedRejoinCode)
      : null;
  const cachedRoomSnapshot =
    lastKnownRoom?.room.code === expectedRejoinCode?.toUpperCase()
      ? lastKnownRoom
      : matchingMemorySnapshot?.room
        ? {
            room: matchingMemorySnapshot.room,
            serverTime: matchingMemorySnapshot.serverTime,
          }
        : null;
  const cachedRejoin =
    !state?.snapshot?.removal &&
    !serverRoom &&
    !!cachedRoomSnapshot &&
    (roomRejoinPending ||
      !!route.params?.roomCode ||
      (!!rejoinCode && !state?.error && !sessionInitializationError)) &&
    cachedRoomSnapshot.room.code === expectedRejoinCode?.toUpperCase() &&
    cachedRoomSnapshot.room.phase === 'finished' &&
    !!cachedRoomSnapshot.room.game;
  const room =
    serverRoom ?? (cachedRejoin ? (cachedRoomSnapshot?.room ?? null) : null);
  const selectedPlayer = room?.members.find(
    (member) => member.uid === selectedPlayerUid,
  );
  const ownerUid = room?.ownerUid !== undefined ? room.ownerUid : room?.host;
  useEffect(() => {
    kickConfirmation.current = null;
    setSelectedPlayerUid(null);
  }, [uid, epoch, active, room?.id, room?.matchId, ownerUid, room?.controller]);
  useEffect(() => {
    if (!selectedPlayer) {
      kickConfirmation.current = null;
      setSelectedPlayerUid(null);
    }
  }, [selectedPlayer]);
  useEffect(
    () => () => {
      kickConfirmation.current = null;
    },
    [],
  );
  const roomIdentity = room ? `${room.id}:${room.code}` : null;
  const previousRoomIdentity = useRef(roomIdentity);
  useEffect(() => {
    if (previousRoomIdentity.current === roomIdentity) return;
    previousRoomIdentity.current = roomIdentity;
    setRoomCodePopupVisible(false);
    setCopyNote(false);
  }, [roomIdentity]);
  const displayServerTime = cachedRejoin
    ? (cachedRoomSnapshot?.serverTime ?? currentServerTime)
    : currentServerTime;
  const playing = room?.phase === 'playing' && !!room.game;
  const tableVisible =
    room?.phase === 'lobby' || playing || room?.phase === 'finished';
  const rotationEnabled = tableVisible;
  const rejoiningRoom =
    !!route.params?.roomCode || roomRejoinPending || cachedRejoin;
  const gamePicker = !room && !rejoiningRoom && !createPending;
  const observedRoom = useRef<{
    id: string;
    phase: string;
    matchId: string | null;
  } | null>(null);
  const [dealAnimationKey, setDealAnimationKey] = useState<string | null>(null);
  const [resultAnimationKey, setResultAnimationKey] = useState<string | null>(
    null,
  );
  useEffect(() => {
    if (serverRoom) {
      setLastKnownRoom({ room: serverRoom, serverTime: currentServerTime });
      if (uid && state?.snapshot)
        void saveRoomSnapshot(uid, state.snapshot).catch(() => undefined);
    }
  }, [serverRoom, currentServerTime, state?.snapshot, uid]);
  const cacheRoomCode = route.params?.roomCode ?? rejoinCode;
  useEffect(() => {
    if (!uid || !cacheRoomCode) return;
    const inMemory = getCachedRoomSnapshot(uid, cacheRoomCode);
    if (inMemory?.room) {
      setLastKnownRoom({
        room: inMemory.room,
        serverTime: inMemory.serverTime,
      });
      return;
    }
    let current = true;
    void loadCachedRoomSnapshot(uid, cacheRoomCode).then((cached) => {
      if (current && cached?.room)
        setLastKnownRoom({ room: cached.room, serverTime: cached.serverTime });
    });
    return () => {
      current = false;
    };
  }, [cacheRoomCode, uid]);
  useEffect(() => {
    const previous = observedRoom.current;
    if (!serverRoom) {
      observedRoom.current = null;
      setDealAnimationKey(null);
      setResultAnimationKey(null);
      return;
    }

    const startsNextMatch =
      serverRoom.phase === 'playing' &&
      previous?.id === serverRoom.id &&
      (previous.phase === 'lobby' ||
        (previous.phase === 'finished' &&
          previous.matchId !== serverRoom.matchId));
    const announcesResult =
      serverRoom.phase === 'finished' &&
      serverRoom.game?.status === 'finished' &&
      previous?.id === serverRoom.id &&
      (previous.phase === 'playing' || previous.matchId !== serverRoom.matchId);
    if (announcesResult && serverRoom.matchId) {
      setResultAnimationKey(`${serverRoom.id}:${serverRoom.matchId}`);
    } else if (
      !previous ||
      previous.id !== serverRoom.id ||
      serverRoom.phase !== 'finished'
    ) {
      setResultAnimationKey(null);
    }
    if (startsNextMatch && serverRoom.matchId) {
      setDealAnimationKey(`${serverRoom.id}:${serverRoom.matchId}`);
    } else if (
      !previous ||
      previous.id !== serverRoom.id ||
      serverRoom.phase !== 'playing' ||
      previous.matchId !== serverRoom.matchId
    ) {
      setDealAnimationKey(null);
    }
    observedRoom.current = {
      id: serverRoom.id,
      phase: serverRoom.phase,
      matchId: serverRoom.matchId,
    };
  }, [serverRoom]);
  useCardGameOrientation(rotationEnabled, active);
  // Shared scores are recorded atomically by the server room trigger. Creating
  // device-only sheets here would duplicate the canonical board on return.

  const connecting =
    connectRequested &&
    !!queuedRoomIntent &&
    !sessionInitializationError &&
    !state?.error &&
    (!state?.connected || !!state?.loading);
  const blocked =
    !active ||
    leavingRoom ||
    (!!room && !!state?.loading) ||
    (connectRequested && !state?.connected) ||
    !!state?.busy ||
    !!state?.pending ||
    room?.controller === false;
  const backBlocked =
    !!room && !cachedRejoin && !!state?.loading && !state?.error;
  const liveKickContext = useRef({
    uid,
    epoch,
    room,
    active,
    blocked,
    cachedRejoin,
    selectedPlayerUid,
    session,
  });
  liveKickContext.current = {
    uid,
    epoch,
    room,
    active,
    blocked,
    cachedRejoin,
    selectedPlayerUid,
    session,
  };
  const closePlayer = () => {
    kickConfirmation.current = null;
    setSelectedPlayerUid(null);
  };
  const confirmKick = () => {
    if (
      !room ||
      !selectedPlayer ||
      ownerUid !== uid ||
      selectedPlayer.uid === uid ||
      blocked ||
      cachedRejoin
    )
      return;
    const targetUid = selectedPlayer.uid;
    const roomId = room.id,
      matchId = room.matchId;
    const confirmation = Symbol();
    kickConfirmation.current = confirmation;
    Alert.alert(
      'Kích người chơi?',
      `Mời ${selectedPlayer.name} ra khỏi phòng? Nếu đang chơi, người này được tính là bỏ cuộc.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Kích người chơi',
          style: 'destructive',
          onPress: () => {
            const current = liveKickContext.current;
            const auth = useAuthStore.getState();
            if (
              kickConfirmation.current !== confirmation ||
              auth.user?.uid !== uid ||
              auth.sessionEpoch !== epoch ||
              current.uid !== uid ||
              current.epoch !== epoch ||
              !current.active ||
              current.blocked ||
              current.cachedRejoin ||
              current.selectedPlayerUid !== targetUid ||
              current.room?.id !== roomId ||
              current.room.matchId !== matchId ||
              (current.room.ownerUid !== undefined
                ? current.room.ownerUid
                : current.room.host) !== uid ||
              !current.room.controller ||
              !current.room.members.some((member) => member.uid === targetUid)
            )
              return;
            closePlayer();
            void current.session?.send({ type: 'kick', targetUid });
          },
        },
      ],
    );
  };
  useEffect(() => {
    setCode('');
    setRules(false);
  }, [user?.uid, user?.displayName]);
  useEffect(() => {
    setSelectedGame(null);
    setConnectRequested(false);
    setCreatePending(false);
    setQueuedRoomIntent(null);
    setRoomEntryMode('create');
  }, [user?.uid]);
  useEffect(() => {
    const roomCode = route.params?.roomCode;
    if (!uid || !roomCode) return;
    setRoomRejoinPending(true);
    setRejoinCode(roomCode);
    setSelectedGame('south');
    setRoomEntryMode('join');
    setCode(roomCode);
    setQueuedRoomIntent({
      type: 'join',
      code: roomCode,
      name: playerName,
    });
    setConnectRequested(true);
    navigation.setParams({ roomCode: undefined });
  }, [navigation, route.params?.roomCode, uid, playerName]);
  useEffect(() => {
    if (
      serverRoom ||
      sessionInitializationError ||
      state?.error ||
      state?.pending
    ) {
      setRoomRejoinPending(false);
    }
    if (sessionInitializationError || state?.error) setRejoinCode(null);
  }, [serverRoom, sessionInitializationError, state?.error, state?.pending]);
  useEffect(() => {
    if (serverRoom) {
      setCreatePending(false);
      return;
    }
    if (
      sessionInitializationError ||
      (state?.error && !state.busy && !queuedRoomIntent) ||
      (state?.pending && !queuedRoomIntent)
    ) {
      setCreatePending(false);
    }
  }, [serverRoom, sessionInitializationError, state, queuedRoomIntent]);
  useEffect(() => {
    if (!active) setRules(false);
  }, [active]);
  const send = (intent: GameIntent) => {
    Keyboard.dismiss();
    void session?.send(intent);
  };
  const transferOwner = () => {
    if (
      !room ||
      (room.ownerUid !== undefined ? room.ownerUid : room.host) !== uid
    )
      return;
    const targets = room.members.filter((member) => member.uid !== uid);
    if (!targets.length) return;
    Alert.alert('Chuyển chủ phòng', 'Chọn người chơi sẽ quản lý phòng này.', [
      ...targets.map((member) => ({
        text: member.name,
        onPress: () => send({ type: 'transfer-owner', targetUid: member.uid }),
      })),
      { text: 'Hủy', style: 'cancel' },
    ]);
  };
  const startRoomAction = (intent: GameIntent) => {
    if (
      intent.type === 'join' &&
      room?.code === intent.code.toUpperCase() &&
      room.members.length >= 4 &&
      !room.members.some((member) => member.uid === uid)
    ) {
      Alert.alert(
        'Không thể vào phòng',
        'Phòng đã đủ người chơi, vui lòng chọn phòng khác.',
      );
      return;
    }
    Keyboard.dismiss();
    if (intent.type === 'create') setCreatePending(true);
    setQueuedRoomIntent(intent);
    setConnectRequested(true);
  };
  const copyRoomCode = () => {
    if (!room) return;
    void Clipboard.setStringAsync(room.code)
      .then(() => setCopyNote(true))
      .catch(() => setCopyNote(false));
  };
  useEffect(() => {
    if (!queuedRoomIntent || !session || !state?.connected || state?.loading)
      return;
    if (state.snapshot?.removal && roomRejoinPending && !removalWasHandled)
      return;
    setQueuedRoomIntent(null);
    if (!serverRoom) void session.send(queuedRoomIntent);
  }, [
    queuedRoomIntent,
    serverRoom,
    session,
    state?.connected,
    state?.loading,
    state?.snapshot?.removal,
    roomRejoinPending,
    removalWasHandled,
  ]);
  useEffect(() => {
    const removal = state?.snapshot?.removal;
    if (!uid || !active || !removal) return;
    const key = `${uid}:${removal.id}`;
    if (seenRemovals.has(key)) return;
    seenRemovals.add(key);
    if (seenRemovals.size > 64)
      seenRemovals.delete(seenRemovals.values().next().value!);
    setLastKnownRoom(null);
    setRejoinCode(null);
    setRoomRejoinPending(false);
    setQueuedRoomIntent(null);
    setCreatePending(false);
    setSelectedPlayerUid(null);
    navigation.setParams({ roomCode: undefined });
    void clearCachedRoomSnapshot(uid).catch(() => undefined);
    Alert.alert('Thông báo', 'Bạn đã bị chủ phòng mời ra khỏi phòng.');
  }, [uid, active, state?.snapshot?.removal, navigation]);
  const returnToCardScore = useCallback(() => {
    setLastKnownRoom(null);
    setRejoinCode(null);
    setRoomRejoinPending(false);
    setQueuedRoomIntent(null);
    setConnectRequested(false);
    setLeavingRoom(false);
    navigation.navigate('CardScore');
  }, [navigation]);
  const handleBack = useCallback(() => {
    if (backBlocked) return;
    if (room && cachedRejoin) {
      returnToCardScore();
      return;
    }
    if (!room) {
      navigation.navigate(
        rejoiningRoom || createPending ? 'CardScore' : 'Home',
      );
      return;
    }
    if (state?.loading && state.error) {
      Alert.alert(
        'Quay lại màn trước?',
        'Chưa kết nối lại được phòng. Quay lại lúc này chưa xác nhận rời phòng; bạn có thể vào lại sau.',
        [
          { text: 'Ở lại', style: 'cancel' },
          { text: 'Quay lại', onPress: returnToCardScore },
        ],
      );
      return;
    }
    Alert.alert(
      playing ? 'Rời ván đang chơi?' : 'Rời phòng?',
      playing
        ? 'Bạn sẽ bỏ cuộc và xếp sau những người còn chơi.'
        : 'Bạn có thể vào lại bằng mã nếu phòng còn chỗ.',
      [
        { text: 'Ở lại', style: 'cancel' },
        {
          text: 'Rời phòng',
          style: 'destructive',
          onPress: () => {
            setLeavingRoom(true);
            void Promise.resolve(session?.send({ type: 'leave' })).finally(
              returnToCardScore,
            );
          },
        },
      ],
    );
  }, [
    backBlocked,
    room,
    cachedRejoin,
    rejoiningRoom,
    createPending,
    navigation,
    state?.loading,
    state?.error,
    playing,
    session,
    returnToCardScore,
  ]);
  useEffect(() => {
    if (!active || Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        handleBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, [active, handleBack]);
  const gameHeader = (
    <View
      style={[
        styles.header,
        playing && styles.playingHeader,
        playing && landscape && styles.landscapeHeader,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quay lại Trò chơi & điểm số"
        disabled={backBlocked}
        accessibilityState={{
          disabled: backBlocked,
        }}
        hitSlop={playing && landscape ? 6 : undefined}
        style={[
          styles.iconButton,
          playing && landscape && styles.landscapeIconButton,
        ]}
        onPress={handleBack}
      >
        <Feather name="arrow-left" size={22} color={colors.earth} />
      </Pressable>
      <View style={styles.headerCopy}>
        <Text
          accessibilityRole="header"
          style={[styles.title, playing && landscape && styles.landscapeTitle]}
        >
          Tiến lên miền Nam
        </Text>
        {room && !state?.connected && (
          <View
            style={[
              styles.status,
              playing && landscape && styles.landscapeStatus,
            ]}
          >
            <View
              style={[styles.dot, !state?.connected && styles.reconnecting]}
            />
            <Text
              style={[
                styles.subtitle,
                playing && landscape && styles.landscapeSubtitle,
              ]}
            >
              Đang nối lại…
            </Text>
          </View>
        )}
      </View>
      {room && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={room ? 'Mã phòng' : 'Xem luật chơi'}
          hitSlop={playing && landscape ? 6 : undefined}
          style={[
            styles.iconButton,
            playing && landscape && styles.landscapeIconButton,
          ]}
          onPress={() => {
            if (!room) {
              setRules(true);
              return;
            }
            setCopyNote(false);
            setRoomCodePopupVisible(true);
          }}
        >
          <Feather name="help-circle" size={22} color={colors.earth} />
        </Pressable>
      )}
    </View>
  );
  const header = gamePicker ? (
    <CardHubHeader onBack={() => navigation.navigate('Home')} />
  ) : (
    gameHeader
  );
  const errorMessage =
    sessionInitializationError ??
    (state && (state.error || state.pending)
      ? (state.error ??
        'Thao tác trước chưa được xác nhận. Hãy kiểm tra lại để tiếp tục.')
      : null);
  const error = errorMessage ? (
    <View
      style={[
        styles.errorBox,
        playing && landscape && styles.landscapeErrorBox,
      ]}
    >
      <Text
        accessibilityRole="alert"
        style={[
          styles.error,
          playing && landscape && styles.landscapeErrorText,
        ]}
      >
        {errorMessage}
      </Text>
      <View
        style={playing && landscape ? styles.landscapeErrorAction : undefined}
      >
        <Button
          compact
          variant="secondary"
          title={
            sessionInitializationError
              ? 'Thử lại'
              : state?.pending
                ? 'Kiểm tra lại thao tác'
                : 'Kết nối lại'
          }
          loading={!!state?.busy}
          onPress={() =>
            sessionInitializationError
              ? retrySessionInitialization()
              : void session?.retry()
          }
        />
      </View>
    </View>
  ) : null;

  return (
    <NativeScreen activityState={2} style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Screen
          scrollRef={scrollRef}
          fixedHeader={header}
          fixedHeaderStyle={
            gamePicker
              ? cardHubStyles.fixedHeader
              : tableVisible && landscape
                ? styles.landscapeFixedHeader
                : undefined
          }
          fixedContent={
            gamePicker ? (
              <CardHubModeTabs
                active="online"
                onlineEnabled={enabled}
                onSelectScore={() => navigation.navigate('CardScore')}
                onSelectOnline={() => undefined}
              />
            ) : undefined
          }
          fixedContentStyle={gamePicker ? cardHubStyles.fixedModes : undefined}
          scrollable={!tableVisible}
          contentStyle={
            tableVisible
              ? [
                  styles.tableContent,
                  landscape && styles.landscapeTableContent,
                  { paddingBottom: Math.max(insets.bottom, 12) },
                ]
              : [styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]
          }
        >
          {!enabled ? (
            <View style={styles.section}>
              <Text style={styles.heading}>
                Phòng online đang được chuẩn bị
              </Text>
              <Text style={styles.body}>
                Bạn vẫn có thể dùng bảng điểm cho các ván chơi cùng nhau.
              </Text>
              <Button
                title="Về bảng điểm"
                onPress={() => navigation.navigate('CardScore')}
              />
            </View>
          ) : createPending && !room ? (
            <>
              {error}
              <CardGameLobbyTable
                room={null}
                uid={uid ?? ''}
                playerName={playerName}
                controller
                disabled
                busy
                onAction={() => undefined}
              />
            </>
          ) : rejoiningRoom && !room ? (
            <>
              {error}
              <CardGameLobbyTable
                room={null}
                uid={uid ?? ''}
                playerName={playerName}
                controller
                disabled
                busy
                onAction={() => undefined}
              />
            </>
          ) : !room ? (
            <>
              {error}
              <View style={styles.section}>
                <View style={styles.introCopy}>
                  <Text style={styles.heading}>Chơi cùng bạn bè</Text>
                  <Text style={styles.body}>
                    Tạo phòng mới hoặc vào phòng bằng mã.
                  </Text>
                </View>
                <View
                  style={[
                    styles.gameCard,
                    selectedGame === 'south' && styles.gameCardSelected,
                  ]}
                >
                  <View style={styles.gameCardHeader}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Chọn Tiến lên miền Nam"
                      accessibilityState={{
                        expanded: selectedGame === 'south',
                      }}
                      onPress={() => {
                        if (selectedGame === 'south') {
                          setSelectedGame(null);
                          setCode('');
                          setConnectRequested(false);
                          setQueuedRoomIntent(null);
                        } else {
                          setCode('');
                          setRoomEntryMode('create');
                          setSelectedGame('south');
                        }
                      }}
                      style={({ pressed }) => [
                        styles.gameOption,
                        pressed && styles.gameOptionPressed,
                      ]}
                    >
                      <View style={styles.gameOptionIcon}>
                        <Feather name="layers" size={18} color={colors.earth} />
                      </View>
                      <View style={styles.grow}>
                        <Text style={styles.name}>Tiến lên miền Nam</Text>
                        <Text style={styles.gameMeta}>
                          2–4 người · Chơi theo lượt
                        </Text>
                      </View>
                      <Feather
                        name={
                          selectedGame === 'south'
                            ? 'chevron-up'
                            : 'chevron-down'
                        }
                        size={18}
                        color={colors.muted}
                      />
                    </Pressable>
                    {selectedGame === 'south' && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Xem luật chơi"
                        style={styles.gameExpansionRules}
                        onPress={() => setRules(true)}
                      >
                        <Feather
                          name="book-open"
                          size={16}
                          color={colors.earth}
                        />
                      </Pressable>
                    )}
                  </View>
                  {selectedGame === 'south' && (
                    <View style={styles.gameExpansion}>
                      <View style={styles.entryModes}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Tạo phòng mới"
                          accessibilityState={{
                            selected: roomEntryMode === 'create',
                          }}
                          onPress={() => setRoomEntryMode('create')}
                          style={[
                            styles.entryMode,
                            roomEntryMode === 'create' &&
                              styles.entryModeSelected,
                          ]}
                        >
                          <Feather
                            name="plus"
                            size={15}
                            color={
                              roomEntryMode === 'create'
                                ? colors.earth
                                : colors.muted
                            }
                          />
                          <Text
                            style={[
                              styles.entryModeTitle,
                              roomEntryMode === 'create' &&
                                styles.entryModeTitleSelected,
                            ]}
                          >
                            Tạo mới
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Vào phòng có sẵn"
                          accessibilityState={{
                            selected: roomEntryMode === 'join',
                          }}
                          onPress={() => setRoomEntryMode('join')}
                          style={[
                            styles.entryMode,
                            roomEntryMode === 'join' &&
                              styles.entryModeSelected,
                          ]}
                        >
                          <Feather
                            name="log-in"
                            size={15}
                            color={
                              roomEntryMode === 'join'
                                ? colors.earth
                                : colors.muted
                            }
                          />
                          <Text
                            style={[
                              styles.entryModeTitle,
                              roomEntryMode === 'join' &&
                                styles.entryModeTitleSelected,
                            ]}
                          >
                            Tham gia
                          </Text>
                        </Pressable>
                      </View>
                      {roomEntryMode === 'create' && (
                        <View style={styles.rateCard}>
                          <View style={styles.rateCopy}>
                            <Text style={styles.formLabel}>
                              Mức phạt mỗi lá
                            </Text>
                            <Text style={styles.rateHint}>
                              Người nhất nhận tiền phạt của người còn bài.
                            </Text>
                          </View>
                          <View style={styles.rateInputRow}>
                            <AppTextInput
                              accessibilityLabel="Số tiền trừ cho mỗi lá còn lại"
                              value={amountPerCard}
                              onChangeText={(value) =>
                                setAmountPerCard(
                                  value.replace(/\D/g, '').slice(0, 10),
                                )
                              }
                              keyboardType="number-pad"
                              editable={!state?.busy}
                              placeholder="1"
                              style={[styles.input, styles.rateInput]}
                            />
                            <Text style={styles.rateUnit}>đ/lá</Text>
                          </View>
                        </View>
                      )}
                      {roomEntryMode === 'join' && (
                        <>
                          <Text style={styles.formLabel}>Mã phòng</Text>
                          <AppTextInput
                            accessibilityLabel="Mã phòng"
                            value={code}
                            onChangeText={(v) =>
                              setCode(
                                v.toUpperCase().replace(/\s/g, '').slice(0, 8),
                              )
                            }
                            autoCapitalize="characters"
                            autoCorrect={false}
                            maxLength={8}
                            editable={!state?.busy}
                            placeholder="Nhập mã phòng 8 ký tự"
                            placeholderTextColor={colors.muted}
                            style={[styles.input, styles.codeInput]}
                            returnKeyType="go"
                            onFocus={() => {
                              codeInputFocused.current = true;
                              if (Platform.OS === 'ios') {
                                setTimeout(
                                  () =>
                                    scrollRef.current?.scrollToEnd({
                                      animated: true,
                                    }),
                                  250,
                                );
                              }
                            }}
                            onBlur={() => {
                              codeInputFocused.current = false;
                            }}
                            onSubmitEditing={() => {
                              if (code.length === 8 && !blocked)
                                startRoomAction({
                                  type: 'join',
                                  name: playerName,
                                  code,
                                });
                            }}
                          />
                        </>
                      )}
                      <Button
                        title={
                          roomEntryMode === 'create' ? 'Tạo phòng' : 'Vào phòng'
                        }
                        variant={
                          roomEntryMode === 'create' ? 'primary' : 'secondary'
                        }
                        loading={connecting || state?.busy}
                        disabled={
                          blocked ||
                          (roomEntryMode === 'create' &&
                            (!Number.isSafeInteger(Number(amountPerCard)) ||
                              Number(amountPerCard) < 1 ||
                              Number(amountPerCard) > 1_000_000_000)) ||
                          (roomEntryMode === 'join' && code.length !== 8)
                        }
                        onPress={() => {
                          if (roomEntryMode === 'create')
                            startRoomAction({
                              type: 'create',
                              name: playerName,
                              game: 'south',
                              amountPerCard: Number(amountPerCard),
                            });
                          else
                            startRoomAction({
                              type: 'join',
                              name: playerName,
                              code,
                            });
                        }}
                      />
                    </View>
                  )}
                </View>
                <View style={styles.comingList}>
                  <View style={styles.comingRow}>
                    <Feather name="layers" size={16} color={colors.muted} />
                    <Text style={[styles.grow, styles.comingName]}>
                      Tiến lên miền Bắc
                    </Text>
                    <Text style={styles.gameComing}>Sắp ra mắt</Text>
                  </View>
                  <View style={styles.comingDivider} />
                  <View style={styles.comingRow}>
                    <Feather name="grid" size={16} color={colors.muted} />
                    <Text style={[styles.grow, styles.comingName]}>Phỏm</Text>
                    <Text style={styles.gameComing}>Sắp ra mắt</Text>
                  </View>
                </View>
              </View>
            </>
          ) : tableVisible ? (
            <>
              {error}
              {!room.controller && room.phase !== 'lobby' && (
                <View
                  style={[
                    styles.errorBox,
                    landscape && styles.landscapeErrorBox,
                  ]}
                >
                  <Text
                    style={[
                      styles.error,
                      landscape && styles.landscapeErrorText,
                    ]}
                  >
                    Bàn này đang được mở trên thiết bị khác.
                  </Text>
                  <View
                    style={landscape ? styles.landscapeErrorAction : undefined}
                  >
                    <Button
                      compact
                      title="Chơi trên thiết bị này"
                      onPress={() => send({ type: 'takeover' })}
                    />
                  </View>
                </View>
              )}
              {room.phase === 'lobby' ||
              (room.phase === 'finished' && !room.game) ? (
                <CardGameLobbyTable
                  room={room}
                  uid={uid!}
                  controller={room.controller}
                  disabled={
                    room.controller
                      ? blocked || cachedRejoin
                      : !active ||
                        leavingRoom ||
                        !!state?.busy ||
                        !!state?.pending
                  }
                  busy={(!leavingRoom && !!state?.busy) || cachedRejoin}
                  onAction={send}
                  onPlayerPress={setSelectedPlayerUid}
                />
              ) : (
                <CardGameTable
                  room={room}
                  uid={uid!}
                  serverTime={displayServerTime}
                  active={active}
                  disabled={blocked || cachedRejoin}
                  busy={(!leavingRoom && !!state?.busy) || cachedRejoin}
                  dealAnimationKey={dealAnimationKey}
                  resultAnimationKey={resultAnimationKey}
                  onAction={send}
                  onPlayerPress={setSelectedPlayerUid}
                />
              )}
            </>
          ) : (
            <>
              {error}
              <View style={[styles.section, styles.roomInfoSection]}>
                <View style={styles.row}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Sao chép mã phòng"
                    style={styles.codeButton}
                    onPress={copyRoomCode}
                  >
                    <Text style={styles.eyebrow}>MÃ PHÒNG</Text>
                    <Text style={styles.code}>{room.code}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Chia sẻ mã phòng"
                    style={styles.iconButton}
                    onPress={() =>
                      void Share.share({
                        message: `Vào LifeMate → Trò chơi & điểm số → Chơi online → Tiến lên miền Nam, nhập mã ${room.code} để chơi cùng mình nhé!`,
                      }).catch(() => undefined)
                    }
                  >
                    <Feather name="share-2" size={21} color={colors.earth} />
                  </Pressable>
                </View>
                {copyNote && (
                  <Text accessibilityLiveRegion="polite" style={styles.ready}>
                    Đã sao chép mã phòng
                  </Text>
                )}
                <Text style={styles.body}>
                  2–4 người · {room.amountPerCard ?? 0} đ/lá còn · 40 giây/lượt
                </Text>
              </View>
              {!!room.game?.result && (
                <View style={styles.section}>
                  <Text style={styles.heading}>
                    {reasons[room.game.result.reason] ?? 'Kết quả ván'}
                  </Text>
                  {room.game.result.ranking.map((p) => (
                    <View key={p.uid} style={styles.resultRow}>
                      <Text style={styles.rank}>#{p.rank}</Text>
                      <View style={styles.grow}>
                        <Text style={styles.name}>
                          {p.name ??
                            room.members.find((m) => m.uid === p.uid)?.name ??
                            'Người chơi đã rời'}
                          {p.uid === uid ? ' (Bạn)' : ''}
                        </Text>
                        <Text style={styles.subtitle}>
                          {p.labels.map((l) => labels[l] ?? l).join(' · ')}
                        </Text>
                        <Text
                          style={[
                            styles.subtitle,
                            (p.moneyDelta ?? 0) > 0 && styles.ready,
                            (p.moneyDelta ?? 0) < 0 && styles.error,
                          ]}
                        >
                          {(p.moneyDelta ?? 0) > 0 ? '+' : ''}
                          {(p.moneyDelta ?? 0).toLocaleString('vi-VN')} đ
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
              <View style={[styles.section, styles.lobbySection]}>
                <View style={styles.lobbyHeading}>
                  <Text style={styles.lobbyTitle}>Người chơi</Text>
                  <Text style={styles.playerCount}>
                    {room.members.length}/4
                  </Text>
                </View>
                {room.members.map((p) => (
                  <Pressable
                    key={p.uid}
                    style={styles.seat}
                    accessibilityRole="button"
                    accessibilityLabel={`Thông tin người chơi ${p.name}`}
                    onPress={() => setSelectedPlayerUid(p.uid)}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {p.name.slice(0, 1).toUpperCase()}
                      </Text>
                      <CardGameAvatarImage
                        uid={p.uid}
                        url={p.avatarUrl}
                        name={p.name}
                        size={36}
                      />
                    </View>
                    <View style={styles.grow}>
                      <Text style={styles.name}>
                        {p.name}
                        {p.uid === uid ? ' (Bạn)' : ''}
                      </Text>
                      <Text
                        style={
                          p.uid !==
                            (room.ownerUid !== undefined
                              ? room.ownerUid
                              : room.host) && p.ready
                            ? styles.ready
                            : styles.subtitle
                        }
                      >
                        {p.uid ===
                        (room.ownerUid !== undefined
                          ? room.ownerUid
                          : room.host)
                          ? 'Chủ phòng'
                          : p.ready
                            ? 'Đã sẵn sàng'
                            : 'Đang chờ'}
                      </Text>
                    </View>
                  </Pressable>
                ))}
                {room.members.length < 4 && (
                  <View style={styles.emptySeat}>
                    <Text style={styles.lobbyHint}>
                      Gửi mã phòng để mời thêm người
                    </Text>
                  </View>
                )}
                {!room.controller ? (
                  <Button
                    title="Chơi trên thiết bị này"
                    onPress={() => send({ type: 'takeover' })}
                  />
                ) : (
                  <>
                    {room.host === uid ? (
                      <Button
                        compact
                        title="Bắt đầu ván"
                        loading={state?.busy}
                        disabled={
                          blocked ||
                          room.members.length < 2 ||
                          room.members.some(
                            (player) =>
                              player.uid !== room.host && !player.ready,
                          )
                        }
                        onPress={() => send({ type: 'start' })}
                      />
                    ) : (
                      <Button
                        compact
                        variant={
                          room.members.find((player) => player.uid === uid)
                            ?.ready
                            ? 'secondary'
                            : 'primary'
                        }
                        title={
                          room.members.find((player) => player.uid === uid)
                            ?.ready
                            ? 'Bỏ sẵn sàng'
                            : 'Sẵn sàng'
                        }
                        loading={state?.busy}
                        disabled={blocked}
                        onPress={() => {
                          const isReady = room.members.find(
                            (player) => player.uid === uid,
                          )?.ready;
                          send({ type: 'ready', ready: !isReady });
                        }}
                      />
                    )}
                  </>
                )}
              </View>
            </>
          )}
        </Screen>
        <CardGameRules
          visible={rules && active}
          onClose={() => setRules(false)}
        />
        <DialogModal
          supportedOrientations={[
            'portrait',
            'landscape-left',
            'landscape-right',
          ]}
          visible={roomCodePopupVisible && !!room}
          onRequestClose={() => setRoomCodePopupVisible(false)}
          onBackdropPress={() => setRoomCodePopupVisible(false)}
          style={styles.roomCodeDialog}
        >
          <View style={styles.roomCodeHeading}>
            <View style={styles.roomCodeIcon}>
              <Feather name="hash" size={19} color={colors.earth} />
            </View>
            <View style={styles.grow}>
              <Text accessibilityRole="header" style={styles.roomCodeTitle}>
                Mã phòng
              </Text>
              <Text style={styles.roomCodeHint}>
                Chia sẻ mã này để bạn bè vào bàn
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng mã phòng"
              hitSlop={8}
              style={styles.roomCodeClose}
              onPress={() => setRoomCodePopupVisible(false)}
            >
              <Feather name="x" size={19} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView
            testID="room-code-scroll"
            style={styles.roomCodeScroll}
            contentContainerStyle={styles.roomCodeContent}
          >
            <View style={styles.roomCodeDisplay}>
              <Text style={styles.roomCodeLabel}>MÃ PHÒNG</Text>
              <Text
                testID="room-code-popup-value"
                selectable
                style={styles.roomCodeValue}
              >
                {room?.code}
              </Text>
            </View>
            {copyNote && (
              <View
                accessibilityLiveRegion="polite"
                style={styles.roomCodeCopied}
              >
                <Feather name="check-circle" size={13} color={colors.success} />
                <Text style={styles.ready}>Đã sao chép mã phòng</Text>
              </View>
            )}
            <Button title="Sao chép mã" onPress={copyRoomCode} />
            {(room?.ownerUid !== undefined ? room.ownerUid : room?.host) ===
              uid &&
              room?.members.some((member) => member.uid !== uid) && (
                <Button
                  compact
                  variant="secondary"
                  title="Chuyển chủ phòng"
                  onPress={() => {
                    setRoomCodePopupVisible(false);
                    transferOwner();
                  }}
                />
              )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Xem luật chơi"
              style={styles.roomCodeRulesButton}
              onPress={() => {
                setRoomCodePopupVisible(false);
                setRules(true);
              }}
            >
              <Feather name="book-open" size={16} color={colors.earth} />
              <Text style={styles.roomCodeRulesText}>Xem luật chơi</Text>
              <Feather name="arrow-right" size={15} color={colors.muted} />
            </Pressable>
          </ScrollView>
        </DialogModal>
      </KeyboardAvoidingView>
      {selectedPlayer && active && (
        <CardGamePlayerDialog
          member={selectedPlayer}
          owner={selectedPlayer.uid === ownerUid}
          self={selectedPlayer.uid === uid}
          canKick={
            ownerUid === uid &&
            selectedPlayer.uid !== uid &&
            !!room?.controller &&
            !cachedRejoin
          }
          busy={blocked}
          onClose={closePlayer}
          onKick={confirmKick}
        />
      )}
    </NativeScreen>
  );
}
