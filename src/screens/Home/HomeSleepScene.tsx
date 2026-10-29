import { StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated';
import {
  NINE_TAIL_FOX_HOME_SLEEP_SCENE_GROWTH_MS,
  NINE_TAIL_FOX_HOME_SLEEP_SCENE_WITHER_MS,
} from '../../services/pixelPet/nineTailFoxHome';
import type { PixelPetSpeciesId } from '../../types/pixelPet';
import {
  GARUDA_HOME_SLEEP_CLOUD_LEFT,
  GARUDA_HOME_SLEEP_CLOUD_RIGHT,
  GARUDA_HOME_SLEEP_REVEAL_ATLAS,
  GARUDA_SLEEP_PLATFORM_ATLAS,
  NINE_TAIL_FOX_SLEEP_SCENE_DECAY_ATLAS,
  NINE_TAIL_FOX_SLEEP_SCENE_ATLAS,
} from '../PixelPet/petArt';
import { RuneWolfSleepAtlas } from '../PixelPet/RuneWolfSleepBackdrop';
import { RUNE_WOLF_WAKE_SCENE_MS } from '../../services/pixelPet/runeWolfWakeScene';
import { PixelPetAtlas } from '../PixelPet/PixelPetAtlas';
import { usePetPlayback } from '../PixelPet/usePetPlayback';
import {
  GARUDA_PLATFORM_BOTTOM_GAP,
  GARUDA_PLATFORM_DESIGN_SIZE,
  GARUDA_SCENE_BASELINE_Y,
  GARUDA_SCENE_DESIGN_SIZE,
  GARUDA_SCENE_TOTAL_MS,
  GARUDA_SCENE_DISSOLVE_MS,
  garudaSleepSceneTimelineAt,
} from './garudaSleepSceneTimeline';

const PET_SIZE = 120;
const FOX_SCENE_SIZE = 240;
const GARUDA_SCENE_SIZE = GARUDA_SCENE_DESIGN_SIZE;
const WOLF_SCENE_SIZE = 240;
const GARUDA_PLATFORM_SIZE = GARUDA_PLATFORM_DESIGN_SIZE;
const SCENE_FRAMES = Array.from({ length: 16 }, (_, frame) => frame);
const GARUDA_PLATFORM_BUILD_FRAMES = [
  0, 1, 2, 3, 4, 5, 6, 7, 9, 9, 9, 9, 9, 9, 9, 9,
] as const;
const SCENES = {
  nine_tail_fox: {
    speciesId: 'nine_tail_fox',
    size: FOX_SCENE_SIZE,
    growthMs: NINE_TAIL_FOX_HOME_SLEEP_SCENE_GROWTH_MS,
  },
  garuda: {
    speciesId: 'garuda',
    size: GARUDA_SCENE_SIZE,
    growthMs: GARUDA_SCENE_TOTAL_MS,
  },
  rune_wolf: {
    speciesId: 'rune_wolf',
    size: WOLF_SCENE_SIZE,
    growthMs: 5200,
  },
} as const satisfies Record<
  'nine_tail_fox' | 'garuda' | 'rune_wolf',
  {
    speciesId: PixelPetSpeciesId;
    size: number;
    growthMs: number;
  }
>;

type Props = {
  scene: keyof typeof SCENES;
  visible: boolean;
  active: boolean;
  size?: number;
  viewportWidth?: number;
  mode?: 'growing' | 'withering';
  onFinished?: () => void;
};

/** A staged species scene that grows behind the full-body sleep pose. */
export function HomeSleepScene({
  scene,
  visible,
  active,
  size: sizeOverride,
  viewportWidth: viewportWidthOverride,
  mode = 'growing',
  onFinished,
}: Props) {
  const garudaScene = scene === 'garuda';
  const { speciesId } = SCENES[scene];
  const size = garudaScene
    ? Math.min(GARUDA_SCENE_SIZE, sizeOverride ?? GARUDA_SCENE_SIZE)
    : scene === 'rune_wolf'
      ? Math.min(WOLF_SCENE_SIZE, sizeOverride ?? WOLF_SCENE_SIZE)
      : FOX_SCENE_SIZE;
  const platformSize = Math.round(
    GARUDA_PLATFORM_SIZE * (size / GARUDA_SCENE_SIZE),
  );
  const viewportWidth = Math.max(size, viewportWidthOverride ?? size);
  const cloudSize = viewportWidth * 0.6;
  const cloudHeight = cloudSize * (615 / 935);
  const cloudLayerLeft = -(viewportWidth - size) / 2;
  const runeWolfScene = scene === 'rune_wolf';
  const wolfWaking = runeWolfScene && mode === 'withering';
  const withering = mode === 'withering' && scene === 'nine_tail_fox';
  // On waking, the shrine fades into the void and the clouds part.
  const dissolving = mode === 'withering' && garudaScene;
  const { progress, reducedMotion } = usePetPlayback({
    clip: 'move',
    speciesId,
    active: visible && active,
    loopMovement: false,
    onClipEnd: withering || garudaScene || wolfWaking ? onFinished : undefined,
    playback: {
      durationMs: wolfWaking
        ? RUNE_WOLF_WAKE_SCENE_MS
        : withering
          ? NINE_TAIL_FOX_HOME_SLEEP_SCENE_WITHER_MS
          : dissolving
            ? GARUDA_SCENE_DISSOLVE_MS
            : garudaScene
              ? GARUDA_SCENE_TOTAL_MS
              : SCENES[scene].growthMs,
      loop: false,
    },
    playbackKey: mode,
    preserveProgressWhenInactive: true,
  });
  const platformProgress = useDerivedValue(
    () =>
      dissolving
        ? 1
        : garudaSleepSceneTimelineAt(progress.value).platformProgress,
    [dissolving],
  );
  const shrineProgress = useDerivedValue(
    () =>
      dissolving
        ? 1
        : garudaSleepSceneTimelineAt(progress.value).shrineProgress,
    [dissolving],
  );
  const cloudLeftStyle = useAnimatedStyle(() => {
    if (dissolving) {
      const part = progress.value;
      return {
        opacity: reducedMotion ? 0 : Math.min(1, part * 4) * (1 - part),
        transform: [{ translateX: -cloudSize * 0.9 * part }],
      };
    }
    const timeline = garudaSleepSceneTimelineAt(progress.value);
    return {
      opacity: reducedMotion
        ? 0
        : 1 - Math.min(1, timeline.shrineProgress * 1.5),
      transform: [
        {
          translateX: interpolate(
            timeline.cloudProgress,
            [0, 1],
            [-cloudSize, 0],
          ),
        },
      ],
    };
  });
  const cloudRightStyle = useAnimatedStyle(() => {
    if (dissolving) {
      const part = progress.value;
      return {
        opacity: reducedMotion ? 0 : Math.min(1, part * 4) * (1 - part),
        transform: [{ translateX: cloudSize * 0.9 * part }],
      };
    }
    const timeline = garudaSleepSceneTimelineAt(progress.value);
    return {
      opacity: reducedMotion
        ? 0
        : 1 - Math.min(1, timeline.shrineProgress * 1.5),
      transform: [
        {
          translateX: interpolate(
            timeline.cloudProgress,
            [0, 1],
            [cloudSize, 0],
          ),
        },
      ],
    };
  });
  const platformStyle = useAnimatedStyle(() => ({
    opacity: dissolving
      ? Math.max(0, 1 - progress.value * 1.6)
      : reducedMotion
        ? 1
        : Math.min(1, platformProgress.value * 4),
  }));
  const shrineStyle = useAnimatedStyle(() => {
    if (!dissolving)
      return {
        opacity: reducedMotion ? 1 : Math.min(1, shrineProgress.value * 2.5),
      };
    // Drift upward and soften as it fades, as if dispersing into the sky.
    const fade = Math.max(0, 1 - progress.value * 1.25);
    return {
      opacity: fade * fade,
      transform: [
        { translateY: -size * 0.06 * progress.value },
        { scale: 1 + 0.04 * progress.value },
      ],
    };
  });
  const decayStyle = useAnimatedStyle(() => ({
    opacity: withering
      ? Math.max(0, Math.min(1, (1 - progress.value) / 0.14))
      : garudaScene
        ? 1
        : runeWolfScene && !wolfWaking
          ? reducedMotion
            ? 1
            : Math.min(1, progress.value * 15)
          : 1,
  }));
  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      testID="home-pet-sleep-scene"
      style={[
        styles.scene,
        {
          left: (PET_SIZE - size) / 2,
          top: GARUDA_SCENE_BASELINE_Y - size * (296 / 320),
          width: size,
          height: size,
        },
        decayStyle,
      ]}
    >
      {runeWolfScene ? (
        <RuneWolfSleepAtlas
          size={size}
          progress={progress}
          animating={!reducedMotion}
          reducedMotion={reducedMotion}
          waking={wolfWaking}
        />
      ) : garudaScene ? (
        <>
          <Animated.View style={[styles.shrine, shrineStyle]}>
            <PixelPetAtlas
              source={GARUDA_HOME_SLEEP_REVEAL_ATLAS}
              size={size}
              clip="move"
              progress={shrineProgress}
              loopMovement={false}
              animating={!reducedMotion}
              columns={4}
              rows={4}
              frameTrack={SCENE_FRAMES}
              staticFrame={15}
              fallback={null}
              blendFrames
            />
          </Animated.View>
          <Animated.Image
            accessible={false}
            source={GARUDA_HOME_SLEEP_CLOUD_LEFT}
            resizeMode="contain"
            style={[
              styles.cloud,
              {
                left: cloudLayerLeft,
                top: size * 0.36,
                width: cloudSize,
                height: cloudHeight,
              },
              cloudLeftStyle,
            ]}
          />
          <Animated.Image
            accessible={false}
            source={GARUDA_HOME_SLEEP_CLOUD_RIGHT}
            resizeMode="contain"
            style={[
              styles.cloud,
              {
                left: cloudLayerLeft + viewportWidth - cloudSize,
                top: size * 0.36,
                width: cloudSize,
                height: cloudHeight,
              },
              cloudRightStyle,
            ]}
          />
          <Animated.View
            testID="home-pet-sleep-scene-build"
            style={[
              styles.platform,
              {
                left: (size - platformSize) / 2,
                top: size - platformSize - GARUDA_PLATFORM_BOTTOM_GAP,
                width: platformSize,
                height: platformSize,
              },
              platformStyle,
            ]}
          >
            <PixelPetAtlas
              source={GARUDA_SLEEP_PLATFORM_ATLAS}
              size={platformSize}
              clip="move"
              progress={platformProgress}
              loopMovement={false}
              animating={!reducedMotion}
              columns={4}
              rows={4}
              frameTrack={GARUDA_PLATFORM_BUILD_FRAMES}
              staticFrame={9}
              fallback={null}
              blendFrames={false}
            />
          </Animated.View>
        </>
      ) : (
        <PixelPetAtlas
          source={
            withering
              ? NINE_TAIL_FOX_SLEEP_SCENE_DECAY_ATLAS
              : NINE_TAIL_FOX_SLEEP_SCENE_ATLAS
          }
          size={size}
          clip="move"
          progress={progress}
          loopMovement={false}
          // Playback progress pauses on blur, so keep rendering its frozen frame.
          animating={!reducedMotion}
          columns={4}
          rows={4}
          frameTrack={SCENE_FRAMES}
          staticFrame={reducedMotion ? 15 : undefined}
          fallback={null}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scene: {
    position: 'absolute',
  },
  platform: { position: 'absolute' },
  shrine: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
  },
  cloud: { position: 'absolute' },
});
