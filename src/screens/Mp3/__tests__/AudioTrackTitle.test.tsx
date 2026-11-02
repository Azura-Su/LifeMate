import { act, fireEvent, render } from '@testing-library/react-native';
import { Animated, AppState, StyleSheet } from 'react-native';
import { AudioTrackTitle } from '../AudioTrackTitle';
import { styles } from '../Mp3Screen.styles';

jest.mock(
  'react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo',
  () => {
    const listeners = new Set<(mockEnabled: boolean) => void>();
    return {
      __esModule: true,
      default: {
        isReduceMotionEnabled: jest.fn().mockResolvedValue(false),
        addEventListener: (_event: string, listener: (mockEnabled: boolean) => void) => {
          listeners.add(listener);
          return { remove: () => listeners.delete(listener) };
        },
      },
      emitReducedMotion: (enabled: boolean) => {
        listeners.forEach((listener) => listener(enabled));
      },
    };
  },
);
const { emitReducedMotion } = jest.requireMock(
  'react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo',
) as { emitReducedMotion: (enabled: boolean) => void };

beforeEach(async () => {
  AppState.currentState = 'active';
  await act(async () => emitReducedMotion(false));
});

jest.mock('@expo/vector-icons/Feather', () => ({
  __esModule: true,
  default: () => null,
}));

it('stops a running title when Reduced Motion is enabled and keeps the title readable', async () => {
  const title = 'Tên âm thanh dài hơn khung hiển thị';
  const start = jest.fn();
  const stop = jest.fn();
  const loop = jest.spyOn(Animated, 'loop').mockReturnValue({ start, stop, reset: jest.fn() });
  try {
    const view = render(<AudioTrackTitle title={title} active onActivate={jest.fn()} />);
    fireEvent(view.getByTestId('audio-title-viewport'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 36 } },
    });
    fireEvent(view.getByTestId('audio-title-measure'), 'contentSizeChange', 300, 36);
    expect(start).toHaveBeenCalledTimes(1);

    await act(async () => emitReducedMotion(true));
    expect(stop).toHaveBeenCalledTimes(1);
    expect(view.getByLabelText(`Chạy tên ${title}`)).toBeTruthy();
    const staticTitle = view.getAllByText(title).find((text) => text.props.ellipsizeMode === 'tail');
    expect(StyleSheet.flatten(staticTitle?.props.style).opacity ?? 1).toBe(1);

    await act(async () => emitReducedMotion(false));
    expect(start).toHaveBeenCalledTimes(2);
  } finally {
    loop.mockRestore();
  }
});

it('truncates the title to one line and starts/stops its marquee when pressed', () => {
  const title = 'Một tiêu đề âm thanh rất dài cần chạy ngang trên màn hình';
  const onActivate = jest.fn();
  const view = render(
    <AudioTrackTitle title={title} active={false} onActivate={onActivate} />,
  );
  const viewport = view.getByTestId('audio-title-viewport');
  const truncated = view.getAllByText(title)[0];
  expect(truncated.props.numberOfLines).toBe(1);
  expect(truncated.props.ellipsizeMode).toBe('tail');
  expect(StyleSheet.flatten(viewport.props.style).height).toBe(36);
  fireEvent(viewport, 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 36 } },
  });
  fireEvent(
    view.getByTestId('audio-title-measure'),
    'contentSizeChange',
    300,
    36,
  );

  fireEvent.press(view.getByLabelText(`Chạy tên ${title}`));
  expect(onActivate).toHaveBeenCalledTimes(1);
  view.rerender(
    <AudioTrackTitle title={title} active onActivate={onActivate} />,
  );
  expect(view.getByTestId('audio-title-viewport')).toBe(viewport);
  expect(view.getByLabelText(`Dừng chạy tên ${title}`)).toBeTruthy();
  expect(view.getAllByTestId(/^audio-title-copy-/)).toHaveLength(2);
  expect(view.getAllByTestId('audio-title-separator')).toHaveLength(1);

  view.rerender(
    <AudioTrackTitle title={title} active={false} onActivate={onActivate} />,
  );
  expect(view.getByLabelText(`Chạy tên ${title}`)).toBeTruthy();
  expect(
    StyleSheet.flatten(view.getByTestId('audio-title-viewport').props.style)
      .height,
  ).toBe(36);
});

it('starts while hovered only when the title overflows the visible line', () => {
  const title = 'Tiêu đề dài cần chạy ngang';
  const view = render(
    <AudioTrackTitle title={title} active={false} onActivate={jest.fn()} />,
  );
  const viewport = view.getByTestId('audio-title-viewport');
  fireEvent(viewport, 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 36 } },
  });
  fireEvent(
    view.getByTestId('audio-title-measure'),
    'contentSizeChange',
    200,
    36,
  );

  fireEvent(viewport, 'hoverIn');
  expect(view.getByLabelText(`Dừng chạy tên ${title}`)).toBeTruthy();
  fireEvent(viewport, 'hoverOut');
  expect(view.getByLabelText(`Chạy tên ${title}`)).toBeTruthy();

  fireEvent(viewport, 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 220, height: 36 } },
  });
  fireEvent(viewport, 'hoverIn');
  expect(view.getByLabelText(`Chạy tên ${title}`)).toBeTruthy();
});

it('keeps a replacement title visible until its own marquee width is measured', () => {
  const firstTitle = 'Tên âm thanh đầu tiên rất dài cần chạy ngang';
  const nextTitle = 'Tên âm thanh tiếp theo cũng dài và cần chạy ngang';
  const view = render(<AudioTrackTitle title={firstTitle} active />);
  const viewport = view.getByTestId('audio-title-viewport');
  fireEvent(viewport, 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 36 } },
  });
  fireEvent(
    view.getByTestId('audio-title-measure'),
    'contentSizeChange',
    300,
    36,
  );

  view.rerender(<AudioTrackTitle title={nextTitle} active />);
  const nextLine = () =>
    view
      .getAllByText(nextTitle)
      .find((text) => text.props.ellipsizeMode === 'tail');
  expect(nextLine()?.props.style).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ opacity: 0 })]),
  );

  fireEvent(
    view.getByTestId('audio-title-measure'),
    'contentSizeChange',
    280,
    36,
  );
  expect(nextLine()?.props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ opacity: 0 })]),
  );
});

it('keeps the rename icon 12 points after a compact title', () => {
  expect(StyleSheet.flatten(styles.trackTitleRow).gap).toBe(12);
  expect(StyleSheet.flatten(styles.titleIcon).minWidth).toBe(20);
  expect(StyleSheet.flatten(styles.trackTitle).flexShrink).toBe(1);
});
