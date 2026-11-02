import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { DialogModal } from '../../components/DialogModal';
import { roomCodeFromQr } from '../../services/cardGames/roomQr';
import { colors, fontSize, radius, spacing } from '../../theme';

export function CardRoomScanner({
  onCode,
  onClose,
}: {
  onCode: (code: string) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const consumed = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      consumed.current = true;
    };
  }, []);
  useEffect(() => {
    if (!permission?.granted || ready || failed) return;
    const timer = setTimeout(() => {
      consumed.current = true;
      setFailed(true);
      setError('Không mở được camera. Bạn có thể nhập mã phòng thủ công.');
    }, 10000);
    return () => clearTimeout(timer);
  }, [permission?.granted, ready, failed]);
  const close = () => {
    consumed.current = true;
    onClose();
  };
  return (
    <DialogModal
      onRequestClose={close}
      onBackdropPress={close}
      style={styles.dialog}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          Quét QR vào phòng
        </Text>
        <Text style={styles.hint}>
          Đưa mã QR trong mục Mã phòng của bạn bè vào khung hình.
        </Text>
        {!permission?.granted ? (
          <>
            <Text style={styles.hint}>
              Cho phép dùng camera để quét mã phòng.
            </Text>
            <Button
              title={
                permission?.canAskAgain === false
                  ? 'Mở cài đặt camera'
                  : 'Cho phép camera'
              }
              onPress={() => {
                setError(null);
                void (
                  permission?.canAskAgain === false
                    ? Linking.openSettings()
                    : requestPermission()
                ).catch(() => {
                  if (mounted.current)
                    setError('Không cấp được quyền camera. Hãy nhập mã phòng.');
                });
              }}
            />
          </>
        ) : !failed ? (
          <View style={styles.cameraFrame}>
            <CameraView
              testID="room-qr-camera"
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onCameraReady={() => {
                if (mounted.current) setReady(true);
              }}
              onMountError={() => {
                if (!mounted.current) return;
                consumed.current = true;
                setFailed(true);
                setError(
                  'Không mở được camera. Bạn có thể nhập mã phòng thủ công.',
                );
              }}
              onBarcodeScanned={({ data }) => {
                if (!mounted.current || consumed.current) return;
                const code = roomCodeFromQr(data);
                if (!code) {
                  setError('QR này không phải mã mời phòng LifeMate.');
                  return;
                }
                consumed.current = true;
                onCode(code);
              }}
            />
          </View>
        ) : null}
        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <Button title="Nhập mã thủ công" variant="secondary" onPress={close} />
      </ScrollView>
    </DialogModal>
  );
}

const styles = StyleSheet.create({
  dialog: { maxHeight: '90%' },
  content: { gap: spacing.md },
  title: { color: colors.ink, fontSize: fontSize.heading, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: fontSize.body },
  error: { color: colors.danger, fontSize: fontSize.body },
  cameraFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.ink,
  },
});
