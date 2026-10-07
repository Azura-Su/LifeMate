import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { colors, typography } from '../../theme';
import type { AudioJob, EditSegment } from '../../types/audio';
import { formatAudioTime } from '../../utils/audio';
import { useAudioEditor } from './useAudioEditor';
import { AudioJobStatus } from './AudioJobStatus';
import { AudioPlayer } from './AudioPlayer';
import type { Playback } from './useMp3Screen';

type Props = {
  initial: EditSegment[];
  job: AudioJob | null;
  error: string | null;
  playback: Playback | null;
  onClose: () => void;
  onCancel: () => void;
  onStop: () => void;
  onSave: (segments: EditSegment[], title: string) => void;
  onPreview: (segment: EditSegment) => void;
};
export function AudioEditor(props: Props) {
  const model = useAudioEditor(props.initial);
  const merging = props.initial.length > 1;
  return (
    <Modal visible animationType="slide" onRequestClose={props.onClose}>
      <Screen>
        <View style={styles.row}>
          <Text
            accessibilityRole="header"
            style={[typography.title, styles.flex]}
          >
            {merging ? 'Ghép âm thanh' : 'Cắt âm thanh'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng chỉnh sửa"
            disabled={!!props.job}
            onPress={props.onClose}
            style={styles.icon}
          >
            <Feather name="x" size={24} color={colors.ink} />
          </Pressable>
        </View>
        <Text style={typography.body}>
          {merging
            ? 'Các đoạn sẽ phát nối tiếp từ trên xuống. Chỉnh khoảng thời gian hoặc đổi thứ tự theo ý bạn.'
            : 'Chọn đoạn muốn giữ. Bản gốc sẽ không thay đổi.'}
        </Text>
        <Text style={typography.small}>
          Thời gian dạng phút:giây hoặc số giây · ví dụ 1:20 hoặc 80
        </Text>
        {model.drafts.map((draft, index) => (
          <View key={draft.track.id} style={styles.segment}>
            <View style={styles.row}>
              <Text style={styles.number}>{index + 1}</Text>
              <View style={styles.flex}>
                <Text style={typography.heading} numberOfLines={2}>
                  {draft.track.title}
                </Text>
                <Text style={typography.small}>
                  Độ dài gốc {formatAudioTime(draft.track.durationMs)}
                </Text>
              </View>
              {merging && (
                <View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Đưa ${draft.track.title} lên`}
                    disabled={index === 0 || !!props.job}
                    onPress={() => model.move(index, -1)}
                    style={[styles.icon, index === 0 && styles.dim]}
                  >
                    <Feather name="arrow-up" size={20} color={colors.green} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Đưa ${draft.track.title} xuống`}
                    disabled={index === model.drafts.length - 1 || !!props.job}
                    onPress={() => model.move(index, 1)}
                    style={[
                      styles.icon,
                      index === model.drafts.length - 1 && styles.dim,
                    ]}
                  >
                    <Feather name="arrow-down" size={20} color={colors.green} />
                  </Pressable>
                </View>
              )}
            </View>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={typography.small}>Bắt đầu</Text>
                <TextInput
                  accessibilityLabel={`Bắt đầu đoạn ${index + 1}`}
                  value={draft.start}
                  onChangeText={(value) =>
                    model.change(draft.track.id, 'start', value)
                  }
                  editable={!props.job}
                  style={styles.input}
                  keyboardType="numbers-and-punctuation"
                  selectTextOnFocus
                />
              </View>
              <View style={styles.flex}>
                <Text style={typography.small}>Kết thúc</Text>
                <TextInput
                  accessibilityLabel={`Kết thúc đoạn ${index + 1}`}
                  value={draft.end}
                  onChangeText={(value) =>
                    model.change(draft.track.id, 'end', value)
                  }
                  editable={!props.job}
                  style={styles.input}
                  keyboardType="numbers-and-punctuation"
                  selectTextOnFocus
                />
              </View>
            </View>
            <Button
              title={`Nghe thử đoạn ${index + 1}`}
              variant="secondary"
              disabled={!!props.job}
              onPress={() => model.preview(index, props.onPreview)}
            />
          </View>
        ))}
        {props.playback && (
          <AudioPlayer
            key={props.playback.key}
            source={props.playback}
            onClose={props.onStop}
          />
        )}
        <View style={styles.field}>
          <Text style={typography.heading}>Tên bản mới</Text>
          <TextInput
            accessibilityLabel="Tên bản âm thanh mới"
            value={model.title}
            onChangeText={model.setTitle}
            editable={!props.job}
            maxLength={120}
            style={styles.input}
          />
          <Text style={typography.small}>
            Tổng thời lượng đã chọn: {formatAudioTime(model.totalMs)} · Lưu dạng
            M4A
          </Text>
        </View>
        {(model.error || props.error) && (
          <Text accessibilityRole="alert" style={styles.error}>
            {model.error || props.error}
          </Text>
        )}
        {props.job ? (
          <AudioJobStatus job={props.job} onCancel={props.onCancel} />
        ) : (
          <Button
            title={merging ? 'Ghép và lưu bản mới' : 'Cắt và lưu bản mới'}
            onPress={() => model.submit(props.onSave)}
          />
        )}
      </Screen>
    </Modal>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  segment: {
    padding: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: 20,
  },
  number: { color: colors.green, fontWeight: '700', fontSize: 24, width: 28 },
  icon: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 14,
    minHeight: 52,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 16,
  },
  field: { gap: 12 },
  error: { color: colors.danger, lineHeight: 22 },
  dim: { opacity: 0.3 },
});
