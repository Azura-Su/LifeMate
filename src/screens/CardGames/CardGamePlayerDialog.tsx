import { Text, View, StyleSheet, ScrollView } from 'react-native';
import { DialogModal } from '../../components/DialogModal';
import { DialogCloseButton } from '../../components/DialogCloseButton';
import { Button } from '../../components/Button';
import { colors, spacing, typography, radius } from '../../theme';
import type { GameMember } from '../../types/cardGame';
import { CardGameAvatarImage } from './CardGameAvatarImage';
const AVATAR_SIZE = 72;

export function CardGamePlayerDialog({
  member,
  balanceUnit = 'đ',
  owner,
  self,
  canKick,
  busy,
  onClose,
  onKick,
}: {
  member: GameMember;
  balanceUnit?: 'đ' | 'điểm';
  owner: boolean;
  self: boolean;
  canKick: boolean;
  busy: boolean;
  onClose: () => void;
  onKick: () => void;
}) {
  return (
    <DialogModal
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
      onRequestClose={onClose}
      onBackdropPress={onClose}
      style={styles.dialog}
    >
      <View style={styles.heading}>
        <Text style={typography.dialogTitle}>Thông tin người chơi</Text>
        <DialogCloseButton
          accessibilityLabel="Đóng thông tin người chơi"
          onPress={onClose}
        />
      </View>
      <ScrollView
        testID="player-info-scroll"
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        <View style={styles.avatar}>
          <Text style={typography.heading}>
            {member.name.slice(0, 1).toUpperCase()}
          </Text>
          <CardGameAvatarImage
            uid={member.uid}
            url={member.avatarUrl}
            name={member.name}
            size={AVATAR_SIZE}
          />
        </View>
        <Text style={styles.name}>
          {member.name}
          {self ? ' (Bạn)' : ''}
        </Text>
        <Text style={typography.body}>
          {owner ? 'Chủ phòng' : 'Thành viên'} ·{' '}
          {member.ready ? 'Sẵn sàng' : 'Chưa sẵn sàng'}
        </Text>
        <Text style={typography.body}>Số ván thắng: {member.wins}</Text>
        <Text style={typography.body}>
          Số dư bàn: {(member.balance ?? 0).toLocaleString('vi-VN')} {balanceUnit}
        </Text>
        {canKick && (
          <Button title="Kích người chơi" disabled={busy} onPress={onKick} />
        )}
      </ScrollView>
    </DialogModal>
  );
}
const styles = StyleSheet.create({
  dialog: {
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.lg,
    maxHeight: '90%',
  },
  scroll: { flexShrink: 1 },
  content: { gap: spacing.md },
  heading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...typography.heading, color: colors.ink },
});
