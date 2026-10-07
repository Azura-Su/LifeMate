import { setDoc } from '@react-native-firebase/firestore';
import { putFile } from '@react-native-firebase/storage';
import { uploadAudioTrack } from '../audioLibraryService';
import { updateAudioIndex } from '../../audio/audioFiles';
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
jest.mock('../../audio/audioFiles', () => ({
  updateAudioIndex: jest.fn(),
  audioExists: jest.fn().mockResolvedValue(false),
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
