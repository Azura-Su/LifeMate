import { fireEvent, render } from '@testing-library/react-native';
import type { Playback } from '../useMp3Screen';
import { AudioPlayer } from '../AudioPlayer';

const mockUseAudioPlayback = jest.fn();

jest.mock('../useAudioPlayback', () => ({
  useAudioPlayback: (...args: unknown[]) => mockUseAudioPlayback(...args),
}));
jest.mock('@react-native-community/slider', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@expo/vector-icons/Feather', () => ({
  __esModule: true,
  default: () => null,
}));

const source: Playback = {
  uri: 'file:///audio.m4a',
  title: 'Một tên bài dài hơn khu vực hiển thị của trình phát',
  startMs: 0,
  endMs: 12000,
  key: 1,
  trackId: 'track-1',
};

function playerModel(playing: boolean) {
  return {
    status: {
      isLoaded: true,
      playing,
      currentTime: 1,
      duration: 12,
    },
    error: null,
    toggle: jest.fn(),
    seek: jest.fn(),
    start: 0,
    end: 12,
  };
}

it('shows the playing title on one line and reports play and pause state', () => {
  const onPlaybackChange = jest.fn();
  mockUseAudioPlayback.mockReturnValue(playerModel(true));
  const view = render(
    <AudioPlayer
      source={source}
      onClose={jest.fn()}
      onPlaybackChange={onPlaybackChange}
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
  expect(view.getAllByText(source.title)[0].props.numberOfLines).toBe(1);
  expect(view.getAllByText(source.title)[0].props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ opacity: 0 })]),
  );
  expect(onPlaybackChange).toHaveBeenLastCalledWith('track-1', true);

  mockUseAudioPlayback.mockReturnValue(playerModel(false));
  view.rerender(
    <AudioPlayer
      source={source}
      onClose={jest.fn()}
      onPlaybackChange={onPlaybackChange}
    />,
  );
  expect(onPlaybackChange).toHaveBeenLastCalledWith('track-1', false);
  expect(view.getAllByText(source.title)[0].props.style).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ opacity: 0 })]),
  );
});
