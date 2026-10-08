import { getAuth, getIdToken } from '@react-native-firebase/auth';
import * as FileSystem from 'expo-file-system/legacy';
import type { AudioTrack } from '../../types/audio';
import {
  audioBackupUnavailable,
  audioCloudApiKey,
  audioCloudUrl,
} from '../../config/audioCloud';
import { parseCloudTrack, trackStoragePath } from '../../utils/audio';
import { abortable, assertAudioSession } from './audioSession';

function storageError(status: number): Error {
  if (status === 401 || status === 403)
    return new Error(
      'Phiên sao lưu chưa hợp lệ. Hãy đăng nhập lại rồi thử lại.',
    );
  if (status === 413)
    return new Error(
      'Kho miễn phí chỉ nhận file tối đa 50 MB. Bản trên máy vẫn được giữ.',
    );
  if (status === 400)
    return new Error('Thông tin bản sao lưu không hợp lệ. Hãy thử lại sau.');
  if (status === 404)
    return new Error(
      'Chưa tìm thấy bản sao lưu. Kiểm tra kết nối kho âm thanh.',
    );
  return new Error(
    'Kho sao lưu miễn phí chưa kết nối được hoặc đã hết hạn mức. Hãy thử lại sau.',
  );
}

async function requestAudioAccess(
  track: AudioTrack,
  action: 'upload' | 'download' | 'delete',
  signal: AbortSignal,
): Promise<{ url?: unknown; deleted?: unknown }> {
  assertAudioSession(track.ownerId, signal);
  const origin = audioCloudUrl();
  const apiKey = audioCloudApiKey();
  if (!origin || !apiKey)
    throw new Error(
      'Kho sao lưu miễn phí chưa được kết nối. Bản trên máy vẫn được giữ.',
    );
  if (action !== 'delete') {
    const unavailable = audioBackupUnavailable(track.sizeBytes);
    if (unavailable) throw new Error(unavailable);
  }
  if (!parseCloudTrack(track.id, track, track.ownerId))
    throw new Error('Thông tin âm thanh không hợp lệ.');
  const user = getAuth().currentUser;
  if (!user || user.uid !== track.ownerId) throw storageError(401);
  const token = await abortable(getIdToken(user), signal, 15000);
  assertAudioSession(track.ownerId, signal);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel);
  try {
    const data = await abortable(
      (async () => {
        const response = await fetch(`${origin}/functions/v1/audio-access`, {
          method: 'POST',
          redirect: 'error',
          signal: controller.signal,
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action,
            id: track.id,
            fileName: track.fileName,
            ...(action === 'delete'
              ? {}
              : { mimeType: track.mimeType, sizeBytes: track.sizeBytes }),
          }),
        });
        if (!response.ok) throw storageError(response.status);
        return response.json() as Promise<{
          url?: unknown;
          deleted?: unknown;
        }>;
      })(),
      signal,
      15000,
    );
    assertAudioSession(track.ownerId, signal);
    return data;
  } finally {
    signal.removeEventListener('abort', cancel);
    controller.abort();
  }
}

export async function requestAudioUrl(
  track: AudioTrack,
  action: 'upload' | 'download',
  signal: AbortSignal,
): Promise<string> {
  const data = await requestAudioAccess(track, action, signal);
  const origin = audioCloudUrl()!;
  const endpoint = action === 'upload' ? 'object/upload/sign' : 'object/sign';
  const expectedPath = `/storage/v1/${endpoint}/lifemate-audio/${trackStoragePath(track)}`;
  let url: URL;
  try {
    url = new URL(String(data.url));
  } catch {
    throw new Error('Địa chỉ sao lưu không hợp lệ.');
  }
  if (
    url.origin !== origin ||
    url.pathname !== expectedPath ||
    !url.searchParams.get('token') ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error('Địa chỉ sao lưu không hợp lệ.');
  return url.toString();
}

export async function deleteFreeAudio(track: AudioTrack, signal: AbortSignal) {
  const result = await requestAudioAccess(track, 'delete', signal);
  if (result.deleted !== true)
    throw new Error('Kho sao lưu chưa xác nhận đã xóa file.');
}

async function transfer(
  task: { cancelAsync: () => Promise<void> },
  start: () => Promise<{ status: number } | undefined | null>,
  signal: AbortSignal,
) {
  const cancel = () => {
    void task.cancelAsync().catch(() => undefined);
  };
  signal.addEventListener('abort', cancel);
  try {
    if (signal.aborted) {
      cancel();
      await abortable(Promise.resolve(), signal);
    }
    const result = await abortable(start(), signal, 10 * 60 * 1000);
    if (!result || result.status < 200 || result.status >= 300)
      throw storageError(result?.status ?? 503);
  } catch (error) {
    await task.cancelAsync().catch(() => undefined);
    throw error;
  } finally {
    signal.removeEventListener('abort', cancel);
  }
}

export async function uploadFreeAudio(
  track: AudioTrack,
  uri: string,
  signal: AbortSignal,
  progress: (value: number) => void,
) {
  const url = await requestAudioUrl(track, 'upload', signal);
  assertAudioSession(track.ownerId, signal);
  const task = FileSystem.createUploadTask(
    url,
    uri,
    {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
      headers: {
        'Content-Type': track.mimeType,
        'x-upsert': 'true',
        'Cache-Control': 'max-age=0',
      },
    },
    ({ totalBytesSent, totalBytesExpectedToSend }) => {
      if (!signal.aborted && totalBytesExpectedToSend > 0)
        progress(totalBytesSent / totalBytesExpectedToSend);
    },
  );
  await transfer(task, () => task.uploadAsync(), signal);
  assertAudioSession(track.ownerId, signal);
}

export async function downloadFreeAudio(
  track: AudioTrack,
  target: string,
  signal: AbortSignal,
  progress: (value: number) => void,
) {
  const url = await requestAudioUrl(track, 'download', signal);
  assertAudioSession(track.ownerId, signal);
  const task = FileSystem.createDownloadResumable(
    url,
    target,
    {
      sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
    },
    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      if (!signal.aborted && totalBytesExpectedToWrite > 0)
        progress(totalBytesWritten / totalBytesExpectedToWrite);
    },
  );
  await transfer(task, () => task.downloadAsync(), signal);
  assertAudioSession(track.ownerId, signal);
}
