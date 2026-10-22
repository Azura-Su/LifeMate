import Feather from '@expo/vector-icons/Feather';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useScreenActive } from '../../hooks/useScreenActive';
import { colors } from '../../theme';
import {
  boundPhotoTransform,
  originalPhotoTransform,
  photoSwipeAction,
  pinchPhotoTransform,
  type PhotoTransform,
} from './memoryPhotoGestures';

export type MemoryViewerPhoto = {
  id: string;
  uri: string;
  label: string;
  text?: string;
  renew?: () => Promise<string | null>;
};

function ZoomableMemoryPhoto({
  photo,
  onClose,
  onNext,
  onPrevious,
}: {
  photo: MemoryViewerPhoto;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}) {
  const surface = useRef<View>(null);
  const viewport = useRef({ width: 0, height: 0, left: 0, top: 0 });
  const image = useRef({ width: 1, height: 1 });
  const transform = useRef<PhotoTransform>({ ...originalPhotoTransform });
  const animated = useRef({
    scale: new Animated.Value(1),
    x: new Animated.Value(0),
    y: new Animated.Value(0),
  }).current;
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);
  const gesture = useRef({
    mode: 'pan',
    startedAt: 0,
    moved: false,
    initial: { ...originalPhotoTransform },
    x: 0,
    y: 0,
    distance: 1,
    center: { x: 0, y: 0 },
    pinched: false,
  });
  const [uri, setUri] = useState(photo.uri);
  const renewalAttempted = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const bound = useCallback(
    (value: PhotoTransform) =>
      boundPhotoTransform(value, viewport.current, image.current),
    [],
  );
  const apply = useCallback(
    (value: PhotoTransform) => {
      transform.current = value;
      animated.scale.setValue(value.scale);
      animated.x.setValue(value.x);
      animated.y.setValue(value.y);
    },
    [animated],
  );
  const pinch = useCallback((event: GestureResponderEvent) => {
    const [a, b] = event.nativeEvent.touches;
    if (!a || !b) return null;
    return {
      distance: Math.max(1, Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY)),
      center: {
        x:
          (a.pageX + b.pageX) / 2 -
          viewport.current.left -
          viewport.current.width / 2,
        y:
          (a.pageY + b.pageY) / 2 -
          viewport.current.top -
          viewport.current.height / 2,
      },
    };
  }, []);
  const begin = useCallback(
    (event: GestureResponderEvent) => {
      const pair = pinch(event);
      const touch = event.nativeEvent.touches[0];
      gesture.current = {
        mode: pair ? 'pinch' : 'pan',
        startedAt: Date.now(),
        moved: false,
        initial: { ...transform.current },
        x: touch?.pageX ?? 0,
        y: touch?.pageY ?? 0,
        distance: pair?.distance ?? 1,
        center: pair?.center ?? { x: 0, y: 0 },
        pinched: !!pair,
      };
    },
    [pinch],
  );
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: begin,
        onPanResponderStart: (event) => {
          if (event.nativeEvent.touches.length > 1) {
            begin(event);
            gesture.current.pinched = true;
          }
        },
        onPanResponderMove: (event) => {
          const pair = pinch(event);
          if (pair) {
            if (gesture.current.mode !== 'pinch') {
              begin(event);
              gesture.current.pinched = true;
              return;
            }
            apply(
              bound(
                pinchPhotoTransform(
                  gesture.current.initial,
                  pair.distance / gesture.current.distance,
                  gesture.current.center,
                  pair.center,
                ),
              ),
            );
            return;
          }
          const touch = event.nativeEvent.touches[0];
          if (!touch) return;
          if (gesture.current.mode === 'pinch') {
            begin(event);
            gesture.current.pinched = true;
            return;
          }
          if (
            Math.hypot(
              touch.pageX - gesture.current.x,
              touch.pageY - gesture.current.y,
            ) > 10
          )
            gesture.current.moved = true;
          const next = {
            ...gesture.current.initial,
            x: gesture.current.initial.x + touch.pageX - gesture.current.x,
            y: gesture.current.initial.y + touch.pageY - gesture.current.y,
          };
          apply(
            next.scale <= 1.02 && !gesture.current.pinched ? next : bound(next),
          );
        },
        onPanResponderRelease: (event, state) => {
          // Use the final touch position even if native coalesced all move events.
          const { pageX, pageY } = event.nativeEvent;
          const dx = Number.isFinite(pageX)
            ? pageX - gesture.current.x
            : state.dx;
          const dy = Number.isFinite(pageY)
            ? pageY - gesture.current.y
            : state.dy;
          const now = Date.now();
          if (
            !gesture.current.pinched &&
            !gesture.current.moved &&
            Math.hypot(dx, dy) <= 10 &&
            now - gesture.current.startedAt <= 250
          ) {
            const point = { x: gesture.current.x, y: gesture.current.y };
            const previousTap = lastTap.current;
            if (
              previousTap &&
              now >= previousTap.time &&
              now - previousTap.time <= 300 &&
              Math.hypot(point.x - previousTap.x, point.y - previousTap.y) <= 30
            ) {
              lastTap.current = null;
              const center = {
                x: point.x - viewport.current.left - viewport.current.width / 2,
                y: point.y - viewport.current.top - viewport.current.height / 2,
              };
              apply(
                transform.current.scale > 1.02
                  ? { ...originalPhotoTransform }
                  : bound(
                      pinchPhotoTransform(
                        originalPhotoTransform,
                        2.5,
                        center,
                        center,
                      ),
                    ),
              );
              return;
            }
            lastTap.current = { ...point, time: now };
          } else lastTap.current = null;
          const action = photoSwipeAction(
            dx,
            dy,
            transform.current.scale,
            gesture.current.pinched,
          );
          apply(
            transform.current.scale <= 1.02
              ? { ...originalPhotoTransform }
              : bound(transform.current),
          );
          if (action === 'close') onClose();
          else if (action === 'next') onNext?.();
          else if (action === 'previous') onPrevious?.();
        },
        onPanResponderTerminate: () => {
          lastTap.current = null;
          apply(bound(transform.current));
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [apply, begin, bound, onClose, onNext, onPrevious, pinch],
  );

  return (
    <View
      ref={surface}
      testID="memory-photo-gesture-surface"
      style={styles.content}
      onLayout={({ nativeEvent }) => {
        viewport.current = { ...viewport.current, ...nativeEvent.layout };
        surface.current?.measureInWindow((left, top) => {
          viewport.current.left = left;
          viewport.current.top = top;
        });
        apply(bound(transform.current));
      }}
      {...pan.panHandlers}
    >
      <Animated.Image
        source={{ uri }}
        accessibilityLabel={`Ảnh phóng lớn: ${photo.label}`}
        accessible
        accessibilityHint="Chạm hai lần để phóng to tại vị trí chạm hoặc về kích thước chuẩn. Chụm hai ngón để phóng to. Khi ảnh ở kích thước chuẩn, vuốt xuống để đóng hoặc vuốt ngang để chuyển ảnh."
        accessibilityActions={[
          { name: 'zoomIn', label: 'Phóng to' },
          { name: 'zoomOut', label: 'Thu nhỏ' },
          { name: 'reset', label: 'Kích thước chuẩn' },
        ]}
        onAccessibilityAction={({ nativeEvent }) => {
          const next =
            nativeEvent.actionName === 'reset'
              ? { ...originalPhotoTransform }
              : {
                  ...transform.current,
                  scale:
                    transform.current.scale +
                    (nativeEvent.actionName === 'zoomIn' ? 0.5 : -0.5),
                };
          apply(bound(next));
        }}
        resizeMode="contain"
        style={[
          styles.image,
          {
            transform: [
              { translateX: animated.x },
              { translateY: animated.y },
              { scale: animated.scale },
            ],
          },
        ]}
        onLoadStart={() => {
          setLoading(true);
          setFailed(false);
        }}
        onLoad={({ nativeEvent }) => {
          const { width, height } = nativeEvent.source;
          if (width > 0 && height > 0) image.current = { width, height };
          setLoading(false);
          apply(bound(transform.current));
        }}
        onError={() => {
          if (photo.renew && !renewalAttempted.current) {
            renewalAttempted.current = true;
            setLoading(true);
            void photo
              .renew()
              .catch(() => null)
              .then((renewed) => {
                if (!mounted.current) return;
                if (renewed && renewed !== uri) setUri(renewed);
                else {
                  setLoading(false);
                  setFailed(true);
                }
              });
          } else {
            setLoading(false);
            setFailed(true);
          }
        }}
      />
      {loading && (
        <View pointerEvents="none" style={styles.feedback}>
          <ActivityIndicator
            accessibilityLabel="Đang mở ảnh lớn"
            color={colors.surface}
          />
        </View>
      )}
      {failed && (
        <Text
          pointerEvents="none"
          accessibilityRole="alert"
          style={styles.error}
        >
          Chưa mở được ảnh. Hãy đóng và thử lại.
        </Text>
      )}
    </View>
  );
}

