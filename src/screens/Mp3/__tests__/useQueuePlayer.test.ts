import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useQueuePlayer } from '../useQueuePlayer';
import { useQueuePlaybackStore } from '../../../store/queuePlaybackStore';
import type { AudioTrack } from '../../../types/audio';
import { readAudioLearningPreferences } from '../../../services/audio/audioLearningPreferences';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);

type Status = {
  currentTime?: number;
  duration?: number;
  didJustFinish: boolean;
  isLoaded: boolean;
  playing: boolean;
};
type Listener = (s: Status) => void;
const mockListeners = new Set<Listener>();
let mockHookStatus = {
  playing: false,
  isLoaded: true,
  currentTime: 0,
  duration: 1,
};
const mockPlayer = {
  isLoaded: true,
  loop: false,
  replace: jest.fn(() => {
    mockPlayer.isLoaded = false;
  }),
  play: jest.fn(),
  pause: jest.fn(),
  seekTo: jest.fn(() => Promise.resolve()),
  setPlaybackRate: jest.fn(),
  setActiveForLockScreen: jest.fn(),
  updateLockScreenMetadata: jest.fn(),
  clearLockScreenControls: jest.fn(),
  addListener: jest.fn((_: string, cb: Listener) => {
    mockListeners.add(cb);
    return { remove: jest.fn(() => mockListeners.delete(cb)) };
  }),
};
const mockSetAudioMode = jest.fn(() => Promise.resolve());
jest.mock('expo-audio', () => ({
  setAudioModeAsync: (...args: unknown[]) => mockSetAudioMode(...(args as [])),
  useAudioPlayer: () => mockPlayer,
  useAudioPlayerStatus: () => mockHookStatus,
}));

const base: AudioTrack = {
  id: 'a',
  ownerId: 'u1',
  title: 'A',
  fileName: 'a.m4a',
  mimeType: 'audio/mp4',
  durationMs: 1000,
  sizeBytes: 10,
  createdAt: 1,
  source: 'audio',
  local: true,
  synced: false,
};
const items = ['a', 'b'].map((id) => ({ ...base, id, title: id }));
const prepare = (track: AudioTrack) => Promise.resolve(`file:///${track.id}`);

function emitStatus(status: Partial<Status> = {}) {
  if (status.isLoaded !== undefined) mockPlayer.isLoaded = status.isLoaded;
  const next = {
    didJustFinish: false,
    isLoaded: mockPlayer.isLoaded,
    playing: mockHookStatus.playing,
    ...status,
  };
  mockHookStatus = { ...mockHookStatus, ...next };
  mockListeners.forEach((cb) => cb(next));
}

beforeEach(() => {
  mockListeners.clear();
  jest.clearAllMocks();
  mockPlayer.isLoaded = true;
  mockPlayer.loop = false;
  mockHookStatus = {
    playing: false,
    isLoaded: true,
    currentTime: 0,
    duration: 1,
  };
  useQueuePlaybackStore.getState().setCurrentId(null);
  useQueuePlaybackStore.getState().setPlaying(false);
});

it('keeps a track switch active until the replacement actually starts playing', async () => {
  const { result, rerender } = renderHook(() =>
    useQueuePlayer({ items, repeatId: null, repeatAll: false, prepare }),
  );
  act(() => result.current.start(items[0]));
  await waitFor(() => expect(result.current.currentId).toBe('a'));
  expect(result.current.isSwitchingTrack).toBe(true);

  act(() => emitStatus({ isLoaded: true, playing: false }));
  rerender(undefined);
  expect(result.current.isSwitchingTrack).toBe(true);
  expect(mockPlayer.play).toHaveBeenCalledTimes(1);

  act(() => emitStatus({ isLoaded: true, playing: true }));
  rerender(undefined);
  expect(result.current.isSwitchingTrack).toBe(false);
});

it('keeps the play action stable while native playback progress changes', () => {
  const { result, rerender } = renderHook(
    ({ version }: { version: number }) => {
      void version;
      return useQueuePlayer({
        items,
        repeatId: null,
        repeatAll: false,
        prepare,
      });
    },
    { initialProps: { version: 0 } },
  );
  const start = result.current.start;

  act(() => {
    mockHookStatus = { ...mockHookStatus, currentTime: 0.25 };
    rerender({ version: 1 });
  });

  expect(result.current.start).toBe(start);
});

