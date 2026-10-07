import { Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Button } from '../../components/Button';
import { colors, typography } from '../../theme';
import type { AudioTrack } from '../../types/audio';
import { formatAudioTime } from '../../utils/audio';
import { styles } from './Mp3Screen.styles';

type Props = {
  track: AudioTrack;
  position: number;
  busy: boolean;
  onSelect: () => void;
  onPlay: () => void;
  onTrim: () => void;
  onRename: () => void;
  onSync: () => void;
};
export function AudioTrackCard(props: Props) {
  const { track, position, busy } = props;
  const actions = [
    { icon: 'play' as const, title: 'Nghe', onPress: props.onPlay },
    { icon: 'scissors' as const, title: 'Cắt', onPress: props.onTrim },
    { icon: 'edit-2' as const, title: 'Đổi tên', onPress: props.onRename },
  ];
  return (
    <View style={[styles.track, position >= 0 && styles.trackSelected]}>
      <View style={styles.row}>
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
          <Text style={styles.trackTitle} numberOfLines={2}>
            {track.title}
          </Text>
          <Text style={typography.small}>
            {formatAudioTime(track.durationMs)} ·{' '}
            {track.fileName.split('.').pop()?.toUpperCase()} ·{' '}
            {(track.sizeBytes / 1048576).toFixed(1)} MB
          </Text>
        </View>
      </View>
      <Text style={styles.sync}>
        {!track.synced
          ? '○ Chỉ trên máy'
          : track.pendingTitle
            ? '○ Tên mới chờ đồng bộ'
            : '✓ Đã sao lưu trên Firebase'}
      </Text>
      <View style={styles.actions}>
        {actions.map((action) => (
          <Pressable
            key={action.title}
            accessibilityRole="button"
            accessibilityLabel={`${action.title} ${track.title}`}
            disabled={busy}
            onPress={action.onPress}
            style={styles.action}
          >
            <Feather name={action.icon} size={18} color={colors.green} />
            <Text style={styles.actionText}>{action.title}</Text>
          </Pressable>
        ))}
      </View>
      {(!track.synced || track.pendingTitle) && (
        <>
          <Button
            title={
              track.synced ? 'Đồng bộ tên lên Firebase' : 'Sao lưu lên Firebase'
            }
            variant="secondary"
            disabled={busy}
            onPress={props.onSync}
          />
          {!track.synced && (
            <Text style={typography.small}>
              Lưu bản sao để tải lại trên thiết bị khác khi đăng nhập cùng tài
              khoản.
            </Text>
          )}
        </>
      )}
    </View>
  );
}
