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
} from '../PixelPet/petArt';
import { PixelPetAtlas } from '../PixelPet/PixelPetAtlas';
import { usePetPlayback } from '../PixelPet/usePetPlayback';

const SCENE_SIZE = 168;

type Props = {
  visible: boolean;
  active?: boolean;
  mode?: 'growing' | 'withering';
  /** Freeze this partial growth pose if the pet wakes before the tree is mature. */
  growthFrame?: number;
  onFinished?: () => void;
};

/** Full-scene growing and withering tracks share a fixed root anchor. */
export function HomeSleepGarden({
  visible,
  active = true,
  mode = 'growing',
  growthFrame = 15,
  onFinished,
}: Props) {
  const withering = mode === 'withering';
  const earlyWake = withering && growthFrame < 15;
  const dustScale = earlyWake ? (growthFrame < 8 ? 0.55 : 0.85) : 1;
  const sceneSize = SCENE_SIZE * dustScale;
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
    <Animated.View pointerEvents="none" style={[styles.garden, sceneStyle]}>
      {earlyWake && (
        <Animated.View style={[styles.snapshot, snapshotStyle]}>
          <PixelPetAtlas
            source={CELESTIAL_STAG_SLEEP_GARDEN_ATLAS}
            size={SCENE_SIZE}
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
            left: (SCENE_SIZE - sceneSize) / 2,
            top: (SCENE_SIZE - sceneSize) * (296 / 320),
            width: sceneSize,
            height: sceneSize,
          },
          dustStyle,
        ]}
      >
        <PixelPetAtlas
          key={mode}
          source={
            withering
              ? CELESTIAL_STAG_SLEEP_GARDEN_DECAY_ATLAS
              : CELESTIAL_STAG_SLEEP_GARDEN_ATLAS
          }
          size={sceneSize}
          clip="move"
          progress={progress}
          loopMovement={false}
          animating={active && !reducedMotion}
          columns={4}
          rows={4}
          frameTrack={
            withering
              ? earlyWake
                ? CELESTIAL_STAG_GARDEN_DUST_FRAMES
                : CELESTIAL_STAG_GARDEN_WITHER_FRAMES
              : CELESTIAL_STAG_SLEEP_GARDEN_FRAMES
          }
          staticFrame={reducedMotion ? 15 : undefined}
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
    left: -24,
    top: -44,
    width: SCENE_SIZE,
    height: SCENE_SIZE,
  },
});
