import Feather from '@expo/vector-icons/Feather';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { colors } from '../../theme';
import { styles } from './MemoryScreen.styles';

export type CapturedMemoryPhoto = { uri: string; mimeType: string | null };

type Props = {
  active: boolean;
  latestPhotoUri: string | null;
  onPhoto: (photo: CapturedMemoryPhoto) => void;
  onWriteOnly: () => void;
  onShowTimeline: () => void;
  memoryCount: number;
};

export function MemoryCapture({
  active,
  latestPhotoUri,
  onPhoto,
  onWriteOnly,
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

  async function pickFromLibrary() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.8,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.uri) throw new Error('Chưa chọn được ảnh.');
      if (asset.fileSize && asset.fileSize > 15 * 1024 * 1024)
        throw new Error('Ảnh cần nhỏ hơn 15 MB. Hãy chọn ảnh khác.');
      onPhoto({ uri: asset.uri, mimeType: asset.mimeType ?? null });
    } catch (cause) {
      setError((cause as Error).message || 'Chưa mở được thư viện ảnh.');
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
              {available === false || cameraFailed
                ? 'Bạn vẫn có thể chọn ảnh từ thư viện để lưu khoảnh khắc.'
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
        {canPreview && (
          <View pointerEvents="none" style={styles.cameraFrameLabel}>
            <Text style={styles.cameraFrameLabelText}>KHOẢNH KHẮC CỦA BẠN</Text>
          </View>
        )}
      </View>
      <View style={styles.cameraControls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chọn ảnh từ thư viện"
          disabled={busy}
          onPress={() => void pickFromLibrary()}
          style={styles.cameraSideButton}
        >
          {latestPhotoUri ? (
            <Image
              source={{ uri: latestPhotoUri }}
              style={styles.latestThumbnail}
            />
          ) : (
            <Feather name="image" size={22} color={colors.earth} />
          )}
          <Text style={styles.cameraSideLabel}>Thư viện</Text>
        </Pressable>
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Viết ký ức không có ảnh"
        onPress={onWriteOnly}
        style={styles.writeOnlyAction}
      >
        <Text style={styles.writeOnlyText}>Viết ký ức không có ảnh</Text>
      </Pressable>
      <Text style={styles.capturePrivacy}>
        Mặc định chỉ mình tôi · Có thể chọn chia sẻ khi lưu
      </Text>
    </View>
  );
}
