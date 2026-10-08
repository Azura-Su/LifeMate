import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { usePlaylist } from '../usePlaylist';
import type { AudioTrack } from '../../../types/audio';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);

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
const tracks = ['a', 'b', 'c'].map((id) => ({ ...base, id, title: id }));

beforeEach(() => AsyncStorage.clear());

it('migrates the previous single list and persists ordered tracks per account', async () => {
  await AsyncStorage.setItem('lifemate-audio-playlist-u1', '["c","a"]');
  const { result, rerender } = renderHook(
    ({ uid }: { uid: string }) => usePlaylist(uid, tracks),
    { initialProps: { uid: 'u1' } },
  );
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.playlists).toHaveLength(1);
  expect(result.current.selectedPlaylist?.name).toBe('Danh sách nghe');
  expect(result.current.items.map((t) => t.id)).toEqual(['c', 'a']);
  await waitFor(async () => {
    const saved = await AsyncStorage.getItem('lifemate-audio-playlists-v1-u1');
    expect(JSON.parse(saved!).playlists[0].trackIds).toEqual(['c', 'a']);
  });

  rerender({ uid: 'u2' });
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.items).toEqual([]);
  expect(result.current.playlists).toHaveLength(1);
});

it('creates and selects named lists, with independent membership for the same file', async () => {
  const { result } = renderHook(() => usePlaylist('u1', tracks));
  await waitFor(() => expect(result.current.ready).toBe(true));

  let morningId = '';
  let workoutId = '';
  act(() => {
    morningId = result.current.createPlaylist('Buổi sáng')!;
    workoutId = result.current.createPlaylist('Tập luyện')!;
  });
  expect(result.current.selectedPlaylist?.id).toBe(workoutId);

  act(() => {
    result.current.toggleInPlaylist('a', morningId);
    result.current.toggleInPlaylist('a', workoutId);
    result.current.toggleInPlaylist('b', workoutId);
  });
  expect(result.current.hasInPlaylist('a', morningId)).toBe(true);
  expect(result.current.hasInPlaylist('a', workoutId)).toBe(true);
  expect(result.current.membershipCount('a')).toBe(2);
  expect(result.current.items.map((track) => track.id)).toEqual(['a', 'b']);

  act(() => result.current.selectPlaylist(morningId));
  expect(result.current.items.map((track) => track.id)).toEqual(['a']);
  act(() => result.current.remove('a'));
  expect(result.current.hasInPlaylist('a', workoutId)).toBe(true);
  act(() => result.current.removeFromAll('a'));
  expect(result.current.membershipCount('a')).toBe(0);

  await waitFor(async () => {
    const saved = await AsyncStorage.getItem('lifemate-audio-playlists-v1-u1');
    const parsed = JSON.parse(saved!);
    expect(parsed.playlists).toHaveLength(3);
    expect(
      parsed.playlists.find((item: { id: string }) => item.id === workoutId)
        .trackIds,
    ).toEqual(['b']);
  });
});

it('moves tracks within the selected list and persists the new order', async () => {
  const { result } = renderHook(() => usePlaylist('u1', tracks));
  await waitFor(() => expect(result.current.ready).toBe(true));
  act(() => {
    result.current.toggleInPlaylist('a', 'default');
    result.current.toggleInPlaylist('b', 'default');
    result.current.toggleInPlaylist('c', 'default');
  });

  act(() => result.current.moveTrack('b', 'up'));
  expect(result.current.items.map((track) => track.id)).toEqual([
    'b',
    'a',
    'c',
  ]);
  act(() => result.current.moveTrack('b', 'down'));
  expect(result.current.items.map((track) => track.id)).toEqual([
    'a',
    'b',
    'c',
  ]);
  act(() => result.current.moveTrack('a', 'up'));
  expect(result.current.items.map((track) => track.id)).toEqual([
    'a',
    'b',
    'c',
  ]);

  await waitFor(async () => {
    const saved = await AsyncStorage.getItem('lifemate-audio-playlists-v1-u1');
    expect(JSON.parse(saved!).playlists[0].trackIds).toEqual(['a', 'b', 'c']);
  });
});

