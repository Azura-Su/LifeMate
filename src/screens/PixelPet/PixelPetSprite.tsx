import { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import type { PixelPetSpecies } from '../../services/pixelPet/pixelPetCatalog';
import {
  gridRects,
  MOTIF_GRIDS,
  PIXEL_CANVAS,
  PIXEL_CLIPS,
  PIXEL_RIGS,
  pixelPetLayers,
  polishGrid,
  sampleTrack,
  slotColor,
  STAGE_LOOK,
  type PixelLayer,
} from '../../services/pixelPet/pixelPetRig';
import {
  CELESTIAL_STAG_ID,
  isExtraClip,
} from '../../services/pixelPet/celestialStagPuppet';
import type {
  PixelPetAnyClipId,
  PixelPetClipId,
  PixelPetStage,
} from '../../types/pixelPet';
import { CelestialStagPuppet } from './CelestialStagPuppet';
import { PET_ART, PET_ATLASES } from './petArt';
import { PixelPetAtlas } from './PixelPetAtlas';
import { usePetPlayback } from './usePetPlayback';

type Props = {
  species: PixelPetSpecies;
  stage: PixelPetStage;
  size: number;
  /** Extra clips are only played by the Celestial Stag puppet. */
  clip?: PixelPetAnyClipId;
  /** Off-screen or unfocused pets stop animating. */
  active?: boolean;
  /** Loop the locomotion poses for roaming or a local animation preview. */
  loopMovement?: boolean;
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
  const grid = polishGrid(layer.grid);
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  return (
    <Svg width={cols * px} height={rows * px} viewBox={`0 0 ${cols} ${rows}`}>
      {gridRects(grid).map((rect) => (
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
    const extra =
      part === 'feature' ? swing * Math.sin(progress.value * Math.PI * 2) : 0;
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

/** The admin's stag is a hand-rigged puppet; every other species uses the shared rig. */
export function PixelPetSprite({ clip = 'idle', ...props }: Props) {
  if (props.species.id === CELESTIAL_STAG_ID)
    return (
      <CelestialStagPuppet
        {...props}
        clip={clip}
        active={props.active ?? true}
        loopMovement={props.loopMovement ?? false}
      />
    );
  return (
    <RiggedPixelPetSprite
      {...props}
      clip={isExtraClip(clip) ? 'happy' : clip}
    />
  );
}

type RiggedProps = Omit<Props, 'clip'> & { clip: PixelPetClipId };

/** One shared rig, clip and stage transform drive every species. */
function RiggedPixelPetSprite({
  species,
  stage,
  size,
  clip,
  active = true,
  loopMovement = false,
  onClipEnd,
}: RiggedProps) {
  const { progress, reducedMotion } = usePetPlayback({
    clip,
    speciesId: species.id,
    active,
    loopMovement,
    onClipEnd,
  });
  const look = STAGE_LOOK[stage];
  const px = size / PIXEL_CANVAS;
  const swing = PIXEL_RIGS[species.rig].featureSwing;

  const styles = {
    body: useLayerStyle('body', progress, clip, px, swing),
    head: useLayerStyle('head', progress, clip, px, swing),
    feature: useLayerStyle('feature', progress, clip, px, swing),
  };
  const art = PET_ART[species.id];
  const layers = art ? [] : pixelPetLayers(species, stage);
  const motif = clip === 'skill' ? MOTIF_GRIDS[species.motif] : null;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${species.name}, ${
        stage === 'hatchling'
          ? 'ấu thể'
          : stage === 'juvenile'
            ? 'trưởng thành'
            : 'thăng hoa'
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
        <PixelPetAtlas
          key={species.id}
          source={PET_ATLASES[species.id as keyof typeof PET_ATLASES]}
          size={size}
          clip={clip}
          progress={progress}
          loopMovement={loopMovement}
          animating={active && !reducedMotion}
          fallback={
            <>
              {art && (
                // Illustrated art moves as one piece on the body track.
                <Animated.View style={[local.fill, styles.body]}>
                  <Image source={art} style={local.art} resizeMode="contain" />
                </Animated.View>
              )}
              {layers.map((layer, index) => (
                <Animated.View
                  key={`${layer.part}-${index}`}
                  style={[
                    local.layer,
                    // polishGrid pads one cell for the outline.
                    { left: (layer.x - 1) * px, top: (layer.y - 1) * px },
                    styles[layer.part],
                  ]}
                >
                  <PixelGrid layer={layer} palette={species.palette} px={px} />
                </Animated.View>
              ))}
            </>
          }
        />
        {motif && (
          <View style={[local.layer, { left: px, top: px }]}>
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
  art: { width: '100%', height: '100%' },
  aura: { position: 'absolute', borderWidth: 2, opacity: 0.5 },
});
