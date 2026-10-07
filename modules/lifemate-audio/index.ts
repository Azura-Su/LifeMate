import { requireNativeModule } from 'expo-modules-core';
import type { AudioSegment, MediaInfo } from '../../src/types/audio';

export default requireNativeModule<{
  inspect(uri: string): Promise<MediaInfo>;
  exportAudio(segments: AudioSegment[]): Promise<string>;
  cancel(): Promise<void>;
}>('LifeMateAudio');