it('waits for each replacement source before playing and auto-advances', async () => {
  const { result } = renderHook(() =>
    useQueuePlayer({ items, repeatId: null, repeatAll: false, prepare }),
  );
  act(() => result.current.start(items[0]));
  await waitFor(() => expect(result.current.currentId).toBe('a'));
  expect(mockPlayer.play).not.toHaveBeenCalled();
  act(() => emitStatus({ isLoaded: true }));
  expect(mockPlayer.play).toHaveBeenCalledTimes(1);

  expect(mockSetAudioMode).toHaveBeenCalledWith(
    expect.objectContaining({ shouldPlayInBackground: true }),
  );
  expect(mockPlayer.setActiveForLockScreen).toHaveBeenCalledTimes(1);
  expect(mockPlayer.replace).toHaveBeenLastCalledWith({ uri: 'file:///a' });

  act(() => emitStatus({ didJustFinish: true, isLoaded: true }));
  await waitFor(() => expect(result.current.currentId).toBe('b'));
  expect(mockPlayer.replace).toHaveBeenLastCalledWith({ uri: 'file:///b' });
  expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  expect(mockPlayer.updateLockScreenMetadata).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'b' }),
  );

  act(() => emitStatus({ isLoaded: true }));
  expect(mockPlayer.play).toHaveBeenCalledTimes(2);
});

it('loops the repeated track natively instead of advancing', async () => {
  mockPlayer.replace.mockClear();
  const { result } = renderHook(() =>
    useQueuePlayer({ items, repeatId: 'a', repeatAll: false, prepare }),
  );
  act(() => result.current.start(items[0]));
  await waitFor(() => expect(result.current.currentId).toBe('a'));
  expect(mockPlayer.loop).toBe(true);
  act(() => emitStatus({ isLoaded: true }));
  act(() => emitStatus({ didJustFinish: true, isLoaded: true }));
  expect(mockPlayer.replace).toHaveBeenCalledTimes(1);
});

it('restarts from the first track when the whole queue finishes', async () => {
  const { result } = renderHook(() =>
    useQueuePlayer({ items, repeatId: null, repeatAll: true, prepare }),
  );
  act(() => result.current.start(items[1]));
  await waitFor(() => expect(result.current.currentId).toBe('b'));
  expect(result.current.hasNext()).toBe(true);
  act(() => emitStatus({ isLoaded: true }));
  expect(mockPlayer.play).toHaveBeenCalledTimes(1);

  act(() => emitStatus({ didJustFinish: true, isLoaded: true }));
  await waitFor(() => expect(result.current.currentId).toBe('a'));
  expect(mockPlayer.replace).toHaveBeenLastCalledWith({ uri: 'file:///a' });
  expect(mockPlayer.play).toHaveBeenCalledTimes(1);

  act(() => emitStatus({ isLoaded: true }));
  expect(mockPlayer.play).toHaveBeenCalledTimes(2);
});

it('forgets the resume point of a track that played to the end', async () => {
  const { result } = renderHook(() =>
    useQueuePlayer({
      uid: 'u1',
      items,
      repeatId: null,
      repeatAll: false,
      prepare,
    }),
  );
  act(() => result.current.start(items[0]));
  await waitFor(() => expect(result.current.currentId).toBe('a'));
  act(() => emitStatus({ isLoaded: true, playing: true }));

  act(() => emitStatus({ playing: true, currentTime: 40, duration: 45 }));
  await waitFor(async () =>
    expect((await readAudioLearningPreferences('u1')).resumePositions.a).toBe(
      40,
    ),
  );

  act(() =>
    emitStatus({
      playing: false,
      currentTime: 45,
      duration: 45,
      didJustFinish: true,
    }),
  );
  await waitFor(async () =>
    expect(
      (await readAudioLearningPreferences('u1')).resumePositions.a,
    ).toBeUndefined(),
  );
});
