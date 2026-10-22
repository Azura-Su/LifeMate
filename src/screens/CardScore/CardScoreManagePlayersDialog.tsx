import Feather from '@expo/vector-icons/Feather';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { DialogModal } from '../../components/DialogModal';
import { AppTextInput as TextInput } from '../../components/AppTextInput';
import {
  MAX_CARD_SCORE_PLAYERS,
  MIN_CARD_SCORE_PLAYERS,
} from '../../utils/cardScore';
import { colors } from '../../theme';
import type { CardScorePlayer } from '../../types/cardScore';
import { styles } from './CardScoreScreen.styles';

type Props = {
  visible: boolean;
  maxPlayers?: number;
  minPlayers?: number;
  maxNameLength?: number;
  busy: boolean;
  error: string | null;
  players: CardScorePlayer[];
  newPlayerName: string;
  hasChanges: boolean;
  onPlayerNameChange: (id: string, value: string) => void;
  onNewPlayerNameChange: (value: string) => void;
  onRemovePlayer: (id: string) => void;
  onAddPlayer: () => void;
  onClose: () => void;
  onSave: () => void;
};

export function CardScoreManagePlayersDialog({
  visible,
  maxPlayers = MAX_CARD_SCORE_PLAYERS,
  minPlayers = MIN_CARD_SCORE_PLAYERS,
  maxNameLength = 32,
  busy,
  error,
  players,
  newPlayerName,
  hasChanges,
  onPlayerNameChange,
  onNewPlayerNameChange,
  onRemovePlayer,
  onAddPlayer,
  onClose,
  onSave,
}: Props) {
  return (
    <DialogModal
      visible={visible}
      onRequestClose={() => !busy && onClose()}
      style={styles.managePlayersDialog}
    >
      <View style={styles.dialogHeading}>
        <View style={styles.managePlayersTitleGroup}>
          <Text accessibilityRole="header" style={styles.dialogTitle}>
            Quản lý người chơi
          </Text>
          <Text style={styles.playerCount}>
            {Number.isFinite(maxPlayers)
              ? `${players.length}/${maxPlayers}`
              : `${players.length} người`}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đóng quản lý người chơi"
          disabled={busy}
          onPress={onClose}
          style={styles.closeDialogButton}
        >
          <Feather name="x" size={20} color={colors.muted} />
        </Pressable>
      </View>
      <View style={styles.managePlayersWarning}>
        <Feather name="alert-triangle" size={14} color={colors.danger} />
        <Text style={styles.managePlayersWarningText}>
          Khi xóa, điểm người đó trong các ván đã ghi cũng bị xóa.
        </Text>
      </View>
      <ScrollView
        testID="card-score-manage-players-scroll"
        style={styles.managePlayersScroll}
        contentContainerStyle={styles.managePlayersList}
        keyboardShouldPersistTaps="handled"
      >
        {players.map((player, index) => (
          <View key={player.id} style={styles.managePlayerRow}>
            <Text style={styles.nameNumber}>{index + 1}</Text>
            <TextInput
              accessibilityLabel={`Tên người chơi ${index + 1}`}
              editable={!busy}
              value={player.name}
              onChangeText={(value) => onPlayerNameChange(player.id, value)}
              maxLength={maxNameLength}
              returnKeyType="done"
              style={[styles.input, styles.managePlayerInput]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Xóa người chơi ${player.name || index + 1}`}
              accessibilityState={{
                disabled: busy || players.length <= minPlayers,
              }}
              disabled={busy || players.length <= minPlayers}
              onPress={() => onRemovePlayer(player.id)}
              style={[
                styles.managePlayerDelete,
                (busy || players.length <= minPlayers) && styles.disabledAction,
              ]}
            >
              <Feather name="x" size={17} color={colors.danger} />
            </Pressable>
          </View>
        ))}
        {players.length < maxPlayers && (
          <View style={styles.managePlayerRow}>
            <View style={styles.nameNumberSpacer} />
            <TextInput
              accessibilityLabel="Tên người chơi mới"
              editable={!busy}
              placeholder="Tên người chơi mới"
              placeholderTextColor={colors.muted}
              value={newPlayerName}
              onChangeText={onNewPlayerNameChange}
              maxLength={maxNameLength}
              returnKeyType="done"
              onSubmitEditing={onAddPlayer}
              style={[styles.input, styles.managePlayerInput]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thêm người chơi vào bàn"
              accessibilityState={{ disabled: busy || !newPlayerName.trim() }}
              disabled={busy || !newPlayerName.trim()}
              onPress={onAddPlayer}
              style={[
                styles.managePlayerAdd,
                (busy || !newPlayerName.trim()) && styles.disabledAction,
              ]}
            >
              <Feather name="plus" size={19} color={colors.earth} />
            </Pressable>
          </View>
        )}
        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
      </ScrollView>
      <Button
        title="Lưu thay đổi"
        onPress={onSave}
        loading={busy}
        disabled={!hasChanges}
        compact
      />
    </DialogModal>
  );
}
