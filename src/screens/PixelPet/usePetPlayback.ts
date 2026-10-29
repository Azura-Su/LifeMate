import { useEffect, useRef } from 'react';
import {
  cancelAnimation,
  Easing,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type {
  PixelPetAnyClipId,
  PixelPetClipId,
  PixelPetSpeciesId,
} from '../../types/pixelPet';
import { petPlayback } from '../../services/pixelPet/pixelPetFrames';

export function usePetPlayback({
  clip,
  speciesId,
  active,
  loopMovement,
  onClipEnd,
  playback,
  playbackKey,
  preserveProgressWhenInactive = false,
}: {
  clip: PixelPetAnyClipId;
  speciesId: PixelPetSpeciesId;
  active: boolean;
  loopMovement: boolean;
  onClipEnd?: () => void;
  /** Puppet pets own their timings; atlas pets use the shared clip table. */
  playback?: { durationMs: number; loop: boolean };
  /** Restart the same-duration timing when a custom atlas track changes. */
  playbackKey?: string;
  /** Pause one-shot playback at its current frame while its screen is inactive. */
  preserveProgressWhenInactive?: boolean;
}) {
  const progress = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const generation = useRef({ value: 0 });
  const { durationMs, loop } =
    playback ?? petPlayback(clip as PixelPetClipId, loopMovement);
  const playbackIdentity = JSON.stringify([
    clip,
    speciesId,
    durationMs,
    loop,
    playbackKey,
  ]);
  const playbackIdentityRef = useRef(playbackIdentity);
  const pausedIdentity = useRef<string | null>(null);
  const callback = useRef(onClipEnd);
  callback.current = onClipEnd;

  useEffect(() => {
    const guard = generation.current;
    const ticket = ++guard.value;
    let completed = false;
    const complete = () => {
      if (guard.value !== ticket || completed) return;
      completed = true;
      callback.current?.();
    };
    const cleanup = () => {
      guard.value++;
      cancelAnimation(progress);
    };
    cancelAnimation(progress);

    if (playbackIdentityRef.current !== playbackIdentity) {
      playbackIdentityRef.current = playbackIdentity;
      pausedIdentity.current = null;
      progress.value = 0;
    }
    if (!active) {
      pausedIdentity.current = preserveProgressWhenInactive
        ? playbackIdentity
        : null;
      if (!preserveProgressWhenInactive) progress.value = 0;
      return cleanup;
    }

    const resume =
      preserveProgressWhenInactive &&
      pausedIdentity.current === playbackIdentity;
    pausedIdentity.current = null;
    if (!resume) progress.value = 0;
    if (active && !reducedMotion) {
      const start = resume ? Math.max(0, Math.min(1, progress.value)) : 0;
      if (start >= 1) {
        complete();
        return cleanup;
      }
      const timing = withTiming(
        1,
        { duration: durationMs * (1 - start), easing: Easing.linear },
        (finished) => {
          if (finished && !loop) scheduleOnRN(complete);
        },
      );
      progress.value = loop ? withRepeat(timing, -1, false) : timing;
    } else if (active && !loop) complete();
    return cleanup;
  }, [
    active,
    reducedMotion,
    clip,
    speciesId,
    durationMs,
    loop,
    playbackIdentity,
    preserveProgressWhenInactive,
    progress,
  ]);

  return { progress, reducedMotion };
}
