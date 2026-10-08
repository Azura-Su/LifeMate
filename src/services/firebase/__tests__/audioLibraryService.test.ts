import { deleteDoc, doc, setDoc } from '@react-native-firebase/firestore';
import { deleteObject, putFile, ref } from '@react-native-firebase/storage';
import {
  deleteAudioTrackRemote,
  uploadAudioTrack,
} from '../audioLibraryService';
import { updateAudioIndex, audioExists } from '../../audio/audioFiles';
import { deleteFreeAudio, uploadFreeAudio } from '../../audio/freeAudioStorage';
import { useAuthStore } from '../../../store/authStore';
import type { AudioTrack } from '../../../types/audio';

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(),
  doc: jest.fn(),
  setDoc: jest.fn(),
  deleteDoc: jest.fn(),
}));
jest.mock('@react-native-firebase/storage', () => ({
  getStorage: jest.fn(),
  ref: jest.fn(),
  putFile: jest.fn(),
  deleteObject: jest.fn(),
}));
jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('../../audio/freeAudioStorage', () => ({
  uploadFreeAudio: jest.fn(),
  deleteFreeAudio: jest.fn(),
  downloadFreeAudio: jest.fn(),
}));
jest.mock('../../audio/audioFiles', () => ({
  updateAudioIndex: jest.fn(),
  audioExists: jest.fn().mockResolvedValue(false),
  audioLocalUri: () => 'file:///audio/a.mp3',
}));
const renamed: AudioTrack = {
  id: 'a',
  ownerId: 'u1',
  title: 'Tên mới',
  fileName: 'a.mp3',
  mimeType: 'audio/mpeg',
  durationMs: 2000,
  sizeBytes: 1000,
  createdAt: 100,
  source: 'audio',
  synced: true,
  local: false,
  pendingTitle: true,
};
beforeEach(() => {
  useAuthStore
    .getState()
    .setUser({ uid: 'u1', email: null, displayName: null });
  jest.mocked(setDoc).mockResolvedValue(undefined);
  jest.mocked(deleteDoc).mockResolvedValue(undefined);
  jest.mocked(uploadFreeAudio).mockResolvedValue(undefined);
  jest.mocked(deleteFreeAudio).mockResolvedValue(undefined);
});
it('removes a Supabase backup before its private Firestore metadata', async () => {
  const track = { ...renamed, storageProvider: 'supabase' as const };
  await deleteAudioTrackRemote(track, new AbortController().signal);
  expect(deleteFreeAudio).toHaveBeenCalledWith(track, expect.anything());
  expect(doc).toHaveBeenLastCalledWith(
    undefined,
    'audioLibraries',
    'u1',
    'tracks',
    'a',
  );
  expect(deleteDoc).toHaveBeenCalledWith(undefined);
  expect(jest.mocked(deleteFreeAudio).mock.invocationCallOrder[0]).toBeLessThan(
    jest.mocked(deleteDoc).mock.invocationCallOrder[0],
  );
});
it('removes legacy Firebase Storage backups before Firestore metadata', async () => {
  const track = { ...renamed, storageProvider: undefined };
  await deleteAudioTrackRemote(track, new AbortController().signal);
  expect(ref).toHaveBeenCalledWith(undefined, 'audio/u1/a/a.mp3');
  expect(deleteObject).toHaveBeenCalled();
  expect(deleteDoc).toHaveBeenCalledWith(undefined);
  expect(jest.mocked(deleteObject).mock.invocationCallOrder[0]).toBeLessThan(
    jest.mocked(deleteDoc).mock.invocationCallOrder[0],
  );
});
it('keeps metadata if remote audio deletion fails', async () => {
  jest.mocked(deleteFreeAudio).mockRejectedValueOnce(new Error('Offline'));
  await expect(
    deleteAudioTrackRemote(
      { ...renamed, storageProvider: 'supabase' },
      new AbortController().signal,
    ),
  ).rejects.toThrow('Offline');
  expect(deleteDoc).not.toHaveBeenCalled();
});
it('cleans up legacy metadata after its already-missing Storage object', async () => {
  jest
    .mocked(deleteObject)
    .mockRejectedValueOnce({ code: 'storage/object-not-found' });
  await deleteAudioTrackRemote(
    { ...renamed, storageProvider: undefined },
    new AbortController().signal,
  );
  expect(deleteDoc).toHaveBeenCalled();
});
it('uploads new audio to free storage and persists the provider with metadata', async () => {
  jest.mocked(audioExists).mockResolvedValueOnce(true);
  const saved = await uploadAudioTrack(
    { ...renamed, local: true, synced: false },
    new AbortController().signal,
    jest.fn(),
  );
  expect(putFile).not.toHaveBeenCalled();
  expect(uploadFreeAudio).toHaveBeenCalledWith(
    expect.objectContaining({ storageProvider: 'supabase' }),
    'file:///audio/a.mp3',
    expect.anything(),
    expect.any(Function),
  );
  expect(setDoc).toHaveBeenCalledWith(
    undefined,
    expect.objectContaining({ storageProvider: 'supabase' }),
  );
  expect(saved).toMatchObject({
    storageProvider: 'supabase',
    synced: true,
    local: true,
  });
});
it('does not publish metadata or mark a backup when upload fails', async () => {
  jest.mocked(audioExists).mockResolvedValueOnce(true);
  jest.mocked(uploadFreeAudio).mockRejectedValueOnce(new Error('quota full'));
  await expect(
    uploadAudioTrack(
      { ...renamed, synced: false },
      new AbortController().signal,
      jest.fn(),
    ),
  ).rejects.toThrow('quota full');
  expect(setDoc).not.toHaveBeenCalled();
  expect(updateAudioIndex).not.toHaveBeenCalled();
});
it('syncs a new title using metadata only, even if the saved cloud audio is not on this device', async () => {
  const saved = await uploadAudioTrack(
    renamed,
    new AbortController().signal,
    jest.fn(),
  );
  expect(putFile).not.toHaveBeenCalled();
  expect(setDoc).toHaveBeenCalledWith(
    undefined,
    expect.objectContaining({ title: 'Tên mới', fileName: 'a.mp3' }),
  );
  expect(jest.mocked(setDoc).mock.calls[0][1]).not.toHaveProperty(
    'pendingTitle',
  );
  expect(saved).toMatchObject({
    synced: true,
    pendingTitle: false,
    local: false,
  });
  expect(updateAudioIndex).toHaveBeenCalledWith(saved);
});
it('keeps a pending title when cloud sync fails', async () => {
  jest.mocked(setDoc).mockRejectedValue(new Error('Offline'));
  await expect(
    uploadAudioTrack(renamed, new AbortController().signal, jest.fn()),
  ).rejects.toThrow('Offline');
  expect(updateAudioIndex).not.toHaveBeenCalled();
});
it('rejects a title sync after switching accounts', async () => {
  useAuthStore
    .getState()
    .setUser({ uid: 'u2', email: null, displayName: null });
  await expect(
    uploadAudioTrack(renamed, new AbortController().signal, jest.fn()),
  ).rejects.toThrow('hủy');
  expect(setDoc).not.toHaveBeenCalled();
});
