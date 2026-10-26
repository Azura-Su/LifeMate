import {
  PanResponder,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
const horizontal = (dx: number, dy: number) =>
  Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.15;
export function createPetRotationResponder(
  rotation: { current: number },
  onRotate?: (value: number) => void,
  onRotateEnd?: (value: number) => void,
) {
  let start = rotation.current,
    pageX = 0,
    pageY = 0,
    tracking = false,
    captured = false;
  const remember = (event: GestureResponderEvent) => {
    if (event.nativeEvent?.touches && event.nativeEvent.touches.length > 1) {
      tracking = false;
      return;
    }
    captured = false;
    start = rotation.current;
    pageX = event.nativeEvent?.pageX ?? 0;
    pageY = event.nativeEvent?.pageY ?? 0;
    tracking = true;
  };
  const move = (dx: number, dy: number) => {
    if (tracking && (captured || horizontal(dx, dy))) {
      captured = true;
      rotation.current = start + dx * 0.008;
      onRotate?.(rotation.current);
    }
  };
  const touchMove = (event: GestureResponderEvent) => {
    const touch = event.nativeEvent?.changedTouches?.[0] ?? event.nativeEvent;
    if (Number.isFinite(touch?.pageX) && Number.isFinite(touch?.pageY))
      move(touch.pageX - pageX, touch.pageY - pageY);
  };
  const finish = (
    event: GestureResponderEvent,
    g?: PanResponderGestureState,
  ) => {
    touchMove(event);
    if (!Number.isFinite(event.nativeEvent?.pageX) && g) move(g.dx, g.dy);
    tracking = false;
    captured = false;
    onRotateEnd?.(rotation.current);
  };
  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (_event, g) => {
      if (g.numberActiveTouches !== 1) return false;
      if (horizontal(g.dx, g.dy)) captured = true;
      return captured;
    },
    onPanResponderGrant: (event) => {
      if (!tracking) {
        const claimed = captured;
        remember(event);
        captured = claimed;
      }
    },
    onPanResponderMove: (event, g) => {
      if (Number.isFinite(event.nativeEvent?.pageX)) touchMove(event);
      else move(g.dx, g.dy);
    },
    onPanResponderRelease: finish,
    onPanResponderTerminationRequest: () => !captured,
  });
  // Native can deliver start/end without responder moves during a fast swipe
  // over a busy GL view. The same absolute calculation is safe to apply twice.
  return {
    panHandlers: {
      ...responder.panHandlers,
      onTouchStart: remember,
      onTouchMove: touchMove,
      onTouchEnd: finish,
      onTouchCancel: () => {
        tracking = false;
        captured = false;
        onRotateEnd?.(rotation.current);
      },
    },
  };
}
