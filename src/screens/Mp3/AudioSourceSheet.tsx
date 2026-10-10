import { useContext, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { colors, layout, typography } from '../../theme';

const PICKER_LAUNCH_DELAY_MS = 300;

type Source = 'file' | 'album';
type Props = {
  visible: boolean;
  onClose: () => void;
  onPreparingPicker: (source: Source) => void;
  onChooseFile: () => void;
  onChooseAlbum: () => void;
};

export function AudioSourceSheet({
  visible,
  onClose,
  onPreparingPicker,
  onChooseFile,
  onChooseAlbum,
}: Props) {
  const insets = useContext(SafeAreaInsetsContext);
  const [pendingSource, setPendingSource] = useState<Source | null>(null);
  const pickerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pickerTimer.current) clearTimeout(pickerTimer.current);
    };
  }, []);

  const choose = (source: Source) => {
    setPendingSource(source);
    onPreparingPicker(source);
    onClose();
    pickerTimer.current = setTimeout(() => {
      pickerTimer.current = null;
      setPendingSource(null);
      if (source === 'file') onChooseFile();
      else onChooseAlbum();
    }, PICKER_LAUNCH_DELAY_MS);
  };

  return (
    <Modal
      transparent
      visible={visible && pendingSource === null}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đóng chọn nguồn âm thanh"
          onPress={onClose}
          style={styles.backdrop}
        />
        <View
          testID="audio-source-sheet"
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets?.bottom ?? 0, 16) },
          ]}
        >
          <View style={styles.grabber} />
          <View style={styles.header}>
            <View style={styles.headingCopy}>
              <Text accessibilityRole="header" style={styles.title}>
                Thêm âm thanh
              </Text>
              <Text style={typography.small}>Chọn nguồn tệp</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng chọn nguồn âm thanh"
              hitSlop={8}
              onPress={onClose}
              style={styles.closeButton}
            >
              <Feather name="x" size={20} color={colors.ink} />
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chọn file audio hoặc video"
            accessibilityHint="Mở ứng dụng Tệp để chọn audio hoặc video"
            onPress={() => choose('file')}
            style={({ pressed }) => [
              styles.option,
              pressed && styles.optionPressed,
            ]}
          >
            <View style={styles.optionIcon}>
              <Feather name="folder" size={18} color={colors.earth} />
            </View>
            <View style={styles.optionCopy}>
              <Text style={styles.optionTitle}>Chọn file audio hoặc video</Text>
              <Text style={styles.optionDetail}>Duyệt ứng dụng Tệp</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.muted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chọn video từ album"
            accessibilityHint="Mở album ảnh để chọn video"
            onPress={() => choose('album')}
            style={({ pressed }) => [
              styles.option,
              pressed && styles.optionPressed,
            ]}
          >
            <View style={styles.optionIcon}>
              <Feather name="film" size={18} color={colors.earth} />
            </View>
            <View style={styles.optionCopy}>
              <Text style={styles.optionTitle}>Chọn video từ album</Text>
              <Text style={styles.optionDetail}>Chỉ nhận video</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.muted} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.scrim,
  },
  sheet: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingTop: 9,
    paddingHorizontal: layout.screenGutter,
    gap: 10,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.background,
    shadowColor: colors.shadow,
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 12,
  },
  grabber: {
    width: 38,
    height: 4,
    alignSelf: 'center',
    marginBottom: 2,
    borderRadius: 2,
    backgroundColor: colors.line,
  },
  header: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headingCopy: { flex: 1, gap: 1 },
  title: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '700',
    color: colors.ink,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
  },
  option: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  optionPressed: { opacity: 0.72 },
  optionIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: colors.sunlightSoft,
  },
  optionCopy: { flex: 1, gap: 1 },
  optionTitle: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  optionDetail: { color: colors.muted, fontSize: 12, lineHeight: 16 },
});
