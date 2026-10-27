import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import type { PixelPetSpecies } from '../../services/pixelPet/pixelPetCatalog';
import {
  gridRects,
  MOTIF_GRIDS,
  PIXEL_CANVAS,
  PIXEL_CLIPS,
  PIXEL_RIGS,
  pixelPetLayers,
  sampleTrack,
  slotColor,
  STAGE_LOOK,
  type PixelLayer,
} from '../../services/pixelPet/pixelPetRig';
import type { PixelPetClipId, PixelPetStage } from '../../types/pixelPet';

type Props = {
  species: PixelPetSpecies;
  stage: PixelPetStage;
  size: number;
  clip?: PixelPetClipId;
  /** Off-screen or unfocused pets stop animating. */
  active?: boolean;
  onClipEnd?: () => void;
};

const PixelGrid = memo(function PixelGrid({
  layer,
  palette,
  px,
}: {
  layer: PixelLayer;
  palette: PixelPetSpecies['palette'];
  px: number;
}) {
  const rows = layer.grid.length;
  const cols = layer.grid[0]?.length ?? 0;
  return (
    <Svg
      width={cols * px}
      height={rows * px}
      viewBox={`0 0 ${cols} ${rows}`}
    >
      {gridRects(layer.grid).map((rect) => (
        <Rect
          key={`${rect.x}-${rect.y}`}
          x={rect.x}
          y={rect.y}
          width={rect.w}
          // Slight overlap hides antialiasing seams between pixel rows.
          height={1.05}
          fill={slotColor(rect.slot, palette)}
        />
      ))}
    </Svg>
  );
});

function useLayerStyle(
  part: PixelLayer['part'],
  progress: { value: number },
  clip: PixelPetClipId,
  px: number,
  swing: number,
) {
  return useAnimatedStyle(() => {
    const [dx, dy, rotate, scale] = sampleTrack(
      PIXEL_CLIPS[clip][part],
      progress.value,
    );
    const extra = part === 'feature' ? swing * Math.sin(progress.value * Math.PI * 2) : 0;
    return {
      transform: [
        { translateX: dx * px },
        { translateY: dy * px },
        { rotate: `${rotate + extra}deg` },
        { scale },
      ],
    };
  });
}

/** One shared rig, clip and stage transform drive every species. */
export function PixelPetSprite({
  species,
  stage,
  size,
  clip = 'idle',
  active = true,
  onClipEnd,
}: Props) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const look = STAGE_LOOK[stage];
  const px = size / PIXEL_CANVAS;
  const swing = PIXEL_RIGS[species.rig].featureSwing;
  const definition = PIXEL_CLIPS[clip];

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (!active || reducedMotion) {
      if (!definition.loop) onClipEnd?.();
      return;
    }
    const timing = withTiming(
      1,
      { duration: definition.durationMs, easing: Easing.inOut(Easing.quad) },
      (finished) => {
        if (finished && !definition.loop && onClipEnd) scheduleOnRN(onClipEnd);
      },
    );
    progress.value = definition.loop ? withRepeat(timing, -1, false) : timing;
    return () => cancelAnimation(progress);
  }, [active, reducedMotion, definition, onClipEnd, progress]);

  const styles = {
    body: useLayerStyle('body', progress, clip, px, swing),
    head: useLayerStyle('head', progress, clip, px, swing),
    feature: useLayerStyle('feature', progress, clip, px, swing),
  };
  const layers = pixelPetLayers(species, stage);
  const motif = clip === 'skill' ? MOTIF_GRIDS[species.motif] : null;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${species.name}, ${
        stage === 'hatchling' ? 'ấu thể' : stage === 'juvenile' ? 'trưởng thành' : 'thăng hoa'
      }`}
      style={[local.canvas, { width: size, height: size }]}
    >
      <View style={[local.fill, { transform: [{ scale: look.scale }] }]}>
        {look.aura && (
          <View
            style={[
              local.aura,
              {
                left: size * 0.16,
                top: size * 0.16,
                width: size * 0.68,
                height: size * 0.68,
                borderRadius: (size * 0.68) / 2,
                borderColor: species.palette[2],
              },
            ]}
          />
        )}
        {layers.map((layer, index) => (
          <Animated.View
            key={`${layer.part}-${index}`}
            style={[
              local.layer,
              { left: layer.x * px, top: layer.y * px },
              styles[layer.part],
            ]}
          >
            <PixelGrid layer={layer} palette={species.palette} px={px} />
          </Animated.View>
        ))}
        {motif && (
          <View style={[local.layer, { left: 2 * px, top: 2 * px }]}>
            <PixelGrid
              layer={{ part: 'feature', x: 0, y: 0, grid: motif }}
              palette={species.palette}
              px={px}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  canvas: { overflow: 'hidden' },
  fill: { ...StyleSheet.absoluteFillObject },
  layer: { position: 'absolute' },
  aura: { position: 'absolute', borderWidth: 2, opacity: 0.5 },
});
