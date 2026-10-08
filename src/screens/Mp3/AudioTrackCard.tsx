import { Alert, Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Button } from '../../components/Button';
import { colors, typography } from '../../theme';
import type { AudioTrack } from '../../types/audio';
import { formatAudioTime } from '../../utils/audio';
import { styles } from './Mp3Screen.styles';
import { audioBackupUnavailable } from '../../config/audioCloud';
import { AudioTrackTitle } from './AudioTrackTitle';
import { SpinningRecord } from './SpinningRecord';

type Props = {
  track: AudioTrack;
  position: number;
  busy: boolean;
  playlistCount: number;
  onManagePlaylists: () => void;
  onSelect: () => void;
  onPlay: () => void;
  onTrim: () => void;
  onRename: () => void;
  onDelete: () => void;
  onSync: () => void;
  titleActive: boolean;
  onActivateTitle: () => void;
  isPlaying: boolean;
};

export function AudioTrackCard(props: Props) {
  const { track, position, busy } = props;
  const unavailable = track.synced
    ? null
    : audioBackupUnavailable(track.sizeBytes);
  const actions = [
    { icon: 'play' as const, title: 'Nghe', onPress: props.onPlay },
    {
      icon:
        props.playlistCount > 0 ? ('list' as const) : ('plus-circle' as const),
      title:
        props.playlistCount > 0
          ? `Trong ${props.playlistCount} DS`
          : 'Thêm vào DS nghe',
      onPress: props.onManagePlaylists,
    },
    { icon: 'scissors' as const, title: 'Cắt', onPress: props.onTrim },
  ];
  const confirmDelete = () =>
    Alert.alert(
      'Xóa file nghe?',
      track.synced
        ? `“${track.title}” sẽ bị xóa khỏi thiết bị và bản sao lưu. Bạn không thể khôi phục file này.`
        : `“${track.title}” sẽ bị xóa khỏi thiết bị. Bạn không thể khôi phục file này.`,
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Xóa file', style: 'destructive', onPress: props.onDelete },
      ],
      { cancelable: true },
    );
  return (
    <View
      testID="track-card"
      style={[styles.track, position >= 0 && styles.trackSelected]}
    >
      <View style={[styles.row, styles.trackTopRow]}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={`Chọn ${track.title} để ghép`}
          accessibilityState={{ checked: position >= 0, disabled: busy }}
          onPress={props.onSelect}
          disabled={busy}
          style={styles.icon}
        >
          {position >= 0 ? (
            <Text style={styles.order}>{position + 1}</Text>
          ) : (
            <Feather name="square" size={23} color={colors.muted} />
          )}
        </Pressable>
        <View style={styles.flex}>
          <View style={styles.trackTitleRow} testID="track-title-row">
            <AudioTrackTitle
              key={track.title}
              title={track.title}
              active={props.titleActive}
              onActivate={props.onActivateTitle}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Đổi tên ${track.title}`}
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={props.onRename}
              style={styles.titleIcon}
              hitSlop={4}
            >
              <Feather name="edit-2" size={17} color={colors.earth} />
            </Pressable>
          </View>
          <Text style={typography.small}>
            {formatAudioTime(track.durationMs)} ·{' '}
            {track.fileName.split('.').pop()?.toUpperCase()} ·{' '}
            {(track.sizeBytes / 1048576).toFixed(1)} MB
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Xóa ${track.title}`}
        accessibilityHint="Hiện thông báo xác nhận trước khi xóa file"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={confirmDelete}
        style={styles.trackDelete}
        hitSlop={4}
      >
        <Feather name="trash-2" size={20} color={colors.danger} />
      </Pressable>
      <Text style={styles.sync}>
        {!track.synced
          ? '○ Chỉ trên máy'
          : track.pendingTitle
            ? '○ Tên mới chờ đồng bộ'
            : '✓ Đã sao lưu trên đám mây'}
      </Text>
      <View style={styles.actions}>
        {actions.map((action) => (
          <Pressable
            key={action.title}
            accessibilityRole="button"
            accessibilityLabel={`${props.isPlaying && action.title === 'Nghe' ? 'Đang phát' : action.title} ${track.title}`}
            disabled={busy}
            onPress={action.onPress}
            style={styles.action}
          >
            {action.title === 'Nghe' && props.isPlaying ? (
              <SpinningRecord playing visible={false} size={20} />
            ) : (
              <Feather name={action.icon} size={18} color={colors.earth} />
            )}
            <Text style={styles.actionText}>{action.title}</Text>
          </Pressable>
        ))}
      </View>
      {(!track.synced || track.pendingTitle) && (
        <>
          <Button
            title={track.synced ? 'Đồng bộ tên' : 'Sao lưu miễn phí'}
            variant="secondary"
            disabled={busy || !!unavailable}
            onPress={props.onSync}
          />
          {!track.synced && (
            <Text style={typography.small}>
              {unavailable ??
                'Lưu bản sao riêng để tải lại trên thiết bị khác khi đăng nhập cùng tài khoản.'}
            </Text>
          )}
        </>
      )}
    </View>
  );
}
