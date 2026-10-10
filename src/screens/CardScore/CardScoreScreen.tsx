import Feather from '@expo/vector-icons/Feather';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { randomUUID } from 'expo-crypto';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { useAuthStore } from '../../store/authStore';
import type { MainTabParams } from '../../navigation/types';
import {
  createCardScoreMatch,
  deleteCardScoreMatch,
  readCardScoreMatches,
  updateCardScoreMatch,
} from '../../services/cardScore/cardScoreStorage';
import { colors } from '../../theme';
import type {
  CardScoreMatch,
  CardScorePlayer,
  CardScoreRound,
} from '../../types/cardScore';
import {
  calculatePlayerTotals,
  drawCardScoreSeats,
  validatePlayerNames,
  validateRoundScores,
} from '../../utils/cardScore';
import { CardScoreFinishDialog } from './CardScoreFinishDialog';
import { CardScoreManagePlayersDialog } from './CardScoreManagePlayersDialog';
import { CardScoreRoundDialog } from './CardScoreRoundDialog';
import { CardScoreSetupDialog } from './CardScoreSetupDialog';
import { CardScoreTable } from './CardScoreTable';
import { styles } from './CardScoreScreen.styles';

const formatDate = (timestamp: number) =>
  new Intl.DateTimeFormat('vi-VN', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);

const formatScore = (score: number) => (score > 0 ? `+${score}` : `${score}`);

