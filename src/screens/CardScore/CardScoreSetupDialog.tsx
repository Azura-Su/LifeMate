import Feather from '@expo/vector-icons/Feather';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { DialogModal } from '../../components/DialogModal';
import { colors } from '../../theme';
import {
  MAX_CARD_SCORE_PLAYERS,
  MIN_CARD_SCORE_PLAYERS,
} from '../../utils/cardScore';
import { styles } from './CardScoreScreen.styles';

type Props = {
  visible: boolean;
  busy: boolean;
  error: string | null;
  title: string;
  onTitleChange: (value: string) => void;
  playerNames: string[];
  drawnSeats: string[] | null;
  onClose: () => void;
  onCreate: () => void;
  onNameChange: (index: number, value: string) => void;
  onRemovePlayer: (index: number) => void;
  onAddPlayer: () => void;
  onDrawSeats: () => void;
};

export function CardScoreSetupDialog({
  visible,
  busy,
  error,
  title,
  onTitleChange,
  playerNames,
  drawnSeats,
  onClose,
  onCreate,
  onNameChange,
  onRemovePlayer,
  onAddPlayer,
  onDrawSeats,
}: Props) {
  return (
    <DialogModal
      visible={visible}
      onRequestClose={() => !busy && onClose()}
      style={styles.dialog}
    >
      <ScrollView
        testID="card-score-setup-scroll"
        style={styles.dialogScroll}
        contentContainerStyle={styles.dialogContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.dialogHeading}>
          <Text accessibilityRole="header" style={styles.dialogTitle}>
            Tạo bàn chơi
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng tạo bàn chơi"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={onClose}
            style={[styles.closeDialogButton, busy && styles.disabledAction]}
          >
            <Feather name="x" size={20} color={colors.muted} />
          </Pressable>
        </View>
        <Text style={styles.fieldLabel}>Tên trò chơi hoặc bàn</Text>
        <TextInput
          accessibilityLabel="Tên bàn chơi"
          placeholder="Ví dụ: Phỏm, Tiến lên, bài vui cuối tuần"
          placeholderTextColor={colors.muted}
          value={title}
          onChangeText={onTitleChange}
          maxLength={60}
          editable={!busy}
          style={[styles.input, busy && styles.disabledAction]}
        />

        <View style={styles.fieldHeading}>
          <Text style={styles.fieldLabel}>Người chơi</Text>
          <Text style={styles.playerCount}>
            {playerNames.length}/{MAX_CARD_SCORE_PLAYERS}
          </Text>
        </View>
        {playerNames.map((name, index) => (
          <View key={`player-${index}`} style={styles.nameInputRow}>
            <Text style={styles.nameNumber}>{index + 1}</Text>
            <TextInput
              accessibilityLabel={`Tên người chơi ${index + 1}`}
              placeholder={`Tên người chơi ${index + 1}`}
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={(value) => onNameChange(index, value)}
              maxLength={32}
              returnKeyType="next"
              editable={!busy}
              style={[
                styles.input,
                styles.nameInput,
                busy && styles.disabledAction,
              ]}
            />
            {playerNames.length > MIN_CARD_SCORE_PLAYERS && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Bỏ người chơi ${index + 1}`}
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={() => onRemovePlayer(index)}
                style={[styles.removePlayer, busy && styles.disabledAction]}
              >
                <Feather name="x" size={17} color={colors.muted} />
              </Pressable>
            )}
          </View>
        ))}
        <View
          testID="card-score-setup-secondary-actions"
          style={styles.setupSecondaryActions}
        >
          {playerNames.length < MAX_CARD_SCORE_PLAYERS && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thêm người chơi"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={onAddPlayer}
              style={[
                styles.setupSecondaryAction,
                styles.addPlayer,
                busy && styles.disabledAction,
              ]}
            >
              <Feather name="plus" size={16} color={colors.earth} />
              <Text style={styles.drawButtonText}>Thêm người chơi</Text>
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bốc thăm vị trí & người chia bài"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={onDrawSeats}
            style={[
              styles.setupSecondaryAction,
              styles.drawSetupButton,
              busy && styles.disabledAction,
            ]}
          >
            <Feather name="shuffle" size={16} color={colors.earth} />
            <Text style={styles.drawButtonText}>Bốc thăm</Text>
          </Pressable>
        </View>
        {drawnSeats && (
          <View style={styles.drawResult}>
            {drawnSeats.map((playerId, index) => (
              <Text key={playerId} style={styles.drawResultText}>
                {index + 1}.{' '}
                {playerNames[Number(playerId.slice(7)) - 1]?.trim()}
                {index === 0 ? ' · Chia bài' : ''}
              </Text>
            ))}
          </View>
        )}
        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
      </ScrollView>
      <View testID="card-score-setup-footer" style={styles.dialogFooter}>
        {busy ? (
          <View
            accessible
            accessibilityLabel="Đang tạo bàn"
            accessibilityRole="progressbar"
            style={styles.createLoadingButton}
          >
            <ActivityIndicator color={colors.onPrimary} />
          </View>
        ) : (
          <Pressable
            testID="card-score-create-button"
            accessibilityRole="button"
            accessibilityLabel="Tạo"
            onPress={onCreate}
            style={styles.createButton}
          >
            <Text style={styles.createButtonText}>Tạo</Text>
          </Pressable>
        )}
      </View>
    </DialogModal>
  );
}
