import { useContext, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { colors, layout, typography } from '../../theme';
import { AvatarCropPreview } from './AvatarCropPreview';
import type { AvatarCropRect, AvatarCropSource } from './avatarCrop';

type Props = {
  visible: boolean;
  source: AvatarCropSource | null;
  canEdit: boolean;
  busy: boolean;
  error: string | null;
  onShown?: () => void;
  onClose: () => void;
  onEdit: () => void;
  onPick: () => void;
  onApply: (crop: AvatarCropRect) => void;
};
export function AvatarEditorSheet({
  visible,
  source,
  canEdit,
  busy,
  error,
  onShown,
  onClose,
  onEdit,
  onPick,
  onApply,
}: Props) {
  const insets = useContext(SafeAreaInsetsContext);
  const pendingPicker = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushPicker = () => {
    if (!pendingPicker.current) return;
    pendingPicker.current = false;
    if (timer.current) clearTimeout(timer.current);
    onPick();
  };
  useEffect(
    () => () => {
      pendingPicker.current = false;
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const chooseLibrary = () => {
    if (busy || pendingPicker.current) return;
    pendingPicker.current = true;
    onClose();
    // iOS must finish dismissing its modal before presenting the native picker.
    if (Platform.OS !== 'ios') timer.current = setTimeout(flushPicker, 300);
  };
  return (
    <Modal
      testID="avatar-sheet-modal"
      visible={visible || !!source}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
      onShow={onShown}
      onDismiss={flushPicker}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đóng bảng ảnh đại diện"
          onPress={onClose}
          style={styles.backdrop}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets?.bottom ?? 0, 16) },
          ]}
        >
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              {source ? 'Căn chỉnh ảnh đại diện' : 'Ảnh đại diện'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng chỉnh sửa ảnh đại diện"
              onPress={onClose}
              style={styles.close}
            >
              <Feather name="x" size={20} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} bounces={false}>
            {source ? (
              <AvatarCropPreview
                key={source.uri}
                source={source}
                busy={busy}
                onApply={onApply}
                onClose={onClose}
              />
            ) : (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Chỉnh sửa ảnh hiện tại"
                  accessibilityState={{ disabled: busy || !canEdit }}
                  disabled={busy || !canEdit}
                  onPress={onEdit}
                  style={[styles.option, !canEdit && styles.disabled]}
                >
                  <View style={styles.optionIcon}>
                    <Feather name="crop" size={18} color={colors.earth} />
                  </View>
                  <View style={styles.copy}>
                    <Text style={styles.optionTitle}>
                      Chỉnh sửa ảnh hiện tại
                    </Text>
                    <Text style={styles.detail}>
                      {canEdit
                        ? 'Xem ảnh, kéo và cắt lại khung'
                        : 'Bạn chưa có ảnh đại diện riêng'}
                    </Text>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={18}
                    color={colors.muted}
                  />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Chọn ảnh từ thư viện"
                  accessibilityState={{ disabled: busy }}
                  disabled={busy}
                  onPress={chooseLibrary}
                  style={styles.option}
                >
                  <View style={styles.optionIcon}>
                    <Feather name="image" size={18} color={colors.earth} />
                  </View>
                  <View style={styles.copy}>
                    <Text style={styles.optionTitle}>Chọn ảnh từ thư viện</Text>
                    <Text style={styles.detail}>
                      Chọn ảnh mới và căn lại khung
                    </Text>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={18}
                    color={colors.muted}
                  />
                </Pressable>
                {busy && (
                  <View style={styles.loading}>
                    <ActivityIndicator size="small" color={colors.earth} />
                    <Text style={styles.detail}>Đang mở ảnh…</Text>
                  </View>
                )}
              </>
            )}
            {error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrim },
  sheet: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    maxHeight: '90%',
    alignSelf: 'center',
    paddingTop: 9,
    paddingHorizontal: layout.screenGutter,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.background,
  },
  grabber: {
    width: 38,
    height: 4,
    alignSelf: 'center',
    borderRadius: 2,
    backgroundColor: colors.line,
  },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: { flex: 1, ...typography.dialogTitle },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { gap: 12, paddingBottom: 4 },
  option: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  optionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.sunlightSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 3 },
  optionTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  detail: { fontSize: 12, lineHeight: 17, color: colors.muted },
  disabled: { opacity: 0.55 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
});
