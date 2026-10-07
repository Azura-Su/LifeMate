import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import Feather from '@expo/vector-icons/Feather';
import { colors, typography } from '../../theme';
import { formatAudioTime } from '../../utils/audio';
import { useAudioPlayback } from './useAudioPlayback';
import type { Playback } from './useMp3Screen';

export function AudioPlayer({
  source,
  onClose,
}: {
  source: Playback;
  onClose: () => void;
}) {
  const model = useAudioPlayback(source);
  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <Text style={[typography.heading, styles.title]} numberOfLines={2}>
          {source.title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đóng trình phát"
          onPress={onClose}
          style={styles.icon}
        >
          <Feather name="x" size={22} color={colors.ink} />
        </Pressable>
      </View>
      {model.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {model.error}
        </Text>
      ) : (
        <>
          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                model.status.playing ? 'Tạm dừng' : 'Phát âm thanh'
              }
              disabled={!model.status.isLoaded}
              onPress={() => void model.toggle()}
              style={styles.play}
            >
              {!model.status.isLoaded ? (
                <ActivityIndicator color={colors.green} />
              ) : (
                <Feather
                  name={model.status.playing ? 'pause' : 'play'}
                  size={26}
                  color={colors.green}
                />
              )}
            </Pressable>
            <Slider
              style={styles.slider}
              accessibilityLabel="Vị trí phát âm thanh"
              minimumValue={model.start}
              maximumValue={model.end}
              value={Math.min(
                model.end,
                Math.max(model.start, model.status.currentTime),
              )}
              disabled={!model.status.isLoaded}
              onSlidingComplete={(value) => void model.seek(value)}
              minimumTrackTintColor={colors.green}
              maximumTrackTintColor={colors.line}
              thumbTintColor={colors.green}
            />
          </View>
          <View style={styles.row}>
            <Text style={typography.small}>
              {formatAudioTime(
                Math.min(
                  source.endMs,
                  Math.max(source.startMs, model.status.currentTime * 1000),
                ),
              )}
            </Text>
            <Text style={typography.small}>
              {formatAudioTime(source.endMs)}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.primarySoft,
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { flex: 1, fontSize: 17 },
  icon: { padding: 12 },
  play: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 26,
  },
  slider: { flex: 1, minHeight: 44 },
  error: { color: colors.danger, lineHeight: 22 },
});
