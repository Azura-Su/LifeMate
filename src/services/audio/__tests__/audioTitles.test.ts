import { renameAudio } from '../audioTitles';
import { renameAudioTitle } from '../audioFiles';
import { uploadAudioTrack } from '../../firebase/audioLibraryService';
import { useAuthStore } from '../../../store/authStore';
import type { AudioTrack } from '../../../types/audio';

jest.mock('../audioFiles', () => ({ renameAudioTitle: jest.fn() }));
jest.mock('../../firebase/audioLibraryService', () => ({
  uploadAudioTrack: jest.fn(),
}));
const track: AudioTrack = {
  id: 'a',
  ownerId: 'u1',
  title: 'Old',
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
  jest
    .mocked(renameAudioTitle)
    .mockResolvedValue({ ...track, title: 'New', pendingTitle: true });
});
it('renames a local file immediately without trying to upload it', async () => {
  const onSaved = jest.fn();
  const result = await renameAudio(
    track,
    'New',
    new AbortController().signal,
    jest.fn(),
    onSaved,
  );
  expect(result.track.title).toBe('New');
  expect(onSaved).toHaveBeenCalledWith(result.track);
  expect(uploadAudioTrack).not.toHaveBeenCalled();
});
it('reports a pending cloud title without rolling back a successful local rename', async () => {
  const saved = { ...track, synced: true, title: 'New', pendingTitle: true };
  jest.mocked(renameAudioTitle).mockResolvedValue(saved);
  jest.mocked(uploadAudioTrack).mockRejectedValue(new Error('Offline'));
  const onSaved = jest.fn();
  const result = await renameAudio(
    track,
    'New',
    new AbortController().signal,
    jest.fn(),
    onSaved,
  );
  expect(onSaved).toHaveBeenCalledWith(saved);
  expect(result.track).toEqual(saved);
  expect(result.warning).toContain('Đã đổi tên trên máy');
});
