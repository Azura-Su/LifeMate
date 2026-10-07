import type { DocumentPickerAsset } from 'expo-document-picker';
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
  asset: DocumentPickerAsset,
  signal: AbortSignal,
  report: Report,
  onSaved: Saved,
) {
  let output: string | undefined;
  const cancel = () => {
    void engine.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', cancel);
  try {
    assertAudioSession(uid, signal);
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
    const title =
      asset.name
        .replace(/\.[^.]+$/, '')
        .trim()
        .slice(0, 120) || 'Âm thanh mới';
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

export async function editAudio(
  uid: string,
  segments: EditSegment[],
  title: string,
  signal: AbortSignal,
  report: Report,
  onSaved: Saved,
) {
  validateSegments(
    segments.map((s) => ({ ...s, durationMs: s.track.durationMs })),
  );
  if (!title.trim() || title.trim().length > 120)
    throw new Error('Tên bản audio phải có từ 1 đến 120 ký tự.');
  let output: string | undefined;
  const cancel = () => {
    void engine.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', cancel);
  try {
    const clips = [];
    for (const [index, segment] of segments.entries()) {
      assertAudioSession(uid, signal);
      if (segment.track.ownerId !== uid)
        throw new Error('Chỉ được ghép file trong thư viện của bạn.');
      report({
        label: `Đang chuẩn bị đoạn ${index + 1}/${segments.length}…`,
        progress: null,
      });
      const local = await downloadAudioTrack(
        segment.track,
        signal,
        (progress) =>
          report({ label: `Đang tải đoạn ${index + 1}…`, progress }),
      );
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
    report({
      label:
        segments.length === 1
          ? 'Đang cắt âm thanh…'
          : 'Đang ghép âm thanh theo thứ tự…',
      progress: null,
    });
    output = await engine.exportAudio(clips);
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
  } finally {
    signal.removeEventListener('abort', cancel);
    await removeTemporaryAudio(output);
  }
}
