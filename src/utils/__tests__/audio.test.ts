import {
  formatAudioTime,
  parseAudioTime,
  validateSegments,
  parseCloudTrack,
  audioFileType,
} from '../audio';

const track = {
  id: 't1',
  ownerId: 'u1',
  title: 'Một ngày',
  fileName: 't1.mp3',
  mimeType: 'audio/mpeg',
  durationMs: 10000,
  sizeBytes: 2048,
  createdAt: 100,
  source: 'audio',
};

it('supports time input in seconds or mm:ss without accepting ambiguous values', () => {
  expect(parseAudioTime('1:02.5')).toBe(62500);
  expect(parseAudioTime('12,5')).toBe(12500);
  expect(parseAudioTime('1:99')).toBeNull();
  expect(parseAudioTime('-1')).toBeNull();
  expect(parseAudioTime('')).toBeNull();
  expect(formatAudioTime(62500)).toBe('1:02.5');
});
it('rejects reversed, out-of-range, tiny or oversized edits', () => {
  expect(() =>
    validateSegments([{ startMs: 2000, endMs: 1000, durationMs: 5000 }]),
  ).toThrow();
  expect(() =>
    validateSegments([{ startMs: 0, endMs: 6000, durationMs: 5000 }]),
  ).toThrow();
  expect(() =>
    validateSegments([{ startMs: 0, endMs: NaN, durationMs: 5000 }]),
  ).toThrow();
  expect(() =>
    validateSegments([{ startMs: 0, endMs: 50, durationMs: 5000 }]),
  ).toThrow();
  expect(() =>
    validateSegments(
      Array(11).fill({ startMs: 0, endMs: 1000, durationMs: 5000 }),
    ),
  ).toThrow();
  expect(
    validateSegments([
      { startMs: 1000, endMs: 3000, durationMs: 5000 },
      { startMs: 0, endMs: 2000, durationMs: 2000 },
    ]),
  ).toBe(4000);
});
it('validates owner, path and finite metadata before accepting cloud records', () => {
  expect(parseCloudTrack('t1', track, 'u1')).toEqual(track);
  expect(parseCloudTrack('t1', { ...track, ownerId: 'u2' }, 'u1')).toBeNull();
  expect(
    parseCloudTrack('t1', { ...track, fileName: '../secret.mp3' }, 'u1'),
  ).toBeNull();
  expect(
    parseCloudTrack('t1', { ...track, mimeType: 'video/mp4' }, 'u1'),
  ).toBeNull();
  expect(
    parseCloudTrack('t1', { ...track, durationMs: Infinity }, 'u1'),
  ).toBeNull();
});
it('keeps existing audio formats and rejects unsupported files', () => {
  expect(audioFileType('My.SONG.MP3')).toEqual({
    extension: 'mp3',
    mimeType: 'audio/mpeg',
  });
  expect(audioFileType('song.wav')?.mimeType).toBe('audio/wav');
  expect(audioFileType('clip.mp4')).toBeNull();
});