it('keeps playlist callbacks stable when unrelated playback status rerenders its parent', async () => {
  const { result, rerender } = renderHook(
    ({ version }: { version: number }) => {
      void version;
      return usePlaylist('u1', tracks);
    },
    { initialProps: { version: 0 } },
  );
  await waitFor(() => expect(result.current.ready).toBe(true));
  const { remove, selectPlaylist, toggleInPlaylist, moveTrack } =
    result.current;

  rerender({ version: 1 });

  expect(result.current.remove).toBe(remove);
  expect(result.current.selectPlaylist).toBe(selectPlaylist);
  expect(result.current.toggleInPlaylist).toBe(toggleInPlaylist);
  expect(result.current.moveTrack).toBe(moveTrack);
});

it('renames lists without losing tracks and rejects duplicate names ignoring case', async () => {
  const { result } = renderHook(() => usePlaylist('u1', tracks));
  await waitFor(() => expect(result.current.ready).toBe(true));
  let firstId = '';
  let secondId = '';
  act(() => {
    firstId = result.current.createPlaylist('Buổi sáng')!;
    secondId = result.current.createPlaylist('Tập trung')!;
    result.current.toggleInPlaylist('a', firstId);
  });
  expect(result.current.createPlaylist('BUỔI SÁNG')).toBeNull();

  act(() => {
    expect(result.current.renamePlaylist(firstId, 'Chạy bộ')).toBe(true);
  });
  expect(
    result.current.playlists.find((item) => item.id === firstId)?.name,
  ).toBe('Chạy bộ');
  expect(
    result.current.playlists.find((item) => item.id === firstId)?.trackIds,
  ).toEqual(['a']);

  act(() => {
    expect(result.current.renamePlaylist(firstId, 'tẬp TRUNG')).toBe(false);
    expect(result.current.renamePlaylist(secondId, '   ')).toBe(false);
  });
  expect(
    result.current.playlists.find((item) => item.id === firstId)?.name,
  ).toBe('Chạy bộ');
});

it('deletes the selected list and its name, including the last list, without deleting audio', async () => {
  const { result } = renderHook(() => usePlaylist('u1', tracks));
  await waitFor(() => expect(result.current.ready).toBe(true));
  let morningId = '';
  let workoutId = '';
  act(() => {
    morningId = result.current.createPlaylist('Buổi sáng')!;
    workoutId = result.current.createPlaylist('Tập luyện')!;
    result.current.toggleInPlaylist('a', morningId);
    result.current.toggleInPlaylist('b', workoutId);
  });

  act(() => result.current.deletePlaylist(morningId));
  expect(result.current.selectedPlaylistId).toBe(workoutId);
  expect(result.current.items.map((track) => track.id)).toEqual(['b']);
  expect(result.current.hasInPlaylist('a', morningId)).toBe(false);

  act(() => result.current.deletePlaylist(workoutId));
  expect(result.current.playlists).toHaveLength(1);
  expect(result.current.selectedPlaylist?.name).toBe('Danh sách nghe');
  expect(result.current.items).toEqual([]);

  act(() => result.current.deletePlaylist('default'));
  expect(result.current.playlists).toHaveLength(0);
  expect(result.current.selectedPlaylist).toBeNull();
  expect(result.current.items).toEqual([]);
  expect(tracks.map((track) => track.id)).toContain('a');

  await waitFor(async () => {
    const saved = await AsyncStorage.getItem('lifemate-audio-playlists-v1-u1');
    expect(JSON.parse(saved!).playlists).toEqual([]);
  });
  const reopened = renderHook(() => usePlaylist('u1', tracks));
  await waitFor(() => expect(reopened.result.current.ready).toBe(true));
  expect(reopened.result.current.playlists).toEqual([]);
  expect(reopened.result.current.selectedPlaylist).toBeNull();
});
