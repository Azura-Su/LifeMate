import { useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type PanResponderInstance,
} from 'react-native';
import { colors } from '../../theme';
import { formatAudioTime } from '../../utils/audio';

type Boundary = 'start' | 'end';
type DragInput = {
  boundary: Boundary;
  startMs: number;
  endMs: number;
  durationMs: number;
  deltaPx: number;
  trackWidth: number;
};
type Props = {
  index: number;
  startMs: number;
  endMs: number;
  durationMs: number;
  disabled: boolean;
  onChange: (startMs: number, endMs: number) => void;
};

const MIN_SEGMENT_MS = 100;
const HANDLE_INSET = 12;
const HANDLE_HIT_SIZE = 44;

// Moves one boundary by deltaMs, keeping it inside the track and at least
// MIN_SEGMENT_MS away from the other boundary.
function shiftBoundary(
  boundary: Boundary,
  startMs: number,
  endMs: number,
  durationMs: number,
  deltaMs: number,
) {
  return boundary === 'start'
    ? {
        startMs: Math.max(
          0,
          Math.min(startMs + deltaMs, endMs - MIN_SEGMENT_MS),
        ),
        endMs,
      }
    : {
        startMs,
        endMs: Math.min(
          durationMs,
          Math.max(endMs + deltaMs, startMs + MIN_SEGMENT_MS),
        ),
      };
}

export function rangeAfterDrag({
  boundary,
  startMs,
  endMs,
  durationMs,
  deltaPx,
  trackWidth,
}: DragInput) {
  const deltaMs = Math.round((deltaPx / Math.max(trackWidth, 1)) * durationMs);
  return shiftBoundary(boundary, startMs, endMs, durationMs, deltaMs);
}

export function AudioRangeSelector({
  index,
  startMs,
  endMs,
  durationMs,
  disabled,
  onChange,
}: Props) {
  const width = useRef(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const values = useRef({ startMs, endMs, durationMs, disabled, onChange });
  const drag = useRef({ boundary: 'start' as Boundary, value: 0, dx: 0 });
  values.current = { startMs, endMs, durationMs, disabled, onChange };

  const responders = useMemo(() => {
    const createResponder = (boundary: Boundary): PanResponderInstance =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !values.current.disabled,
        onMoveShouldSetPanResponder: (_, gesture) =>
          !values.current.disabled &&
          Math.abs(gesture.dx) > 3 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: (_, gesture) => {
          const current = values.current;
          drag.current = {
            boundary,
            value: boundary === 'start' ? current.startMs : current.endMs,
            dx: gesture.dx,
          };
        },
        onPanResponderMove: (_, gesture) => {
          const current = values.current;
          const trackWidth = Math.max(1, width.current - HANDLE_INSET * 2);
          const next = rangeAfterDrag({
            boundary: drag.current.boundary,
            startMs:
              drag.current.boundary === 'start'
                ? drag.current.value
                : current.startMs,
            endMs:
              drag.current.boundary === 'end'
                ? drag.current.value
                : current.endMs,
            durationMs: current.durationMs,
            deltaPx: gesture.dx - drag.current.dx,
            trackWidth,
          });
          current.onChange(next.startMs, next.endMs);
        },
        onPanResponderTerminationRequest: (_, gesture) =>
          Math.abs(gesture.dy) > Math.abs(gesture.dx),
      });

    return {
      start: createResponder('start'),
      end: createResponder('end'),
    };
  }, []);

  function adjust(boundary: Boundary, actionName: string) {
    const current = values.current;
    if (current.disabled || !['increment', 'decrement'].includes(actionName))
      return;
    const direction = actionName === 'increment' ? 1 : -1;
    const step = Math.max(MIN_SEGMENT_MS, Math.round(current.durationMs / 100));
    const next = shiftBoundary(
      boundary,
      current.startMs,
      current.endMs,
      current.durationMs,
      direction * step,
    );
    current.onChange(next.startMs, next.endMs);
  }

  function handleLayout(event: LayoutChangeEvent) {
    const nextWidth = event.nativeEvent.layout.width;
    width.current = nextWidth;
    setContainerWidth(nextWidth);
  }

  const availableWidth = Math.max(containerWidth - HANDLE_INSET * 2, 0);
  const startPosition =
    HANDLE_INSET + (startMs / Math.max(durationMs, 1)) * availableWidth;
  const endPosition =
    HANDLE_INSET + (endMs / Math.max(durationMs, 1)) * availableWidth;

  return (
    <View
      testID={`audio-range-${index + 1}`}
      onLayout={handleLayout}
      style={styles.container}
    >
      <View pointerEvents="none" style={styles.rail} />
      <View
        pointerEvents="none"
        style={[
          styles.selected,
          {
            left: startPosition,
            right: Math.max(0, containerWidth - endPosition),
          },
        ]}
      />
      <View
        {...responders.start.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Điểm bắt đầu đoạn ${index + 1}`}
        accessibilityValue={{
          min: 0,
          max: durationMs,
          now: startMs,
          text: formatAudioTime(startMs),
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        accessibilityState={{ disabled }}
        onAccessibilityAction={(event) =>
          adjust('start', event.nativeEvent.actionName)
        }
        pointerEvents={disabled ? 'none' : 'auto'}
        style={[styles.handle, { left: startPosition - HANDLE_HIT_SIZE / 2 }]}
      >
        <View style={styles.thumb} />
      </View>
      <View
        {...responders.end.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Điểm kết thúc đoạn ${index + 1}`}
        accessibilityValue={{
          min: 0,
          max: durationMs,
          now: endMs,
          text: formatAudioTime(endMs),
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        accessibilityState={{ disabled }}
        onAccessibilityAction={(event) =>
          adjust('end', event.nativeEvent.actionName)
        }
        pointerEvents={disabled ? 'none' : 'auto'}
        style={[styles.handle, { left: endPosition - HANDLE_HIT_SIZE / 2 }]}
      >
        <View style={styles.thumb} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 48, justifyContent: 'center', overflow: 'visible' },
  rail: {
    position: 'absolute',
    left: HANDLE_INSET,
    right: HANDLE_INSET,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
  },
  selected: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.sky,
  },
  handle: {
    position: 'absolute',
    top: 2,
    width: HANDLE_HIT_SIZE,
    height: HANDLE_HIT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: colors.earth,
    backgroundColor: colors.surface,
  },
});
