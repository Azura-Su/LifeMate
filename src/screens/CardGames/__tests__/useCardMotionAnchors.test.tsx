import { act, renderHook } from '@testing-library/react-native';
import type { View } from 'react-native';
import { useCardMotionAnchors } from '../useCardMotionAnchors';

type Measurement = Parameters<View['measureInWindow']>[0];
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('discards measurements from the previous viewport and uses one window coordinate space', () => {
  const callbacks: Measurement[] = [];
  const node = {
    measureInWindow: (callback: Measurement) => {
      callbacks.push(callback);
    },
  };
  const { result, rerender } = renderHook<
    ReturnType<typeof useCardMotionAnchors>,
    { viewport: string }
  >(({ viewport }) => useCardMotionAnchors(viewport), {
    initialProps: { viewport: 'portrait' },
  });
  result.current.anchorRef('table')(node);
  result.current.anchorRef('hand')(node);
  act(() => jest.advanceTimersByTime(20));
  expect(callbacks).toHaveLength(2);
  rerender({ viewport: 'landscape' });
  act(() => {
    callbacks[0](0, 0, 100, 100);
    callbacks[1](0, 200, 100, 100);
  });
  const fallback = { x: 0, y: 34 };
  expect(result.current.originFor('hand', fallback)).toEqual(fallback);
  act(() => jest.advanceTimersByTime(20));
  act(() => {
    callbacks[2](100, 100, 100, 80);
    callbacks[3](100, 240, 100, 80);
  });
  expect(result.current.originFor('hand', fallback)).toEqual({ x: 0, y: 140 });
});

it('keeps fallback geometry until every current anchor has a valid size', () => {
  const { result } = renderHook(() => useCardMotionAnchors('portrait-invalid'));
  result.current.anchorRef('table')({
    measureInWindow: (cb) => cb(0, 0, 100, 80),
  });
  result.current.anchorRef('hand')({ measureInWindow: (cb) => cb(0, 0, 0, 0) });
  act(() => jest.advanceTimersByTime(20));
  expect(result.current.originFor('hand', { x: 0, y: 44 })).toEqual({
    x: 0,
    y: 44,
  });
});
