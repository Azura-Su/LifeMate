import { act, renderHook } from '@testing-library/react-native';
import { useAudioEditor } from '../useAudioEditor';
import type { EditSegment, AudioTrack } from '../../../types/audio';
const track: AudioTrack = {
  id: 'a',
  ownerId: 'u1',
  title: 'A',
  fileName: 'a.mp3',
  mimeType: 'audio/mpeg',
  durationMs: 5000,
  sizeBytes: 1000,
  createdAt: 10,
  source: 'audio',
  local: true,
  synced: true,
};
const input: EditSegment[] = [
  { track, startMs: 0, endMs: 5000 },
  { track: { ...track, id: 'b', title: 'B' }, startMs: 0, endMs: 5000 },
];
it('preserves edited boundaries while changing the merge order', () => {
  const { result } = renderHook(() => useAudioEditor(input));
  act(() => result.current.change('a', 'start', '1.5'));
  act(() => result.current.move(1, -1));
  const save = jest.fn();
  act(() => result.current.submit(save));
  expect(save.mock.calls[0][0].map((s: EditSegment) => s.track.id)).toEqual([
    'b',
    'a',
  ]);
  expect(save.mock.calls[0][0][1].startMs).toBe(1500);
});
it('blocks save and preview when the chosen cut is reversed', () => {
  const { result } = renderHook(() => useAudioEditor(input));
  act(() => result.current.change('a', 'start', '6'));
  const save = jest.fn();
  act(() => result.current.submit(save));
  expect(save).not.toHaveBeenCalled();
  expect(result.current.error).toBeTruthy();
});

it('never rounds the initial end past the source duration', () => {
  const { result } = renderHook(() =>
    useAudioEditor([
      { track: { ...track, durationMs: 5070.2 }, startMs: 0, endMs: 5070.2 },
    ]),
  );
  const save = jest.fn();
  act(() => result.current.submit(save));
  expect(save.mock.calls[0][0][0].endMs).toBe(5070);
});
