import { memo, useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
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
  pixelPetExpressionPlayback,
  type PixelPetExpression,
} from '../../services/pixelPet/pixelPetExpressions';
import {
  CELESTIAL_STAG_ID,
  isExtraClip,
} from '../../services/pixelPet/celestialStagPuppet';
import type { CelestialStagFlightPhase } from '../../services/pixelPet/celestialStagAtlas';
import type {
  DragFallStyle,
  DragPhase,
  PixelPetAnyClipId,
  PixelPetClipId,
  PixelPetStage,
} from '../../types/pixelPet';
import {
  PET_REST_FRAMES,
  PET_WAKE_FRAMES,
  petRestPlayback,
  type PetRestPhase,
} from '../../services/pixelPet/petRestAnimation';
import { CelestialStagAtlas } from './CelestialStagAtlas';
import {
  PET_ART,
  PET_ATLASES,
  PET_DRAG_ATLASES,
  PET_DRAG_ATLAS_READY,
  PET_REST_ATLASES,
} from './petArt';
import { PixelPetAtlas } from './PixelPetAtlas';
import { usePetPlayback } from './usePetPlayback';
import {
  petDragDurationMs,
  petDragFallbackClip,
  petDragFrameTrack,
} from '../../services/pixelPet/pixelPetFrames';

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
  /** Roaming on the ground: the puppet trots instead of flapping. */
  walking?: boolean;
  /** Home locomotion cadence for the Stag's authored full-body ground cycle. */
  pace?: 'walk' | 'run';
  /** Ground stride period derived from distance and phase duration on Home. */
  gaitCycleDurationMs?: number;
  /** Extra isolated atlas space for full wing extents on the Home lane. */
  motionCanvasScale?: number;
  /** Select the authored flight transition for the Home sequence. */
  flightPhase?: CelestialStagFlightPhase;
  onClipEnd?: () => void;
  /** Select authored expression poses without changing saved pet data. */
  expression?: PixelPetExpression | null;
  /** Render the admin Stag's whole-body transition into its sleeping pose. */
  sleeping?: boolean;
  /** Optional authored Home drag pose. Uses existing art until this species' atlas is ready. */
  dragPhase?: DragPhase;
  fallStyle?: DragFallStyle;
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

