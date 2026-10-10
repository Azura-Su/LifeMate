import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { DialogModal } from '../../components/DialogModal';
import { colors } from '../../theme';
import type { CardScoreMatch, CardScoreRound } from '../../types/cardScore';
import { styles } from './CardScoreScreen.styles';

type Props = {
  visible: boolean;
  busy: boolean;
  error: string | null;
  match: CardScoreMatch | null;
  editingRound: CardScoreRound | null;
  scores: Record<string, string>;
  onClose: () => void;
  onChange: (playerId: string, value: string) => void;
  onSave: () => void;
};

const shownScore = (score: string | undefined) => {
  const value = Number(score ?? 0);
  return value > 0 ? `+${value}` : String(value);
};

export function CardScoreRoundDialog({
  visible,
  busy,
  error,
  match,
  editingRound,
  scores,
  onClose,
  onChange,
  onSave,
}: Props) {
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const activePlayer = match?.players.find(
    (player) => player.id === activePlayerId,
  );
  const currentScore = activePlayerId ? (scores[activePlayerId] ?? '0') : '0';
  const parsedScore = Number(currentScore) || 0;
  const scoreDisplay = shownScore(currentScore);
  const firstPlayerId = match?.players[0]?.id;

  useEffect(() => {
    if (visible && firstPlayerId) setActivePlayerId(firstPlayerId);
    else if (!visible) setActivePlayerId(null);
  }, [editingRound?.id, firstPlayerId, match?.id, visible]);

  function appendDigit(digit: string) {
    if (!activePlayerId) return;
    const current = scores[activePlayerId] ?? '0';
    const negative = current.startsWith('-');
    const digits = current.replace(/^[+-]/, '');
    if (digits.length >= 12 && digits !== '0') return;
    const next = digits === '0' ? digit : `${digits}${digit}`;
    onChange(activePlayerId, `${negative && next !== '0' ? '-' : ''}${next}`);
  }

  function toggleSign() {
    if (!activePlayerId) return;
    if (currentScore.startsWith('-'))
      onChange(activePlayerId, String(Math.abs(parsedScore)));
    else
      onChange(activePlayerId, parsedScore === 0 ? '-0' : String(-parsedScore));
  }

  function removeDigit() {
    if (!activePlayerId) return;
    const negative = currentScore.startsWith('-');
    const digits = currentScore.replace(/^[+-]/, '');
    const next = digits.length <= 1 ? '0' : digits.slice(0, -1);
    onChange(activePlayerId, `${negative && next !== '0' ? '-' : ''}${next}`);
  }

  function clearScore() {
    if (activePlayerId) onChange(activePlayerId, '0');
  }

  const keypad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['sign', '0', 'delete'],
  ];

  return (
    <DialogModal
      visible={visible}
      onRequestClose={() => !busy && onClose()}
      style={styles.scoreDialog}
    >
      <View style={styles.dialogHeading}>
        <Text accessibilityRole="header" style={styles.dialogTitle}>
          {editingRound ? 'Sửa điểm ván' : 'Nhập điểm nhanh'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đóng nhập điểm"
          disabled={busy}
          onPress={onClose}
          style={styles.closeDialogButton}
        >
          <Feather name="x" size={20} color={colors.muted} />
        </Pressable>
      </View>
      <ScrollView
        testID="card-score-round-scroll"
        style={styles.scoreDialogScroll}
        contentContainerStyle={styles.scoreDialogContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          testID="card-score-player-choices"
          style={styles.scorePlayerChoices}
        >
          {match?.players.map((player) => (
            <Pressable
              key={player.id}
              accessibilityRole="button"
              accessibilityLabel={`Chọn điểm của ${player.name}`}
              accessibilityState={{ selected: player.id === activePlayerId }}
              disabled={busy}
              onPress={() => setActivePlayerId(player.id)}
              style={[
                styles.scorePlayerChoice,
                player.id === activePlayerId && styles.scorePlayerSelected,
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.scorePlayerChoiceName,
                  player.id === activePlayerId &&
                    styles.scorePlayerSelectedText,
                ]}
              >
                {player.name}
              </Text>
              <Text style={styles.scorePlayerChoiceValue}>
                {shownScore(scores[player.id])}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.activeScoreCard}>
          <Text style={styles.activeScoreLabel}>
            {activePlayer ? `ĐIỂM CỦA ${activePlayer.name}` : 'CHỌN NGƯỜI CHƠI'}
          </Text>
          <Text
            accessibilityLiveRegion="polite"
            style={[
              styles.activeScoreValue,
              parsedScore < 0 && styles.negative,
              parsedScore > 0 && styles.positive,
            ]}
          >
            {scoreDisplay}
          </Text>
        </View>

        <View style={styles.keypad}>
          {keypad.flatMap((row, rowIndex) =>
            row.map((key) => {
              const isSign = key === 'sign';
              const isDelete = key === 'delete';
              const label = isSign
                ? 'Dấu âm/dương'
                : isDelete
                  ? 'Xóa chữ số'
                  : `Số ${key}`;
              return (
                <Pressable
                  key={`${rowIndex}-${key}`}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  disabled={!activePlayerId || busy}
                  onPress={() =>
                    isSign
                      ? toggleSign()
                      : isDelete
                        ? removeDigit()
                        : appendDigit(key)
                  }
                  style={({ pressed }) => [
                    styles.keypadKey,
                    (isSign || isDelete) && styles.keypadUtility,
                    pressed && styles.keypadPressed,
                  ]}
                >
                  {isDelete ? (
                    <Feather name="delete" size={18} color={colors.earth} />
                  ) : (
                    <Text
                      style={[
                        styles.keypadText,
                        (isSign || isDelete) && styles.keypadUtilityText,
                      ]}
                    >
                      {isSign ? '±' : key}
                    </Text>
                  )}
                </Pressable>
              );
            }),
          )}
        </View>

        {!!error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
      </ScrollView>
      <View style={styles.scoreDialogActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Xóa điểm người chơi đang chọn"
          disabled={busy}
          onPress={clearScore}
          style={styles.clearScoreButton}
        >
          <Text style={styles.clearScoreText}>C</Text>
        </Pressable>
        <View style={styles.actionSpacer} />
        <Button
          title={busy ? 'Đang lưu…' : 'Lưu ván'}
          onPress={onSave}
          loading={busy}
          compact
        />
      </View>
    </DialogModal>
  );
}
