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
}: {
  clip: PixelPetAnyClipId;
  speciesId: PixelPetSpeciesId;
  active: boolean;
  loopMovement: boolean;
  onClipEnd?: () => void;
  /** Puppet pets own their timings; atlas pets use the shared clip table. */
  playback?: { durationMs: number; loop: boolean };
}) {
  const progress = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const generation = useRef({ value: 0 });
  const callback = useRef(onClipEnd);
  callback.current = onClipEnd;
  const { durationMs, loop } =
    playback ?? petPlayback(clip as PixelPetClipId, loopMovement);

  useEffect(() => {
    const guard = generation.current;
    const ticket = ++guard.value;
    let completed = false;
    const complete = () => {
      if (guard.value !== ticket || completed) return;
      completed = true;
      callback.current?.();
    };
    cancelAnimation(progress);
    progress.value = 0;
    if (active && !reducedMotion) {
      const timing = withTiming(
        1,
        { duration: durationMs, easing: Easing.linear },
        (finished) => {
          if (finished && !loop) scheduleOnRN(complete);
        },
      );
      progress.value = loop ? withRepeat(timing, -1, false) : timing;
    } else if (active && !loop) complete();
    return () => {
      guard.value++;
      cancelAnimation(progress);
    };
  }, [active, reducedMotion, clip, speciesId, durationMs, loop, progress]);

  return { progress, reducedMotion };
}
