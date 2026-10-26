import Feather from '@expo/vector-icons/Feather';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { colors } from '../../theme';
import { styles } from './MemoryScreen.styles';

export type CapturedMemoryPhoto = {
  uri: string;
  mimeType: string | null;
  aspectRatio: number;
  width?: number;
  height?: number;
};

type Props = {
  active: boolean;
  onPhoto: (photo: CapturedMemoryPhoto) => void;
  onCapturingChange: (capturing: boolean) => void;
};

export function MemoryCapture({ active, onPhoto, onCapturingChange }: Props) {
  const camera = useRef<CameraView>(null);
  const captureInFlight = useRef(false);
  const cameraSession = useRef(0);
  const readyRef = useRef(false);
  const captureGeneration = useRef(0);
  const mounted = useRef(true);
  const activeRef = useRef(active);
  activeRef.current = active;
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
    if (!active) {
      readyRef.current = false;
      setReady(false);
      cameraSession.current += 1;
      captureGeneration.current += 1;
    }
  }, [active]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cameraSession.current += 1;
      readyRef.current = false;
      captureGeneration.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!active) onCapturingChange(false);
  }, [active, onCapturingChange]);

  useEffect(() => {
    if (!active || !available || !permission?.granted || ready || cameraFailed)
      return;
    const session = cameraSession.current;
    const timeout = setTimeout(() => {
      if (session !== cameraSession.current || !activeRef.current) return;
      cameraSession.current += 1;
      readyRef.current = false;
      setCameraFailed(true);
    }, 10000);
    return () => clearTimeout(timeout);
  }, [active, available, permission?.granted, ready, cameraFailed]);

  async function enableCamera() {
    cameraSession.current += 1;
    readyRef.current = false;
    setReady(false);
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
    if (!readyRef.current || captureInFlight.current || !activeRef.current)
      return;
    captureInFlight.current = true;
    const generation = captureGeneration.current;
    setBusy(true);
    onCapturingChange(true);
    setError(null);
    try {
      const photo = await camera.current?.takePictureAsync({ quality: 0.8 });
      if (generation !== captureGeneration.current || !activeRef.current)
        return;
      if (!photo?.uri) throw new Error('Chưa chụp được ảnh. Hãy thử lại.');
      const hasDimensions =
        Number.isFinite(photo.width) &&
        Number.isFinite(photo.height) &&
        photo.width > 0 &&
        photo.height > 0;
      onPhoto({
        uri: photo.uri,
        mimeType: 'image/jpeg',
        aspectRatio: hasDimensions ? photo.width / photo.height : 3 / 4,
        ...(hasDimensions && { width: photo.width, height: photo.height }),
      });
    } catch (cause) {
      if (generation === captureGeneration.current && activeRef.current)
        setError((cause as Error).message || 'Chưa chụp được ảnh.');
    } finally {
      captureInFlight.current = false;
      if (mounted.current) {
        setBusy(false);
        onCapturingChange(false);
      }
    }
  }

  function flipCamera() {
    if (!readyRef.current || captureInFlight.current || !activeRef.current)
      return;
    readyRef.current = false;
    cameraSession.current += 1;
    setError(null);
    setReady(false);
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  }
  const session = cameraSession.current;
  const currentSession = () =>
    mounted.current && activeRef.current && session === cameraSession.current;
  const canPreview =
    active && available === true && permission?.granted && !cameraFailed;
  return (
    <View style={styles.capturePage}>
      <ScrollView
        style={styles.captureStage}
        contentContainerStyle={styles.captureStageContent}
        bounces={false}
      >
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
              // iOS 55.0.23 emits ready on session startup, not facing changes.
              // Android rebinds the existing view and emits ready for the new camera.
              key={Platform.OS === 'ios' ? session : 'camera'}
              style={styles.cameraPreview}
              facing={facing}
              mode="picture"
              onCameraReady={() => {
                if (!currentSession()) return;
                readyRef.current = true;
                setReady(true);
              }}
              onMountError={(event) => {
                if (!currentSession()) return;
                cameraSession.current += 1;
                readyRef.current = false;
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
              <Text style={styles.cameraFrameLabelText}>
                KHOẢNH KHẮC CỦA BẠN
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
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
          accessibilityState={{
            disabled: !canPreview || !ready || busy,
            busy: !!canPreview && !ready,
          }}
          disabled={!canPreview || !ready || busy}
          onPress={flipCamera}
          style={styles.cameraSideButton}
        >
          {canPreview && !ready ? (
            <ActivityIndicator size="small" color={colors.earth} />
          ) : (
            <Feather name="refresh-cw" size={22} color={colors.earth} />
          )}
          <Text style={styles.cameraSideLabel}>Đổi camera</Text>
        </Pressable>
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      )}
    </View>
  );
}
