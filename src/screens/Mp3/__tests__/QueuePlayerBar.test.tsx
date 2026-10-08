import { fireEvent, render } from '@testing-library/react-native';
import type { useQueuePlayer } from '../useQueuePlayer';
import { QueuePlayerBar } from '../QueuePlayerBar';

jest.mock('@react-native-community/slider', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@expo/vector-icons/Feather', () => ({
  __esModule: true,
  default: () => null,
}));

const title = 'Tên bài hát rất dài cần chạy ngang trong khu vực phát nhạc';

function queue(playing: boolean, isLoaded = true, isSwitchingTrack = false) {
  return {
    status: {
      duration: 28.5,
      currentTime: 2.8,
      playing,
      isLoaded,
    },
    isSwitchingTrack,
    error: null,
    stop: jest.fn(),
    seek: jest.fn(),
    toggle: jest.fn(),
    previous: jest.fn(),
    next: jest.fn(),
    hasNext: () => true,
  } as unknown as ReturnType<typeof useQueuePlayer>;
}

it('shows the playing queue title on one line and scrolls it only while playing', () => {
  const view = render(
    <QueuePlayerBar
      queue={queue(true)}
      title={title}
      subtitle="Bài 1/2"
      repeatAll={false}
      repeatCurrent={false}
      onToggleRepeatCurrent={jest.fn()}
    />,
  );
  const viewport = view.getByTestId('audio-title-viewport');
  const titleText = view.getAllByText(title)[0];

  expect(titleText.props.numberOfLines).toBe(1);
  fireEvent(viewport, 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 36 } },
  });
  fireEvent(
    view.getByTestId('audio-title-measure'),
    'contentSizeChange',
    300,
    36,
  );
  expect(view.getAllByText(title)[0].props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ opacity: 0 })]),
  );

  view.rerender(
    <QueuePlayerBar
      queue={queue(false)}
      title={title}
      subtitle="Bài 1/2"
      repeatAll={false}
      repeatCurrent={false}
      onToggleRepeatCurrent={jest.fn()}
    />,
  );
  expect(view.getAllByText(title)[0].props.style).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ opacity: 0 })]),
  );
});

it('keeps the player in its playing state while the next track loads', () => {
  const view = render(
    <QueuePlayerBar
      queue={queue(false, false, true)}
      title={title}
      subtitle="Bài 2/2"
      repeatAll={false}
      repeatCurrent={false}
      onToggleRepeatCurrent={jest.fn()}
    />,
  );

  fireEvent(view.getByTestId('audio-title-viewport'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 36 } },
  });
  fireEvent(
    view.getByTestId('audio-title-measure'),
    'contentSizeChange',
    300,
    36,
  );
  expect(view.getByLabelText('Tạm dừng')).toBeTruthy();
  const titleLine = view
    .getAllByText(title)
    .find((text) => text.props.ellipsizeMode === 'tail');
  expect(titleLine?.props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ opacity: 0 })]),
  );
});

it('shows a control for repeating the current track', () => {
  const onToggleRepeatCurrent = jest.fn();
  const view = render(
    <QueuePlayerBar
      queue={queue(true)}
      title={title}
      subtitle="Bài 1/2"
      repeatAll={false}
      repeatCurrent={false}
      onToggleRepeatCurrent={onToggleRepeatCurrent}
    />,
  );
  const repeatButton = view.getByLabelText('Lặp lại bài hiện tại');

  expect(repeatButton.props.accessibilityState.checked).toBe(false);
  fireEvent.press(repeatButton);
  expect(onToggleRepeatCurrent).toHaveBeenCalledTimes(1);
});

it('hides single-track repeat while whole-list repeat is active', () => {
  const view = render(
    <QueuePlayerBar
      queue={queue(true)}
      title={title}
      subtitle="Đang lặp lại cả danh sách"
      repeatAll
      repeatCurrent={false}
      onToggleRepeatCurrent={jest.fn()}
    />,
  );

  expect(view.queryByLabelText('Lặp lại bài hiện tại')).toBeNull();
  expect(view.getByTestId('player-transport-controls').props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ paddingRight: 0 })]),
  );
});
