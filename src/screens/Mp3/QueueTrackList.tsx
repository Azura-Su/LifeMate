import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, PanResponder, Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Button } from '../../components/Button';
import { colors, typography } from '../../theme';
import type { AudioTrack } from '../../types/audio';
import { formatAudioTime } from '../../utils/audio';
import { useQueuePlaybackStore } from '../../store/queuePlaybackStore';
import { AudioTrackTitle } from './AudioTrackTitle';
import { SpinningRecord } from './SpinningRecord';
import { styles } from './Mp3Screen.styles';

const QUEUE_ROW_GAP = 12;
const DRAG_SPRING = {
  damping: 20,
  stiffness: 240,
  mass: 0.8,
  useNativeDriver: true,
};

export function queueTargetIndex(
  startIndex: number,
  deltaY: number,
  rowHeight: number,
  itemCount: number,
) {
  if (itemCount < 1) return 0;
  const step = Math.max(1, rowHeight + QUEUE_ROW_GAP);
  return Math.max(
    0,
    Math.min(itemCount - 1, startIndex + Math.round(deltaY / step)),
  );
}

export function queueDragOffset(
  startIndex: number,
  targetIndex: number,
  deltaY: number,
  rowHeight: number,
) {
  const step = Math.max(1, rowHeight + QUEUE_ROW_GAP);
  return deltaY - (targetIndex - startIndex) * step;
}

type RowProps = {
  track: AudioTrack;
  index: number;
  itemCount: number;
  dragging: boolean;
  busy: boolean;
  onPlayTrack: (track: AudioTrack) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
};

