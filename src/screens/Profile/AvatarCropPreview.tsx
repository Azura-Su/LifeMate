import { useMemo, useRef, useState } from 'react';
import {
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import Slider from '@react-native-community/slider';
import { Button } from '../../components/Button';
import { colors } from '../../theme';
import {
  avatarCropGeometry,
  type AvatarCropRect,
  type AvatarCropSource,
} from './avatarCrop';

type Props = {
  source: AvatarCropSource;
  busy: boolean;
  onApply: (crop: AvatarCropRect) => void;
  onClose: () => void;
};
export function AvatarCropPreview({ source, busy, onApply, onClose }: Props) {
  const window = useWindowDimensions();
  const viewport = Math.max(
    120,
    Math.min(320, window.width - 40, window.height * 0.4),
  );
  const [position, setPosition] = useState({ zoom: 1, x: 0, y: 0 });
  const geometry = avatarCropGeometry(
    source.width,
    source.height,
    viewport,
    position.zoom,
    position.x,
    position.y,
  );
  const latest = useRef({ position, geometry });
  latest.current = { position, geometry };
  const start = useRef({ x: 0, y: 0 });
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !busy,
        onMoveShouldSetPanResponder: () => !busy,
        onPanResponderGrant: () => {
          start.current = {
            x: latest.current.geometry.offsetX,
            y: latest.current.geometry.offsetY,
          };
        },
        onPanResponderMove: (_event, gesture) => {
          const next = avatarCropGeometry(
            source.width,
            source.height,
            viewport,
            latest.current.position.zoom,
            start.current.x + gesture.dx,
            start.current.y + gesture.dy,
          );
          setPosition({
            zoom: latest.current.position.zoom,
            x: next.offsetX,
            y: next.offsetY,
          });
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [busy, source.width, source.height, viewport],
  );
  return (
    <View style={styles.content}>
      <Text style={styles.hint}>
        Kéo ảnh để căn khung, phóng to để chọn vùng bạn muốn giữ.
      </Text>
      <View
        accessibilityLabel="Vùng cắt ảnh"
        accessibilityHint="Kéo ảnh trong khung. Có thể dùng các tác vụ trợ năng để dịch ảnh."
        accessible
        accessibilityActions={[
          { name: 'left', label: 'Dịch ảnh sang trái' },
          { name: 'right', label: 'Dịch ảnh sang phải' },
          { name: 'up', label: 'Dịch ảnh lên trên' },
          { name: 'down', label: 'Dịch ảnh xuống dưới' },
        ]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (busy) return;
          const step = viewport / 10;
          const dx =
            nativeEvent.actionName === 'left'
              ? -step
              : nativeEvent.actionName === 'right'
                ? step
                : 0;
          const dy =
            nativeEvent.actionName === 'up'
              ? -step
              : nativeEvent.actionName === 'down'
                ? step
                : 0;
          const next = avatarCropGeometry(
            source.width,
            source.height,
            viewport,
            position.zoom,
            geometry.offsetX + dx,
            geometry.offsetY + dy,
          );
          setPosition({
            zoom: position.zoom,
            x: next.offsetX,
            y: next.offsetY,
          });
        }}
        style={[styles.frame, { width: viewport, height: viewport }]}
        {...pan.panHandlers}
      >
        <Image
          accessibilityLabel="Ảnh đang chỉnh sửa"
          source={{ uri: source.uri }}
          resizeMode="stretch"
          style={{
            position: 'absolute',
            width: geometry.width,
            height: geometry.height,
            left: geometry.left,
            top: geometry.top,
          }}
        />
        <View pointerEvents="none" style={styles.grid}>
          <View style={[styles.vertical, { left: '33.333%' }]} />
          <View style={[styles.vertical, { left: '66.667%' }]} />
          <View style={[styles.horizontal, { top: '33.333%' }]} />
          <View style={[styles.horizontal, { top: '66.667%' }]} />
        </View>
      </View>
      <View style={styles.zoomRow}>
        <Text style={styles.hint}>Phóng to</Text>
        <Text style={styles.hint}>{position.zoom.toFixed(1)}×</Text>
      </View>
      <View style={styles.zoomControls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thu nhỏ ảnh"
          disabled={busy || position.zoom <= 1}
          onPress={() =>
            setPosition({ ...position, zoom: Math.max(1, position.zoom - 0.2) })
          }
          style={styles.zoomButton}
        >
          <Feather name="minus" size={18} color={colors.earth} />
        </Pressable>
        <Slider
          accessibilityLabel="Phóng to ảnh"
          minimumValue={1}
          maximumValue={3}
          step={0.01}
          value={position.zoom}
          disabled={busy}
          minimumTrackTintColor={colors.earth}
          maximumTrackTintColor={colors.line}
          thumbTintColor={colors.earth}
          onValueChange={(zoom) => {
            const next = avatarCropGeometry(
              source.width,
              source.height,
              viewport,
              zoom,
              geometry.offsetX,
              geometry.offsetY,
            );
            setPosition({ zoom, x: next.offsetX, y: next.offsetY });
          }}
          style={styles.slider}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Phóng to thêm"
          disabled={busy || position.zoom >= 3}
          onPress={() =>
            setPosition({ ...position, zoom: Math.min(3, position.zoom + 0.2) })
          }
          style={styles.zoomButton}
        >
          <Feather name="plus" size={18} color={colors.earth} />
        </Pressable>
      </View>
      <Button
        title="Đặt lại vùng cắt"
        compact
        variant="secondary"
        disabled={busy}
        onPress={() => setPosition({ zoom: 1, x: 0, y: 0 })}
      />
      <Text style={styles.hint}>
        Bấm Dùng ảnh để xem trước, rồi Lưu thay đổi trong hồ sơ.
      </Text>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button title="Hủy" variant="secondary" onPress={onClose} />
        </View>
        <View style={styles.action}>
          <Button
            title="Dùng ảnh"
            loading={busy}
            disabled={busy}
            onPress={() => onApply(geometry.crop)}
          />
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  content: { gap: 10 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  frame: {
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: colors.skySoft,
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: colors.surface,
    borderRadius: 24,
  },
  vertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.surface,
  },
  horizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.surface,
  },
  zoomRow: { flexDirection: 'row', justifyContent: 'space-between' },
  zoomControls: { flexDirection: 'row', alignItems: 'center' },
  zoomButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slider: { flex: 1, minHeight: 44 },
  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1 },
});
