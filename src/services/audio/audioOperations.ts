import type { DocumentPickerAsset } from 'expo-document-picker';
import { audioBackupUnavailable } from '../../config/audioCloud';
import * as FileSystem from 'expo-file-system/legacy';
import { randomUUID } from 'expo-crypto';
import engine from '../../../modules/lifemate-audio';
import type {
  AudioJob,
  AudioSource,
  AudioTrack,
  EditSegment,
} from '../../types/audio';
import {
  audioError,
  audioFileType,
  defaultAudioTitle,
  normalizeAudioTitle,
  MAX_AUDIO_MS,
  MAX_INPUT_BYTES,
  validateSegments,
} from '../../utils/audio';
import {
  audioLocalUri,
  removeTemporaryAudio,
  saveAudioFile,
} from './audioFiles';
import { assertAudioSession } from './audioSession';
import {
  downloadAudioTrack,
  uploadAudioTrack,
} from '../firebase/audioLibraryService';

type Report = (job: AudioJob) => void;
type Saved = (track: AudioTrack) => void;
export type AudioImportAsset = Pick<DocumentPickerAsset, 'uri' | 'name'>;

async function saveResult(
  uid: string,
  uri: string,
  title: string,
  extension: string,
  mimeType: string,
  source: AudioSource,
  signal: AbortSignal,
  report: Report,
  onSaved: Saved,
) {
  assertAudioSession(uid, signal);
  const info = await engine.inspect(uri);
  if (
    !info.hasAudio ||
    info.hasVideo ||
    info.durationMs < 100 ||
    info.durationMs > MAX_AUDIO_MS
  )
    throw new Error(
      'Kết quả phải là file chỉ có âm thanh, thời lượng tối đa 60 phút.',
    );
  assertAudioSession(uid, signal);
  report({ label: 'Đang lưu audio trên máy…', progress: null });
  const id = randomUUID();
  const track = await saveAudioFile(
    {
      id,
      ownerId: uid,
      title: title.trim().slice(0, 120),
      fileName: `${id}.${extension}`,
      mimeType,
      durationMs: info.durationMs,
      sizeBytes: 0,
      source,
      createdAt: Date.now(),
      synced: false,
      local: true,
    },
    uri,
  );
  onSaved(track);
  assertAudioSession(uid, signal);
  const unavailable = audioBackupUnavailable(track.sizeBytes);
  if (unavailable)
    return { track, warning: `Đã lưu audio trên máy. ${unavailable}` };
  report({ label: 'Đã lưu trên máy · Đang đồng bộ…', progress: 0 });
  try {
    const synced = await uploadAudioTrack(track, signal, (progress) =>
      report({ label: 'Đang đồng bộ audio…', progress }),
    );
    onSaved(synced);
    return { track: synced, warning: null };
  } catch (error) {
    assertAudioSession(uid, signal);
    return { track, warning: `Đã lưu audio trên máy. ${audioError(error)}` };
  }
}

