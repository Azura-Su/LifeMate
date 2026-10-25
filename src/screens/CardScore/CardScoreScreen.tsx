import Feather from '@expo/vector-icons/Feather';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { randomUUID } from 'expo-crypto';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { useAuthStore } from '../../store/authStore';
import {
  hasOnlineGameAccess,
  useOnlineGameAccess,
} from '../../hooks/useOnlineGameAccess';
import type { MainTabParams } from '../../navigation/types';
import {
  createCardScoreMatch,
  deleteCardScoreMatch,
  readCardScoreMatches,
  updateCardScoreMatch,
  setCardScoreLocalFinished,
} from '../../services/cardScore/cardScoreStorage';
import { colors } from '../../theme';
import { gameRequest } from '../../services/cardGames/gameApi';
import { getGameDeviceSessionId } from '../../services/cardGames/gameDeviceSession';
import { cardGamesEnabled } from '../../config/cardGames';
import type {
  CardScoreMatch,
  CardScorePlayer,
  CardScoreRound,
} from '../../types/cardScore';
import type { GameRoomStatus } from '../../types/cardGame';
import {
  calculatePlayerTotals,
  drawCardScoreSeats,
  MIN_CARD_SCORE_PLAYERS,
  SHARED_CARD_SCORE_PLAYER_RULES,
  validatePlayerNames,
  validateRoundScores,
} from '../../utils/cardScore';
import { CardScoreFinishDialog } from './CardScoreFinishDialog';
import { CardHubHeader, CardHubModeTabs } from './CardHubChrome';
import { CardScoreManagePlayersDialog } from './CardScoreManagePlayersDialog';
import { CardScoreRoundDialog } from './CardScoreRoundDialog';
import { CardScoreSetupDialog } from './CardScoreSetupDialog';
import { CardScoreTable } from './CardScoreTable';
import { styles } from './CardScoreScreen.styles';
import { useSharedCardScores } from './useSharedCardScores';
import { useScoreRoomStatuses } from './useScoreRoomStatuses';
import { CardScoreAuditDialog } from './CardScoreAuditDialog';
import { CardScoreHistoryCard } from './CardScoreHistoryCard';
import { CardScoreRoomActions } from './CardScoreRoomActions';
import { CardScoreSyncNotice } from './CardScoreSyncNotice';

const formatDate = (timestamp: number) =>
  new Intl.DateTimeFormat('vi-VN', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);

