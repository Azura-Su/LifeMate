import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { AudioTrack } from '../../../types/audio';
import { useAuthStore } from '../../../store/authStore';
import { useAudioStore } from '../../../store/audioStore';
import {
  deleteAudioTrackRemote,
  fetchCloudTracks,
} from '../../../services/firebase/audioLibraryService';
import {
  deleteLocalAudioTrack,
  removeTemporaryAudio,
  readAudioIndex,
} from '../../../services/audio/audioFiles';
import { previewAudio } from '../../../services/audio/audioOperations';
import { useMp3Screen } from '../useMp3Screen';

jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn().mockResolvedValue(undefined),
  deactivateKeepAwake: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../services/audio/audioFiles', () => ({
  audioLocalUri: jest.fn(() => 'file:///audio/a.mp3'),
  deleteLocalAudioTrack: jest.fn(),
  removeTemporaryAudio: jest.fn(async () => undefined),
  mergeAudioIndex: jest.fn(async (_uid, remote) => remote),
  readAudioIndex: jest.fn(),
}));
jest.mock('../../../services/audio/audioSession', () => ({
  assertAudioSession: jest.fn(),
}));
jest.mock('../../../services/audio/audioOperations', () => ({
  editAudio: jest.fn(),
  previewAudio: jest.fn(async () => ({
    uri: 'file:///cache/merge-preview.m4a',
    durationMs: 4000,
  })),
}));
jest.mock('../../../config/audioCloud', () => ({ audioCloudUrl: () => null }));
jest.mock('../../../services/firebase/audioLibraryService', () => ({
  deleteAudioTrackRemote: jest.fn(),
  downloadAudioTrack: jest.fn(),
  fetchCloudTracks: jest.fn(),
  uploadAudioTrack: jest.fn(),
}));
jest.mock('../useAudioNaming', () => ({
  useAudioNaming: () => ({
    draft: null,
    chooseFile: jest.fn(),
    rename: jest.fn(),
    save: jest.fn(),
    close: jest.fn(),
  }),
}));

const track: AudioTrack = {
  id: 'a',
  ownerId: 'u1',
  title: 'Bài nghe',
  fileName: 'a.mp3',
  mimeType: 'audio/mpeg',
  durationMs: 2000,
  sizeBytes: 1000,
  createdAt: 100,
  source: 'audio',
  synced: false,
  local: true,
};

beforeEach(() => {
  useAuthStore
    .getState()
    .setUser({ uid: 'u1', email: null, displayName: null });
  useAudioStore.getState().bind('u1');
  jest.mocked(readAudioIndex).mockResolvedValue([track]);
  jest.mocked(deleteLocalAudioTrack).mockResolvedValue([]);
  jest.mocked(deleteAudioTrackRemote).mockResolvedValue(undefined);
  jest.mocked(fetchCloudTracks).mockResolvedValue([]);
  jest.mocked(removeTemporaryAudio).mockResolvedValue(undefined);
});

it('removes a local track and its merge selection after confirmation', async () => {
  const { result } = renderHook(() => useMp3Screen());
  await waitFor(() => expect(result.current.tracks).toEqual([track]));
  act(() => result.current.toggleSelect(track.id));
  let deleted = false;
  await act(async () => {
    deleted = await result.current.deleteTrack(track);
  });
  expect(deleted).toBe(true);
  expect(deleteLocalAudioTrack).toHaveBeenCalledWith(track);
  expect(deleteAudioTrackRemote).not.toHaveBeenCalled();
  expect(result.current.tracks).toEqual([]);
  expect(result.current.selected).toEqual([]);
});

it('clears a successful operation message automatically', async () => {
  const { result } = renderHook(() => useMp3Screen());
  await waitFor(() => expect(result.current.tracks).toEqual([track]));

  jest.useFakeTimers();
  try {
    await act(async () => {
      await result.current.deleteTrack(track);
    });
    expect(result.current.message).toBe('Đã xóa file thành công.');

    act(() => jest.advanceTimersByTime(2999));
    expect(result.current.message).toBe('Đã xóa file thành công.');

    act(() => jest.advanceTimersByTime(1));
    expect(result.current.message).toBeNull();
  } finally {
    jest.useRealTimers();
  }
});

it('clears the temporary merge selection when leaving the library', async () => {
  const { result } = renderHook(() => useMp3Screen());
  await waitFor(() => expect(result.current.tracks).toEqual([track]));
  act(() => result.current.toggleSelect(track.id));
  expect(result.current.selected).toEqual([track.id]);

  act(() => result.current.clearSelection());
  expect(result.current.selected).toEqual([]);
});

it('clears merge selection when backing out of the editor', async () => {
  const { result } = renderHook(() => useMp3Screen());
  await waitFor(() => expect(result.current.tracks).toEqual([track]));
  act(() => result.current.toggleSelect(track.id));
  act(() => result.current.mergeSelected());

  expect(result.current.selected).toEqual([track.id]);
  expect(result.current.editor).toHaveLength(1);

  act(() => result.current.closeEditor());
  expect(result.current.selected).toEqual([]);
  expect(result.current.editor).toBeNull();
});

it('keeps a local copy when removing its cloud backup fails', async () => {
  const synced = { ...track, synced: true };
  jest.mocked(readAudioIndex).mockResolvedValueOnce([synced]);
  jest.mocked(fetchCloudTracks).mockResolvedValueOnce([synced]);
  jest
    .mocked(deleteAudioTrackRemote)
    .mockRejectedValueOnce(new Error('Offline'));
  const { result } = renderHook(() => useMp3Screen());
  await waitFor(() => expect(result.current.tracks).toEqual([synced]));
  let deleted = true;
  await act(async () => {
    deleted = await result.current.deleteTrack(synced);
  });
  expect(deleted).toBe(false);
  expect(deleteAudioTrackRemote).toHaveBeenCalledWith(
    synced,
    expect.any(AbortSignal),
  );
  expect(deleteLocalAudioTrack).not.toHaveBeenCalled();
  expect(result.current.tracks).toEqual([synced]);
});

it('opens the generated merge preview and removes its temporary audio on stop', async () => {
  const { result } = renderHook(() => useMp3Screen());
  await waitFor(() => expect(result.current.tracks).toEqual([track]));
  const other = { ...track, id: 'b', title: 'Bản khác' };
  const segments = [
    { track, startMs: 500, endMs: 1500 },
    { track: other, startMs: 1000, endMs: 3500 },
  ];

  await act(async () => {
    await result.current.previewEdit(segments);
  });

  expect(previewAudio).toHaveBeenCalledWith(
    segments,
    expect.any(AbortSignal),
    expect.any(Function),
    expect.any(Function),
  );
  expect(result.current.playback).toMatchObject({
    uri: 'file:///cache/merge-preview.m4a',
    title: 'Nghe thử bản ghép',
    startMs: 0,
    endMs: 4000,
    trackId: 'merge-preview',
  });

  act(() => result.current.stop());
  expect(result.current.playback).toBeNull();
  expect(removeTemporaryAudio).toHaveBeenCalledWith(
    'file:///cache/merge-preview.m4a',
  );
});
