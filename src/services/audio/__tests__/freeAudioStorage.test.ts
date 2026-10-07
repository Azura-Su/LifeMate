import { getAuth, getIdToken } from '@react-native-firebase/auth';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuthStore } from '../../../store/authStore';
import {
  requestAudioUrl,
  uploadFreeAudio,
  downloadFreeAudio,
} from '../freeAudioStorage';
import type { AudioTrack } from '../../../types/audio';

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(),
  getIdToken: jest.fn(),
}));
jest.mock('expo-file-system/legacy', () => ({
  createUploadTask: jest.fn(),
  createDownloadResumable: jest.fn(),
  FileSystemUploadType: { BINARY_CONTENT: 0 },
  FileSystemSessionType: { FOREGROUND: 0 },
}));
const track: AudioTrack = {
  id: 'a',
  ownerId: 'u1',
  title: 'A',
  fileName: 'a.mp3',
  mimeType: 'audio/mpeg',
  durationMs: 2000,
  sizeBytes: 1000,
  createdAt: 100,
  source: 'audio',
  synced: false,
  local: true,
};
const projectUrl = 'https://lifematetest.supabase.co';
const signedUrl = `${projectUrl}/storage/v1/object/upload/sign/lifemate-audio/audio/u1/a/a.mp3?token=short-lived`;
beforeEach(() => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = projectUrl;
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  useAuthStore
    .getState()
    .setUser({ uid: 'u1', email: null, displayName: null });
  jest
    .mocked(getAuth)
    .mockReturnValue({ currentUser: { uid: 'u1' } } as ReturnType<
      typeof getAuth
    >);
  jest.mocked(getIdToken).mockResolvedValue('firebase-token');
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ url: signedUrl }) });
});
afterEach(() => {
  delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
});
it('fails closed before sending credentials when storage is not configured', async () => {
  delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  await expect(
    requestAudioUrl(track, 'upload', new AbortController().signal),
  ).rejects.toThrow('chưa được kết nối');
  expect(fetch).not.toHaveBeenCalled();
});
it('rejects files above the free limit before any request', async () => {
  await expect(
    requestAudioUrl(
      { ...track, sizeBytes: 52428801 },
      'upload',
      new AbortController().signal,
    ),
  ).rejects.toThrow('50 MB');
  expect(fetch).not.toHaveBeenCalled();
});
it('requests only the authenticated user file and rejects redirected signed URLs', async () => {
  expect(
    await requestAudioUrl(track, 'upload', new AbortController().signal),
  ).toBe(signedUrl);
  expect(fetch).toHaveBeenCalledWith(
    `${projectUrl}/functions/v1/audio-access`,
    expect.objectContaining({
      redirect: 'error',
      headers: expect.objectContaining({
        apikey: 'sb_publishable_test',
        Authorization: 'Bearer firebase-token',
      }),
    }),
  );
  const body = JSON.parse(jest.mocked(fetch).mock.calls[0][1]?.body as string);
  expect(body).not.toHaveProperty('ownerId');
  for (const url of [
    'https://attacker.test/file',
    signedUrl.replace('/u1/', '/victim/'),
    signedUrl.replace('?token=short-lived', ''),
  ]) {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url }),
      } as Response);
    await expect(
      requestAudioUrl(track, 'upload', new AbortController().signal),
    ).rejects.toThrow('không hợp lệ');
  }
});
it('does not upload after the account changes', async () => {
  jest.mocked(getIdToken).mockImplementation(async () => {
    useAuthStore
      .getState()
      .setUser({ uid: 'u2', email: null, displayName: null });
    return 'old-token';
  });
  await expect(
    requestAudioUrl(track, 'upload', new AbortController().signal),
  ).rejects.toThrow('hủy');
  expect(fetch).not.toHaveBeenCalled();
});
it('rejects a failed binary upload and cancels the native task', async () => {
  const cancelAsync = jest.fn().mockResolvedValue(undefined);
  jest
    .mocked(FileSystem.createUploadTask)
    .mockReturnValue({
      uploadAsync: async () => ({ status: 413 }),
      cancelAsync,
    } as unknown as FileSystem.UploadTask);
  await expect(
    uploadFreeAudio(
      track,
      'file:///a.mp3',
      new AbortController().signal,
      jest.fn(),
    ),
  ).rejects.toThrow('50 MB');
  expect(cancelAsync).toHaveBeenCalled();
});
it('cancels an in-flight native upload on abort', async () => {
  const controller = new AbortController();
  const cancelAsync = jest.fn().mockResolvedValue(undefined);
  jest.mocked(FileSystem.createUploadTask).mockReturnValue({
    uploadAsync: () =>
      new Promise(() => {
        controller.abort();
      }),
    cancelAsync,
  } as unknown as FileSystem.UploadTask);
  await expect(
    uploadFreeAudio(track, 'file:///a.mp3', controller.signal, jest.fn()),
  ).rejects.toThrow('hủy');
  expect(cancelAsync).toHaveBeenCalled();
});
it('downloads a signed private object to the caller-provided partial file', async () => {
  const url = signedUrl.replace('/upload/sign/', '/sign/');
  jest
    .mocked(fetch)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url }),
    } as Response);
  jest
    .mocked(FileSystem.createDownloadResumable)
    .mockReturnValue({
      downloadAsync: async () => ({ status: 200 }),
      cancelAsync: jest.fn(),
    } as unknown as FileSystem.DownloadResumable);
  await downloadFreeAudio(
    track,
    'file:///a.mp3.partial',
    new AbortController().signal,
    jest.fn(),
  );
  expect(FileSystem.createDownloadResumable).toHaveBeenCalledWith(
    url,
    'file:///a.mp3.partial',
    expect.anything(),
    expect.any(Function),
  );
});
