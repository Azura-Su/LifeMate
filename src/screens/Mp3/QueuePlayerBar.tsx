import { Pressable, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import Feather from '@expo/vector-icons/Feather';
import { colors, typography } from '../../theme';
import { formatAudioTime } from '../../utils/audio';
import { AudioTrackTitle } from './AudioTrackTitle';
import type { useQueuePlayer } from './useQueuePlayer';

type Props = {
  queue: ReturnType<typeof useQueuePlayer>;
  title: string;
  subtitle: string;
  repeatAll: boolean;
  repeatCurrent: boolean;
  onToggleRepeatCurrent: () => void;
};

export function QueuePlayerBar({
  queue,
  title,
  subtitle,
  repeatAll,
  repeatCurrent,
  onToggleRepeatCurrent,
}: Props) {
  const { status } = queue;
  const visuallyPlaying = status.playing || queue.isSwitchingTrack;
  const duration = status.duration || 0;
  const hasNext = queue.hasNext();
  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={typography.small}>{subtitle}</Text>
          <AudioTrackTitle
            title={title}
            active={visuallyPlaying}
            style={styles.titleViewport}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dừng phát"
          onPress={queue.stop}
          style={styles.icon}
        >
          <Feather name="x" size={22} color={colors.ink} />
        </Pressable>
      </View>
      {queue.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {queue.error}
        </Text>
      ) : (
        <>
          <Slider
            style={styles.slider}
            accessibilityLabel="Vị trí phát âm thanh"
            minimumValue={0}
            maximumValue={Math.max(duration, 0.1)}
            value={Math.min(duration, status.currentTime)}
            disabled={!status.isLoaded}
            onSlidingComplete={queue.seek}
            minimumTrackTintColor={colors.sky}
            maximumTrackTintColor={colors.line}
            thumbTintColor={colors.sky}
          />
          <View style={styles.row}>
            <Text style={typography.small}>
              {formatAudioTime(status.currentTime * 1000)}
            </Text>
            <Text style={typography.small}>
              {formatAudioTime(duration * 1000)}
            </Text>
          </View>
          <View style={styles.controls}>
            <View
              testID="player-transport-controls"
              style={[
                styles.transportControls,
                repeatAll && styles.transportControlsFullWidth,
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Bài trước"
                onPress={queue.previous}
                style={styles.icon}
              >
                <Feather name="skip-back" size={24} color={colors.earth} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={visuallyPlaying ? 'Tạm dừng' : 'Phát'}
                disabled={!status.isLoaded || queue.isSwitchingTrack}
                onPress={queue.toggle}
                style={styles.play}
              >
                <Feather
                  name={visuallyPlaying ? 'pause' : 'play'}
                  size={28}
                  color={colors.earth}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Bài tiếp theo"
                disabled={!hasNext}
                onPress={queue.next}
                style={[styles.icon, !hasNext && styles.dim]}
              >
                <Feather name="skip-forward" size={24} color={colors.earth} />
              </Pressable>
            </View>
            {!repeatAll && (
              <Pressable
                accessibilityRole="switch"
                accessibilityLabel={
                  repeatCurrent
                    ? 'Tắt lặp lại bài hiện tại'
                    : 'Lặp lại bài hiện tại'
                }
                accessibilityHint="Phát lại bài đang nghe khi bài kết thúc"
                accessibilityState={{ checked: repeatCurrent }}
                onPress={onToggleRepeatCurrent}
                style={[styles.repeatButton, repeatCurrent && styles.repeatOn]}
              >
                <Feather
                  name="repeat"
                  size={20}
                  color={repeatCurrent ? colors.sunlight : colors.earth}
                />
              </Pressable>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.skySoft,
    borderRadius: 20,
    padding: 16,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  flex: { flex: 1 },
  titleViewport: {
    height: 36,
    flexShrink: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  icon: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  transportControls: {
    flex: 1,
    paddingRight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  transportControlsFullWidth: {
    paddingRight: 0,
  },
  repeatButton: {
    width: 44,
    height: 44,
    position: 'absolute',
    right: 0,
    top: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  repeatOn: {
    backgroundColor: colors.sunlightSoft,
    borderWidth: 1,
    borderColor: colors.sunlightBorder,
  },
  play: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 28,
  },
  slider: { minHeight: 44 },
  error: { color: colors.danger, lineHeight: 22 },
  dim: { opacity: 0.3 },
});
