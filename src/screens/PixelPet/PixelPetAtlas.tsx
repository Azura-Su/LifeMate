import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { PixelPetAnyClipId, PixelPetClipId } from '../../types/pixelPet';
import {
  PET_ATLAS,
  petFrameBlendAt,
} from '../../services/pixelPet/pixelPetFrames';

function frameBlendAt(
  track: readonly number[],
  progress: number,
  loop: boolean,
) {
  'worklet';
  const t = Math.max(0, Math.min(1, progress));
  if (t === 1 && !loop) {
    const last = track[track.length - 1];
    return { from: last, to: last, mix: 0 };
  }
  if (t === 1) {
    const last = track[track.length - 1];
    return { from: last, to: track[0], mix: 1 };
  }
  const position = loop ? t * track.length : t * (track.length - 1);
  const index = Math.min(track.length - 1, Math.floor(position));
  const next = index + 1 < track.length ? index + 1 : loop ? 0 : index;
  const local = Math.max(0, Math.min(1, position - index));
  return {
    from: track[index],
    to: track[next],
    mix: local * local * (3 - 2 * local),
  };
}

export function PixelPetAtlas({
  source,
  size,
  clip,
  progress,
  loopMovement,
  animating,
  fallback,
  columns = PET_ATLAS.columns,
  rows = PET_ATLAS.rows,
  frameTrack,
  staticFrame,
  loop = false,
  blendFrames = true,
}: {
  source: ImageSourcePropType;
  size: number;
  clip: PixelPetAnyClipId;
  progress: { value: number };
  loopMovement: boolean;
  animating: boolean;
  fallback: ReactNode;
  columns?: number;
  rows?: number;
  /** Optional custom frame sequence for atlas characters with more than 16 poses. */
  frameTrack?: readonly number[];
  /** Pose to hold while the atlas playback is paused, e.g. the closed-eye pose. */
  staticFrame?: number;
  loop?: boolean;
  /** Full-body frame sheets can jump between distinct silhouettes without ghosting. */
  blendFrames?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const cell = (frame: number) => {
    'worklet';
    return [
      { translateX: -(frame % columns) * size },
      { translateY: -Math.floor(frame / columns) * size },
    ];
  };
  // Two copies of the same atlas: the pose and the next one fading in on top.
  const frameStyle = useAnimatedStyle(() => {
    const blend = frameTrack
      ? frameBlendAt(frameTrack, progress.value, loop)
      : petFrameBlendAt(clip as PixelPetClipId, progress.value, loopMovement);
    const frame = animating
      ? blendFrames || blend.mix < 0.5
        ? blend.from
        : blend.to
      : (staticFrame ?? 0);
    return { transform: cell(frame) };
  });
  const nextStyle = useAnimatedStyle(() => {
    const blend =
      animating && blendFrames
        ? frameTrack
          ? frameBlendAt(frameTrack, progress.value, loop)
          : petFrameBlendAt(
              clip as PixelPetClipId,
              progress.value,
              loopMovement,
            )
        : { to: 0, mix: 0 };
    return { opacity: ready ? blend.mix : 0, transform: cell(blend.to) };
  });
  return (
    <View style={[styles.viewport, { width: size, height: size }]}>
      {(!ready || failed) && fallback}
      {!failed && (
        <Animated.Image
          testID="pixel-pet-atlas"
          accessible={false}
          source={source}
          resizeMode="stretch"
          fadeDuration={0}
          onLoad={() => {
            if (mounted.current) setReady(true);
          }}
          onError={() => {
            if (mounted.current) setFailed(true);
          }}
          style={[
            styles.image,
            {
              width: size * columns,
              height: size * rows,
              opacity: ready ? 1 : 0,
            },
            frameStyle,
          ]}
        />
      )}
      {!failed && ready && animating && blendFrames && (
        <Animated.Image
          accessible={false}
          source={source}
          resizeMode="stretch"
          fadeDuration={0}
          style={[
            styles.image,
            {
              width: size * columns,
              height: size * rows,
            },
            nextStyle,
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { overflow: 'hidden' },
  image: { position: 'absolute', left: 0, top: 0 },
});