const QueueTrackRow = memo(function QueueTrackRow({
  track,
  index,
  itemCount,
  dragging,
  busy,
  onPlayTrack,
  onRemove,
  onMove,
  onDragStart,
  onDragEnd,
}: RowProps) {
  const rowHeight = useRef(72);
  const dragY = useRef(new Animated.Value(0)).current;
  const dragScale = useRef(new Animated.Value(1)).current;
  const neighborShift = useRef(new Animated.Value(0)).current;
  const currentIndex = useRef(index);
  currentIndex.current = index;
  const previousIndex = useRef(index);
  const startIndex = useRef(index);
  const lastIndex = useRef(index);
  const current = useQueuePlaybackStore(
    (state) => state.currentId === track.id,
  );
  // Spin only while visible: the native loop otherwise keeps running on a
  // hidden tab.
  const playing = useQueuePlaybackStore(
    (state) => state.currentId === track.id && state.playing && state.visible,
  );
  const finishDrag = useCallback(() => {
    Animated.parallel([
      Animated.spring(dragY, { toValue: 0, ...DRAG_SPRING }),
      Animated.spring(dragScale, { toValue: 1, ...DRAG_SPRING }),
    ]).start(({ finished }) => {
      if (finished) onDragEnd();
    });
  }, [dragScale, dragY, onDragEnd]);
  useLayoutEffect(() => {
    if (previousIndex.current === index) return;
    const fromIndex = previousIndex.current;
    previousIndex.current = index;
    if (dragging) {
      neighborShift.setValue(0);
      return;
    }

    neighborShift.stopAnimation();
    neighborShift.setValue(
      (fromIndex - index) * (rowHeight.current + QUEUE_ROW_GAP),
    );
    Animated.spring(neighborShift, { toValue: 0, ...DRAG_SPRING }).start();
  }, [dragging, index, neighborShift]);
  const dragResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !busy && itemCount > 1,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dy) > 6,
        onPanResponderGrant: () => {
          startIndex.current = currentIndex.current;
          lastIndex.current = currentIndex.current;
          dragY.stopAnimation();
          dragY.setValue(0);
          Animated.spring(dragScale, {
            toValue: 1.025,
            ...DRAG_SPRING,
          }).start();
          onDragStart(track.id);
        },
        onPanResponderMove: (_event, gesture) => {
          const target = queueTargetIndex(
            startIndex.current,
            gesture.dy,
            rowHeight.current,
            itemCount,
          );
          dragY.setValue(
            queueDragOffset(
              startIndex.current,
              target,
              gesture.dy,
              rowHeight.current,
            ),
          );
          if (target === lastIndex.current) return;
          const direction = target > lastIndex.current ? 'down' : 'up';
          for (let position = lastIndex.current; position !== target;) {
            onMove(track.id, direction);
            position += direction === 'down' ? 1 : -1;
          }
          lastIndex.current = target;
        },
        onPanResponderRelease: finishDrag,
        onPanResponderTerminate: finishDrag,
        onPanResponderTerminationRequest: () => false,
      }),
    [
      busy,
      dragScale,
      dragY,
      finishDrag,
      itemCount,
      onDragStart,
      onMove,
      track.id,
    ],
  );
  const animatedStyle = {
    zIndex: dragging ? 2 : 0,
    elevation: dragging ? 4 : 0,
    transform: [
      { translateY: dragging ? dragY : neighborShift },
      { scale: dragging ? dragScale : 1 },
    ],
  };

  return (
    <Animated.View
      testID={`queue-track-${track.id}`}
      onLayout={(event) => {
        rowHeight.current = event.nativeEvent.layout.height;
      }}
      style={[
        styles.queueItem,
        current && styles.trackSelected,
        dragging && styles.queueDragging,
        animatedStyle,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Phát ${track.title}`}
        disabled={busy}
        onPress={() => onPlayTrack(track)}
        style={styles.queueMain}
      >
        <View style={styles.queueIndex}>
          <Text
            style={[
              styles.queueNumber,
              styles.queueIndicator,
              current && styles.hiddenIndicator,
            ]}
          >
            {index + 1}
          </Text>
          <SpinningRecord
            playing={playing}
            visible={current}
            style={[styles.queueIndicator, !current && styles.hiddenIndicator]}
          />
        </View>
        <View style={styles.flex}>
          <AudioTrackTitle title={track.title} active={false} />
          <Text style={typography.small}>
            {formatAudioTime(track.durationMs)}
          </Text>
        </View>
      </Pressable>
      <View
        {...dragResponder.panHandlers}
        testID={`queue-reorder-handle-${track.id}`}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Kéo để sắp xếp ${track.title}`}
        accessibilityHint="Giữ và rê lên hoặc xuống để đổi vị trí"
        accessibilityState={{
          disabled: busy || itemCount < 2,
          selected: dragging,
        }}
        accessibilityActions={[
          ...(index > 0
            ? [{ name: 'decrement', label: 'Chuyển lên một vị trí' }]
            : []),
          ...(index < itemCount - 1
            ? [{ name: 'increment', label: 'Chuyển xuống một vị trí' }]
            : []),
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'decrement' && index > 0)
            onMove(track.id, 'up');
          if (
            event.nativeEvent.actionName === 'increment' &&
            index < itemCount - 1
          )
            onMove(track.id, 'down');
        }}
        style={[
          styles.queueReorderHandle,
          dragging && styles.queueReorderHandleDragging,
        ]}
      >
        <Feather name="move" size={20} color={colors.earth} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Bỏ ${track.title} khỏi danh sách nghe`}
        onPress={() => onRemove(track.id)}
        style={styles.icon}
      >
        <Feather name="x" size={20} color={colors.muted} />
      </Pressable>
    </Animated.View>
  );
});

type Props = {
  items: AudioTrack[];
  busy: boolean;
  onPlayTrack: (track: AudioTrack) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
};

function QueueTrackListView({
  items,
  busy,
  onPlayTrack,
  onRemove,
  onMove,
}: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const onDragStart = useCallback((id: string) => setDraggingId(id), []);
  const onDragEnd = useCallback(() => setDraggingId(null), []);
  return (
    <View style={styles.list}>
      {items.map((track, index) => (
        <QueueTrackRow
          key={track.id}
          track={track}
          index={index}
          itemCount={items.length}
          dragging={draggingId === track.id}
          busy={busy}
          onPlayTrack={onPlayTrack}
          onRemove={onRemove}
          onMove={onMove}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      ))}
    </View>
  );
}

type ControlsProps = {
  itemCount: number;
  repeatAll: boolean;
  busy: boolean;
  onToggleRepeatAll: () => void;
  onPlayAll: () => void;
};

function QueueTrackControlsView({
  itemCount,
  repeatAll,
  busy,
  onToggleRepeatAll,
  onPlayAll,
}: ControlsProps) {
  return (
    <>
      <View style={styles.row}>
        <Text style={[typography.heading, styles.flex]}>
          {itemCount} bài · phát lần lượt
        </Text>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel="Lặp lại toàn bộ danh sách nghe"
          accessibilityHint="Phát lại từ bài đầu sau khi bài cuối kết thúc"
          accessibilityState={{ checked: repeatAll }}
          onPress={onToggleRepeatAll}
          style={[styles.icon, repeatAll && styles.repeatOn]}
        >
          <Feather
            name="repeat"
            size={20}
            color={repeatAll ? colors.onPrimary : colors.earth}
          />
        </Pressable>
      </View>
      <PlayAllButton busy={busy} onPress={onPlayAll} />
    </>
  );
}

function PlayAllButton({
  busy,
  onPress,
}: {
  busy: boolean;
  onPress: () => void;
}) {
  const currentId = useQueuePlaybackStore((state) => state.currentId);
  return (
    <Button
      title={currentId ? 'Phát lại từ đầu' : 'Phát tất cả'}
      disabled={busy}
      onPress={onPress}
    />
  );
}

export const QueueTrackControls = memo(QueueTrackControlsView);
export const QueueTrackList = memo(QueueTrackListView);
