import { importAudio, editAudio } from '../audioOperations';
import engine from '../../../../modules/lifemate-audio';
import { saveAudioFile, removeTemporaryAudio } from '../audioFiles';
import {
  uploadAudioTrack,
  downloadAudioTrack,
} from '../../firebase/audioLibraryService';
import { useAuthStore } from '../../../store/authStore';
import type { AudioTrack } from '../../../types/audio';

jest.mock('../../../../modules/lifemate-audio', () => ({
  __esModule: true,
  default: { inspect: jest.fn(), exportAudio: jest.fn(), cancel: jest.fn() },
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'new-id' }));
jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest
    .fn()
    .mockResolvedValue({ exists: true, size: 1000, isDirectory: false }),
}));
jest.mock('../audioFiles', () => ({
  saveAudioFile: jest.fn(),
  removeTemporaryAudio: jest.fn(),
  audioLocalUri: (t: AudioTrack) => `file:///saved/${t.fileName}`,
}));
jest.mock('../../firebase/audioLibraryService', () => ({
  uploadAudioTrack: jest.fn(),
  downloadAudioTrack: jest.fn(),
}));
const asset = {
  uri: 'file:///cache/picked.mp3',
  name: 'Morning.mp3',
  lastModified: 1,
  size: 1000,
  mimeType: 'audio/mpeg',
};
const info = { durationMs: 5000, hasAudio: true, hasVideo: false };
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
beforeEach(() => {
  useAuthStore
    .getState()
    .setUser({ uid: 'u1', email: null, displayName: null });
  jest.mocked(engine.inspect).mockResolvedValue(info);
  jest.mocked(engine.exportAudio).mockResolvedValue('file:///cache/output.m4a');
  jest
    .mocked(saveAudioFile)
    .mockImplementation(async (t) => ({ ...t, local: true }));
  jest
    .mocked(uploadAudioTrack)
    .mockImplementation(async (t) => ({ ...t, synced: true }));
  jest.mocked(downloadAudioTrack).mockImplementation(async (t) => t);
});
it('preserves MP3 bytes without invoking the converter and saves before reporting a cloud failure', async () => {
  jest.mocked(uploadAudioTrack).mockRejectedValue(new Error('Offline'));
  const saved = jest.fn();
  const result = await importAudio(
    'u1',
    asset,
    new AbortController().signal,
    jest.fn(),
    saved,
  );
  expect(engine.exportAudio).not.toHaveBeenCalled();
  expect(saveAudioFile).toHaveBeenCalledWith(
    expect.objectContaining({ fileName: 'new-id.mp3', source: 'audio' }),
    asset.uri,
  );
  expect(saved).toHaveBeenCalledWith(
    expect.objectContaining({ local: true, synced: false }),
  );
  expect(result.warning).toContain('Offline');
});
it('uploads only extracted audio and removes the temporary video copy', async () => {
  jest
    .mocked(engine.inspect)
    .mockResolvedValueOnce({ ...info, hasVideo: true });
  await importAudio(
    'u1',
    { ...asset, name: 'clip.mp4' },
    new AbortController().signal,
    jest.fn(),
    jest.fn(),
  );
  expect(saveAudioFile).toHaveBeenCalledWith(
    expect.objectContaining({ mimeType: 'audio/mp4', source: 'video' }),
    'file:///cache/output.m4a',
  );
  expect(removeTemporaryAudio).toHaveBeenCalledWith(asset.uri);
});
it('rejects silent videos before saving or uploading', async () => {
  jest
    .mocked(engine.inspect)
    .mockResolvedValue({ ...info, hasAudio: false, hasVideo: true });
  await expect(
    importAudio(
      'u1',
      asset,
      new AbortController().signal,
      jest.fn(),
      jest.fn(),
    ),
  ).rejects.toThrow('không có âm thanh');
  expect(saveAudioFile).not.toHaveBeenCalled();
});
it.each([false, true])(
  'saves the chosen name for audio/video (video=%s) without changing format detection',
  async (hasVideo) => {
    jest.mocked(engine.inspect).mockResolvedValueOnce({ ...info, hasVideo });
    await importAudio(
      'u1',
      asset,
      new AbortController().signal,
      jest.fn(),
      jest.fn(),
      '  Nhạc thư giãn  ',
    );
    expect(saveAudioFile).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Nhạc thư giãn',
        fileName: hasVideo ? 'new-id.m4a' : 'new-id.mp3',
      }),
      hasVideo ? 'file:///cache/output.m4a' : asset.uri,
    );
  },
);
it('keeps the chosen segment order and boundaries when merging', async () => {
  const other = { ...track, id: 'b', fileName: 'b.wav', mimeType: 'audio/wav' };
  await editAudio(
    'u1',
    [
      { track: other, startMs: 1000, endMs: 3000 },
      { track, startMs: 0, endMs: 2000 },
    ],
    'Bản ghép',
    new AbortController().signal,
    jest.fn(),
    jest.fn(),
  );
  expect(engine.exportAudio).toHaveBeenCalledWith([
    { uri: 'file:///saved/b.wav', startMs: 1000, endMs: 3000 },
    { uri: 'file:///saved/a.mp3', startMs: 0, endMs: 2000 },
  ]);
});
it('does not save a result after the account changes during conversion', async () => {
  jest
    .mocked(engine.inspect)
    .mockResolvedValueOnce({ ...info, hasVideo: true });
  jest.mocked(engine.exportAudio).mockImplementation(async () => {
    useAuthStore
      .getState()
      .setUser({ uid: 'u2', email: null, displayName: null });
    return 'file:///cache/output.m4a';
  });
  await expect(
    importAudio(
      'u1',
      asset,
      new AbortController().signal,
      jest.fn(),
      jest.fn(),
    ),
  ).rejects.toThrow('hủy');
  expect(saveAudioFile).not.toHaveBeenCalled();
});