export async function importAudio(
  uid: string,
  asset: AudioImportAsset,
  signal: AbortSignal,
  report: Report,
  onSaved: Saved,
  chosenTitle = defaultAudioTitle(asset.name),
) {
  let output: string | undefined;
  const cancel = () => {
    void engine.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', cancel);
  try {
    assertAudioSession(uid, signal);
    const title = normalizeAudioTitle(chosenTitle);
    report({ label: 'Đang kiểm tra file…', progress: null });
    const size = await FileSystem.getInfoAsync(asset.uri);
    if (
      !size.exists ||
      size.isDirectory ||
      size.size <= 0 ||
      size.size > MAX_INPUT_BYTES
    )
      throw new Error('Chọn file tối đa 500 MB và không rỗng.');
    const info = await engine.inspect(asset.uri);
    assertAudioSession(uid, signal);
    if (!info.hasAudio) throw new Error('File này không có âm thanh để lưu.');
    if (
      !Number.isFinite(info.durationMs) ||
      info.durationMs < 100 ||
      info.durationMs > MAX_AUDIO_MS
    )
      throw new Error('Chọn file có thời lượng từ 0,1 giây đến 60 phút.');
    if (info.hasVideo) {
      report({ label: 'Đang tách âm thanh từ video…', progress: null });
      output = await engine.exportAudio([
        { uri: asset.uri, startMs: 0, endMs: info.durationMs },
      ]);
      return await saveResult(
        uid,
        output,
        title,
        'm4a',
        'audio/mp4',
        'video',
        signal,
        report,
        onSaved,
      );
    }
    const format = audioFileType(asset.name);
    if (!format)
      throw new Error(
        'Định dạng audio chưa hỗ trợ. Hãy chọn MP3, M4A, AAC, WAV, FLAC, OGG, AIFF hoặc CAF.',
      );
    return await saveResult(
      uid,
      asset.uri,
      title,
      format.extension,
      format.mimeType,
      'audio',
      signal,
      report,
      onSaved,
    );
  } finally {
    signal.removeEventListener('abort', cancel);
    await removeTemporaryAudio(output);
    await removeTemporaryAudio(asset.uri);
  }
}

// Aborting the signal also cancels a running native export.
async function withEngineCancel<T>(
  signal: AbortSignal,
  work: () => Promise<T>,
) {
  const cancel = () => {
    void engine.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', cancel);
  try {
    return await work();
  } finally {
    signal.removeEventListener('abort', cancel);
  }
}

// Downloads (if needed) and checks every segment, then exports them in order
// into one temporary M4A. The caller owns the returned file.
async function exportSegments(
  uid: string,
  segments: EditSegment[],
  signal: AbortSignal,
  report: Report,
  onSaved: Saved,
  labels: { prepare: (index: number) => string; export: string },
) {
  const clips = [];
  for (const [index, segment] of segments.entries()) {
    assertAudioSession(uid, signal);
    if (segment.track.ownerId !== uid)
      throw new Error('Chỉ được ghép file trong thư viện của bạn.');
    report({ label: labels.prepare(index), progress: null });
    const local = await downloadAudioTrack(segment.track, signal, (progress) =>
      report({ label: `Đang tải đoạn ${index + 1}…`, progress }),
    );
    assertAudioSession(uid, signal);
    onSaved(local);
    const uri = audioLocalUri(local);
    const actual = await engine.inspect(uri);
    if (!actual.hasAudio)
      throw new Error('Một file được chọn không có âm thanh.');
    validateSegments([
      {
        startMs: segment.startMs,
        endMs: segment.endMs,
        durationMs: actual.durationMs + 1,
      },
    ]);
    clips.push({ uri, startMs: segment.startMs, endMs: segment.endMs });
  }
  assertAudioSession(uid, signal);
  report({ label: labels.export, progress: null });
  return engine.exportAudio(clips);
}

const validateTrackSegments = (segments: EditSegment[]) =>
  validateSegments(
    segments.map((segment) => ({
      ...segment,
      durationMs: segment.track.durationMs,
    })),
  );

export async function editAudio(
  uid: string,
  segments: EditSegment[],
  title: string,
  signal: AbortSignal,
  report: Report,
  onSaved: Saved,
) {
  validateTrackSegments(segments);
  normalizeAudioTitle(title);
  let output: string | undefined;
  try {
    return await withEngineCancel(signal, async () => {
      output = await exportSegments(uid, segments, signal, report, onSaved, {
        prepare: (index) =>
          `Đang chuẩn bị đoạn ${index + 1}/${segments.length}…`,
        export:
          segments.length === 1
            ? 'Đang cắt âm thanh…'
            : 'Đang ghép âm thanh theo thứ tự…',
      });
      return await saveResult(
        uid,
        output,
        title,
        'm4a',
        'audio/mp4',
        segments.length === 1 ? 'trim' : 'merge',
        signal,
        report,
        onSaved,
      );
    });
  } finally {
    await removeTemporaryAudio(output);
  }
}

// Builds a temporary merged file for listening before saving. The caller must
// remove the returned uri when playback ends.
export async function previewAudio(
  segments: EditSegment[],
  signal: AbortSignal,
  report: Report,
  onSaved: Saved,
) {
  if (segments.length < 2)
    throw new Error('Chọn ít nhất hai đoạn để nghe thử bản ghép.');
  validateTrackSegments(segments);
  const uid = segments[0].track.ownerId;
  let output: string | undefined;
  try {
    return await withEngineCancel(signal, async () => {
      output = await exportSegments(uid, segments, signal, report, onSaved, {
        prepare: (index) =>
          `Đang chuẩn bị đoạn ${index + 1}/${segments.length} để nghe thử…`,
        export: 'Đang ghép các đoạn để nghe thử…',
      });
      assertAudioSession(uid, signal);
      const info = await engine.inspect(output);
      if (
        !info.hasAudio ||
        info.hasVideo ||
        info.durationMs < 100 ||
        info.durationMs > MAX_AUDIO_MS
      )
        throw new Error('Không tạo được bản nghe thử hợp lệ.');
      assertAudioSession(uid, signal);
      return { uri: output, durationMs: info.durationMs };
    });
  } catch (error) {
    await removeTemporaryAudio(output);
    throw error;
  }
}
