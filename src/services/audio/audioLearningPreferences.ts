import AsyncStorage from '@react-native-async-storage/async-storage';

export type AudioBookmark = {
  id: string;
  trackId: string;
  positionSeconds: number;
  label: string;
};

export type AudioLearningPreferences = {
  playbackRate: number;
  resumePositions: Record<string, number>;
  bookmarks: AudioBookmark[];
};

const allowedRates = [0.75, 1, 1.25, 1.5, 2];
const keyFor = (uid: string) =>
  `lifemate:audio-learning:v1:${encodeURIComponent(uid)}`;
const empty = (): AudioLearningPreferences => ({
  playbackRate: 1,
  resumePositions: {},
  bookmarks: [],
});

export async function readAudioLearningPreferences(uid: string) {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(keyFor(uid));
  } catch {
    return empty();
  }
  if (!raw) return empty();
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return empty();
    const parsed = value as Partial<AudioLearningPreferences>;
    const resumePositions =
      parsed.resumePositions && typeof parsed.resumePositions === 'object'
        ? Object.fromEntries(
            Object.entries(parsed.resumePositions).filter(
              ([id, seconds]) =>
                /^[A-Za-z0-9_-]{1,128}$/.test(id) &&
                typeof seconds === 'number' &&
                Number.isFinite(seconds) &&
                seconds >= 0,
            ),
          )
        : {};
    const bookmarks = Array.isArray(parsed.bookmarks)
      ? parsed.bookmarks.filter(
          (item): item is AudioBookmark =>
            !!item &&
            typeof item.id === 'string' &&
            typeof item.trackId === 'string' &&
            typeof item.positionSeconds === 'number' &&
            Number.isFinite(item.positionSeconds) &&
            item.positionSeconds >= 0 &&
            typeof item.label === 'string',
        )
      : [];
    return {
      playbackRate: allowedRates.includes(parsed.playbackRate ?? 1)
        ? (parsed.playbackRate ?? 1)
        : 1,
      resumePositions,
      bookmarks,
    };
  } catch {
    return empty();
  }
}

export function writeAudioLearningPreferences(
  uid: string,
  preferences: AudioLearningPreferences,
) {
  return AsyncStorage.setItem(keyFor(uid), JSON.stringify(preferences));
}
