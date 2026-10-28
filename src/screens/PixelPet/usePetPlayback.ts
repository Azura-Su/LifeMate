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
import type { PixelPetClipId, PixelPetSpeciesId } from '../../types/pixelPet';
import { petPlayback } from '../../services/pixelPet/pixelPetFrames';

export function usePetPlayback({
  clip,
  speciesId,
  active,
  loopMovement,
  onClipEnd,
}: {
  clip: PixelPetClipId;
  speciesId: PixelPetSpeciesId;
  active: boolean;
  loopMovement: boolean;
  onClipEnd?: () => void;
}) {
  const progress = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const generation = useRef({ value: 0 });
  const callback = useRef(onClipEnd);
  callback.current = onClipEnd;
  const { durationMs, loop } = petPlayback(clip, loopMovement);

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
