import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { CELESTIAL_STAG_ID } from '../../services/pixelPet/celestialStagPuppet';
import {
  CELESTIAL_STAG_SLEEP_GARDEN_FRAMES,
  CELESTIAL_STAG_GARDEN_GROWTH_MS,
  CELESTIAL_STAG_GARDEN_WITHER_MS,
  CELESTIAL_STAG_GARDEN_EARLY_WITHER_MS,
  CELESTIAL_STAG_GARDEN_WITHER_FRAMES,
  CELESTIAL_STAG_GARDEN_DUST_FRAMES,
} from '../../services/pixelPet/celestialStagAtlas';
import {
  CELESTIAL_STAG_SLEEP_GARDEN_ATLAS,
  CELESTIAL_STAG_SLEEP_GARDEN_DECAY_ATLAS,
  CELESTIAL_STAG_SLEEP_GARDEN_LV04_ATLAS,
  CELESTIAL_STAG_SLEEP_GARDEN_LV04_DECAY_ATLAS,
  CELESTIAL_STAG_SLEEP_GARDEN_LV06_ATLAS,
  CELESTIAL_STAG_SLEEP_GARDEN_LV06_DECAY_ATLAS,
  CELESTIAL_STAG_SLEEP_GARDEN_LV08_ATLAS,
  CELESTIAL_STAG_SLEEP_GARDEN_LV08_DECAY_ATLAS,
  CELESTIAL_STAG_SLEEP_GARDEN_LV10_ATLAS,
  CELESTIAL_STAG_SLEEP_GARDEN_LV10_DECAY_ATLAS,
  CELESTIAL_STAG_SLEEP_GARDEN_LV12_ATLAS,
  CELESTIAL_STAG_SLEEP_GARDEN_LV12_DECAY_ATLAS,
  CELESTIAL_STAG_SLEEP_GARDEN_LV14_ATLAS,
  CELESTIAL_STAG_SLEEP_GARDEN_LV14_DECAY_ATLAS,
  CELESTIAL_STAG_SLEEP_GARDEN_LV16_ATLAS,
  CELESTIAL_STAG_SLEEP_GARDEN_LV16_DECAY_ATLAS,
  CELESTIAL_STAG_SLEEP_GARDEN_LV18_ATLAS,
  CELESTIAL_STAG_SLEEP_GARDEN_LV18_DECAY_ATLAS,
  CELESTIAL_STAG_SLEEP_GARDEN_LV20_ATLAS,
  CELESTIAL_STAG_SLEEP_GARDEN_LV20_DECAY_ATLAS,
} from '../PixelPet/petArt';
import { PixelPetAtlas } from '../PixelPet/PixelPetAtlas';
import { usePetPlayback } from '../PixelPet/usePetPlayback';
import {
  CELESTIAL_STAG_HOME_GARDEN_SIZE,
  CELESTIAL_STAG_HOME_PET_SIZE,
} from './celestialStagHomeLayout';

const STAG_SLEEP_GARDEN_ATLASES: Record<number, readonly [number, number]> = {
  4: [CELESTIAL_STAG_SLEEP_GARDEN_LV04_ATLAS, CELESTIAL_STAG_SLEEP_GARDEN_LV04_DECAY_ATLAS],
  6: [CELESTIAL_STAG_SLEEP_GARDEN_LV06_ATLAS, CELESTIAL_STAG_SLEEP_GARDEN_LV06_DECAY_ATLAS],
  8: [CELESTIAL_STAG_SLEEP_GARDEN_LV08_ATLAS, CELESTIAL_STAG_SLEEP_GARDEN_LV08_DECAY_ATLAS],
  10: [CELESTIAL_STAG_SLEEP_GARDEN_LV10_ATLAS, CELESTIAL_STAG_SLEEP_GARDEN_LV10_DECAY_ATLAS],
  12: [CELESTIAL_STAG_SLEEP_GARDEN_LV12_ATLAS, CELESTIAL_STAG_SLEEP_GARDEN_LV12_DECAY_ATLAS],
  14: [CELESTIAL_STAG_SLEEP_GARDEN_LV14_ATLAS, CELESTIAL_STAG_SLEEP_GARDEN_LV14_DECAY_ATLAS],
  16: [CELESTIAL_STAG_SLEEP_GARDEN_LV16_ATLAS, CELESTIAL_STAG_SLEEP_GARDEN_LV16_DECAY_ATLAS],
  18: [CELESTIAL_STAG_SLEEP_GARDEN_LV18_ATLAS, CELESTIAL_STAG_SLEEP_GARDEN_LV18_DECAY_ATLAS],
  20: [CELESTIAL_STAG_SLEEP_GARDEN_LV20_ATLAS, CELESTIAL_STAG_SLEEP_GARDEN_LV20_DECAY_ATLAS],
};