export function CardScoreScreen({
  navigation,
}: BottomTabScreenProps<MainTabParams, 'CardScore'>) {
  const uid = useAuthStore((state) => state.user?.uid);
  const displayName = useAuthStore((state) => state.user?.displayName);
  const sessionEpoch = useAuthStore((state) => state.sessionEpoch);
  const onlineGameAccess = useOnlineGameAccess();
  const isCurrentSession = () => {
    const live = useAuthStore.getState();
    return live.user?.uid === uid && live.sessionEpoch === sessionEpoch;
  };
  const [matches, setMatches] = useState<CardScoreMatch[]>([]);
  const [loadedUid, setLoadedUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const refreshToken = useRef<symbol | null>(null);
  const [busy, setBusy] = useState(false);
  // Alert callbacks capture stale state, so they read the live flag instead.
  const busyRef = useRef(false);
  const roomEntryRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!onlineGameAccess) roomEntryRequest.current?.abort();
  }, [onlineGameAccess]);
  const markBusy = (value: boolean) => {
    busyRef.current = value;
    setBusy(value);
  };
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(
    null,
  );
  const [setupVisible, setSetupVisible] = useState(false);
  const [managePlayersVisible, setManagePlayersVisible] = useState(false);
  const [managedPlayers, setManagedPlayers] = useState<CardScorePlayer[]>([]);
  const [managedNewPlayerName, setManagedNewPlayerName] = useState('');
  const [managePlayersError, setManagePlayersError] = useState<string | null>(
    null,
  );
  const [matchTitle, setMatchTitle] = useState('');
  const [playerNames, setPlayerNames] = useState(['', '', '', '']);
  const [drawnSeats, setDrawnSeats] = useState<string[] | null>(null);
  const [roundVisible, setRoundVisible] = useState(false);
  const [finishDialogVisible, setFinishDialogVisible] = useState(false);
  const [finishLocally, setFinishLocally] = useState(false);
  const finishCommit = useRef<{ matchId: string; apply: () => void } | null>(
    null,
  );
  const finishCommitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (finishCommitTimer.current) clearTimeout(finishCommitTimer.current);
      finishCommitTimer.current = null;
      finishCommit.current = null;
    },
    [uid, sessionEpoch],
  );
  const finishSession = useRef<{
    uid: string | undefined;
    epoch: number;
  } | null>(null);
  const [editingRound, setEditingRound] = useState<CardScoreRound | null>(null);
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({});
  const [editorMatch, setEditorMatch] = useState<CardScoreMatch | null>(null);
  const [auditSelection, setAuditSelection] = useState<{
    match: CardScoreMatch;
    uid: string;
    epoch: number;
  } | null>(null);
  const auditMatch =
    auditSelection !== null &&
    auditSelection.uid === uid &&
    auditSelection.epoch === sessionEpoch
      ? auditSelection.match
      : null;
  const showAudit = (match: CardScoreMatch) => {
    if (uid && isCurrentSession())
      setAuditSelection({ match, uid, epoch: sessionEpoch });
  };
  const shared = useSharedCardScores(
    uid,
    sessionEpoch,
    reloadKey,
    navigation,
    setMatches,
    cardGamesEnabled(),
  );

  useEffect(() => {
    if (!uid) {
      setMatches([]);
      setLoadedUid(null);
      setLoading(false);
      return;
    }
    let current = true;
    setMatches([]);
    setLoadedUid(null);
    setSelectedMatchId(null);
    setLoading(true);
    setError(null);
    void readCardScoreMatches(uid, { includeDeleted: true })
      .then((stored) => {
        if (current) {
          setMatches(stored);
          setLoadedUid(uid);
        }
      })
      .catch((cause) => {
        if (current)
          setError(
            (cause as Error).message || 'Chưa đọc được lịch sử ghi điểm.',
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [uid, sessionEpoch, reloadKey]);

  useEffect(() => {
    refreshToken.current = null;
    setRefreshing(false);
    setEditorMatch(null);
    setAuditSelection(null);
    setRoundVisible(false);
    setManagePlayersVisible(false);
    setFinishDialogVisible(false);
    setSetupVisible(false);
    busyRef.current = false;
    setBusy(false);
  }, [uid, sessionEpoch]);

  useEffect(
    () => navigation.addListener('focus', () => setReloadKey((key) => key + 1)),
    [navigation],
  );

  useEffect(() => {
    const cancel = () => {
      roomEntryRequest.current?.abort();
      refreshToken.current = null;
      setRefreshing(false);
    };
    const offBlur = navigation.addListener('blur', cancel);
    return () => {
      cancel();
      offBlur();
    };
  }, [navigation, uid, sessionEpoch]);

  async function refreshScores() {
    if (
      !uid ||
      !isCurrentSession() ||
      loading ||
      busyRef.current ||
      refreshToken.current
    )
      return;
    const token = Symbol();
    refreshToken.current = token;
    setRefreshing(true);
    try {
      await shared.retry();
      if (!isCurrentSession() || refreshToken.current !== token) return;
      const stored = await readCardScoreMatches(uid, { includeDeleted: true });
      if (!isCurrentSession() || refreshToken.current !== token) return;
      setMatches(stored);
      setLoadedUid(uid);
      setError(null);
    } catch (cause) {
      if (isCurrentSession() && refreshToken.current === token)
        setError((cause as Error).message || 'Chưa tải lại được bảng điểm.');
    } finally {
      if (refreshToken.current === token) {
        refreshToken.current = null;
        setRefreshing(false);
      }
    }
  }

  const accountMatches = useMemo(
    () =>
      loadedUid === uid ? matches.filter((match) => !match.deletedAt) : [],
    [loadedUid, matches, uid],
  );
  const loadFailed = !loading && !!uid && loadedUid !== uid;
  const activeMatches = useMemo(
    () =>
      accountMatches.filter(
        (match) =>
          match.status === 'active' &&
          !match.localFinished &&
          (!match.onlineRoomId ||
            !!match.sharedVersion ||
            match.localScoreEditable === true),
      ),
    [accountMatches],
  );
  const currentMatch =
    activeMatches.find((match) => match.id === selectedMatchId) ??
    activeMatches[0] ??
    null;
  const onlineMatch = !!currentMatch?.onlineRoomId;
  const history = accountMatches.filter(
    (match) =>
      match.status === 'finished' ||
      !!match.localFinished ||
      (!!match.onlineRoomId &&
        !match.sharedVersion &&
        match.localScoreEditable !== true),
  );
  const roomStatuses = useScoreRoomStatuses(
    uid,
    sessionEpoch,
    reloadKey,
    accountMatches.filter(
      (match) =>
        match.id === expandedHistoryId ||
        (match.id === currentMatch?.id &&
          !!match.onlineRoomId &&
          !match.sharedVersion),
    ),
    navigation,
  );
  const canManageScore = (match: CardScoreMatch) =>
    match.onlineRoomId && !match.sharedVersion
      ? roomStatuses.isOwner(match.onlineRoomId)
      : shared.canEdit(match);
  const editable = !!currentMatch && canManageScore(currentMatch);
  const playerManagementRules = (editorMatch ?? currentMatch)?.sharedVersion
    ? SHARED_CARD_SCORE_PLAYER_RULES
    : undefined;

  async function assertLegacyScoreOwner(match: CardScoreMatch) {
    if (!uid || !isCurrentSession())
      throw new Error('Phiên bảng điểm đã thay đổi.');
    if (!match.onlineRoomId || match.sharedVersion) return;
    try {
      const controller = new AbortController();
      const sessionId = await getGameDeviceSessionId();
      if (!isCurrentSession()) throw new Error('Phiên bảng điểm đã thay đổi.');
      const status = await gameRequest(
        uid,
        { type: 'room-status', roomId: match.onlineRoomId, sessionId },
        controller.signal,
      );
      if (
        !isCurrentSession() ||
        !roomStatuses.isOwner(match.onlineRoomId) ||
        !status.owner
      )
        throw new Error('Chỉ chủ phòng hiện tại mới được sửa/xóa bảng điểm.');
    } catch (cause) {
      if (isCurrentSession()) roomStatuses.invalidate(match.onlineRoomId);
      throw cause;
    }
  }

  async function enterOnlineRoom(
    match: CardScoreMatch | null = currentMatch,
    code = match?.onlineRoomCode ??
      match?.title.match(/· ([ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8})$/)?.[1],
  ) {
    if (
      !uid ||
      !match?.onlineRoomId ||
      !isCurrentSession() ||
      !hasOnlineGameAccess() ||
      busyRef.current
    )
      return;
    const controller = new AbortController();
    roomEntryRequest.current = controller;
    const current = () =>
      !controller.signal.aborted && isCurrentSession() && hasOnlineGameAccess();
    markBusy(true);
    setError(null);
    try {
      const sessionId = await getGameDeviceSessionId();
      if (!current()) return;
      const status = await gameRequest(
        uid,
        { type: 'room-status', roomId: match.onlineRoomId, sessionId },
        controller.signal,
      );
      if (!current()) return;
      if (!status.exists)
        throw new Error('Phòng này đã bị xóa hoặc không còn tồn tại.');
      if (status.canReopen && status.version !== null) {
        const snapshot = await gameRequest(
          uid,
          {
            type: 'reopen',
            roomId: match.onlineRoomId,
            sessionId,
            actionId: randomUUID(),
            expectedVersion: status.version,
            matchId: status.matchId,
            name: displayName?.trim().slice(0, 30) || 'Người chơi',
          },
          controller.signal,
        );
        if (!current()) return;
        if (!snapshot.room)
          throw new Error('Chưa mở lại được phòng. Hãy thử lại.');
        code = snapshot.room.code;
      } else if (!status.canRejoin) {
        if (status.expired)
          throw new Error(
            'Phòng đã ngưng hoạt động. Hãy chờ chủ phòng mở lại.',
          );
        if (
          !status.owner &&
          (status.phase === 'lobby' || status.phase === 'finished')
        )
          throw new Error('Phòng đang chờ chủ phòng vào lại.');
        throw new Error('Hiện chưa thể vào lại phòng này.');
      }
      if (!code) throw new Error('Không tìm thấy mã phòng để vào lại.');
      navigation.navigate('CardGames', { roomCode: code });
    } catch (cause) {
      if (current())
        setError(
          (cause as Error).message || 'Chưa vào lại được phòng. Hãy thử lại.',
        );
    } finally {
      if (roomEntryRequest.current === controller) {
        roomEntryRequest.current = null;
        if (isCurrentSession()) markBusy(false);
      }
    }
  }

  async function deleteOnlineRoom(
    match: CardScoreMatch,
    status: GameRoomStatus | null,
  ) {
    if (
      !uid ||
      !match?.onlineRoomId ||
      !status?.canDelete ||
      status.version === null ||
      !isCurrentSession() ||
      busyRef.current
    )
      return;
    markBusy(true);
    try {
      const sessionId = await getGameDeviceSessionId();
      const controller = new AbortController();
      await gameRequest(
        uid,
        {
          type: 'delete-room',
          roomId: match.onlineRoomId,
          sessionId,
          actionId: randomUUID(),
          expectedVersion: status.version,
          matchId: status.matchId,
        },
        controller.signal,
      );
      if (isCurrentSession()) setReloadKey((key) => key + 1);
    } catch (cause) {
      if (isCurrentSession()) {
        setReloadKey((key) => key + 1);
        setError((cause as Error).message || 'Chưa xóa được phòng.');
      }
    } finally {
      if (isCurrentSession()) markBusy(false);
    }
  }

  function confirmDeleteOnlineRoom(
    match: CardScoreMatch,
    status: GameRoomStatus | null,
  ) {
    Alert.alert(
      'Xóa phòng đã kết thúc?',
      'Mọi người sẽ không thể vào lại phòng này. Bảng điểm và lịch sử thay đổi vẫn được giữ.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa phòng',
          style: 'destructive',
          onPress: () => void deleteOnlineRoom(match, status),
        },
      ],
    );
  }

  function openSetup() {
    setMatchTitle('');
    setPlayerNames(['', '', '', '']);
    setDrawnSeats(null);
    setError(null);
    setSetupVisible(true);
  }

  function openManagePlayers() {
    if (!currentMatch || !editable) return;
    setEditorMatch(currentMatch);
    setManagedPlayers(currentMatch.players.map((player) => ({ ...player })));
    setManagedNewPlayerName('');
    setManagePlayersError(null);
    setManagePlayersVisible(true);
  }

  function changePlayerName(index: number, value: string) {
    setPlayerNames((current) =>
      current.map((name, itemIndex) => (itemIndex === index ? value : name)),
    );
    setDrawnSeats(null);
  }

  function drawSetupSeats() {
    const validationError = validatePlayerNames(playerNames);
    if (validationError) {
      setError(validationError);
      return;
    }
    const players = playerNames.map((name, index) => ({
      id: `player-${index + 1}`,
      name: name.trim(),
    }));
    setDrawnSeats(drawCardScoreSeats(players).seatOrder);
    setError(null);
  }

  async function createMatch() {
    if (!uid || !isCurrentSession() || busyRef.current) return;
    const validationError = validatePlayerNames(playerNames);
    if (validationError) {
      setError(validationError);
      return;
    }
    const players: CardScorePlayer[] = playerNames.map((name, index) => ({
      id: `player-${index + 1}`,
      name: name.trim(),
    }));
    const draw = drawnSeats
      ? {
          seatOrder: drawnSeats,
          dealerPlayerId: drawnSeats[0],
        }
      : {
          seatOrder: players.map(({ id }) => id),
          dealerPlayerId: players[0].id,
        };
    markBusy(true);
    setError(null);
    try {
      const match = await createCardScoreMatch(uid, {
        title: matchTitle.trim() || 'Bàn chơi',
        players,
        ...draw,
      });
      if (!isCurrentSession()) return;
      setLoadedUid(uid);
      setMatches((current) => [match, ...current]);
      setSelectedMatchId(match.id);
      setSetupVisible(false);
    } catch (cause) {
      if (isCurrentSession())
        setError((cause as Error).message || 'Chưa tạo được bàn chơi.');
    } finally {
      if (isCurrentSession()) markBusy(false);
    }
  }

  async function saveMatch(
    match: CardScoreMatch,
    base: CardScoreMatch,
    onError?: (message: string) => void,
    options: { resume?: boolean; deferStateUpdate?: boolean } = {},
  ) {
    if (!uid || !isCurrentSession() || busyRef.current || match.deletedAt)
      return null;
    if (!canManageScore(match)) {
      const message = 'Chỉ chủ phòng đang kết nối mới được sửa/xóa bảng điểm.';
      setError(message);
      onError?.(message);
      return null;
    }
    markBusy(true);
    setError(null);
    try {
      await assertLegacyScoreOwner(match);
      let saved = match.sharedVersion
        ? await shared.mutate(match, 'save', base)
        : await updateCardScoreMatch(uid, match, {
            ...options,
            actorName: displayName ?? undefined,
          });
      if (options.resume && (saved.localFinished || match.localFinished)) {
        const stored = await setCardScoreLocalFinished(uid, saved.id, false);
        saved = stored.find((item) => item.id === saved.id)!;
        if (isCurrentSession()) setMatches(stored);
      }
      if (!isCurrentSession()) return null;
      if (!options.deferStateUpdate) {
        setMatches((current) =>
          current.map((item) => (item.id === saved.id ? saved : item)),
        );
      }
      return saved;
    } catch (cause) {
      if (!isCurrentSession()) return null;
      const message = (cause as Error).message || 'Chưa lưu được thay đổi.';
      setError(message);
      onError?.(message);
      return null;
    } finally {
      if (isCurrentSession()) markBusy(false);
    }
  }

  function changeManagedPlayerName(id: string, value: string) {
    setManagedPlayers((current) =>
      current.map((player) =>
        player.id === id ? { ...player, name: value } : player,
      ),
    );
    setManagePlayersError(null);
  }

  function removeManagedPlayer(id: string) {
    const minPlayers =
      playerManagementRules?.minPlayers ?? MIN_CARD_SCORE_PLAYERS;
    if (managedPlayers.length <= minPlayers) {
      setManagePlayersError(`Mỗi bàn chơi cần có ít nhất ${minPlayers} người.`);
      return;
    }
    setManagedPlayers((current) =>
      current.filter((player) => player.id !== id),
    );
    setManagePlayersError(null);
  }

  function addManagedPlayer() {
    const name = managedNewPlayerName.trim();
    const validationError = validatePlayerNames(
      [...managedPlayers.map((player) => player.name), name],
      (editorMatch ?? currentMatch)?.onlineRoomId ? Infinity : undefined,
      playerManagementRules,
    );
    if (validationError) {
      setManagePlayersError(validationError);
      return;
    }
    const player: CardScorePlayer = { id: randomUUID(), name };
    setManagedPlayers((current) => [...current, player]);
    setManagedNewPlayerName('');
    setManagePlayersError(null);
  }

  async function saveManagedPlayers() {
    const currentMatch = editorMatch;
    if (!uid || !currentMatch || busy) return;
    const validationError = validatePlayerNames(
      managedPlayers.map((player) => player.name),
      currentMatch.onlineRoomId ? Infinity : undefined,
      playerManagementRules,
    );
    if (validationError) {
      setManagePlayersError(validationError);
      return;
    }

    const managedIds = new Set(managedPlayers.map((player) => player.id));
    const removedPlayers = currentMatch.players.filter(
      (player) => !managedIds.has(player.id),
    );
    const players = managedPlayers.map((player) => ({
      ...player,
      name: player.name.trim(),
    }));
    const addedPlayers = players.filter(
      (player) => !currentMatch.players.some(({ id }) => id === player.id),
    );
    const seatOrder = [
      ...currentMatch.seatOrder.filter((id) => managedIds.has(id)),
      ...addedPlayers.map(({ id }) => id),
    ];
    const rounds = currentMatch.rounds.map((round) => ({
      ...round,
      scores: Object.fromEntries(
        Object.entries(round.scores).filter(([id]) => managedIds.has(id)),
      ),
    }));
    const updatedMatch: CardScoreMatch = {
      ...currentMatch,
      players,
      seatOrder,
      dealerPlayerId: managedIds.has(currentMatch.dealerPlayerId)
        ? currentMatch.dealerPlayerId
        : (seatOrder[0] ?? ''),
      rounds,
      ...(currentMatch.onlineRoomId && removedPlayers.length
        ? {
            ignoredOnlinePlayerIds: [
              ...new Set([
                ...(currentMatch.ignoredOnlinePlayerIds ?? []),
                ...removedPlayers.map(({ id }) => id),
              ]),
            ],
          }
        : {}),
    };

    const persistChanges = async () => {
      const saved = await saveMatch(
        updatedMatch,
        currentMatch,
        setManagePlayersError,
      );
      if (saved) {
        setManagePlayersError(null);
        setManagePlayersVisible(false);
      }
    };
    const affectedRounds = currentMatch.rounds.filter((round) =>
      removedPlayers.some((player) => (round.scores[player.id] ?? 0) !== 0),
    ).length;
    if (affectedRounds > 0) {
      Alert.alert(
        'Xóa người chơi và điểm?',
        `Điểm của ${removedPlayers.map(({ name }) => name).join(', ')} sẽ bị xóa khỏi ${affectedRounds} ván đã ghi. Tổng các ván này có thể không còn bằng 0.`,
        [
          { text: 'Quay lại', style: 'cancel' },
          {
            text: 'Xóa và lưu',
            style: 'destructive',
            onPress: () => void persistChanges(),
          },
        ],
      );
      return;
    }
    await persistChanges();
  }

  function openRound(round?: CardScoreRound) {
    if (!currentMatch || !editable) return;
    setEditorMatch(currentMatch);
    setEditingRound(round ?? null);
    setScoreInputs(
      Object.fromEntries(
        currentMatch.players.map((player) => [
          player.id,
          round ? String(round.scores[player.id] ?? 0) : '0',
        ]),
      ),
    );
    setError(null);
    setRoundVisible(true);
  }

  async function saveRound() {
    const currentMatch = editorMatch;
    if (!currentMatch) return;
    const result = validateRoundScores(
      currentMatch.players.map(({ id }) => id),
      scoreInputs,
    );
    if ('error' in result && result.error) {
      setError(result.error);
      return;
    }
    const round: CardScoreRound = {
      id: editingRound?.id ?? randomUUID(),
      createdAt: editingRound?.createdAt ?? Date.now(),
      scores: result.scores,
    };
    const rounds = editingRound
      ? currentMatch.rounds.map((item) =>
          item.id === editingRound.id ? round : item,
        )
      : [...currentMatch.rounds, round];
    const saved = await saveMatch({ ...currentMatch, rounds }, currentMatch);
    if (saved) setRoundVisible(false);
  }

  function confirmDeleteRound(round: CardScoreRound, index: number) {
    if (!currentMatch || !editable) return;
    Alert.alert(
      `Xóa điểm ván ${index + 1}?`,
      'Tổng điểm sẽ được tính lại ngay.',
      [
        { text: 'Giữ lại', style: 'cancel' },
        {
          text: 'Xóa ván',
          style: 'destructive',
          onPress: () => {
            const ignoredOnlineRoundIds = currentMatch.onlineRoomId
              ? [
                  ...new Set([
                    ...(currentMatch.ignoredOnlineRoundIds ?? []),
                    round.id,
                  ]),
                ]
              : currentMatch.ignoredOnlineRoundIds;
            void saveMatch(
              {
                ...currentMatch,
                rounds: currentMatch.rounds.filter(
                  (item) => item.id !== round.id,
                ),
                ...(ignoredOnlineRoundIds ? { ignoredOnlineRoundIds } : {}),
              },
              currentMatch,
            );
          },
        },
      ],
    );
  }

  function finishMatch() {
    if (!currentMatch || busyRef.current || !isCurrentSession()) return;
    setEditorMatch(currentMatch);
    setFinishLocally(!!currentMatch.onlineRoomId && !editable);
    finishSession.current = { uid, epoch: sessionEpoch };
    setError(null);
    setFinishDialogVisible(true);
  }

  async function confirmFinishMatch() {
    const currentMatch = editorMatch;
    if (
      !currentMatch ||
      finishSession.current?.uid !== uid ||
      finishSession.current?.epoch !== sessionEpoch
    )
      return;
    if (finishLocally) {
      if (!uid || !isCurrentSession() || busyRef.current) return;
      markBusy(true);
      setError(null);
      try {
        const stored = await setCardScoreLocalFinished(
          uid,
          currentMatch.id,
          true,
        );
        if (isCurrentSession()) {
          const archived = stored.find((match) => match.id === currentMatch.id);
          queueFinishedMatchCommit(currentMatch.id, () => {
            setMatches((current) =>
              current.map((item) =>
                item.id === currentMatch.id && !item.deletedAt && archived
                  ? {
                      ...item,
                      localFinished: archived.localFinished,
                      localFinishedAt: archived.localFinishedAt,
                    }
                  : item,
              ),
            );
            setSelectedMatchId(null);
          });
        }
      } catch (cause) {
        if (isCurrentSession())
          setError(
            (cause as Error).message || 'Chưa lưu được bàn vào lịch sử.',
          );
      } finally {
        if (isCurrentSession()) markBusy(false);
      }
      return;
    }
    const saved = await saveMatch(
      { ...currentMatch, status: 'finished' },
      currentMatch,
      undefined,
      { deferStateUpdate: true },
    );
    if (saved) {
      queueFinishedMatchCommit(currentMatch.id, () => {
        setMatches((current) =>
          current.map((item) => {
            if (item.id !== saved.id || item.deletedAt) return item;
            if (
              saved.sharedVersion
                ? (item.sharedVersion ?? 0) >= saved.sharedVersion
                : item.updatedAt > saved.updatedAt
            )
              return item;
            return saved;
          }),
        );
        setSelectedMatchId(null);
      });
    }
  }

  function queueFinishedMatchCommit(matchId: string, commit: () => void) {
    if (!isCurrentSession()) return;
    if (finishCommitTimer.current) clearTimeout(finishCommitTimer.current);
    finishCommit.current = {
      matchId,
      apply: () => {
        if (isCurrentSession()) commit();
      },
    };
    setFinishDialogVisible(false);
    finishCommitTimer.current = setTimeout(commitFinishedMatchAfterDialog, 350);
  }

  function commitFinishedMatchAfterDialog() {
    if (finishCommitTimer.current) {
      clearTimeout(finishCommitTimer.current);
      finishCommitTimer.current = null;
    }
    const commit = finishCommit.current;
    finishCommit.current = null;
    commit?.apply();
  }

  async function resumeMatch(match: CardScoreMatch) {
    if (match.deletedAt) return;
    if (finishCommit.current?.matchId === match.id) {
      if (finishCommitTimer.current) clearTimeout(finishCommitTimer.current);
      finishCommitTimer.current = null;
      finishCommit.current = null;
    }
    if (match.localFinished && match.status === 'active') {
      if (!uid || !isCurrentSession() || busyRef.current) return;
      markBusy(true);
      setError(null);
      try {
        const stored = await setCardScoreLocalFinished(uid, match.id, false);
        if (isCurrentSession()) {
          setMatches(stored);
          setSelectedMatchId(match.id);
          setExpandedHistoryId(null);
        }
      } catch (cause) {
        if (isCurrentSession())
          setError((cause as Error).message || 'Chưa mở lại được bàn.');
      } finally {
        if (isCurrentSession()) markBusy(false);
      }
      return;
    }
    if (!canManageScore(match)) return;
    const saved = await saveMatch(
      {
        ...match,
        status: 'active',
        ...(match.onlineRoomId && !match.sharedVersion
          ? { localScoreEditable: true }
          : {}),
      },
      match,
      undefined,
      {
        resume: true,
      },
    );
    if (saved) {
      setSelectedMatchId(saved.id);
      setExpandedHistoryId(null);
    }
  }

  function toggleHistory(matchId: string) {
    setExpandedHistoryId((current) => (current === matchId ? null : matchId));
  }

  function confirmDeleteMatch(match: CardScoreMatch) {
    if (match.deletedAt || !canManageScore(match)) return;
    Alert.alert(
      match.onlineRoomId && !match.sharedVersion
        ? 'Xóa bản lưu trên thiết bị?'
        : 'Xóa bàn chơi?',
      match.onlineRoomId && !match.sharedVersion
        ? 'Bản lưu sẽ bị xóa khỏi danh sách và không thể khôi phục. Phòng online không bị xóa.'
        : 'Bảng điểm sẽ bị xóa khỏi danh sách và không thể khôi phục.',
      [
        { text: 'Giữ lại', style: 'cancel' },
        {
          text: 'Xóa bàn',
          style: 'destructive',
          onPress: () => {
            if (
              !uid ||
              !isCurrentSession() ||
              busyRef.current ||
              !canManageScore(match)
            )
              return;
            markBusy(true);
            void assertLegacyScoreOwner(match)
              .then(() =>
                match.sharedVersion
                  ? shared
                      .mutate(match, 'delete')
                      .then(() =>
                        readCardScoreMatches(uid, { includeDeleted: true }),
                      )
                  : deleteCardScoreMatch(
                      uid,
                      match.id,
                      displayName ?? undefined,
                    ).then(() =>
                      readCardScoreMatches(uid, { includeDeleted: true }),
                    ),
              )
              .then((stored) => {
                if (isCurrentSession()) setMatches(stored);
              })
              .catch((cause) => {
                if (isCurrentSession())
                  setError(
                    (cause as Error).message || 'Chưa xóa được bàn chơi.',
                  );
              })
              .finally(() => {
                if (isCurrentSession()) markBusy(false);
              });
          },
        },
      ],
    );
  }

  const totals = currentMatch
    ? calculatePlayerTotals(currentMatch.players, currentMatch.rounds)
    : {};
  const hasManagedPlayerChanges = Boolean(
    editorMatch &&
    (managedPlayers.length !== editorMatch.players.length ||
      managedPlayers.some((player) => {
        const currentPlayer = editorMatch.players.find(
          ({ id }) => id === player.id,
        );
        return !currentPlayer || currentPlayer.name !== player.name.trim();
      })),
  );

  return (
    <>
      <Screen
        fixedHeaderStyle={styles.fixedHeader}
        fixedHeader={
          <CardHubHeader onBack={() => navigation.navigate('Home')} />
        }
        fixedContent={
          <CardHubModeTabs
            active="score"
            onlineEnabled={cardGamesEnabled()}
            onSelectScore={() => undefined}
            onSelectOnline={() => navigation.navigate('CardGames')}
          />
        }
        fixedContentStyle={styles.fixedModes}
        contentStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refreshScores()}
            enabled={!!uid && !loading && !busy}
            tintColor={colors.earth}
            colors={[colors.earth]}
            progressBackgroundColor={colors.surface}
            accessibilityLabel="Kéo xuống để tải lại bảng điểm"
          />
        }
      >
        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        {loading ? (
          <ActivityIndicator
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Đang tải bảng điểm"
            color={colors.earth}
          />
        ) : loadFailed ? (
          <View style={styles.emptyMatch}>
            <Text style={styles.emptyMatchTitle}>Chưa mở được bảng điểm</Text>
            <Text style={styles.emptyMatchText}>
              Thử tải lại để xem các bàn chơi đã lưu trên thiết bị.
            </Text>
            <Button
              title="Thử tải lại"
              onPress={() => setReloadKey((current) => current + 1)}
            />
          </View>
        ) : currentMatch ? (
          <View testID="card-score-open-table" style={styles.section}>
            <View style={styles.activeTablesSection}>
              <View
                testID="card-score-active-tables-heading"
                style={styles.activeTablesHeading}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.sectionMeta, styles.activeTablesHeadingText]}
                >
                  Các bàn đang chơi · {activeMatches.length}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Tạo bàn mới, giữ bàn hiện tại"
                  accessibilityState={{ disabled: busy }}
                  disabled={busy}
                  onPress={openSetup}
                  style={[styles.newMatchAction, busy && styles.disabledAction]}
                >
                  <Feather name="plus" size={16} color={colors.earth} />
                  <Text style={styles.newMatchActionText}>Bàn mới</Text>
                </Pressable>
              </View>
              {activeMatches.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.activeTableList}
                >
                  {activeMatches.map((match) => (
                    <Pressable
                      key={match.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Mở bàn ${match.title}`}
                      accessibilityState={{
                        selected: match.id === currentMatch.id,
                        disabled: busy,
                      }}
                      disabled={busy}
                      onPress={() => setSelectedMatchId(match.id)}
                      style={[
                        styles.activeTableChip,
                        match.id === currentMatch.id &&
                          styles.activeTableSelected,
                        busy && styles.disabledAction,
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.activeTableTitle,
                          match.id === currentMatch.id &&
                            styles.activeTableSelectedText,
                        ]}
                      >
                        {match.title}
                      </Text>
                      <Text style={styles.activeTableMeta}>
                        {match.players.length} người
                        {match.amountPerCard
                          ? ` · ${match.amountPerCard.toLocaleString('vi-VN')} đ/lá`
                          : ''}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
            <View style={styles.tablePanel}>
              <View
                testID="card-score-current-match-heading"
                style={styles.tablePanelHeader}
              >
                <View style={styles.headingCopy}>
                  {activeMatches.length === 1 && (
                    <Text numberOfLines={1} style={styles.tablePanelTitle}>
                      {currentMatch.title}
                    </Text>
                  )}
                  <Text numberOfLines={1} style={styles.tablePanelMeta}>
                    {activeMatches.length === 1 &&
                      `${currentMatch.players.length} người · `}
                    {currentMatch.amountPerCard
                      ? `${currentMatch.amountPerCard.toLocaleString('vi-VN')} đ/lá · `
                      : ''}
                    Bắt đầu {formatDate(currentMatch.createdAt)}
                  </Text>
                </View>
                <View style={styles.tablePanelIcons}>
                  <CardScoreRoomActions
                    compact
                    match={currentMatch}
                    status={null}
                    busy={busy}
                    allowRejoin={onlineGameAccess}
                    onRejoin={(roomCode) =>
                      void enterOnlineRoom(currentMatch, roomCode)
                    }
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Lịch sử sửa/xóa"
                    onPress={() => showAudit(currentMatch)}
                    style={({ pressed }) => [
                      styles.tablePanelIcon,
                      pressed && styles.disabledAction,
                    ]}
                  >
                    <Feather name="clock" size={16} color={colors.earth} />
                  </Pressable>
                  {editable && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Quản lý người chơi"
                      accessibilityState={{ disabled: busy || !editable }}
                      disabled={busy || !editable}
                      onPress={openManagePlayers}
                      style={[
                        styles.tablePanelIcon,
                        (busy || !editable) && styles.disabledAction,
                      ]}
                    >
                      <Feather name="users" size={16} color={colors.earth} />
                    </Pressable>
                  )}
                </View>
              </View>
              <CardScoreTable
                embedded
                match={currentMatch}
                totals={totals}
                busy={busy}
                readOnly={!editable}
                allowDelete={editable}
                hint={
                  currentMatch.sharedVersion
                    ? editable
                      ? 'Điểm dùng chung · chỉ chủ phòng được sửa/xóa'
                      : 'Điểm dùng chung · bạn chỉ có quyền xem'
                    : onlineMatch
                      ? null
                      : undefined
                }
                onEditRound={openRound}
                onDeleteRound={confirmDeleteRound}
              />
              <View style={styles.tablePanelFooter}>
                {editable && (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Bốc thăm người chia bài"
                      accessibilityState={{ disabled: busy || !editable }}
                      disabled={busy || !editable}
                      onPress={() => {
                        const draw = drawCardScoreSeats(currentMatch.players);
                        void saveMatch(
                          {
                            ...currentMatch,
                            dealerPlayerId: draw.dealerPlayerId,
                          },
                          currentMatch,
                        );
                      }}
                      style={[
                        styles.footerAction,
                        (busy || !editable) && styles.disabledAction,
                      ]}
                    >
                      <Feather name="shuffle" size={15} color={colors.earth} />
                      <Text style={styles.drawActionText}>Bốc thăm</Text>
                    </Pressable>
                    <View style={styles.footerPrimary}>
                      <Button
                        title="Thêm ván"
                        onPress={() => openRound()}
                        disabled={busy || !editable}
                        compact
                      />
                    </View>
                  </>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Kết thúc bàn chơi"
                  accessibilityState={{ disabled: busy }}
                  disabled={busy}
                  onPress={finishMatch}
                  style={[styles.footerAction, busy && styles.disabledAction]}
                >
                  <Feather name="check" size={15} color={colors.success} />
                  <Text style={styles.finishActionText}>Kết thúc</Text>
                </Pressable>
              </View>
            </View>
            {onlineMatch && (
              <CardScoreSyncNotice
                scoreError={
                  currentMatch.sharedVersion
                    ? shared.error
                    : roomStatuses.failedRooms[currentMatch.onlineRoomId!]
                      ? 'Chưa xác nhận được quyền chủ phòng.'
                      : null
                }
                onSync={
                  currentMatch.sharedVersion ? shared.retry : roomStatuses.retry
                }
              />
            )}
            {currentMatch.rounds.length === 0 && (
              <Text style={styles.sectionMeta}>
                {currentMatch.sharedVersion
                  ? 'Kết quả các ván online sẽ tự động ghi vào bàn này.'
                  : 'Thêm ván mới để bắt đầu ghi điểm. Chạm vào một dòng điểm để sửa.'}
              </Text>
            )}
          </View>
        ) : history.length ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tạo bàn chơi"
            onPress={openSetup}
            style={styles.newScorePrompt}
          >
            <View style={styles.newScorePromptIcon}>
              <Feather name="plus" size={20} color={colors.earth} />
            </View>
            <View style={styles.headingCopy}>
              <Text style={styles.newScorePromptTitle}>Tạo bàn chơi</Text>
              <Text style={styles.sectionMeta}>Bắt đầu bảng điểm mới</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.muted} />
          </Pressable>
        ) : (
          <View style={styles.emptyMatch}>
            <View style={styles.emptyMatchIcon}>
              <Feather name="users" size={27} color={colors.sky} />
            </View>
            <Text style={styles.emptyMatchTitle}>Sẵn sàng ghi điểm?</Text>
            <Text style={styles.emptyMatchText}>
              Tạo một bảng dùng chung cho bất kỳ trò chơi nào, thêm người chơi
              rồi ghi điểm nhanh theo từng ván.
            </Text>
            <Button title="Tạo bàn chơi" onPress={openSetup} />
          </View>
        )}

        {!loading && !loadFailed && (
          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <View style={styles.headingCopy}>
                <Text style={styles.sectionTitle}>Lịch sử bàn chơi</Text>
                <Text style={styles.sectionMeta}>
                  Bàn online đồng bộ · bàn thủ công lưu trên máy
                </Text>
              </View>
              <Feather name="archive" size={18} color={colors.muted} />
            </View>
            {history.length === 0 ? (
              <Text style={styles.historyEmpty}>
                Các bàn đã kết thúc sẽ lưu ở đây.
              </Text>
            ) : (
              history.map((match) => (
                <CardScoreHistoryCard
                  key={match.id}
                  match={match}
                  date={formatDate(match.createdAt)}
                  expanded={expandedHistoryId === match.id}
                  busy={busy}
                  canManage={canManageScore(match)}
                  onToggle={() => toggleHistory(match.id)}
                  onResume={() => void resumeMatch(match)}
                  onDelete={() => confirmDeleteMatch(match)}
                  onAudit={() => showAudit(match)}
                >
                  <CardScoreRoomActions
                    match={match}
                    status={
                      match.onlineRoomId
                        ? (roomStatuses.statuses[match.onlineRoomId] ?? null)
                        : null
                    }
                    busy={busy}
                    allowRejoin={false}
                    onRejoin={() => undefined}
                    onReopen={
                      onlineGameAccess
                        ? () => void enterOnlineRoom(match)
                        : undefined
                    }
                    onDelete={() =>
                      confirmDeleteOnlineRoom(
                        match,
                        match.onlineRoomId
                          ? (roomStatuses.statuses[match.onlineRoomId] ?? null)
                          : null,
                      )
                    }
                  />
                  {match.onlineRoomId && (
                    <CardScoreSyncNotice
                      scoreError={match.sharedVersion ? shared.error : null}
                      onSync={shared.retry}
                    />
                  )}
                </CardScoreHistoryCard>
              ))
            )}
          </View>
        )}
      </Screen>

      <CardScoreAuditDialog
        uid={uid}
        epoch={sessionEpoch}
        match={auditMatch}
        onClose={() => setAuditSelection(null)}
      />
      <CardScoreSetupDialog
        visible={setupVisible}
        busy={busy}
        error={error}
        title={matchTitle}
        onTitleChange={setMatchTitle}
        playerNames={playerNames}
        drawnSeats={drawnSeats}
        onClose={() => setSetupVisible(false)}
        onCreate={() => void createMatch()}
        onNameChange={changePlayerName}
        onRemovePlayer={(index) => {
          setPlayerNames((current) => current.filter((_, i) => i !== index));
          setDrawnSeats(null);
        }}
        onAddPlayer={() => setPlayerNames((current) => [...current, ''])}
        onDrawSeats={drawSetupSeats}
      />
      <CardScoreManagePlayersDialog
        visible={managePlayersVisible}
        minPlayers={playerManagementRules?.minPlayers}
        maxNameLength={playerManagementRules?.maxNameLength}
        maxPlayers={
          (editorMatch ?? currentMatch)?.onlineRoomId ? Infinity : undefined
        }
        busy={busy}
        error={managePlayersError}
        players={managedPlayers}
        newPlayerName={managedNewPlayerName}
        hasChanges={hasManagedPlayerChanges}
        onPlayerNameChange={changeManagedPlayerName}
        onNewPlayerNameChange={(value) => {
          setManagedNewPlayerName(value);
          setManagePlayersError(null);
        }}
        onRemovePlayer={removeManagedPlayer}
        onAddPlayer={addManagedPlayer}
        onClose={() => setManagePlayersVisible(false)}
        onSave={() => void saveManagedPlayers()}
      />
      <CardScoreRoundDialog
        visible={roundVisible}
        busy={busy}
        error={error}
        match={editorMatch ?? currentMatch}
        editingRound={editingRound}
        scores={scoreInputs}
        onClose={() => setRoundVisible(false)}
        onChange={(playerId, value) =>
          setScoreInputs((current) => ({ ...current, [playerId]: value }))
        }
        onSave={() => void saveRound()}
      />
      <CardScoreFinishDialog
        visible={finishDialogVisible}
        localOnly={finishLocally}
        busy={busy}
        error={error}
        onCancel={() => setFinishDialogVisible(false)}
        onConfirm={() => void confirmFinishMatch()}
        onDismiss={commitFinishedMatchAfterDialog}
      />
    </>
  );
}
