import type { AudioMetadata } from '../types/audio';

export const MAX_INPUT_BYTES = 500 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 200 * 1024 * 1024;
export const MAX_AUDIO_MS = 60 * 60 * 1000;
export const MAX_SEGMENTS = 10;
const formats: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  aif: 'audio/aiff',
  aiff: 'audio/aiff',
  caf: 'audio/x-caf',
};

export function audioFileType(name: string) {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = formats[extension];
  return mimeType ? { extension, mimeType } : null;
}

export function defaultAudioTitle(fileName: string) {
  return (
    fileName
      .replace(/\.[^.]+$/, '')
      .trim()
      .slice(0, 120) || 'Âm thanh mới'
  );
}

export function normalizeAudioTitle(value: string) {
  const title = value.trim();
  if (!title || title.length > 120)
    throw new Error('Tên bản audio phải có từ 1 đến 120 ký tự.');
  return title;
}

export function parseAudioTime(value: string): number | null {
  const text = value.trim().replace(',', '.');
  if (!/^(?:\d+:)?\d+(?:\.\d{1,3})?$/.test(text)) return null;
  const parts = text.split(':').map(Number);
  if (parts.length === 2 && parts[1] >= 60) return null;
  const seconds = parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) : null;
}

export function formatAudioTime(ms: number) {
  const totalSeconds = Number.isFinite(ms)
    ? Math.max(0, Math.floor(ms / 1000))
    : 0;
  const seconds = totalSeconds % 60;
  return `${Math.floor(totalSeconds / 60)}:${String(seconds).padStart(2, '0')}`;
}

export function validateSegments(
  segments: { startMs: number; endMs: number; durationMs: number }[],
) {
  if (!segments.length || segments.length > MAX_SEGMENTS)
    throw new Error('Chọn từ 1 đến 10 đoạn âm thanh.');
  let total = 0;
  for (const s of segments) {
    if (
      ![s.startMs, s.endMs, s.durationMs].every(Number.isFinite) ||
      s.startMs < 0 ||
      s.endMs > s.durationMs ||
      s.endMs - s.startMs < 100
    )
      throw new Error(
        'Đoạn cắt phải dài ít nhất 0,1 giây và nằm trong thời lượng file.',
      );
    total += s.endMs - s.startMs;
  }
  if (total > MAX_AUDIO_MS) throw new Error('Bản âm thanh tối đa 60 phút.');
  return total;
}

export function trackStoragePath(track: AudioMetadata) {
  return `audio/${track.ownerId}/${track.id}/${track.fileName}`;
}

export function parseCloudTrack(
  id: string,
  value: unknown,
  uid: string,
): AudioMetadata | null {
  if (!value || typeof value !== 'object') return null;
  const t = value as AudioMetadata;
  if (
    typeof id !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(id) ||
    t.id !== id ||
    t.ownerId !== uid ||
    typeof t.title !== 'string' ||
    !t.title.trim() ||
    t.title.length > 120 ||
    typeof t.fileName !== 'string' ||
    !t.fileName.startsWith(`${id}.`) ||
    !/^[\w-]+\.[a-z0-9]+$/.test(t.fileName) ||
    audioFileType(t.fileName)?.mimeType !== t.mimeType ||
    !Number.isFinite(t.durationMs) ||
    t.durationMs < 100 ||
    t.durationMs > MAX_AUDIO_MS ||
    !Number.isFinite(t.sizeBytes) ||
    t.sizeBytes <= 0 ||
    t.sizeBytes > MAX_AUDIO_BYTES ||
    (t.storageProvider !== undefined && t.storageProvider !== 'supabase') ||
    !Number.isFinite(t.createdAt) ||
    t.createdAt < 0 ||
    !['audio', 'video', 'trim', 'merge'].includes(t.source)
  )
    return null;
  return {
    id,
    ownerId: uid,
    title: t.title,
    fileName: t.fileName,
    mimeType: t.mimeType,
    durationMs: t.durationMs,
    sizeBytes: t.sizeBytes,
    createdAt: t.createdAt,
    source: t.source,
    ...(t.storageProvider === 'supabase'
      ? { storageProvider: 'supabase' }
      : {}),
  };
}

export function audioError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  const detail = error instanceof Error ? error.message : '';
  if (/cancell?ed/i.test(code)) return 'Đã hủy thao tác.';
  if (/Cloud Firestore API has not been used|SERVICE_DISABLED/i.test(detail))
    return 'Cloud Firestore chưa được bật cho dự án Firebase. Cần bật dịch vụ để dùng thư viện trên đám mây.';
  if (/unauth|permission|unauthorized/i.test(code))
    return 'Chưa có quyền truy cập Firebase. Kiểm tra đăng nhập và quy tắc thư viện.';
  if (/bucket|quota|billing|project-not-found/i.test(code))
    return 'Kho lưu trữ cũ chưa truy cập được. Các bản audio trên máy vẫn được giữ nguyên.';
  if (/network|unavailable|retry-limit|timeout/i.test(code))
    return 'Chưa kết nối được thư viện trên đám mây. Bạn vẫn có thể nghe, cắt và ghép audio đã lưu trên máy.';
  return error instanceof Error
    ? error.message
    : 'Không thể xử lý âm thanh. Vui lòng thử lại.';
}
