import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { AudioJob } from '../../types/audio';
import { colors } from '../../theme';

export function AudioJobStatus({
  job,
  onCancel,
}: {
  job: AudioJob;
  onCancel: () => void;
}) {
  const progress =
    job.progress === null
      ? null
      : Math.round(Math.max(0, Math.min(job.progress, 1)) * 100);

  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <ActivityIndicator color={colors.earth} size="small" />
        <Text
          accessibilityLiveRegion="polite"
          numberOfLines={2}
          style={styles.label}
        >
          {job.label}
          {progress !== null ? ` ${progress}%` : ''}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hủy thao tác"
          hitSlop={6}
          onPress={onCancel}
          style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
        >
          <Text style={styles.cancelText}>Hủy</Text>
        </Pressable>
      </View>
      {progress !== null && (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`Tiến trình ${progress}%`}
          accessibilityValue={{ min: 0, max: 100, now: progress }}
          style={styles.progressTrack}
        >
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    padding: 10,
    gap: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.skySoft,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: {
    flex: 1,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  cancel: {
    minWidth: 48,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  cancelText: { color: colors.earth, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  progressTrack: {
    height: 4,
    marginLeft: 26,
    overflow: 'hidden',
    borderRadius: 2,
    backgroundColor: colors.line,
  },
  progressFill: { height: '100%', backgroundColor: colors.earth },
});
