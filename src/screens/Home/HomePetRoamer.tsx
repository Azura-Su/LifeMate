import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { PixelPetAnyClipId } from '../../types/pixelPet';
import { CELESTIAL_STAG_ID } from '../../services/pixelPet/celestialStagPuppet';
import { scheduleOnRN } from 'react-native-worklets';
import { PixelPetSprite } from '../PixelPet/PixelPetSprite';
import { pixelPetSpecies } from '../../services/pixelPet/pixelPetCatalog';
import {
  petFacesLeft,
  petMovementKind,
} from '../../services/pixelPet/pixelPetFrames';
import {
  readOwnedPixelPet,
  subscribeOwnedPixelPet,
} from '../../services/pixelPet/pixelPetApi';
import { spacing } from '../../theme';

const SIZE = 56;
/** Travel speeds in points per second. */
const FLY_SPEED = 60;
const WALK_SPEED = 32;
/** Drop from the flight lane until the feet rest on the tab bar's top edge. */
const GROUND_Y = SIZE * 0.24 + spacing.xs;
const LAND_MS = 900;
const TRICK_MS = 2600;
const REST_MS = 4000;

/** Tricks per pose; the stag puppet has its own extra clips. */
const TRICKS = {
  ground: ['idle', 'happy', 'eat', 'heal'],
  air: ['happy'],
  stagGround: [
    'idle',
    'happy',
    'eat',
    'bow',
    'prance',
    'glow',
    'blaze',
    'spin',
  ],
  stagAir: ['flap', 'fly', 'spin', 'glow'],
} as const satisfies Record<string, readonly PixelPetAnyClipId[]>;

export type RoamBeat =
  | { kind: 'travel'; to: number; ms: number }
  | { kind: 'trick'; clip: PixelPetAnyClipId; ms: number }
  | { kind: 'shift' };

/**
 * Picks what the pet does next: after travelling it often stops for a trick
 * and, if it has wings, sometimes lands or takes off; otherwise it travels to
 * a fresh spot at least a third of the bar away.
 */
export function nextRoamBeat(
  previous: RoamBeat['kind'] | null,
  at: {
    x: number;
    range: number;
    walking: boolean;
    flier: boolean;
    stag: boolean;
  },
  random: () => number = Math.random,
): RoamBeat {
  if (previous === 'travel') {
    const roll = random();
    if (roll < 0.55) {
      const list = at.stag
        ? at.walking
          ? TRICKS.stagGround
          : TRICKS.stagAir
        : at.walking
          ? TRICKS.ground
          : TRICKS.air;
      const clip = list[Math.floor(random() * list.length)];
      return { kind: 'trick', clip, ms: clip === 'idle' ? REST_MS : TRICK_MS };
    }
    if (at.flier && roll < 0.8) return { kind: 'shift' };
  }
  let to = random() * at.range;
  if (Math.abs(to - at.x) < at.range / 3)
    to = at.x < at.range / 2 ? at.range : 0;
  const speed = at.walking ? WALK_SPEED : FLY_SPEED;
  return { kind: 'travel', to, ms: (Math.abs(to - at.x) / speed) * 1000 };
}

type Props = {
  uid: string | null;
  active: boolean;
  onPress: () => void;
};

/** The owned pet roams above the tab bar: flies, lands, walks and plays. */
export function HomePetRoamer({ uid, active, onPress }: Props) {
  const read = useCallback(() => (uid ? readOwnedPixelPet(uid) : null), [uid]);
  const pet = useSyncExternalStore(subscribeOwnedPixelPet, read, read);
  const species = pixelPetSpecies(pet?.speciesId ?? '');
  const reducedMotion = useReducedMotion();
  // The lane spans the screen; onLayout on a box-none overlay never fired.
  const { width } = useWindowDimensions();
  const range = Math.max(0, width - SIZE - spacing.md * 2);
  const facing = species && petFacesLeft(species) ? -1 : 1;
  const flier = !!species && petMovementKind(species) === 'wings';
  const stag = species?.id === CELESTIAL_STAG_ID;
  const [walking, setWalking] = useState(!flier);
  const [beat, setBeat] = useState<RoamBeat | null>(null);
  const x = useSharedValue(0);
  const heading = useSharedValue(1);
  const ground = useSharedValue(walking ? 1 : 0);
  const travelling = useSharedValue(0);
  const roaming = active && !reducedMotion && range > 0;

  const advance = useCallback(() => {
    setBeat((previous) =>
      nextRoamBeat(previous?.kind ?? null, {
        x: x.value,
        range,
        walking,
        flier,
        stag,
      }),
    );
  }, [x, range, walking, flier, stag]);

  // Pets without wings never get a shift beat, so put them on the ground.
  useEffect(() => {
    if (flier) return;
    setWalking(true);
    ground.value = 1;
  }, [flier, ground]);

  // Start (or restart after a pause) with a fresh beat.
  useEffect(() => {
    if (!roaming) {
      cancelAnimation(x);
      setBeat(null);
      return;
    }
    advance();
    // Only (re)start when roaming toggles; later beats chain from `advance`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roaming]);

  useEffect(() => {
    if (!beat || !roaming) return;
    if (beat.kind === 'travel') {
      heading.value = beat.to >= x.value ? 1 : -1;
      travelling.value = 1;
      x.value = withTiming(
        beat.to,
        { duration: beat.ms, easing: Easing.inOut(Easing.quad) },
        (finished) => {
          if (finished) scheduleOnRN(advance);
        },
      );
      return () => {
        travelling.value = 0;
        cancelAnimation(x);
      };
    }
    travelling.value = 0;
    if (beat.kind === 'shift') {
      const next = !walking;
      let landed = false;
      ground.value = withTiming(next ? 1 : 0, { duration: LAND_MS });
      const timer = setTimeout(() => {
        landed = true;
        setWalking(next);
      }, LAND_MS);
      return () => {
        clearTimeout(timer);
        // Interrupted mid-shift: return to the pose `walking` still describes.
        if (!landed)
          ground.value = withTiming(walking ? 1 : 0, { duration: LAND_MS });
      };
    }
    const timer = setTimeout(advance, beat.ms);
    return () => clearTimeout(timer);
    // `walking` changing after a shift must not replay the shift.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat, roaming]);

  // A finished shift continues once `walking` (and so `advance`) is updated.
  useEffect(() => {
    if (beat?.kind === 'shift') advance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walking]);

  const flight = useAnimatedStyle(() => {
    const g = ground.value;
    const bob = Math.sin((x.value / 40) * Math.PI) * 5 * (1 - g);
    return {
      transform: [
        { translateX: x.value },
        { translateY: g * GROUND_Y + bob * travelling.value },
        { scaleX: heading.value * facing },
      ],
    };
  });

  if (!species || !pet) return null;
  const trick = beat?.kind === 'trick' ? beat.clip : null;
  return (
    <View pointerEvents="box-none" style={styles.lane}>
      <Animated.View style={[styles.pet, flight]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Mở linh thú ${species.name}`}
          onPress={onPress}
          hitSlop={spacing.sm}
        >
          <PixelPetSprite
            species={species}
            stage={pet.stage}
            size={SIZE}
            clip={trick ?? 'move'}
            loopMovement={!trick}
            walking={walking}
            active={active}
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  lane: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing.xs,
    height: SIZE,
  },
  pet: { position: 'absolute', left: spacing.md, width: SIZE, height: SIZE },
});
