import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { PixelPetClipId } from '../../types/pixelPet';
import {
  PET_ATLAS,
  petFrameBlendAt,
} from '../../services/pixelPet/pixelPetFrames';

export function PixelPetAtlas({
  source,
  size,
  clip,
  progress,
  loopMovement,
  animating,
  fallback,
}: {
  source: ImageSourcePropType;
  size: number;
  clip: PixelPetClipId;
  progress: { value: number };
  loopMovement: boolean;
  animating: boolean;
  fallback: ReactNode;
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
      { translateX: -(frame % PET_ATLAS.columns) * size },
      { translateY: -Math.floor(frame / PET_ATLAS.columns) * size },
    ];
  };
  // Two copies of the same atlas: the pose and the next one fading in on top.
  const frameStyle = useAnimatedStyle(() => {
    const frame = animating
      ? petFrameBlendAt(clip, progress.value, loopMovement).from
      : 0;
    return { transform: cell(frame) };
  });
  const nextStyle = useAnimatedStyle(() => {
    const blend = animating
      ? petFrameBlendAt(clip, progress.value, loopMovement)
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
              width: size * PET_ATLAS.columns,
              height: size * PET_ATLAS.rows,
              opacity: ready ? 1 : 0,
            },
            frameStyle,
          ]}
        />
      )}
      {!failed && ready && animating && (
        <Animated.Image
          accessible={false}
          source={source}
          resizeMode="stretch"
          fadeDuration={0}
          style={[
            styles.image,
            {
              width: size * PET_ATLAS.columns,
              height: size * PET_ATLAS.rows,
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
