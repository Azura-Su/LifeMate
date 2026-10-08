import { useCallback, useEffect, useRef, useState } from 'react';
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import type { AudioTrack } from '../../types/audio';
import { useQueuePlaybackStore } from '../../store/queuePlaybackStore';

// doNotMix is required for lock screen controls to attach to this player.
const BACKGROUND_AUDIO_MODE = {
  playsInSilentMode: true,
  allowsRecording: false,
  shouldPlayInBackground: true,
  interruptionMode: 'doNotMix',
} as const;

type Options = {
  items: AudioTrack[];
  repeatId: string | null;
  repeatAll: boolean;
  // Resolves a playable local URI (downloads a cloud-only backup if needed).
  prepare: (track: AudioTrack) => Promise<string | null>;
};

// Background playback rules this hook relies on:
// - One long-lived native player; tracks are swapped with replace() so the
//   iOS audio session and the Android media foreground service stay alive
//   between tracks while the app is in the background or the screen is off.
// - UIBackgroundModes=audio (iOS) and AudioControlsService (Android) come from
//   the expo-audio config plugin (enableBackgroundPlayback).
// - Android stops background audio after ~3 min unless the player is active
//   for lock screen controls, so the queue always registers itself there.
// - Auto-advance listens to the native status event directly instead of React
//   state, so it still fires while the UI is not rendering in background.
export function useQueuePlayer({
  items,
  repeatId,
  repeatAll,
  prepare,
}: Options) {
  const player = useAudioPlayer(null, {
    updateInterval: 250,
    keepAudioSessionActive: true,
  });
  const status = useAudioPlayerStatus(player);
  const statusRef = useRef(status);
  statusRef.current = status;
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSwitchingTrack, setIsSwitchingTrack] = useState(false);
  const currentRef = useRef<string | null>(null);
  const itemsRef = useRef(items);
  const repeatRef = useRef(repeatId);
  const repeatAllRef = useRef(repeatAll);
  const prepareRef = useRef(prepare);
  const lockScreen = useRef(false);
  const pendingReady = useRef<{ remove: () => void } | null>(null);
  const token = useRef(0);
  itemsRef.current = items;
  repeatRef.current = repeatId;
  repeatAllRef.current = repeatAll;
  prepareRef.current = prepare;

  const clearPending = useCallback(() => {
    pendingReady.current?.remove();
    pendingReady.current = null;
  }, []);
  const fail = useCallback(() => {
    clearPending();
    setIsSwitchingTrack(false);
    setError('Không phát được bài này.');
  }, [clearPending]);

  useEffect(() => {
    useQueuePlaybackStore
      .getState()
      .setPlaying(status.playing || isSwitchingTrack);
  }, [isSwitchingTrack, status.playing]);

  const start = useCallback(
    async (track: AudioTrack) => {
      const mine = ++token.current;
      clearPending();
      setError(null);
      let readySubscription: { remove: () => void } | null = null;
      try {
        await setAudioModeAsync(BACKGROUND_AUDIO_MODE);
        const uri = await prepareRef.current(track);
        if (mine !== token.current) return;
        if (!uri) {
          setIsSwitchingTrack(false);
          return;
        }
        setIsSwitchingTrack(true);
        currentRef.current = track.id;
        setCurrentId(track.id);
        useQueuePlaybackStore.getState().setCurrentId(track.id);
        player.loop = repeatRef.current === track.id;
        const metadata = { title: track.title, artist: 'LifeMate' };
        if (!lockScreen.current) {
          player.setActiveForLockScreen(true, metadata, {
            showSeekForward: true,
            showSeekBackward: true,
          });
          lockScreen.current = true;
        } else {
          player.updateLockScreenMetadata(metadata);
        }

        let replaced = false;
        let sawLoading = false;
        let playRequested = false;
        readySubscription = player.addListener('playbackStatusUpdate', (s) => {
          const subscription = readySubscription;
          if (!subscription) return;
          if (!replaced) return;
          if (mine !== token.current) {
            subscription.remove();
            return;
          }
          if (!s.isLoaded) {
            sawLoading = true;
            return;
          }
          if (!playRequested) {
            if (!sawLoading) return;
            playRequested = true;
            try {
              player.play();
            } catch {
              fail();
              return;
            }
          }
          if (s.playing) {
            clearPending();
            setIsSwitchingTrack(false);
          }
        });
        pendingReady.current = readySubscription;
        player.replace({ uri });
        replaced = true;
        if (player.isLoaded) {
          playRequested = true;
          try {
            player.play();
          } catch {
            fail();
          }
        } else {
          sawLoading = true;
        }
      } catch {
        readySubscription?.remove();
        if (mine === token.current) fail();
      }
    },
    [clearPending, fail, player],
  );

  const neighbour = useCallback((offset: 1 | -1) => {
    const list = itemsRef.current;
    const index = list.findIndex((t) => t.id === currentRef.current);
    return index >= 0 ? (list[index + offset] ?? null) : null;
  }, []);
  const nextTrack = useCallback(
    () =>
      neighbour(1) ??
      (repeatAllRef.current ? (itemsRef.current[0] ?? null) : null),
    [neighbour],
  );

  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (s) => {
      if (!s.didJustFinish || player.loop || !currentRef.current) return;
      const next = nextTrack();
      if (next) void start(next);
    });
    return () => sub.remove();
  }, [nextTrack, player, start]);

  // Turning repeat on/off applies immediately to the track that is playing.
  useEffect(() => {
    player.loop = !!currentId && repeatId === currentId;
  }, [currentId, player, repeatId]);

  const stop = useCallback(() => {
    token.current++;
    clearPending();
    setIsSwitchingTrack(false);
    try {
      player.pause();
      if (lockScreen.current) player.clearLockScreenControls();
    } catch {
      // The native player may already be released on sign-out.
    }
    lockScreen.current = false;
    currentRef.current = null;
    setCurrentId(null);
    useQueuePlaybackStore.getState().setCurrentId(null);
    useQueuePlaybackStore.getState().setPlaying(false);
  }, [clearPending, player]);

  useEffect(
    () => () => {
      token.current++;
      clearPending();
      useQueuePlaybackStore.getState().setCurrentId(null);
      useQueuePlaybackStore.getState().setPlaying(false);
      try {
        if (lockScreen.current) player.clearLockScreenControls();
      } catch {
        // Released together with the screen.
      }
    },
    [clearPending, player],
  );

  const toggle = useCallback(async () => {
    const currentStatus = statusRef.current;
    if (currentStatus.playing) {
      player.pause();
      return;
    }
    try {
      await setAudioModeAsync(BACKGROUND_AUDIO_MODE);
      if (
        currentStatus.duration > 0 &&
        currentStatus.currentTime >= currentStatus.duration - 0.1
      )
        await player.seekTo(0);
      player.play();
    } catch {
      setError('Không phát được bài này.');
    }
  }, [player]);

  const startTrack = useCallback(
    (track: AudioTrack) => void start(track),
    [start],
  );
  const seek = useCallback(
    (seconds: number) => void player.seekTo(seconds).catch(() => {}),
    [player],
  );
  const next = useCallback(() => {
    const track = nextTrack();
    if (track) void start(track);
  }, [nextTrack, start]);
  const previous = useCallback(() => {
    const track = neighbour(-1);
    if (track && statusRef.current.currentTime < 3) void start(track);
    else void player.seekTo(0).catch(() => {});
  }, [neighbour, player, start]);
  const hasNext = useCallback(() => !!nextTrack(), [nextTrack]);
  const pause = useCallback(() => {
    token.current++;
    clearPending();
    setIsSwitchingTrack(false);
    player.pause();
  }, [clearPending, player]);

  return {
    currentId,
    status,
    isSwitchingTrack,
    error,
    start: startTrack,
    toggle,
    seek,
    next,
    previous,
    hasNext,
    pause,
    stop,
  };
}
