import type { AudioJob, AudioTrack } from '../../types/audio';
import { audioError } from '../../utils/audio';
import { uploadAudioTrack } from '../firebase/audioLibraryService';
import { renameAudioTitle } from './audioFiles';
import { assertAudioSession } from './audioSession';

export async function renameAudio(
  track: AudioTrack,
  title: string,
  signal: AbortSignal,
  report: (job: AudioJob) => void,
  onSaved: (track: AudioTrack) => void,
) {
  assertAudioSession(track.ownerId, signal);
  const saved = await renameAudioTitle(track.ownerId, track.id, title);
  assertAudioSession(track.ownerId, signal);
  onSaved(saved);
  if (!saved.synced || !saved.pendingTitle)
    return { track: saved, warning: null };
  report({ label: 'Đã đổi tên trên máy · Đang đồng bộ tên…', progress: null });
  try {
    const synced = await uploadAudioTrack(saved, signal, () => undefined);
    assertAudioSession(track.ownerId, signal);
    onSaved(synced);
    return { track: synced, warning: null };
  } catch (error) {
    assertAudioSession(track.ownerId, signal);
    return {
      track: saved,
      warning: `Đã đổi tên trên máy. Tên mới chưa được đồng bộ lên Firebase. ${audioError(error)}`,
    };
  }
}
