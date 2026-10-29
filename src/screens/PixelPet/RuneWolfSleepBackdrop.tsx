import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { PixelPetAtlas } from './PixelPetAtlas';
import { usePetPlayback } from './usePetPlayback';
import {
  RUNE_WOLF_SLEEP_SCENE_ATLAS,
  RUNE_WOLF_WAKE_SCENE_ATLAS,
} from './petArt';
import { RUNE_WOLF_WAKE_SCENE_FRAMES } from '../../services/pixelPet/runeWolfWakeScene';

const FRAME_TRACK = Array.from({ length: 16 }, (_, frame) => frame);
const TRANSITION_MS = 5200;

/** Raster sprite-sheet background that grows in warm late-afternoon light. */
export function RuneWolfSleepBackdrop({
  visible,
  active,
  size,
}: {
  visible: boolean;
  active: boolean;
  size: number;
}) {
  const opacity = useSharedValue(0);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const { progress, reducedMotion } = usePetPlayback({
    clip: 'move',
    speciesId: 'rune_wolf',
    active: visible && active,
    loopMovement: false,
    playback: { durationMs: TRANSITION_MS, loop: false },
    playbackKey: visible ? 'sleeping' : 'awake',
    preserveProgressWhenInactive: true,
  });

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 480 });
  }, [opacity, visible]);

  if (!visible) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="rune-wolf-sleep-scene"
      style={[styles.scene, fadeStyle]}
    >
      <RuneWolfSleepFrames
        size={size}
        progress={progress}
        animating={!reducedMotion}
        reducedMotion={reducedMotion}
      />
    </Animated.View>
  );
}

export function RuneWolfSleepAtlas({
  size,
  progress,
  animating,
  reducedMotion,
  waking = false,
}: {
  size: number;
  progress: { value: number };
  animating: boolean;
  reducedMotion: boolean;
  waking?: boolean;
}) {
  return (
    <Animated.View pointerEvents="none" style={styles.scene}>
      <RuneWolfSleepFrames
        size={size}
        progress={progress}
        animating={animating}
        reducedMotion={reducedMotion}
        waking={waking}
      />
    </Animated.View>
  );
}

function RuneWolfSleepFrames({
  size,
  progress,
  animating,
  reducedMotion,
  waking = false,
}: {
  size: number;
  progress: { value: number };
  animating: boolean;
  reducedMotion: boolean;
  waking?: boolean;
}) {
  return (
    <PixelPetAtlas
      source={waking ? RUNE_WOLF_WAKE_SCENE_ATLAS : RUNE_WOLF_SLEEP_SCENE_ATLAS}
      size={size}
      clip="move"
      progress={progress}
      loopMovement={false}
      animating={animating}
      columns={waking ? 8 : 4}
      rows={4}
      frameTrack={waking ? RUNE_WOLF_WAKE_SCENE_FRAMES : FRAME_TRACK}
      staticFrame={reducedMotion ? (waking ? 31 : 15) : undefined}
      fallback={null}
      blendFrames
    />
  );
}

const styles = StyleSheet.create({
  scene: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
