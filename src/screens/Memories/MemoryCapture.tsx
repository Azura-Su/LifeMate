import Feather from '@expo/vector-icons/Feather';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { colors } from '../../theme';
import { styles } from './MemoryScreen.styles';

export type CapturedMemoryPhoto = { uri: string; mimeType: string | null };

type Props = {
  active: boolean;
  onPhoto: (photo: CapturedMemoryPhoto) => void;
  onShowTimeline: () => void;
  memoryCount: number;
};

export function MemoryCapture({
  active,
  onPhoto,
  onShowTimeline,
  memoryCount,
}: Props) {
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      setAvailable(true);
      return;
    }
    let current = true;
    void CameraView.isAvailableAsync()
      .then((value) => {
        if (current) setAvailable(value);
      })
      .catch(() => {
        if (current) setAvailable(false);
      });
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    if (!active) setReady(false);
  }, [active]);

  useEffect(() => {
    if (!active || !available || !permission?.granted || ready || cameraFailed)
      return;
    const timeout = setTimeout(() => {
      setCameraFailed(true);
    }, 10000);
    return () => clearTimeout(timeout);
  }, [active, available, permission?.granted, ready, cameraFailed]);

  async function enableCamera() {
    setError(null);
    setCameraFailed(false);
    try {
      const response = permission?.granted
        ? permission
        : await requestPermission();
      if (!response.granted)
        setError('Cho phép máy ảnh trong Cài đặt để chụp khoảnh khắc.');
    } catch (cause) {
      setError((cause as Error).message || 'Chưa mở được máy ảnh.');
    }
  }

  async function capture() {
    if (!ready || busy || !active) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await camera.current?.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) throw new Error('Chưa chụp được ảnh. Hãy thử lại.');
      onPhoto({ uri: photo.uri, mimeType: 'image/jpeg' });
    } catch (cause) {
      setError((cause as Error).message || 'Chưa chụp được ảnh.');
    } finally {
      setBusy(false);
    }
  }

  const canPreview =
    active && available === true && permission?.granted && !cameraFailed;
  return (
    <View style={styles.capturePage}>
      <View style={styles.captureHeading}>
        <Text style={styles.captureEyebrow}>HÔM NAY</Text>
        <Text style={styles.captureTitle}>Một khoảnh khắc để nhớ</Text>
        <Text style={styles.captureHint}>
          Chụp ảnh rồi viết vài dòng cho riêng bạn.
        </Text>
      </View>
      <View style={styles.cameraFrame}>
        {canPreview ? (
          <CameraView
            ref={camera}
            style={styles.cameraPreview}
            facing={facing}
            mode="picture"
            onCameraReady={() => setReady(true)}
            onMountError={(event) => {
              setReady(false);
              setCameraFailed(true);
              setError(event.message || 'Máy ảnh chưa sẵn sàng.');
            }}
          />
        ) : (
          <View style={styles.cameraFallback}>
            <View style={styles.cameraFallbackIcon}>
              <Feather name="camera" size={35} color={colors.sky} />
            </View>
            <Text style={styles.cameraFallbackTitle}>
              {available === false || cameraFailed
                ? 'Máy ảnh chưa khả dụng'
                : permission === null || available === null
                  ? 'Đang kiểm tra máy ảnh…'
                  : 'Sẵn sàng chụp ảnh'}
            </Text>
            <Text style={styles.cameraFallbackText}>
              {available === false
                ? 'Thiết bị này không hỗ trợ chụp ảnh.'
                : cameraFailed
                  ? 'Hãy thử mở lại máy ảnh để chụp khoảnh khắc.'
                  : 'Bật máy ảnh khi bạn muốn chụp một khoảnh khắc mới.'}
            </Text>
            {available === true &&
              permission &&
              (!permission.granted || cameraFailed) && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    cameraFailed ? 'Thử mở lại máy ảnh' : 'Bật máy ảnh'
                  }
                  onPress={() => void enableCamera()}
                  style={styles.enableCameraButton}
                >
                  <Text style={styles.enableCameraText}>
                    {cameraFailed ? 'Thử lại' : 'Bật máy ảnh'}
                  </Text>
                </Pressable>
              )}
          </View>
        )}
        {canPreview && !ready && (
          <View pointerEvents="none" style={styles.cameraStarting}>
            <ActivityIndicator color={colors.earth} />
            <Text style={styles.cameraFallbackText}>Đang mở máy ảnh…</Text>
          </View>
        )}
        {canPreview && (
          <View pointerEvents="none" style={styles.cameraFrameLabel}>
            <Text style={styles.cameraFrameLabelText}>KHOẢNH KHẮC CỦA BẠN</Text>
          </View>
        )}
      </View>
      <View style={styles.cameraControls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chụp khoảnh khắc"
          accessibilityState={{ disabled: !canPreview || !ready || busy, busy }}
          disabled={!canPreview || !ready || busy}
          onPress={() => void capture()}
          style={[
            styles.shutterOuter,
            (!canPreview || !ready || busy) && styles.shutterDisabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.earth} />
          ) : (
            <View style={styles.shutterInner} />
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đổi camera trước sau"
          disabled={!canPreview || busy}
          onPress={() => {
            setReady(false);
            setFacing((current) => (current === 'back' ? 'front' : 'back'));
          }}
          style={styles.cameraSideButton}
        >
          <Feather name="refresh-cw" size={22} color={colors.earth} />
          <Text style={styles.cameraSideLabel}>Đổi camera</Text>
        </Pressable>
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Xem dòng ký ức, ${memoryCount} khoảnh khắc`}
        onPress={onShowTimeline}
        style={styles.viewTimelineButton}
      >
        <Feather name="grid" size={17} color={colors.earth} />
        <Text style={styles.viewTimelineText}>Xem ký ức · {memoryCount}</Text>
        <Feather name="arrow-right" size={17} color={colors.earth} />
      </Pressable>
      <Text style={styles.capturePrivacy}>
        Mặc định chỉ mình tôi · Có thể chọn chia sẻ khi lưu
      </Text>
    </View>
  );
}
