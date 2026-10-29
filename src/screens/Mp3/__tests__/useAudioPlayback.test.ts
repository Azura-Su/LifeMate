import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAudioPlayback } from '../useAudioPlayback';
import type { Playback } from '../useMp3Screen';

const mockPlayer = {
  seekTo: jest.fn(() => Promise.resolve()),
  play: jest.fn(),
  pause: jest.fn(),
};
let mockStatus = {
  isLoaded: false,
  playing: false,
  currentTime: 0,
  duration: 5,
  didJustFinish: false,
};
const mockSetAudioMode = jest.fn((_options: unknown) => Promise.resolve());

jest.mock('expo-audio', () => ({
  setAudioModeAsync: (options: unknown) => mockSetAudioMode(options),
  useAudioPlayer: () => mockPlayer,
  useAudioPlayerStatus: () => mockStatus,
}));

const source: Playback = {
  uri: 'file:///preview.m4a',
  title: 'Preview',
  startMs: 1250,
  endMs: 5000,
  key: 1,
  trackId: 'track-1',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockStatus = {
    isLoaded: false,
    playing: false,
    currentTime: 0,
    duration: 5,
    didJustFinish: false,
  };
});

it('starts playback automatically as soon as the preview source is loaded', async () => {
  const { rerender } = renderHook(
    ({ playback }: { playback: Playback }) => useAudioPlayback(playback),
    { initialProps: { playback: source } },
  );
  expect(mockPlayer.play).not.toHaveBeenCalled();

  act(() => {
    mockStatus = { ...mockStatus, isLoaded: true };
    rerender({ playback: source });
  });

  await waitFor(() => expect(mockPlayer.play).toHaveBeenCalledTimes(1));
  expect(mockPlayer.seekTo).toHaveBeenCalledWith(1.25);
  expect(mockSetAudioMode).toHaveBeenCalledWith(
    expect.objectContaining({ playsInSilentMode: true }),
  );
});

it('restores playback controls if a slow source loads after the loading deadline', async () => {
  jest.useFakeTimers();
  try {
    const { result, rerender } = renderHook(() => useAudioPlayback(source));
    await act(async () => {
      jest.advanceTimersByTime(12000);
    });
    expect(result.current.error).not.toBeNull();
    act(() => {
      mockStatus = { ...mockStatus, isLoaded: true };
      rerender({});
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  } finally {
    jest.useRealTimers();
  }
});
