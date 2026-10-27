import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  AppState,
  Image,
  PanResponder,
  StyleSheet,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import { MemoryPhotoViewer } from '../MemoryPhotoViewer';
import {
  boundPhotoTransform,
  photoSwipeAction,
  pinchPhotoTransform,
} from '../memoryPhotoGestures';
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
const photos = ['one', 'two', 'three'].map((id) => ({
  id,
  uri: `file:///${id}.jpg`,
  label: id,
}));
const originalState = AppState.currentState;
beforeEach(() => {
  AppState.currentState = 'active';
});
afterEach(() => {
  jest.restoreAllMocks();
  AppState.currentState = originalState;
});
const event = (...points: number[][]) =>
  ({
    nativeEvent: {
      touches: points.map(([pageX, pageY], identifier) => ({
        pageX,
        pageY,
        identifier,
      })),
    },
  }) as unknown as GestureResponderEvent;
const state = (dx = 0, dy = 0) => ({ dx, dy }) as PanResponderGestureState;

function setup(initialIndex = 1) {
  const pan = jest.spyOn(PanResponder, 'create');
  const onClose = jest.fn();
  render(
    <MemoryPhotoViewer
      photos={photos}
      initialIndex={initialIndex}
      onClose={onClose}
    />,
  );
  const handlers = () => pan.mock.calls[pan.mock.calls.length - 1][0];
  const surface = screen.getByTestId('memory-photo-gesture-surface');
  fireEvent(surface, 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 600 } },
  });
  fireEvent(screen.getByLabelText(/^Ảnh phóng lớn:/), 'load', {
    nativeEvent: { source: { width: 400, height: 600 } },
  });
  const swipe = (dx: number, dy: number) =>
    act(() => {
      handlers().onPanResponderGrant!(event([200, 300]), state());
      handlers().onPanResponderMove!(
        event([200 + dx, 300 + dy]),
        state(dx, dy),
      );
      handlers().onPanResponderRelease!(event(), state(dx, dy));
    });
  return { handlers, swipe, onClose };
}

it('waits for the current image then prefetches at most two authorized remote neighbors', async () => {
  const pending: (() => void)[] = [];
  const prefetch = jest.spyOn(Image, 'prefetch').mockImplementation(
    () =>
      new Promise((resolve) => {
        pending.push(() => resolve(true));
      }),
  );
  const remote = Array.from({ length: 6 }, (_, index) => ({
    id: String(index),
    uri: `https://example.com/${index}.jpg`,
    label: String(index),
  }));
  render(
    <MemoryPhotoViewer photos={remote} initialIndex={2} onClose={jest.fn()} />,
  );
  expect(prefetch).not.toHaveBeenCalled();
  fireEvent(screen.getByLabelText('Ảnh phóng lớn: 2'), 'load', {
    nativeEvent: { source: { width: 400, height: 600 } },
  });
  expect(prefetch.mock.calls.map(([uri]) => uri)).toEqual([
    remote[3].uri,
    remote[1].uri,
  ]);
  fireEvent.press(screen.getByRole('button', { name: 'Ảnh tiếp theo' }));
  fireEvent(screen.getByLabelText('Ảnh phóng lớn: 3'), 'load', {
    nativeEvent: { source: { width: 400, height: 600 } },
  });
  expect(prefetch).toHaveBeenCalledTimes(2);
  await act(async () => {
    pending.forEach((finish) => finish());
  });
});

