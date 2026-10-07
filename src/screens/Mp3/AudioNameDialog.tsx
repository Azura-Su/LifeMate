import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { colors, typography } from '../../theme';
import { normalizeAudioTitle } from '../../utils/audio';

type Props = {
  initialTitle: string;
  renaming: boolean;
  busy: boolean;
  error: string | null;
  onSave: (title: string) => void;
  onClose: () => void;
};
export function AudioNameDialog(props: Props) {
  const [title, setTitle] = useState(props.initialTitle);
  const [error, setError] = useState<string | null>(null);
  function submit() {
    if (props.busy) return;
    try {
      props.onSave(normalizeAudioTitle(title));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={props.busy ? undefined : props.onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card} accessibilityViewIsModal>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <Text accessibilityRole="header" style={typography.heading}>
              {props.renaming ? 'Đổi tên âm thanh' : 'Đặt tên âm thanh'}
            </Text>
            <Text style={typography.body}>
              {props.renaming
                ? 'Tên này hiển thị trong thư viện của bạn.'
                : 'Đặt tên dễ nhớ cho bản nghe. Nếu chọn video, chỉ phần tiếng được lưu lại.'}
            </Text>
            <TextInput
              accessibilityLabel="Tên âm thanh"
              placeholder="Ví dụ: Nhạc thư giãn"
              placeholderTextColor={colors.muted}
              value={title}
              onChangeText={(value) => {
                setTitle(value);
                setError(null);
              }}
              editable={!props.busy}
              maxLength={120}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={submit}
              style={styles.input}
            />
            <Text style={typography.small}>
              {title.length}/120 ký tự · Không cần nhập đuôi file
            </Text>
            {(error || props.error) && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error || props.error}
              </Text>
            )}
            <Button
              title={props.renaming ? 'Lưu tên' : 'Lưu âm thanh'}
              disabled={props.busy}
              onPress={submit}
            />
            <Button
              title="Hủy"
              variant="secondary"
              disabled={props.busy}
              onPress={props.onClose}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#00000055',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    borderRadius: 24,
    backgroundColor: colors.background,
  },
  content: { padding: 24, gap: 16 },
  input: {
    minHeight: 52,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.green,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  error: { color: colors.danger, lineHeight: 22 },
});