export function CardScoreScreen({
  navigation,
}: BottomTabScreenProps<MainTabParams, 'CardScore'>) {
  const uid = useAuthStore((state) => state.user?.uid);
  const [matches, setMatches] = useState<CardScoreMatch[]>([]);
  const [loadedUid, setLoadedUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // Alert callbacks capture stale state, so they read the live flag instead.
  const busyRef = useRef(false);
  const markBusy = (value: boolean) => {
    busyRef.current = value;
    setBusy(value);
  };
  const [error, setError] = useState<string | null>(null);
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
  const [playerNames, setPlayerNames] = useState(['', '']);
  const [drawnSeats, setDrawnSeats] = useState<string[] | null>(null);
  const [roundVisible, setRoundVisible] = useState(false);
  const [finishDialogVisible, setFinishDialogVisible] = useState(false);
  const [editingRound, setEditingRound] = useState<CardScoreRound | null>(null);
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({});

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
    void readCardScoreMatches(uid)
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
  }, [uid]);

  const accountMatches = useMemo(
    () => (loadedUid === uid ? matches : []),
    [loadedUid, matches, uid],
  );
  const activeMatches = useMemo(
    () => accountMatches.filter((match) => match.status === 'active'),
    [accountMatches],
  );
  const currentMatch =
    activeMatches.find((match) => match.id === selectedMatchId) ??
    activeMatches[0] ??
    null;
  const history = accountMatches.filter((match) => match.status === 'finished');

  function openSetup() {
    setMatchTitle('');
    setPlayerNames(['', '']);
    setDrawnSeats(null);
    setError(null);
    setSetupVisible(true);
  }

  function openManagePlayers() {
    if (!currentMatch) return;
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
    if (!uid || busyRef.current) return;
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
      setLoadedUid(uid);
      setMatches((current) => [match, ...current]);
      setSelectedMatchId(match.id);
      setSetupVisible(false);
    } catch (cause) {
      setError((cause as Error).message || 'Chưa tạo được bàn chơi.');
    } finally {
      markBusy(false);
    }
  }

  async function saveMatch(
    match: CardScoreMatch,
    onError?: (message: string) => void,
  ) {
    if (!uid || busyRef.current) return null;
    markBusy(true);
    setError(null);
    try {
      const saved = await updateCardScoreMatch(uid, match);
      setMatches((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      );
      return saved;
    } catch (cause) {
      const message = (cause as Error).message || 'Chưa lưu được thay đổi.';
      setError(message);
      onError?.(message);
      return null;
    } finally {
      markBusy(false);
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
    if (managedPlayers.length <= 2) {
      setManagePlayersError('Mỗi bàn chơi cần có ít nhất 2 người.');
      return;
    }
    setManagedPlayers((current) =>
      current.filter((player) => player.id !== id),
    );
    setManagePlayersError(null);
  }

  function addManagedPlayer() {
    const name = managedNewPlayerName.trim();
    const validationError = validatePlayerNames([
      ...managedPlayers.map((player) => player.name),
      name,
    ]);
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
    if (!uid || !currentMatch || busy) return;
    const validationError = validatePlayerNames(
      managedPlayers.map((player) => player.name),
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
    };

    const persistChanges = async () => {
      const saved = await saveMatch(updatedMatch, setManagePlayersError);
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
    if (!currentMatch) return;
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
    const saved = await saveMatch({ ...currentMatch, rounds });
    if (saved) setRoundVisible(false);
  }

  function confirmDeleteRound(round: CardScoreRound, index: number) {
    if (!currentMatch) return;
    Alert.alert(
      `Xóa điểm ván ${index + 1}?`,
      'Tổng điểm sẽ được tính lại ngay.',
      [
        { text: 'Giữ lại', style: 'cancel' },
        {
          text: 'Xóa ván',
          style: 'destructive',
          onPress: () =>
            void saveMatch({
              ...currentMatch,
              rounds: currentMatch.rounds.filter(
                (item) => item.id !== round.id,
              ),
            }),
        },
      ],
    );
  }

  function finishMatch() {
    if (!currentMatch) return;
    setFinishDialogVisible(true);
  }

  async function confirmFinishMatch() {
    if (!currentMatch) return;
    const saved = await saveMatch({ ...currentMatch, status: 'finished' });
    if (saved) {
      setSelectedMatchId(null);
      setFinishDialogVisible(false);
    }
  }

  async function resumeMatch(match: CardScoreMatch) {
    const saved = await saveMatch({ ...match, status: 'active' });
    if (saved) {
      setSelectedMatchId(saved.id);
      setExpandedHistoryId(null);
    }
  }

  function toggleHistory(matchId: string) {
    setExpandedHistoryId((current) => (current === matchId ? null : matchId));
  }

  function confirmDeleteMatch(match: CardScoreMatch) {
    Alert.alert('Xóa bàn chơi?', 'Lịch sử các ván của bàn này sẽ bị xóa.', [
      { text: 'Giữ lại', style: 'cancel' },
      {
        text: 'Xóa bàn',
        style: 'destructive',
        onPress: () => {
          if (!uid || busyRef.current) return;
          markBusy(true);
          void deleteCardScoreMatch(uid, match.id)
            .then(setMatches)
            .catch((cause) =>
              setError((cause as Error).message || 'Chưa xóa được bàn chơi.'),
            )
            .finally(() => markBusy(false));
        },
      },
    ]);
  }

  const totals = currentMatch
    ? calculatePlayerTotals(currentMatch.players, currentMatch.rounds)
    : {};
  const hasManagedPlayerChanges = Boolean(
    currentMatch &&
    (managedPlayers.length !== currentMatch.players.length ||
      managedPlayers.some((player) => {
        const currentPlayer = currentMatch.players.find(
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
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quay về Home"
              onPress={() => navigation.navigate('Home')}
              style={styles.headerButton}
            >
              <Feather name="arrow-left" size={21} color={colors.earth} />
            </Pressable>
            <View style={styles.headerTitleGroup}>
              <Text accessibilityRole="header" style={styles.headerTitle}>
                Bảng điểm
              </Text>
            </View>
            <View style={styles.headerButtonSpacer} />
          </View>
        }
        contentStyle={styles.content}
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
        ) : currentMatch ? (
          <View style={styles.section}>
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
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
            <View
              testID="card-score-current-match-heading"
              style={styles.sectionHeading}
            >
              <View style={styles.headingCopy}>
                {activeMatches.length === 1 && (
                  <Text style={styles.sectionTitle}>{currentMatch.title}</Text>
                )}
                <Text style={styles.sectionMeta}>
                  {activeMatches.length === 1 &&
                    `${currentMatch.players.length} người · `}
                  Bắt đầu {formatDate(currentMatch.createdAt)}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Quản lý người chơi"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={openManagePlayers}
                style={[
                  styles.selectedMatchAddAction,
                  busy && styles.disabledAction,
                ]}
              >
                <Feather name="users" size={14} color={colors.earth} />
                <Text style={styles.selectedMatchAddActionText}>Quản lý</Text>
              </Pressable>
            </View>
            <CardScoreTable
              match={currentMatch}
              totals={totals}
              busy={busy}
              onEditRound={openRound}
              onDeleteRound={confirmDeleteRound}
            />

            <View style={styles.roundHeading}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Bốc thăm người chia bài"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={() => {
                  const draw = drawCardScoreSeats(currentMatch.players);
                  void saveMatch({
                    ...currentMatch,
                    dealerPlayerId: draw.dealerPlayerId,
                  });
                }}
                style={[styles.drawAction, busy && styles.disabledAction]}
              >
                <Feather name="shuffle" size={16} color={colors.earth} />
                <Text style={styles.drawActionText}>Bốc thăm</Text>
              </Pressable>
              <Button
                title="Thêm ván"
                onPress={() => openRound()}
                disabled={busy}
                compact
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Kết thúc bàn chơi"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={finishMatch}
                style={[styles.finishAction, busy && styles.disabledAction]}
              >
                <Feather name="check" size={16} color={colors.success} />
                <Text style={styles.finishActionText}>Kết thúc</Text>
              </Pressable>
            </View>
            {currentMatch.rounds.length === 0 && (
              <Text style={styles.sectionMeta}>
                Thêm ván mới để bắt đầu ghi điểm. Chạm vào một dòng điểm để sửa.
              </Text>
            )}
          </View>
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

        {!loading && (
          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <View style={styles.headingCopy}>
                <Text style={styles.sectionTitle}>Lịch sử bàn chơi</Text>
                <Text style={styles.sectionMeta}>
                  Lưu riêng trên thiết bị và theo tài khoản này
                </Text>
              </View>
              <Feather name="archive" size={18} color={colors.muted} />
            </View>
            {history.length === 0 ? (
              <Text style={styles.historyEmpty}>
                Các bàn đã kết thúc sẽ lưu ở đây.
              </Text>
            ) : (
              history.map((match) => {
                const historyTotals = calculatePlayerTotals(
                  match.players,
                  match.rounds,
                );
                return (
                  <View
                    key={match.id}
                    testID={`card-score-history-${match.id}`}
                    style={styles.historyCard}
                  >
                    <View style={styles.historyTopLine}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Xem lịch sử bàn ${match.title}`}
                        accessibilityState={{
                          expanded: expandedHistoryId === match.id,
                        }}
                        onPress={() => toggleHistory(match.id)}
                        style={styles.historyTitleButton}
                      >
                        <Text numberOfLines={1} style={styles.historyTitle}>
                          {match.title}
                        </Text>
                      </Pressable>
                      <View style={styles.historyActions}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Tiếp tục chơi bàn ${match.title}`}
                          accessibilityState={{ disabled: busy }}
                          disabled={busy}
                          onPress={() => void resumeMatch(match)}
                          style={[
                            styles.historyResume,
                            busy && styles.disabledAction,
                          ]}
                        >
                          <Feather name="play" size={15} color={colors.earth} />
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Xóa lịch sử bàn ${formatDate(match.createdAt)}`}
                          accessibilityState={{ disabled: busy }}
                          disabled={busy}
                          onPress={() => confirmDeleteMatch(match)}
                          style={[
                            styles.historyDelete,
                            busy && styles.disabledAction,
                          ]}
                        >
                          <Feather
                            name="trash-2"
                            size={17}
                            color={colors.muted}
                          />
                        </Pressable>
                      </View>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Xem lịch sử bàn ${formatDate(match.createdAt)}`}
                      accessibilityState={{
                        expanded: expandedHistoryId === match.id,
                      }}
                      onPress={() => toggleHistory(match.id)}
                      style={styles.historyMain}
                    >
                      <View
                        testID={`card-score-history-scores-${match.id}`}
                        style={styles.historyScores}
                      >
                        {match.players.map((player) => (
                          <View key={player.id} style={styles.historyScoreChip}>
                            <Text
                              numberOfLines={1}
                              style={styles.historyScoreName}
                            >
                              {player.name}
                            </Text>
                            <Text style={styles.historyScoreValue}>
                              {formatScore(historyTotals[player.id] ?? 0)}
                            </Text>
                          </View>
                        ))}
                      </View>
                      <Text style={styles.historySubtitle}>
                        {formatDate(match.createdAt)} · {match.rounds.length}{' '}
                        ván
                      </Text>
                    </Pressable>
                    {expandedHistoryId === match.id && (
                      <View style={styles.historyRounds}>
                        {match.rounds.length === 0 ? (
                          <Text style={styles.historySubtitle}>
                            Bàn chưa có ván được ghi điểm.
                          </Text>
                        ) : (
                          match.rounds.map((round, index) => (
                            <View key={round.id} style={styles.historyRoundRow}>
                              <Text style={styles.historyRoundTitle}>
                                Ván {index + 1}
                              </Text>
                              <Text style={styles.historySubtitle}>
                                {match.players
                                  .map(
                                    (player) =>
                                      `${player.name} ${formatScore(round.scores[player.id] ?? 0)}`,
                                  )
                                  .join('  ·  ')}
                              </Text>
                            </View>
                          ))
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}
      </Screen>

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
        match={currentMatch}
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
        busy={busy}
        onCancel={() => setFinishDialogVisible(false)}
        onConfirm={() => void confirmFinishMatch()}
      />
    </>
  );
}
