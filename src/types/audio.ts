export type AudioSource = 'audio' | 'video' | 'trim' | 'merge';
export type AudioMetadata = {
  id: string;
  ownerId: string;
  title: string;
  fileName: string;
  mimeType: string;
  durationMs: number;
  sizeBytes: number;
  createdAt: number;
  source: AudioSource;
};
export type AudioTrack = AudioMetadata & {
  synced: boolean;
  local: boolean;
  // A pending title must survive refreshes until Firestore acknowledges it.
  pendingTitle?: boolean;
};
export type MediaInfo = {
  durationMs: number;
  hasAudio: boolean;
  hasVideo: boolean;
};
export type AudioSegment = { uri: string; startMs: number; endMs: number };
export type EditSegment = { track: AudioTrack; startMs: number; endMs: number };
export type AudioJob = { label: string; progress: number | null };
