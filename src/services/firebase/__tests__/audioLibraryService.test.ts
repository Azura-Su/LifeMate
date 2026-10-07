import { setDoc } from '@react-native-firebase/firestore';
import { putFile } from '@react-native-firebase/storage';
import { uploadAudioTrack } from '../audioLibraryService';
import { updateAudioIndex, audioExists } from '../../audio/audioFiles';
import { uploadFreeAudio } from '../../audio/freeAudioStorage';
import { useAuthStore } from '../../../store/authStore';
import type { AudioTrack } from '../../../types/audio';

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(),
  doc: jest.fn(),
  setDoc: jest.fn(),
}));
jest.mock('@react-native-firebase/storage', () => ({
  getStorage: jest.fn(),
  ref: jest.fn(),
  putFile: jest.fn(),
}));
jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('../../audio/freeAudioStorage', () => ({
  uploadFreeAudio: jest.fn(),
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
  jest.mocked(uploadFreeAudio).mockResolvedValue(undefined);
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