it('pinches around the focal point and clamps zoom and panning to the fitted photo', () => {
  expect(
    pinchPhotoTransform(
      { scale: 1, x: 0, y: 0 },
      2,
      { x: 50, y: 0 },
      { x: 50, y: 0 },
    ),
  ).toEqual({ scale: 2, x: -50, y: 0 });
  expect(
    boundPhotoTransform(
      { scale: 10, x: 10000, y: -10000 },
      { width: 400, height: 600 },
      { width: 400, height: 600 },
    ),
  ).toEqual({ scale: 4, x: 600, y: -900 });
  expect(
    boundPhotoTransform(
      { scale: 0.5, x: 100, y: 100 },
      { width: 400, height: 600 },
      { width: 800, height: 400 },
    ),
  ).toEqual({ scale: 1, x: 0, y: 0 });
});
it('does not dismiss or page during a pinch, zoomed pan, or diagonal movement', () => {
  expect(photoSwipeAction(200, 0, 2, false)).toBeNull();
  expect(photoSwipeAction(0, 200, 1, true)).toBeNull();
  expect(photoSwipeAction(100, 100, 1, false)).toBeNull();
  expect(photoSwipeAction(0, -200, 1, false)).toBeNull();
});
it('pages left/right in timeline order, resets zoom/loading, and stops at both ends', () => {
  const { swipe, onClose } = setup();
  expect(screen.getByLabelText('Ảnh phóng lớn: two')).toBeTruthy();
  swipe(-120, 10);
  expect(screen.getByLabelText('Ảnh phóng lớn: three')).toBeTruthy();
  expect(screen.getByLabelText('Đang mở ảnh lớn')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Ảnh tiếp theo' })).toBeDisabled();
  swipe(-120, 0);
  expect(screen.getByLabelText('Ảnh phóng lớn: three')).toBeTruthy();
  swipe(120, 0);
  swipe(120, 0);
  expect(screen.getByLabelText('Ảnh phóng lớn: one')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Ảnh trước' })).toBeDisabled();
  swipe(120, 0);
  expect(screen.getByLabelText('Ảnh phóng lớn: one')).toBeTruthy();
  expect(onClose).not.toHaveBeenCalled();
});
it('dismisses by swiping down at original scale', () => {
  const { swipe, onClose } = setup();
  swipe(10, 130);
  expect(onClose).toHaveBeenCalledTimes(1);
});
it('keeps zoomed drags inside the photo and only dismisses after a separate gesture at original scale', () => {
  const { handlers, swipe, onClose } = setup();
  act(() => {
    handlers().onPanResponderGrant!(event([100, 300], [300, 300]), state());
    handlers().onPanResponderMove!(event([50, 300], [350, 300]), state());
    handlers().onPanResponderRelease!(event(), state(0, 150));
  });
  swipe(-150, 0);
  swipe(0, 150);
  expect(screen.getByLabelText('Ảnh phóng lớn: two')).toBeTruthy();
  expect(onClose).not.toHaveBeenCalled();
  act(() => {
    handlers().onPanResponderGrant!(event([50, 300], [350, 300]), state());
    handlers().onPanResponderMove!(event([100, 300], [300, 300]), state());
    handlers().onPanResponderRelease!(event(), state(0, 150));
  });
  expect(onClose).not.toHaveBeenCalled();
  swipe(0, 150);
  expect(onClose).toHaveBeenCalledTimes(1);
});
it('provides accessible paging/close controls and zoom actions', () => {
  const { swipe, onClose } = setup();
  fireEvent(
    screen.getByLabelText('Ảnh phóng lớn: two'),
    'accessibilityAction',
    { nativeEvent: { actionName: 'zoomIn' } },
  );
  swipe(0, 150);
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Ảnh tiếp theo' }));
  expect(screen.getByLabelText('Ảnh phóng lớn: three')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Đóng ảnh' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('renews an expired friend photo once while paging and reports a failed retry', async () => {
  const renew = jest
    .fn()
    .mockResolvedValue('https://photos.example/renewed.jpg');
  render(
    <MemoryPhotoViewer
      photos={[photos[0], { ...photos[1], renew }]}
      initialIndex={0}
      onClose={jest.fn()}
    />,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Ảnh tiếp theo' }));
  await act(async () => {
    fireEvent(screen.getByLabelText('Ảnh phóng lớn: two'), 'error');
  });
  expect(renew).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Ảnh phóng lớn: two').props.source.uri).toBe(
    'https://photos.example/renewed.jpg',
  );
  fireEvent(screen.getByLabelText('Ảnh phóng lớn: two'), 'error');
  expect(renew).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('alert')).toBeTruthy();
});

it('ignores a late renewal after moving to another photo', async () => {
  let resolve!: (uri: string) => void;
  const renew = jest.fn(
    () =>
      new Promise<string>((done) => {
        resolve = done;
      }),
  );
  render(
    <MemoryPhotoViewer
      photos={[{ ...photos[0], renew }, photos[1]]}
      initialIndex={0}
      onClose={jest.fn()}
    />,
  );
  fireEvent(screen.getByLabelText('Ảnh phóng lớn: one'), 'error');
  fireEvent.press(screen.getByRole('button', { name: 'Ảnh tiếp theo' }));
  await act(async () => {
    resolve('https://photos.example/renewed.jpg');
  });
  expect(screen.getByLabelText('Ảnh phóng lớn: two').props.source.uri).toBe(
    photos[1].uri,
  );
});

it('uses final native touch coordinates when move events are coalesced', () => {
  const { handlers } = setup(0);
  act(() => {
    handlers().onPanResponderGrant!(event([300, 300]), state());
    const release = event();
    release.nativeEvent.pageX = 80;
    release.nativeEvent.pageY = 300;
    handlers().onPanResponderRelease!(release, state());
  });
  expect(screen.getByLabelText('Ảnh phóng lớn: two')).toBeTruthy();
});

it('does not page or dismiss a stationary two-finger tap', () => {
  const { handlers, onClose } = setup(0);
  act(() => {
    handlers().onPanResponderGrant!(event([300, 300]), state());
    handlers().onPanResponderStart!(event([300, 300], [80, 450]), state());
    const release = event();
    release.nativeEvent.pageX = 80;
    release.nativeEvent.pageY = 450;
    handlers().onPanResponderRelease!(release, state());
  });
  expect(screen.getByLabelText('Ảnh phóng lớn: one')).toBeTruthy();
  expect(onClose).not.toHaveBeenCalled();
});

it('shows the current photo caption below the image and clears it for an empty caption', () => {
  render(
    <MemoryPhotoViewer
      photos={[
        { ...photos[0], text: 'Một ngày đáng nhớ' },
        { ...photos[1], text: 'Đi chơi cùng gia đình' },
        { ...photos[2], text: '  ' },
      ]}
      initialIndex={0}
      onClose={jest.fn()}
    />,
  );
  expect(screen.getByTestId('memory-photo-caption')).toHaveTextContent(
    'Một ngày đáng nhớ',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Ảnh tiếp theo' }));
  expect(screen.getByTestId('memory-photo-caption')).toHaveTextContent(
    'Đi chơi cùng gia đình',
  );
  expect(screen.queryByText('Một ngày đáng nhớ')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Ảnh tiếp theo' }));
  expect(screen.queryByTestId('memory-photo-caption')).toBeNull();
});

it('double-taps to zoom around the touched point and double-taps again to reset', () => {
  let now = 1000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  const { handlers, swipe, onClose } = setup(0);
  const tap = () =>
    act(() => {
      handlers().onPanResponderGrant!(event([300, 400]), state());
      const release = event();
      release.nativeEvent.pageX = 300;
      release.nativeEvent.pageY = 400;
      now += 40;
      handlers().onPanResponderRelease!(release, state());
      now += 80;
    });
  tap();
  tap();
  expect(
    StyleSheet.flatten(screen.getByLabelText('Ảnh phóng lớn: one').props.style)
      .transform,
  ).toEqual([{ translateX: -150 }, { translateY: -150 }, { scale: 2.5 }]);
  swipe(0, 150);
  expect(onClose).not.toHaveBeenCalled();
  tap();
  tap();
  expect(
    StyleSheet.flatten(screen.getByLabelText('Ảnh phóng lớn: one').props.style)
      .transform,
  ).toEqual([{ translateX: 0 }, { translateY: 0 }, { scale: 1 }]);
  swipe(0, 150);
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('does not treat distant, delayed taps or a drag returning to its start as double-taps', () => {
  let now = 1000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  const { handlers } = setup(0);
  const tap = (x: number, drag = false) =>
    act(() => {
      handlers().onPanResponderGrant!(event([x, 300]), state());
      if (drag) {
        handlers().onPanResponderMove!(event([x + 40, 300]), state(40));
        handlers().onPanResponderMove!(event([x, 300]), state());
      }
      const release = event();
      release.nativeEvent.pageX = x;
      release.nativeEvent.pageY = 300;
      now += 40;
      handlers().onPanResponderRelease!(release, state());
      now += 80;
    });
  const expectStandard = () =>
    expect(
      StyleSheet.flatten(
        screen.getByLabelText('Ảnh phóng lớn: one').props.style,
      ).transform,
    ).toEqual([{ translateX: 0 }, { translateY: 0 }, { scale: 1 }]);
  tap(100);
  tap(300);
  expectStandard();
  now += 400;
  tap(300);
  expectStandard();
  tap(300, true);
  tap(300);
  expectStandard();
});
