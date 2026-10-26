import { PanResponder, type PanResponderGestureState } from 'react-native';
import { createPetRotationResponder } from '../petRotation';
const gesture = (dx: number, dy: number, touches = 1) =>
  ({ dx, dy, numberActiveTouches: touches }) as PanResponderGestureState;
it('claims horizontal drags before a child canvas, leaves vertical scroll alone and retains rotation between drags', () => {
  const spy = jest.spyOn(PanResponder, 'create');
  const rotation = { current: 0.35 };
  const responder = createPetRotationResponder(rotation);
  const handlers = spy.mock.calls.at(-1)![0];
  expect(responder.panHandlers.onMoveShouldSetResponderCapture).toBeDefined();
  const capture = handlers.onMoveShouldSetPanResponderCapture!;
  expect(capture({} as never, gesture(3, 1))).toBe(false);
  expect(capture({} as never, gesture(12, 45))).toBe(false);
  expect(capture({} as never, gesture(45, 12, 2))).toBe(false);
  expect(capture({} as never, gesture(45, 12))).toBe(true);
  handlers.onPanResponderGrant!({} as never, gesture(0, 0));
  handlers.onPanResponderMove!({} as never, gesture(100, 8));
  expect(rotation.current).toBeCloseTo(1.15);
  expect(
    handlers.onPanResponderTerminationRequest!({} as never, gesture(100, 8)),
  ).toBe(false);
  handlers.onPanResponderRelease!({} as never, gesture(100, 8));
  handlers.onPanResponderGrant!({} as never, gesture(0, 0));
  handlers.onPanResponderMove!({} as never, gesture(-50, 5));
  expect(rotation.current).toBeCloseTo(0.75);
  spy.mockRestore();
});
it('rotates on release even when a fast native swipe coalesces every move event', () => {
  const spy = jest.spyOn(PanResponder, 'create');
  const rotation = { current: 0.35 };
  createPetRotationResponder(rotation);
  const handlers = spy.mock.calls.at(-1)![0];
  handlers.onPanResponderGrant!(
    { nativeEvent: { pageX: 100, pageY: 200 } } as never,
    gesture(0, 0),
  );
  handlers.onPanResponderRelease!(
    { nativeEvent: { pageX: 250, pageY: 210 } } as never,
    gesture(0, 0),
  );
  expect(rotation.current).toBeCloseTo(1.55);
  spy.mockRestore();
});
it('handles native start/end delivery when ScrollView owns the responder stream', () => {
  const rotation = { current: 0.35 };
  const { panHandlers } = createPetRotationResponder(rotation);
  panHandlers.onTouchStart({
    nativeEvent: { pageX: 100, pageY: 200, touches: [{}] },
  } as never);
  panHandlers.onTouchEnd({
    nativeEvent: { pageX: 250, pageY: 210, touches: [] },
  } as never);
  expect(rotation.current).toBeCloseTo(1.55);
  panHandlers.onTouchStart({
    nativeEvent: { pageX: 100, pageY: 200, touches: [{}] },
  } as never);
  panHandlers.onTouchEnd({
    nativeEvent: { pageX: 105, pageY: 350, touches: [] },
  } as never);
  expect(rotation.current).toBeCloseTo(1.55);
});
it('publishes the settled rotation so the illustration can switch 2D facings', () => {
  const rotation = { current: 0 };
  const onRotateEnd = jest.fn();
  const { panHandlers } = createPetRotationResponder(
    rotation,
    undefined,
    onRotateEnd,
  );
  panHandlers.onTouchStart({
    nativeEvent: { pageX: 20, pageY: 30, touches: [{}] },
  } as never);
  panHandlers.onTouchMove({
    nativeEvent: { pageX: 130, pageY: 33, touches: [{}] },
  } as never);
  panHandlers.onTouchEnd({
    nativeEvent: { pageX: 130, pageY: 33, touches: [] },
  } as never);
  expect(rotation.current).toBeCloseTo(0.88);
  expect(onRotateEnd).toHaveBeenCalledWith(rotation.current);
});
it('keeps horizontal ownership after vertical drift and releases the lock at the end', () => {
  const spy = jest.spyOn(PanResponder, 'create'),
    rotation = { current: 0 };
  const { panHandlers } = createPetRotationResponder(rotation),
    handlers = spy.mock.calls.at(-1)![0];
  panHandlers.onTouchStart({
    nativeEvent: { pageX: 100, pageY: 100, touches: [{}] },
  } as never);
  expect(
    handlers.onMoveShouldSetPanResponderCapture!({} as never, gesture(30, 3)),
  ).toBe(true);
  handlers.onPanResponderGrant!({} as never, gesture(30, 3));
  handlers.onPanResponderMove!({} as never, gesture(40, 90));
  expect(rotation.current).toBeCloseTo(0.32);
  expect(
    handlers.onPanResponderTerminationRequest!({} as never, gesture(40, 90)),
  ).toBe(false);
  panHandlers.onTouchEnd({ nativeEvent: { pageX: 140, pageY: 190 } } as never);
  panHandlers.onTouchStart({
    nativeEvent: { pageX: 100, pageY: 100, touches: [{}] },
  } as never);
  expect(
    handlers.onMoveShouldSetPanResponderCapture!({} as never, gesture(3, 60)),
  ).toBe(false);
  expect(
    handlers.onPanResponderTerminationRequest!({} as never, gesture(3, 60)),
  ).toBe(true);
  spy.mockRestore();
});
