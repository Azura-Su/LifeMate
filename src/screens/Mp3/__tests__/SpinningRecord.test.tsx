import { act, render } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { SpinningRecord } from '../SpinningRecord';

jest.mock(
  'react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo',
  () => {
    const listeners = new Set<(mockEnabled: boolean) => void>();
    let finishInitialRead!: (mockEnabled: boolean) => void;
    const initialPreference = new Promise<boolean>((resolve) => {
      finishInitialRead = resolve;
    });
    return {
      __esModule: true,
      default: {
        isReduceMotionEnabled: jest.fn(() => initialPreference),
        addEventListener: (_event: string, listener: (mockEnabled: boolean) => void) => {
          listeners.add(listener);
          return { remove: () => listeners.delete(listener) };
        },
      },
      emitReducedMotion: (enabled: boolean) => {
        listeners.forEach((listener) => listener(enabled));
      },
      finishInitialRead: (enabled: boolean) => finishInitialRead(enabled),
    };
  },
);
const { emitReducedMotion, finishInitialRead } = jest.requireMock(
  'react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo',
) as {
  emitReducedMotion: (enabled: boolean) => void;
  finishInitialRead: (enabled: boolean) => void;
};

beforeEach(async () => {
  await act(async () => emitReducedMotion(false));
});

it('keeps a newer OS event when the initial preference read finishes late', async () => {
  const start = jest.fn();
  const loop = jest.spyOn(Animated, 'loop').mockReturnValue({
    start,
    stop: jest.fn(),
    reset: jest.fn(),
  });
  try {
    await act(async () => emitReducedMotion(true));
    render(<SpinningRecord playing />);
    expect(start).not.toHaveBeenCalled();

    await act(async () => finishInitialRead(false));
    expect(start).not.toHaveBeenCalled();
  } finally {
    loop.mockRestore();
  }
});

it('reacts to OS reduced-motion events without needing an unrelated render', async () => {
  const start = jest.fn();
  const stop = jest.fn();
  const loop = jest.spyOn(Animated, 'loop').mockReturnValue({
    start,
    stop,
    reset: jest.fn(),
  });
  try {
    const view = render(<SpinningRecord playing />);
    expect(start).toHaveBeenCalledTimes(1);
    await act(async () => emitReducedMotion(true));
    expect(stop).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('spinning-record').props.accessibilityLabel).toBe(
      'Đĩa đang phát',
    );

    await act(async () => emitReducedMotion(false));
    expect(start).toHaveBeenCalledTimes(2);
    await act(async () => emitReducedMotion(true));
    expect(stop).toHaveBeenCalledTimes(2);
    expect(start).toHaveBeenCalledTimes(2);
  } finally {
    loop.mockRestore();
  }
});

it('renders an accessible record that can spin with the current playback state', () => {
  const view = render(<SpinningRecord playing />);

  expect(view.getByTestId('spinning-record').props.accessibilityLabel).toBe(
    'Đĩa đang phát',
  );
  expect(view.getByTestId('record-spin-marker')).toBeTruthy();
  expect(view.getByTestId('spinning-record').props.style.transform).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ rotate: expect.anything() }),
    ]),
  );

  view.rerender(<SpinningRecord playing={false} />);
  expect(view.getByTestId('spinning-record').props.accessibilityLabel).toBe(
    'Đĩa tạm dừng',
  );
});
