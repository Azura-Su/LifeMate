import { fireEvent, render, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
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
    playbackRate: 1,
    sleepMinutes: null,
    bookmarks: [],
    setPlaybackRate: jest.fn(),
    setSleepTimer: jest.fn(),
    addBookmark: jest.fn(),
    removeBookmark: jest.fn(),
    seekBookmark: jest.fn(),
  } as unknown as ReturnType<typeof useQueuePlayer>;
}

it('keeps the player panel compact without shrinking its touch controls', () => {
  const view = render(
    <QueuePlayerBar
      queue={queue(false)}
      title={title}
      subtitle="Bài 1/2"
      repeatAll={false}
      repeatCurrent={false}
      onToggleRepeatCurrent={jest.fn()}
    />,
  );
  const panel = view.getByTestId('queue-player-bar');
  const panelStyle = StyleSheet.flatten(panel.props.style);
  const settings = StyleSheet.flatten(
    view.getByLabelText('Cài đặt phát').props.style,
  );
  const play = StyleSheet.flatten(view.getByLabelText('Phát').props.style);

  expect(panelStyle).toMatchObject({ padding: 12, borderRadius: 18 });
  expect(settings).toMatchObject({ width: 44, height: 44 });
  expect(play).toMatchObject({ width: 56, height: 56 });
});

it('places playback times on either side of the seek line', () => {
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
  const progress = view.getByTestId('player-progress-row');
  const style = StyleSheet.flatten(progress.props.style);
  const progressContent = within(progress);
  const elapsedStyle = StyleSheet.flatten(
    progressContent.getByText('0:02').props.style,
  );

  expect(style.flexDirection).toBe('row');
  expect(elapsedStyle).toMatchObject({
    width: 34,
    fontVariant: ['tabular-nums'],
  });
  expect(progressContent.getByText('0:02')).toBeTruthy();
  expect(progressContent.getByText('0:28')).toBeTruthy();
});

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

it('opens playback settings in a bottom sheet and applies its actions', () => {
  const player = queue(true);
  const view = render(
    <QueuePlayerBar
      queue={player}
      title={title}
      subtitle="Bài 1/2"
      repeatAll={false}
      repeatCurrent={false}
      onToggleRepeatCurrent={jest.fn()}
    />,
  );

  expect(view.queryByText('Tiện ích nghe')).toBeNull();
  fireEvent.press(view.getByLabelText('Cài đặt phát'));

  expect(view.getByText('Tiện ích nghe')).toBeTruthy();
  expect(
    StyleSheet.flatten(view.getByLabelText('Tốc độ 1.5 lần').props.style)
      .minHeight,
  ).toBe(44);
  fireEvent.press(view.getByLabelText('Tốc độ 1.5 lần'));
  fireEvent.press(view.getByLabelText('Tạm dừng sau 30 phút'));
  fireEvent.press(view.getByLabelText('Đánh dấu vị trí đang nghe'));

  expect(player.setPlaybackRate).toHaveBeenCalledWith(1.5);
  expect(player.setSleepTimer).toHaveBeenCalledWith(30);
  expect(player.addBookmark).toHaveBeenCalledTimes(1);

  fireEvent.press(view.getByLabelText('Đóng tiện ích nghe'));
  expect(view.queryByText('Tiện ích nghe')).toBeNull();
});
