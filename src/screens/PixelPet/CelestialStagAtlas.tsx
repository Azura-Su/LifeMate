import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { PixelPetSpecies } from '../../services/pixelPet/pixelPetCatalog';
import {
  CELESTIAL_STAG_ATLAS_LAYOUT,
  CELESTIAL_STAG_FRAME_TRACKS,
  CELESTIAL_STAG_GLIDE_FRAMES,
  CELESTIAL_STAG_FLAP_FRAMES,
  CELESTIAL_STAG_LANDING_FRAMES,
  CELESTIAL_STAG_LANDING_LAYOUT,
  CELESTIAL_STAG_MOVEMENT_FRAMES,
  CELESTIAL_STAG_MOVEMENT_LAYOUT,
  CELESTIAL_STAG_TAKEOFF_LAYOUT,
  CELESTIAL_STAG_TAKEOFF_FRAMES,
  CELESTIAL_STAG_SLEEP_FRAMES,
  celestialStagFlightPlayback,
  type CelestialStagFlightPhase,
} from '../../services/pixelPet/celestialStagAtlas';
import { puppetPlayback } from '../../services/pixelPet/celestialStagPuppet';
import { STAGE_LOOK } from '../../services/pixelPet/pixelPetRig';
import {
  petDragDurationMs,
  petDragFrameTrack,
} from '../../services/pixelPet/pixelPetFrames';
import type {
  DragFallStyle,
  DragPhase,
  PixelPetAnyClipId,
  PixelPetStage,
} from '../../types/pixelPet';
import {
  pixelPetExpressionPlayback,
  type PixelPetExpression,
} from '../../services/pixelPet/pixelPetExpressions';
import {
  CELESTIAL_STAG_ATLAS,
  CELESTIAL_STAG_FLIGHT_ATLAS,
  CELESTIAL_STAG_GROUND_ATLAS,
  CELESTIAL_STAG_LANDING_ATLAS,
  CELESTIAL_STAG_TAKEOFF_ATLAS,
  CELESTIAL_STAG_SLEEP_ATLAS,
  PET_DRAG_ATLASES,
  PET_DRAG_ATLAS_READY,
  PET_ART,
} from './petArt';
import { PixelPetAtlas } from './PixelPetAtlas';
import { usePetPlayback } from './usePetPlayback';

type Props = {
  species: PixelPetSpecies;
  stage: PixelPetStage;
  size: number;
  clip: PixelPetAnyClipId;
  active: boolean;
  loopMovement: boolean;
  walking?: boolean;
  pace?: 'walk' | 'run';
  gaitCycleDurationMs?: number;
  motionCanvasScale?: number;
  flightPhase?: CelestialStagFlightPhase;
  sleeping?: boolean;
  onClipEnd?: () => void;
  expression?: PixelPetExpression | null;
  dragPhase?: DragPhase;
  fallStyle?: DragFallStyle;
};

const STAGE_LABEL = {
  hatchling: 'ấu thể',
  juvenile: 'trưởng thành',
  ascended: 'thăng hoa',
} as const;

