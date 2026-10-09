import { useEffect, useRef, useState } from 'react';
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import type { Playback } from './useMp3Screen';

export function useAudioPlayback(source: Playback) {
  const player = useAudioPlayer({ uri: source.uri }, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const start = source.startMs / 1000;
  const end = source.endMs / 1000;

  useEffect(() => {
    if (!status.isLoaded || started.current) return;
    started.current = true;
    let active = true;
    const begin = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
          shouldPlayInBackground: false,
          interruptionMode: 'doNotMix',
        });
        await player.seekTo(start);
        if (active) player.play();
      } catch {
        if (active) setError('Không thể phát audio này trên thiết bị.');
      }
    };
    void begin();
    return () => {
      active = false;
    };
  }, [player, start, status.isLoaded]);

  useEffect(() => {
    if (status.playing && status.currentTime >= end) player.pause();
  }, [end, player, status.currentTime, status.playing]);

  useEffect(() => {
    if (status.isLoaded) return;
    const timer = setTimeout(
      () =>
        setError(
          'Chưa mở được audio. File hoặc codec có thể không được hỗ trợ.',
        ),
      12000,
    );
    return () => clearTimeout(timer);
  }, [status.isLoaded]);

  async function toggle() {
    try {
      if (status.playing) {
        player.pause();
        return;
      }
      if (
        status.didJustFinish ||
        status.currentTime >= Math.min(end, status.duration || end) - 0.05 ||
        status.currentTime < start
      )
        await player.seekTo(start);
      player.play();
    } catch {
      setError('Không thể phát audio này.');
    }
  }
  async function seek(seconds: number) {
    try {
      await player.seekTo(Math.min(end, Math.max(start, seconds)));
    } catch {
      setError('Chưa tua được âm thanh.');
    }
  }
  return { status, error, toggle, seek, start, end };
}
