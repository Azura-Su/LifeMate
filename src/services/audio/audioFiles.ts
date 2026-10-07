import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import type { AudioTrack } from '../../types/audio';
import {
  MAX_AUDIO_BYTES,
  normalizeAudioTitle,
  parseCloudTrack,
} from '../../utils/audio';

const queues = new Map<string, Promise<unknown>>();
const indexKey = (uid: string) => `lifemate:audio:v1:${uid}`;

export function audioDirectory(uid: string) {
  return `${FileSystem.documentDirectory}audio/${encodeURIComponent(uid)}/`;
}
export function audioLocalUri(track: Pick<AudioTrack, 'ownerId' | 'fileName'>) {
  return `${audioDirectory(track.ownerId)}${track.fileName}`;
}
export async function readAudioIndex(uid: string): Promise<AudioTrack[]> {
  const saved = await AsyncStorage.getItem(indexKey(uid));
  if (!saved) return [];
  let values: unknown;
  try {
    values = JSON.parse(saved);
  } catch {
    throw new Error(
      'Chưa đọc được thư viện trên máy. Hãy thử mở lại ứng dụng.',
    );
  }
  if (!Array.isArray(values))
    throw new Error('Dữ liệu thư viện trên máy không hợp lệ.');
  return values.flatMap((value) => {
    const record = parseCloudTrack(value?.id, value, uid);
    return record
      ? [
          {
            ...record,
            local: value.local === true,
            synced: value.synced === true,
            ...(value.pendingTitle === true ? { pendingTitle: true } : {}),
          },
        ]
      : [];
  });
}

function writeAudioIndex(
  uid: string,
  update: (tracks: AudioTrack[]) => AudioTrack[],
): Promise<AudioTrack[]> {
  const previous = queues.get(uid) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      const tracks = await readAudioIndex(uid);
      const updated = update(tracks).sort((a, b) => b.createdAt - a.createdAt);
      await AsyncStorage.setItem(indexKey(uid), JSON.stringify(updated));
      return updated;
    });
  queues.set(uid, next);
  void next
    .finally(() => {
      if (queues.get(uid) === next) queues.delete(uid);
    })
    .catch(() => undefined);
  return next;
}

export function updateAudioIndex(track: AudioTrack): Promise<AudioTrack[]> {
  return writeAudioIndex(track.ownerId, (tracks) => [
    track,
    ...tracks.filter((t) => t.id !== track.id),
  ]);
}

export async function renameAudioTitle(uid: string, id: string, value: string) {
  const title = normalizeAudioTitle(value);
  const updated = await writeAudioIndex(uid, (tracks) => {
    if (!tracks.some((track) => track.id === id))
      throw new Error('Không tìm thấy âm thanh trong thư viện của bạn.');
    return tracks.map((track) =>
      track.id === id && track.title !== title
        ? { ...track, title, pendingTitle: true }
        : track,
    );
  });
  return updated.find((track) => track.id === id)!;
}

export function mergeAudioIndex(
  uid: string,
  remote: AudioTrack[],
): Promise<AudioTrack[]> {
  return writeAudioIndex(uid, (tracks) => {
    const merged = new Map(tracks.map((track) => [track.id, track]));
    for (const track of remote) {
      const existing = merged.get(track.id);
      if (track.ownerId === uid)
        merged.set(track.id, {
          ...track,
          local: existing?.local ?? false,
          ...(existing?.pendingTitle
            ? { title: existing.title, pendingTitle: true }
            : {}),
        });
    }
    return [...merged.values()];
  });
}

export async function ensureAudioDirectory(uid: string) {
  await FileSystem.makeDirectoryAsync(audioDirectory(uid), {
    intermediates: true,
  });
}

export async function audioExists(track: AudioTrack) {
  const info = await FileSystem.getInfoAsync(audioLocalUri(track));
  return (
    info.exists &&
    !info.isDirectory &&
    info.size > 0 &&
    info.size === track.sizeBytes
  );
}

export async function saveAudioFile(track: AudioTrack, sourceUri: string) {
  await ensureAudioDirectory(track.ownerId);
  const info = await FileSystem.getInfoAsync(sourceUri);
  if (
    !info.exists ||
    info.isDirectory ||
    info.size <= 0 ||
    info.size > MAX_AUDIO_BYTES
  )
    throw new Error('File âm thanh không hợp lệ hoặc lớn hơn 200 MB.');
  const saved = { ...track, sizeBytes: info.size, local: true };
  const target = audioLocalUri(saved);
  await FileSystem.copyAsync({ from: sourceUri, to: target });
  try {
    await updateAudioIndex(saved);
  } catch (error) {
    await FileSystem.deleteAsync(target, { idempotent: true });
    throw error;
  }
  return saved;
}

export async function removeTemporaryAudio(uri: string | undefined) {
  // Never delete the user's original document or a saved library file.
  if (
    uri &&
    FileSystem.cacheDirectory &&
    uri.startsWith(FileSystem.cacheDirectory)
  )
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(
      () => undefined,
    );
}