function sleepGardenAtlas(level: number, withering: boolean) {
  const tier = Math.max(2, Math.min(20, Math.floor(level / 2) * 2));
  const pair = STAG_SLEEP_GARDEN_ATLASES[tier];
  if (!pair) return withering
    ? CELESTIAL_STAG_SLEEP_GARDEN_DECAY_ATLAS
    : CELESTIAL_STAG_SLEEP_GARDEN_ATLAS;
  return pair[withering ? 1 : 0];
}

type Props = {
  visible: boolean;
  active?: boolean;
  mode?: 'growing' | 'withering';
  /** Freeze this partial growth pose if the pet wakes before the tree is mature. */
  growthFrame?: number;
  /** Scene atlas is selected from the level the pet had when it went to sleep. */
  level?: number;
  size?: number;
  petSize?: number;
  /** Hold a fully grown scene in the appearance picker. */
  staticFrame?: number;
  onFinished?: () => void;
};

/** Full-scene growing and withering tracks share a fixed root anchor. */
export function HomeSleepGarden({
  visible,
  active = true,
  mode = 'growing',
  growthFrame = 15,
  level = 2,
  size = CELESTIAL_STAG_HOME_GARDEN_SIZE,
  petSize = CELESTIAL_STAG_HOME_PET_SIZE,
  staticFrame,
  onFinished,
}: Props) {
  const withering = mode === 'withering';
  const earlyWake = withering && growthFrame < 15;
  const dustScale = earlyWake ? (growthFrame < 8 ? 0.55 : 0.85) : 1;
  const gardenSize = size;
  const sceneSize = gardenSize * dustScale;
  const { progress, reducedMotion } = usePetPlayback({
    clip: 'move',
    speciesId: CELESTIAL_STAG_ID,
    active: visible && active,
    loopMovement: false,
    playback: {
      durationMs: withering
        ? earlyWake
          ? CELESTIAL_STAG_GARDEN_EARLY_WITHER_MS
          : CELESTIAL_STAG_GARDEN_WITHER_MS
        : CELESTIAL_STAG_GARDEN_GROWTH_MS,
      loop: false,
    },
    onClipEnd: withering ? onFinished : undefined,
    preserveProgressWhenInactive: true,
  });
  const sceneStyle = useAnimatedStyle(() => ({
    opacity: withering
      ? Math.min(1, Math.max(0, (1 - progress.value) / 0.2))
      : 1,
  }));
  const snapshotStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - progress.value * 2),
  }));
  const dustStyle = useAnimatedStyle(() => ({
    opacity: earlyWake ? Math.min(1, progress.value * 2) : 1,
  }));

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.garden, {
        left: (petSize - size) / 2,
        top: petSize * 0.81 - size * (296 / 320),
        width: size,
        height: size,
      }, sceneStyle]}
    >
      {earlyWake && (
        <Animated.View style={[styles.snapshot, snapshotStyle]}>
          <PixelPetAtlas
            source={sleepGardenAtlas(level, false)}
            size={gardenSize}
            clip="move"
            progress={progress}
            loopMovement={false}
            animating={false}
            columns={4}
            rows={4}
            staticFrame={growthFrame}
            fallback={null}
          />
        </Animated.View>
      )}
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: (gardenSize - sceneSize) / 2,
            top: (gardenSize - sceneSize) * (296 / 320),
            width: sceneSize,
            height: sceneSize,
          },
          dustStyle,
        ]}
      >
        <PixelPetAtlas
          key={mode}
          source={sleepGardenAtlas(level, withering)}
          size={sceneSize}
          clip="move"
          progress={progress}
          loopMovement={false}
          animating={active && !reducedMotion && staticFrame === undefined}
          columns={4}
          rows={4}
          frameTrack={
            withering
              ? earlyWake
                ? CELESTIAL_STAG_GARDEN_DUST_FRAMES
                : CELESTIAL_STAG_GARDEN_WITHER_FRAMES
              : CELESTIAL_STAG_SLEEP_GARDEN_FRAMES
          }
          staticFrame={staticFrame ?? (reducedMotion ? 15 : undefined)}
          loop={false}
          blendFrames={withering}
          fallback={null}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  snapshot: { ...StyleSheet.absoluteFillObject },
  garden: {
    position: 'absolute',
  },
});