/** The admin's stag uses full-character atlas frames; other pets use the shared pixel rig. */
export function PixelPetSprite({
  clip = 'idle',
  walking,
  pace,
  gaitCycleDurationMs,
  motionCanvasScale,
  flightPhase,
  dragPhase = 'roam',
  fallStyle = 'fall',
  ...props
}: Props) {
  const sleeping = props.sleeping ?? false;
  const dragClip = petDragFallbackClip(dragPhase);
  const effectiveClip =
    props.species.id === CELESTIAL_STAG_ID && dragPhase === 'land'
      ? 'move'
      : (dragClip ?? clip);
  if (props.species.id === CELESTIAL_STAG_ID)
    return (
      <View
        style={[local.stagCanvas, { width: props.size, height: props.size }]}
      >
        <CelestialStagAtlas
          {...props}
          clip={effectiveClip}
          active={props.active ?? true}
          loopMovement={props.loopMovement ?? false}
          walking={walking}
          pace={pace}
          gaitCycleDurationMs={gaitCycleDurationMs}
          motionCanvasScale={motionCanvasScale}
          flightPhase={flightPhase}
          expression={props.expression}
          sleeping={sleeping}
          dragPhase={dragPhase}
          fallStyle={fallStyle}
        />
      </View>
    );
  return (
    <RiggedPixelPetSprite
      {...props}
      clip={isExtraClip(effectiveClip) ? 'happy' : effectiveClip}
      sleeping={sleeping}
      dragPhase={dragPhase}
      fallStyle={fallStyle}
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
  expression,
  sleeping = false,
  dragPhase = 'roam',
  fallStyle = 'fall',
}: RiggedProps) {
  const [restPhase, setRestPhase] = useState<PetRestPhase>(
    sleeping ? 'sleeping' : 'awake',
  );
  const restBreath = useSharedValue(0);
  const expressionPlayback = expression
    ? pixelPetExpressionPlayback(species.id, expression)
    : undefined;
  const restPlayback = petRestPlayback(restPhase);
  const dragAtlas = PET_DRAG_ATLASES[species.id];
  const useDragAtlas =
    dragPhase !== 'roam' &&
    PET_DRAG_ATLAS_READY[species.id] &&
    !!dragAtlas &&
    !!petDragFrameTrack(dragPhase);
  const dragTrack = useDragAtlas ? petDragFrameTrack(dragPhase) : undefined;
  const dragPlayback = useDragAtlas
    ? {
        durationMs: petDragDurationMs(dragPhase, fallStyle, false),
        loop: false,
      }
    : undefined;
  const { progress, reducedMotion } = usePetPlayback({
    clip,
    speciesId: species.id,
    active,
    loopMovement,
    onClipEnd:
      restPhase === 'sleeping'
        ? undefined
        : restPhase === 'waking'
          ? () => setRestPhase('awake')
          : onClipEnd,
    playback: dragPlayback ?? (restPlayback
      ? restPlayback
      : expressionPlayback
        ? { durationMs: expressionPlayback.durationMs, loop: false }
        : undefined),
    playbackKey: useDragAtlas
      ? `${dragPhase}:${fallStyle}`
      : restPhase,
  });
  useEffect(() => {
    setRestPhase((current) => {
      if (sleeping) return 'sleeping';
      if (current === 'sleeping' || current === 'waking')
        return reducedMotion ? 'awake' : 'waking';
      return 'awake';
    });
  }, [reducedMotion, sleeping]);
  useEffect(() => {
    cancelAnimation(restBreath);
    restBreath.value = 0;
    if (restPhase === 'sleeping' && active && !reducedMotion) {
      restBreath.value = withRepeat(
        withTiming(1, {
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true,
      );
    }
    return () => cancelAnimation(restBreath);
  }, [active, reducedMotion, restBreath, restPhase]);
  const look = STAGE_LOOK[stage];
  const px = size / PIXEL_CANVAS;
  const swing = PIXEL_RIGS[species.rig].featureSwing;

  const styles = {
    body: useLayerStyle('body', progress, clip, px, swing),
    head: useLayerStyle('head', progress, clip, px, swing),
    feature: useLayerStyle('feature', progress, clip, px, swing),
  };
  // Sub-frame motion between atlas poses: the shared body track's lift and
  // squash (not its horizontal shift, which would fight Home roaming).
  // Keep the same handle when sleep changes; replacing handles trips React
  // 19's props profiler on Reanimated's enumerable dev guard.
  const bodyStyle = useAnimatedStyle(() => {
    if (restPhase !== 'awake') {
      const breath = restPhase === 'sleeping' ? restBreath.value : 0;
      return {
        transform: [
          { scaleX: 1 + breath * 0.012 },
          { scaleY: 1 + breath * 0.024 },
        ],
      };
    }
    const [, dy, , scale] = sampleTrack(PIXEL_CLIPS[clip].body, progress.value);
    return { transform: [{ translateY: dy * px }, { scale }] };
  });
  const art = PET_ART[species.id];
  const layers = art ? [] : pixelPetLayers(species, stage);
  const motif = clip === 'skill' ? MOTIF_GRIDS[species.motif] : null;
  const resting = restPhase !== 'awake';
  const restAtlas =
    PET_REST_ATLASES[species.id as keyof typeof PET_REST_ATLASES];

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${species.name}, ${
        resting
          ? 'đang nghỉ ngơi'
          : stage === 'hatchling'
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
        <Animated.View style={[local.fill, bodyStyle]}>
          <PixelPetAtlas
            key={
              useDragAtlas
                ? `${species.id}-drag`
                : resting
                  ? `${species.id}-rest`
                  : species.id
            }
            source={
              useDragAtlas && dragAtlas
                ? dragAtlas
                : resting
                ? restAtlas
                : PET_ATLASES[species.id as keyof typeof PET_ATLASES]
            }
            size={size}
            clip={clip}
            progress={progress}
            loopMovement={loopMovement}
            frameTrack={
              useDragAtlas
                ? dragTrack
                : restPhase === 'sleeping'
                ? PET_REST_FRAMES
                : restPhase === 'waking'
                  ? PET_WAKE_FRAMES
                  : expressionPlayback?.frameTrack
            }
            staticFrame={
              useDragAtlas && dragTrack && (!active || reducedMotion)
                ? dragTrack[dragTrack.length - 1]
                : resting && (!active || reducedMotion)
                  ? 15
                  : undefined
            }
            animating={active && !reducedMotion}
            loop={false}
            blendFrames={!resting}
            fallback={
              <>
                {art && (
                  // Moves with the sway wrapper; no second body track here.
                  <View style={local.fill}>
                    <Image
                      source={art}
                      style={local.art}
                      resizeMode="contain"
                    />
                  </View>
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
                    <PixelGrid
                      layer={layer}
                      palette={species.palette}
                      px={px}
                    />
                  </Animated.View>
                ))}
              </>
            }
          />
        </Animated.View>
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
  stagCanvas: { overflow: 'visible' },
  fill: { ...StyleSheet.absoluteFillObject },
  layer: { position: 'absolute' },
  art: { width: '100%', height: '100%' },
  aura: { position: 'absolute', borderWidth: 2, opacity: 0.5 },
});