export function CelestialStagAtlas({
  species,
  stage,
  size,
  clip,
  active,
  loopMovement,
  walking = false,
  pace = 'run',
  gaitCycleDurationMs,
  motionCanvasScale = 1,
  flightPhase,
  sleeping = false,
  onClipEnd,
  expression,
  dragPhase = 'roam',
  fallStyle = 'wings',
}: Props) {
  const expressionPlayback = expression
    ? pixelPetExpressionPlayback(species.id, expression)
    : undefined;
  const dragAtlasTrack = petDragFrameTrack(dragPhase);
  const dragAtlasReady =
    !sleeping &&
    (dragPhase === 'lifted' || dragPhase === 'descend') &&
    PET_DRAG_ATLAS_READY.celestial_stag &&
    !!PET_DRAG_ATLASES.celestial_stag &&
    !!dragAtlasTrack;
  const homeMovement = loopMovement && (clip === 'move' || clip === 'fly');
  const dragLanding =
    !sleeping &&
    dragPhase === 'land' &&
    flightPhase === 'landing' &&
    homeMovement;
  const flightTrack =
    flightPhase === 'takeoff'
      ? CELESTIAL_STAG_TAKEOFF_FRAMES
      : flightPhase === 'landing'
        ? CELESTIAL_STAG_LANDING_FRAMES
        : flightPhase === 'glide'
          ? CELESTIAL_STAG_GLIDE_FRAMES
          : CELESTIAL_STAG_FLAP_FRAMES;
  const playback =
    (dragAtlasReady
      ? {
          durationMs: petDragDurationMs(dragPhase, fallStyle, false),
          loop: false,
        }
      : null) ??
    (dragLanding
      ? { durationMs: petDragDurationMs('land', fallStyle, false), loop: false }
      : null) ??
    (expressionPlayback
      ? { durationMs: expressionPlayback.durationMs, loop: false }
      : null) ??
    (homeMovement
      ? walking
        ? {
            durationMs: gaitCycleDurationMs ?? (pace === 'walk' ? 1100 : 520),
            loop: true,
          }
        : celestialStagFlightPlayback(flightPhase, clip)
      : puppetPlayback(clip, loopMovement, walking));
  const playbackActive = active && !sleeping && gaitCycleDurationMs !== 0;
  const playbackClockActive = active && (sleeping || gaitCycleDurationMs !== 0);
  const { progress, reducedMotion } = usePetPlayback({
    clip,
    speciesId: species.id,
    active: playbackClockActive,
    loopMovement,
    onClipEnd: sleeping ? undefined : onClipEnd,
    playback: sleeping ? { durationMs: 2600, loop: false } : playback,
    playbackKey: dragPhase === 'roam' ? undefined : dragPhase,
    preserveProgressWhenInactive: sleeping,
  });
  const sleepBreath = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(sleepBreath);
    sleepBreath.value = 0;
    if (sleeping && active && !reducedMotion) {
      sleepBreath.value = withRepeat(
        withTiming(1, {
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true,
      );
    }
    return () => cancelAnimation(sleepBreath);
  }, [active, reducedMotion, sleeping, sleepBreath]);
  const look = STAGE_LOOK[stage];
  const groundStopped = homeMovement && walking && gaitCycleDurationMs === 0;
  const atlasSize = homeMovement && !sleeping ? size * motionCanvasScale : size;
  const frameTrack = sleeping
    ? CELESTIAL_STAG_SLEEP_FRAMES
    : dragAtlasReady
      ? dragAtlasTrack
    : expressionPlayback
      ? CELESTIAL_STAG_FRAME_TRACKS.happy
      : homeMovement
        ? walking
          ? CELESTIAL_STAG_MOVEMENT_FRAMES
          : flightTrack
        : CELESTIAL_STAG_FRAME_TRACKS[clip];
  const atlasSource = sleeping
    ? CELESTIAL_STAG_SLEEP_ATLAS
    : dragAtlasReady
      ? PET_DRAG_ATLASES.celestial_stag!
    : homeMovement
      ? walking && clip !== 'fly'
        ? CELESTIAL_STAG_GROUND_ATLAS
        : flightPhase === 'takeoff'
          ? CELESTIAL_STAG_TAKEOFF_ATLAS
          : flightPhase === 'landing'
            ? CELESTIAL_STAG_LANDING_ATLAS
            : CELESTIAL_STAG_FLIGHT_ATLAS
      : CELESTIAL_STAG_ATLAS;
  const atlasLayout = sleeping
    ? { columns: 4, rows: 4 }
    : dragAtlasReady
      ? { columns: 4, rows: 4 }
    : homeMovement
      ? flightPhase === 'takeoff'
        ? CELESTIAL_STAG_TAKEOFF_LAYOUT
        : flightPhase === 'landing'
          ? CELESTIAL_STAG_LANDING_LAYOUT
          : CELESTIAL_STAG_MOVEMENT_LAYOUT
      : CELESTIAL_STAG_ATLAS_LAYOUT;
  // Keep crisp, authored atlas poses while adding sub-frame body motion. The
  // stag atlas deliberately does not cross-fade full silhouettes (which makes
  // antlers, hooves and wings look doubled between poses).
  // Keep one handle across sleep/wake. React 19's props profiler recursively
  // compares replaced handles and reads Reanimated's throwing dev guard.
  const bodyStyle = useAnimatedStyle(() => {
    if (sleeping) {
      const breath = sleepBreath.value;
      return {
        transform: [
          { scaleX: 1 + breath * 0.012 },
          { scaleY: 1 + breath * 0.024 },
        ],
      };
    }
    if (!active || reducedMotion) return { transform: [{ translateY: 0 }] };
    const phase = progress.value * Math.PI * 2;
    const amplitude = Math.min(size * 0.007, 1.6);
    const strength = homeMovement ? (walking ? 0.55 : 1) : 0.35;
    return {
      transform: [{ translateY: Math.sin(phase) * amplitude * strength }],
    };
  });

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${species.name}, ${sleeping ? 'đang ngủ' : STAGE_LABEL[stage]}`}
      style={[styles.canvas, { width: size, height: size }]}
    >
      <View style={[styles.fill, { transform: [{ scale: look.scale }] }]}>
        {look.aura && (
          <View
            pointerEvents="none"
            style={[
              styles.aura,
              {
                left: size * 0.16,
                top: size * 0.16,
                width: size * 0.68,
                height: size * 0.68,
                borderRadius: size * 0.34,
                borderColor: species.palette[2],
              },
            ]}
          />
        )}
        <Animated.View style={[styles.sprite, bodyStyle]}>
          <PixelPetAtlas
            key={
              dragAtlasReady
                ? 'drag-atlas'
                : sleeping
                ? 'sleep-transition'
                : homeMovement
                  ? walking
                    ? 'ground-run'
                    : `flight-${flightPhase ?? 'loop'}`
                  : 'default'
            }
            source={atlasSource}
            size={atlasSize}
            clip={clip}
            progress={progress}
            loopMovement={loopMovement}
            animating={
              sleeping
                ? active && !reducedMotion
                : !dragLanding && playbackActive && !reducedMotion
            }
            columns={atlasLayout.columns}
            rows={atlasLayout.rows}
            frameTrack={frameTrack}
            staticFrame={
              dragAtlasReady && (!active || reducedMotion) && dragAtlasTrack
                ? dragAtlasTrack[dragAtlasTrack.length - 1]
                : dragLanding
                  ? CELESTIAL_STAG_LANDING_FRAMES[
                      CELESTIAL_STAG_LANDING_FRAMES.length - 1
                    ]
                : sleeping && reducedMotion
                  ? 15
                  : groundStopped
                    ? 0
                    : undefined
            }
            loop={sleeping ? false : playback.loop}
            blendFrames={false}
            fallback={
              <Image
                source={PET_ART.celestial_stag}
                style={styles.art}
                resizeMode="contain"
              />
            }
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { overflow: 'visible' },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sprite: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  aura: { position: 'absolute', borderWidth: 2, opacity: 0.5 },
  art: { width: '100%', height: '100%' },
});