export function MemoryPhotoViewer({
  photos,
  initialIndex,
  onClose,
}: {
  photos: MemoryViewerPhoto[];
  initialIndex: number;
  onClose: () => void;
}) {
  const insets = useContext(SafeAreaInsetsContext);
  const active = useScreenActive();
  const [index, setIndex] = useState(initialIndex);
  useEffect(() => {
    if (!active) onClose();
  }, [active, onClose]);
  const photo = photos[index];
  if (!photo) return null;
  const previous =
    index > 0
      ? () => setIndex((current) => Math.max(0, current - 1))
      : undefined;
  const next =
    index < photos.length - 1
      ? () => setIndex((current) => Math.min(photos.length - 1, current + 1))
      : undefined;
  return (
    <Modal visible={active} animationType="fade" onRequestClose={onClose}>
      <View
        style={[
          styles.root,
          {
            paddingTop: Math.max(insets?.top ?? 0, 20),
            paddingBottom: insets?.bottom ?? 0,
          },
        ]}
        accessibilityViewIsModal
      >
        <View style={styles.toolbar}>
          {photos.length > 1 && (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ảnh trước"
                disabled={!previous}
                onPress={previous}
                style={styles.close}
              >
                <Feather
                  name="chevron-left"
                  size={24}
                  color={previous ? colors.surface : colors.muted}
                />
              </Pressable>
              <Text accessibilityLiveRegion="polite" style={styles.counter}>
                {index + 1} / {photos.length}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ảnh tiếp theo"
                disabled={!next}
                onPress={next}
                style={styles.close}
              >
                <Feather
                  name="chevron-right"
                  size={24}
                  color={next ? colors.surface : colors.muted}
                />
              </Pressable>
            </>
          )}
          <View style={styles.spacer} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng ảnh"
            onPress={onClose}
            style={styles.close}
          >
            <Feather name="x" size={26} color={colors.surface} />
          </Pressable>
        </View>
        <ZoomableMemoryPhoto
          key={`${photo.id}:${photo.uri}`}
          photo={photo}
          onClose={onClose}
          onPrevious={previous}
          onNext={next}
        />
        {!!photo.text?.trim() && (
          <ScrollView
            key={photo.id}
            testID="memory-photo-caption"
            style={styles.caption}
            contentContainerStyle={styles.captionContent}
          >
            <Text style={styles.captionText}>{photo.text}</Text>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  spacer: { flex: 1 },
  counter: { color: colors.surface, fontSize: 13 },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: { flexGrow: 0, maxHeight: '20%' },
  captionContent: { paddingHorizontal: 20, paddingVertical: 12 },
  captionText: { color: colors.surface, fontSize: 14, lineHeight: 22 },
  content: { flex: 1, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  feedback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    textAlign: 'center',
    color: colors.surface,
  },
});
