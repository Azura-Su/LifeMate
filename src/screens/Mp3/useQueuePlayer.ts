import { useCallback, useEffect, useRef, useState } from 'react';
import {
  setAudioModeAsync,
  useAudioPlayer,
  type AudioStatus,
} from 'expo-audio';
import type { AudioTrack } from '../../types/audio';
import { useQueuePlaybackStore } from '../../store/queuePlaybackStore';
import {
  readAudioLearningPreferences,
  writeAudioLearningPreferences,
  type AudioBookmark,
  type AudioLearningPreferences,
} from '../../services/audio/audioLearningPreferences';
import { formatAudioTime } from '../../utils/audio';

// doNotMix is required for lock screen controls to attach to this player.
const BACKGROUND_AUDIO_MODE = {
  playsInSilentMode: true,
  allowsRecording: false,
  shouldPlayInBackground: true,
  interruptionMode: 'doNotMix',
} as const;

type Options = {
  uid?: string | null;
  items: AudioTrack[];
  libraryTrackIds?: string[] | null;
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
function coarseStatus(s: Partial<AudioStatus> | undefined) {
  return {
    playing: !!s?.playing,
    isLoaded: !!s?.isLoaded,
    duration: s?.duration || 0,
    currentTime: s?.currentTime || 0,
  };
}

export function useQueuePlayer({
  uid,
  items,
  libraryTrackIds = null,
  repeatId,
  repeatAll,
  prepare,
}: Options) {
  // 500 ms is enough for auto-advance and checkpoints; each native tick also
  // refreshes the iOS lock-screen info, so faster ticks only cost battery.
  const player = useAudioPlayer(null, {
    updateInterval: 500,
    keepAudioSessionActive: true,
  });
  const statusRef = useRef<
    Pick<
      AudioStatus,
      'playing' | 'isLoaded' | 'duration' | 'currentTime' | 'didJustFinish'
    >
  >(
    player.currentStatus ?? {
      ...coarseStatus(undefined),
      didJustFinish: false,
    },
  );
  // Only play/pause/load/duration changes re-render the screen. The moving
  // position is read by QueueProgress, which subscribes on its own and only
  // while the MP3 screen is visible.
  const [status, setStatus] = useState(() => coarseStatus(statusRef.current));
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSwitchingTrack, setIsSwitchingTrack] = useState(false);
  const [learning, setLearning] = useState<AudioLearningPreferences>({
    playbackRate: 1,
    resumePositions: {},
    bookmarks: [],
  });
  const learningReadyRef = useRef(false);
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const currentRef = useRef<string | null>(null);
  const itemsRef = useRef(items);
  const repeatRef = useRef(repeatId);
  const repeatAllRef = useRef(repeatAll);
  const prepareRef = useRef(prepare);
  const lockScreen = useRef(false);
  const pendingReady = useRef<{ remove: () => void } | null>(null);
  const token = useRef(0);
  const startRequest = useRef(0);
  const uidRef = useRef(uid);
  const accountUidRef = useRef(uid);
  const playerOwnerRef = useRef(uid);
  const learningRef = useRef(learning);
  const savedPositionRef = useRef(0);
  const sleepDeadlineRef = useRef<number | null>(null);
  const sleepTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sleepExpirationGenerationRef = useRef(0);
  const sleepTimerExpiredRef = useRef(false);
  uidRef.current = uid;
  itemsRef.current = items;
  repeatRef.current = repeatId;
  repeatAllRef.current = repeatAll;
  prepareRef.current = prepare;

  const updateLearning = useCallback(
    (
      update: (current: AudioLearningPreferences) => AudioLearningPreferences,
    ) => {
      const next = update(learningRef.current);
      learningRef.current = next;
      setLearning(next);
      const owner = uidRef.current;
      if (owner)
        void writeAudioLearningPreferences(owner, next).catch(() => undefined);
    },
    [],
  );

  useEffect(() => {
    if (!libraryTrackIds) return;
    const activeIds = new Set(libraryTrackIds);
    const current = learningRef.current;
    const resumePositions = Object.fromEntries(
      Object.entries(current.resumePositions).filter(([id]) =>
        activeIds.has(id),
      ),
    );
    const bookmarks = current.bookmarks.filter((bookmark) =>
      activeIds.has(bookmark.trackId),
    );
    if (
      Object.keys(resumePositions).length ===
        Object.keys(current.resumePositions).length &&
      bookmarks.length === current.bookmarks.length
    )
      return;
    updateLearning(() => ({ ...current, resumePositions, bookmarks }));
  }, [libraryTrackIds, updateLearning]);

  // Stores (or with null, forgets) where a track should resume for one
  // account. Writes go to the owner captured by the caller, never to an
  // account that signed in afterwards.
  const writeResumePosition = useCallback(
    (owner: string, trackId: string, seconds: number | null) => {
      const resumePositions = { ...learningRef.current.resumePositions };
      if (seconds === null) {
        if (!(trackId in resumePositions)) return;
        delete resumePositions[trackId];
      } else {
        resumePositions[trackId] = seconds;
      }
      const next = { ...learningRef.current, resumePositions };
      learningRef.current = next;
      if (uidRef.current === owner) setLearning(next);
      void writeAudioLearningPreferences(owner, next).catch(() => undefined);
      savedPositionRef.current = seconds ?? 0;
    },
    [],
  );

  const saveCurrentPositionForOwner = useCallback(
    (owner: string | null | undefined) => {
      const trackId = currentRef.current;
      const seconds = statusRef.current.currentTime;
      if (!owner || !trackId || !Number.isFinite(seconds) || seconds < 0)
        return;
      // At (or within 2s of) the end counts as finished: restart next time.
      const { duration } = statusRef.current;
      const finished = duration > 0 && seconds >= duration - 2;
      writeResumePosition(owner, trackId, finished ? null : seconds);
    },
    [writeResumePosition],
  );

  // A mounted tab can survive an auth change. Save the outgoing account's
  // position before clearing the player so checkpoints cannot leak to the
  // newly signed-in account.
  useEffect(() => {
    const previousUid = accountUidRef.current;
    if (previousUid === uid) return;
    saveCurrentPositionForOwner(previousUid);
    startRequest.current++;
    token.current++;
    pendingReady.current?.remove();
    pendingReady.current = null;
    currentRef.current = null;
    playerOwnerRef.current = uid;
    accountUidRef.current = uid;
    if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current);
    sleepTimeoutRef.current = null;
    sleepDeadlineRef.current = null;
    sleepTimerExpiredRef.current = false;
    setSleepMinutes(null);
    try {
      player.pause();
      if (lockScreen.current) player.clearLockScreenControls();
    } catch {
      // The native player may already be released during sign-out.
    }
    lockScreen.current = false;
    setCurrentId(null);
    setIsSwitchingTrack(false);
    useQueuePlaybackStore.getState().setCurrentId(null);
    useQueuePlaybackStore.getState().setPlaying(false);
  }, [player, saveCurrentPositionForOwner, uid]);

  useEffect(() => {
    let active = true;
    learningRef.current = {
      playbackRate: 1,
      resumePositions: {},
      bookmarks: [],
    };
    learningReadyRef.current = false;
    setLearning(learningRef.current);
    savedPositionRef.current = 0;
    if (uid)
      void readAudioLearningPreferences(uid).then((saved) => {
        if (active && uidRef.current === uid) {
          learningRef.current = saved;
          learningReadyRef.current = true;
          setLearning(saved);
          player.setPlaybackRate(saved.playbackRate);
        }
      });
    return () => {
      active = false;
    };
  }, [player, uid]);

  const saveCurrentPosition = useCallback(() => {
    saveCurrentPositionForOwner(playerOwnerRef.current);
  }, [saveCurrentPositionForOwner]);

  const clearSleepTimer = useCallback(() => {
    if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current);
    sleepTimeoutRef.current = null;
    sleepDeadlineRef.current = null;
    setSleepMinutes(null);
  }, []);

  const setSleepTimer = useCallback(
    (minutes: number | null) => {
      clearSleepTimer();
      if (minutes === null) {
        sleepTimerExpiredRef.current = false;
        return;
      }
      sleepTimerExpiredRef.current = false;
      const deadline = Date.now() + minutes * 60_000;
      sleepDeadlineRef.current = deadline;
      setSleepMinutes(minutes);
      sleepTimeoutRef.current = setTimeout(() => {
        sleepExpirationGenerationRef.current++;
        sleepTimerExpiredRef.current = true;
        saveCurrentPosition();
        player.pause();
        clearSleepTimer();
      }, minutes * 60_000);
    },
    [clearSleepTimer, player, saveCurrentPosition],
  );

  useEffect(
    () => () => {
      if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current);
    },
    [],
  );

  const clearPending = useCallback(() => {
    pendingReady.current?.remove();
    pendingReady.current = null;
  }, []);
  const fail = useCallback(
    (message?: string) => {
      clearPending();
      setIsSwitchingTrack(false);
      setError(message ?? 'Không phát được bài này.');
    },
    [clearPending],
  );

  useEffect(() => {
    useQueuePlaybackStore
      .getState()
      .setPlaying(status.playing || isSwitchingTrack);
  }, [isSwitchingTrack, status.playing]);

  const start = useCallback(
    async (track: AudioTrack, autoAdvance = false) => {
      if (autoAdvance && sleepTimerExpiredRef.current) return;
      if (!autoAdvance) sleepTimerExpiredRef.current = false;
      const request = ++startRequest.current;
      const sleepGeneration = sleepExpirationGenerationRef.current;
      const sleepExpired = () => {
        if (sleepGeneration !== sleepExpirationGenerationRef.current)
          return true;
        const deadline = sleepDeadlineRef.current;
        if (!deadline || Date.now() < deadline) return false;
        sleepExpirationGenerationRef.current++;
        sleepTimerExpiredRef.current = true;
        saveCurrentPosition();
        player.pause();
        clearSleepTimer();
        return true;
      };
      const owner = uidRef.current;
      setError(null);
      let readySubscription: { remove: () => void } | null = null;
      let committed = false;
      try {
        if (owner && !learningReadyRef.current) {
          const saved = await readAudioLearningPreferences(owner);
          if (request !== startRequest.current) return;
          if (sleepExpired()) return;
          learningRef.current = saved;
          learningReadyRef.current = true;
          setLearning(saved);
          player.setPlaybackRate(saved.playbackRate);
        }
        // Keep the currently playing track and its readiness listener intact
        // until the new source is actually prepared. A busy import/download
        // should report an error without leaving the queue silent.
        const uri = await prepareRef.current(track);
        if (request !== startRequest.current) return;
        if (sleepExpired()) return;
        if (!uri) {
          setError(
            'Chưa chuẩn bị được bài nghe. Hãy đợi tác vụ hiện tại hoàn tất rồi thử lại.',
          );
          return;
        }
        await setAudioModeAsync(BACKGROUND_AUDIO_MODE);
        if (request !== startRequest.current) return;
        if (sleepExpired()) return;
        const mine = ++token.current;
        committed = true;
        saveCurrentPosition();
        playerOwnerRef.current = owner;
        savedPositionRef.current = 0;
        clearPending();
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
        const playFromResumePosition = async (duration: number) => {
          const saved = learningRef.current.resumePositions[track.id] ?? 0;
          if (saved > 0 && duration > 0 && saved < duration - 2) {
            await player.seekTo(saved).catch(() => undefined);
            savedPositionRef.current = saved;
          }
          if (
            mine === token.current &&
            sleepGeneration === sleepExpirationGenerationRef.current
          )
            player.play();
        };
        readySubscription = player.addListener('playbackStatusUpdate', (s) => {
          const subscription = readySubscription;
          if (!subscription) return;
          if (!replaced) return;
          if (mine !== token.current) {
            subscription.remove();
            return;
          }
          if (sleepGeneration !== sleepExpirationGenerationRef.current) {
            subscription.remove();
            if (pendingReady.current === subscription)
              pendingReady.current = null;
            setIsSwitchingTrack(false);
            return;
          }
          if (!s.isLoaded) {
            sawLoading = true;
            return;
          }
          if (!playRequested) {
            if (!sawLoading) return;
            playRequested = true;
            void playFromResumePosition(s.duration).catch(() => {
              fail();
            });
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
          void playFromResumePosition(player.duration).catch(() => {
            fail();
          });
        } else {
          sawLoading = true;
        }
      } catch (error) {
        readySubscription?.remove();
        if (request === startRequest.current) {
          const message = error instanceof Error ? error.message : undefined;
          if (committed) fail(message);
          else setError(message ?? 'Không chuẩn bị được bài nghe.');
        }
      }
    },
    [clearPending, clearSleepTimer, fail, player, saveCurrentPosition],
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
      statusRef.current = s;
      setStatus((previous) =>
        previous.playing === !!s.playing &&
        previous.isLoaded === !!s.isLoaded &&
        Math.abs(previous.duration - (s.duration || 0)) < 0.5
          ? previous
          : coarseStatus(s),
      );
      const trackId = currentRef.current;
      const owner = playerOwnerRef.current;
      // While a new track is loading, status events can still carry the
      // previous track's time; skip checkpoints until it is playing.
      if (
        trackId &&
        owner &&
        s.isLoaded &&
        !pendingReady.current &&
        !s.didJustFinish &&
        Math.abs(s.currentTime - savedPositionRef.current) >= 10
      )
        writeResumePosition(owner, trackId, s.currentTime);
      if (sleepDeadlineRef.current && Date.now() >= sleepDeadlineRef.current) {
        sleepExpirationGenerationRef.current++;
        sleepTimerExpiredRef.current = true;
        saveCurrentPosition();
        player.pause();
        clearSleepTimer();
        return;
      }
      if (!s.didJustFinish || player.loop || !trackId) return;
      // A finished track starts from the beginning next time.
      if (owner) writeResumePosition(owner, trackId, null);
      const next = nextTrack();
      if (next) void start(next, true);
    });
    return () => sub.remove();
  }, [
    clearSleepTimer,
    nextTrack,
    player,
    saveCurrentPosition,
    start,
    writeResumePosition,
  ]);

  // Turning repeat on/off applies immediately to the track that is playing.
  useEffect(() => {
    player.loop = !!currentId && repeatId === currentId;
  }, [currentId, player, repeatId]);

  const stop = useCallback(() => {
    saveCurrentPosition();
    clearSleepTimer();
    startRequest.current++;
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
  }, [clearPending, clearSleepTimer, player, saveCurrentPosition]);

  useEffect(
    () => () => {
      startRequest.current++;
      token.current++;
      saveCurrentPosition();
      clearPending();
      useQueuePlaybackStore.getState().setCurrentId(null);
      useQueuePlaybackStore.getState().setPlaying(false);
      try {
        if (lockScreen.current) player.clearLockScreenControls();
      } catch {
        // Released together with the screen.
      }
    },
    [clearPending, player, saveCurrentPosition],
  );

  const toggle = useCallback(async () => {
    const currentStatus = statusRef.current;
    if (currentStatus.playing) {
      saveCurrentPosition();
      startRequest.current++;
      token.current++;
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
  }, [player, saveCurrentPosition]);

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
    saveCurrentPosition();
    startRequest.current++;
    token.current++;
    clearPending();
    setIsSwitchingTrack(false);
    player.pause();
  }, [clearPending, player, saveCurrentPosition]);

  const setPlaybackRate = useCallback(
    (rate: number) => {
      if (![0.75, 1, 1.25, 1.5, 2].includes(rate)) return;
      player.setPlaybackRate(rate);
      updateLearning((current) => ({ ...current, playbackRate: rate }));
    },
    [player, updateLearning],
  );

  const addBookmark = useCallback(
    (name = '') => {
      const trackId = currentRef.current;
      const positionSeconds = statusRef.current.currentTime;
      if (!trackId || !Number.isFinite(positionSeconds)) return;
      const bookmark: AudioBookmark = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        trackId,
        positionSeconds,
        label:
          name.trim().slice(0, 60) || formatAudioTime(positionSeconds * 1000),
      };
      updateLearning((current) => ({
        ...current,
        bookmarks: [...current.bookmarks, bookmark],
      }));
    },
    [updateLearning],
  );

  const removeBookmark = useCallback(
    (id: string) => {
      updateLearning((current) => ({
        ...current,
        bookmarks: current.bookmarks.filter((bookmark) => bookmark.id !== id),
      }));
    },
    [updateLearning],
  );

  const seekBookmark = useCallback(
    (bookmark: AudioBookmark) => {
      if (bookmark.trackId !== currentRef.current) return;
      void player.seekTo(bookmark.positionSeconds).catch(() => undefined);
    },
    [player],
  );

  return {
    player,
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
    playbackRate: learning.playbackRate,
    bookmarks: learning.bookmarks.filter(
      (bookmark) => bookmark.trackId === currentId,
    ),
    addBookmark,
    removeBookmark,
    seekBookmark,
    setPlaybackRate,
    sleepMinutes,
    setSleepTimer,
  };
}
