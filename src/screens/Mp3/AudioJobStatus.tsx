import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import type { AudioJob } from '../../types/audio';
import { colors, typography } from '../../theme';

export function AudioJobStatus({
  job,
  onCancel,
}: {
  job: AudioJob;
  onCancel: () => void;
}) {
  return (
    <View style={styles.box}>
      <ActivityIndicator color={colors.green} />
      <Text accessibilityLiveRegion="polite" style={typography.body}>
        {job.label}
        {job.progress !== null ? ` ${Math.round(job.progress * 100)}%` : ''}
      </Text>
      <Text style={typography.small}>Giữ ứng dụng mở trong lúc xử lý.</Text>
      <Button title="Hủy thao tác" variant="secondary" onPress={onCancel} />
    </View>
  );
}
const styles = StyleSheet.create({
  box: {
    padding: 16,
    gap: 12,
    borderRadius: 16,
    backgroundColor: colors.cream,
  },
});
