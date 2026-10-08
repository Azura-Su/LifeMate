import {
  collection,
  deleteDoc,
  doc,
  getDocsFromServer,
  getFirestore,
  setDoc,
} from '@react-native-firebase/firestore';
import {
  deleteObject,
  getStorage,
  ref,
  writeToFile,
  type Task,
} from '@react-native-firebase/storage';
import * as FileSystem from 'expo-file-system/legacy';
import type { AudioTrack } from '../../types/audio';
import { parseCloudTrack, trackStoragePath } from '../../utils/audio';
import { abortable, assertAudioSession } from '../audio/audioSession';
import {
  deleteFreeAudio,
  downloadFreeAudio,
  uploadFreeAudio,
} from '../audio/freeAudioStorage';
import {
  audioExists,
  audioLocalUri,
  ensureAudioDirectory,
  updateAudioIndex,
} from '../audio/audioFiles';

export async function fetchCloudTracks(
  uid: string,
  signal: AbortSignal,
): Promise<AudioTrack[]> {
  assertAudioSession(uid, signal);
  const snapshot = await abortable(
    getDocsFromServer(
      collection(getFirestore(), 'audioLibraries', uid, 'tracks'),
    ),
    signal,
    15000,
  );
  assertAudioSession(uid, signal);
  return snapshot.docs.flatMap((document) => {
    const value = parseCloudTrack(document.id, document.data(), uid);
    return value ? [{ ...value, local: false, synced: true }] : [];
  });
}

async function waitForTransfer(
  task: Task,
  signal: AbortSignal,
  onProgress: (progress: number) => void,
) {
  const cancel = () => {
    task.cancel();
  };
  const unsubscribe = task.on('state_changed', (snapshot) => {
    if (!signal.aborted && snapshot.totalBytes > 0)
      onProgress(snapshot.bytesTransferred / snapshot.totalBytes);
  }) as () => void;
  signal.addEventListener('abort', cancel);
  try {
    await abortable(
      new Promise<void>((resolve, reject) => {
        task.then(() => resolve(), reject);
      }),
      signal,
      10 * 60 * 1000,
    );
  } catch (error) {
    cancel();
    throw error;
  } finally {
    signal.removeEventListener('abort', cancel);
    unsubscribe();
  }
}

export async function uploadAudioTrack(
  track: AudioTrack,
  signal: AbortSignal,
  onProgress: (progress: number) => void,
): Promise<AudioTrack> {
  assertAudioSession(track.ownerId, signal);
  const candidate: AudioTrack = track.synced
    ? track
    : { ...track, storageProvider: 'supabase' };
  const metadata = parseCloudTrack(track.id, candidate, track.ownerId);
  if (!metadata) throw new Error('Thông tin âm thanh không hợp lệ.');
  // Renaming an existing backup updates metadata without transferring the audio again.
  if (!track.synced) {
    if (!(await audioExists(track)))
      throw new Error('Không tìm thấy bản âm thanh trên máy để đồng bộ.');
    assertAudioSession(track.ownerId, signal);
    await uploadFreeAudio(candidate, audioLocalUri(track), signal, onProgress);
  }
  assertAudioSession(track.ownerId, signal);
  await abortable(
    setDoc(
      doc(getFirestore(), 'audioLibraries', track.ownerId, 'tracks', track.id),
      metadata,
    ),
    signal,
    15000,
  );
  assertAudioSession(track.ownerId, signal);
  const saved = { ...candidate, synced: true, pendingTitle: false };
  await updateAudioIndex(saved);
  return saved;
}

export async function deleteAudioTrackRemote(
  track: AudioTrack,
  signal: AbortSignal,
) {
  assertAudioSession(track.ownerId, signal);
  if (track.storageProvider === 'supabase') {
    await deleteFreeAudio(track, signal);
  } else {
    try {
      await abortable(
        deleteObject(ref(getStorage(), trackStoragePath(track))),
        signal,
        15000,
      );
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? error.code
          : null;
      if (code !== 'storage/object-not-found') throw error;
    }
  }
  assertAudioSession(track.ownerId, signal);
  await abortable(
    deleteDoc(
      doc(getFirestore(), 'audioLibraries', track.ownerId, 'tracks', track.id),
    ),
    signal,
    15000,
  );
  assertAudioSession(track.ownerId, signal);
}

export async function downloadAudioTrack(
  track: AudioTrack,
  signal: AbortSignal,
  onProgress: (progress: number) => void,
): Promise<AudioTrack> {
  assertAudioSession(track.ownerId, signal);
  if (await audioExists(track)) return { ...track, local: true };
  if (!track.synced)
    throw new Error(
      'Bản audio trên máy không còn tồn tại và chưa được đồng bộ.',
    );
  await ensureAudioDirectory(track.ownerId);
  const target = audioLocalUri(track);
  const partial = `${target}.partial`;
  try {
    assertAudioSession(track.ownerId, signal);
    if (track.storageProvider === 'supabase') {
      await downloadFreeAudio(track, partial, signal, onProgress);
    } else {
      // Read-only compatibility for backups created before the free-storage switch.
      await waitForTransfer(
        writeToFile(ref(getStorage(), trackStoragePath(track)), partial),
        signal,
        onProgress,
      );
    }
    assertAudioSession(track.ownerId, signal);
    const info = await FileSystem.getInfoAsync(partial);
    if (!info.exists || info.isDirectory || info.size !== track.sizeBytes)
      throw new Error('File tải về chưa đầy đủ. Hãy thử lại.');
    await FileSystem.moveAsync({ from: partial, to: target });
    const saved = { ...track, local: true };
    await updateAudioIndex(saved);
    return saved;
  } finally {
    await FileSystem.deleteAsync(partial, { idempotent: true }).catch(
      () => undefined,
    );
  }
}
