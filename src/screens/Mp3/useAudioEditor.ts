import { useState } from 'react';
import type { EditSegment } from '../../types/audio';
import {
  audioError,
  parseAudioTime,
  validateSegments,
} from '../../utils/audio';

export function useAudioEditor(initial: EditSegment[]) {
  const [drafts, setDrafts] = useState(() =>
    initial.map((s) => ({
      track: s.track,
      start: String(Math.floor(s.startMs) / 1000),
      end: String(Math.floor(s.endMs) / 1000),
    })),
  );
  const [title, setTitle] = useState(
    initial.length === 1
      ? `${initial[0].track.title} · bản cắt`.slice(0, 120)
      : 'Bản ghép mới',
  );
  const [error, setError] = useState<string | null>(null);
  function change(id: string, field: 'start' | 'end', value: string) {
    setDrafts((current) =>
      current.map((d) => (d.track.id === id ? { ...d, [field]: value } : d)),
    );
    setError(null);
  }
  function changeRange(id: string, startMs: number, endMs: number) {
    const seconds = (value: number) =>
      String(Number((Math.floor(value) / 1000).toFixed(3)));
    setDrafts((current) =>
      current.map((draft) =>
        draft.track.id === id
          ? { ...draft, start: seconds(startMs), end: seconds(endMs) }
          : draft,
      ),
    );
    setError(null);
  }
  function move(index: number, direction: -1 | 1) {
    setDrafts((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const result = [...current];
      [result[index], result[target]] = [result[target], result[index]];
      return result;
    });
  }
  function segmentAt(index: number): EditSegment {
    const draft = drafts[index];
    const startMs = parseAudioTime(draft.start);
    const endMs = parseAudioTime(draft.end);
    if (startMs === null || endMs === null)
      throw new Error(
        'Nhập thời gian dạng phút:giây hoặc số giây, ví dụ 1:20 hoặc 80.',
      );
    validateSegments([{ startMs, endMs, durationMs: draft.track.durationMs }]);
    return { track: draft.track, startMs, endMs };
  }
  function selectedSegments() {
    const segments = drafts.map((_, index) => segmentAt(index));
    validateSegments(
      segments.map((segment) => ({
        ...segment,
        durationMs: segment.track.durationMs,
      })),
    );
    return segments;
  }
  function submit(onSave: (segments: EditSegment[], name: string) => void) {
    try {
      const segments = selectedSegments();
      if (!title.trim()) throw new Error('Đặt tên cho bản âm thanh mới.');
      setError(null);
      onSave(segments, title.trim());
    } catch (e) {
      setError(audioError(e));
    }
  }
  function preview(index: number, onPreview: (segment: EditSegment) => void) {
    try {
      const segment = segmentAt(index);
      setError(null);
      onPreview(segment);
    } catch (e) {
      setError(audioError(e));
    }
  }
  function previewAll(onPreview: (segments: EditSegment[]) => void) {
    try {
      const segments = selectedSegments();
      if (segments.length < 2)
        throw new Error('Chọn ít nhất hai đoạn để nghe thử bản ghép.');
      setError(null);
      onPreview(segments);
    } catch (e) {
      setError(audioError(e));
    }
  }
  const totalMs = drafts.reduce(
    (sum, draft) =>
      sum +
      Math.max(
        0,
        (parseAudioTime(draft.end) ?? 0) - (parseAudioTime(draft.start) ?? 0),
      ),
    0,
  );
  return {
    drafts,
    title,
    setTitle,
    error,
    change,
    changeRange,
    move,
    submit,
    preview,
    previewAll,
    totalMs,
  };
}
