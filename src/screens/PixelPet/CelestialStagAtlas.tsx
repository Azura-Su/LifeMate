import { useEffect } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
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
  CELESTIAL_STAG_LV12_HOP_DURATION_MS,
  CELESTIAL_STAG_LV12_SLEEP_DURATION_MS,
  CELESTIAL_STAG_LV12_HOP_FRAMES,
  CELESTIAL_STAG_LV12_RUN_FRAMES,
  CELESTIAL_STAG_LV12_SETTLE_FRAMES,
  CELESTIAL_STAG_LV12_SLEEP_FRAMES,
  CELESTIAL_STAG_LV12_WALK_FRAMES,
  CELESTIAL_STAG_HOME_PHASE_DURATION,
  CELESTIAL_STAG_FLAP_CYCLE_MS,
  CELESTIAL_STAG_LV34_TAKEOFF_FRAMES,
  CELESTIAL_STAG_LV34_FLAP_FRAMES,
  CELESTIAL_STAG_LV34_GLIDE_FRAMES,
  CELESTIAL_STAG_LV34_LANDING_FRAMES,
  CELESTIAL_STAG_LV34_SETTLE_FRAMES,
  CELESTIAL_STAG_LV34_SLEEP_FRAMES,
  celestialStagLevelLookScale,
  CELESTIAL_STAG_LV1314_WALK_FRAMES,
  CELESTIAL_STAG_LV1314_TAKEOFF_FRAMES,
  CELESTIAL_STAG_LV1314_FLAP_FRAMES,
  CELESTIAL_STAG_LV1314_GLIDE_FRAMES,
  CELESTIAL_STAG_LV1314_LANDING_FRAMES,
  CELESTIAL_STAG_LV1314_SETTLE_FRAMES,
  CELESTIAL_STAG_LV1314_SLEEP_FRAMES,
  CELESTIAL_STAG_LV1516_WALK_FRAMES,
  CELESTIAL_STAG_LV1516_RUN_FRAMES,
  CELESTIAL_STAG_LV1516_SETTLE_FRAMES,
  CELESTIAL_STAG_LV1516_SLEEP_FRAMES,
  CELESTIAL_STAG_LV1516_TAKEOFF_FRAMES,
  CELESTIAL_STAG_LV1516_FLAP_FRAMES,
  CELESTIAL_STAG_LV1516_GLIDE_FRAMES,
  CELESTIAL_STAG_LV1516_LANDING_FRAMES,
  isCelestialStagLevel1516,
  CELESTIAL_STAG_LV1718_WALK_FRAMES,
  CELESTIAL_STAG_LV1718_RUN_FRAMES,
  CELESTIAL_STAG_LV1718_SETTLE_FRAMES,
  CELESTIAL_STAG_LV1718_SLEEP_FRAMES,
  CELESTIAL_STAG_LV1718_TAKEOFF_FRAMES,
  CELESTIAL_STAG_LV1718_FLAP_FRAMES,
  CELESTIAL_STAG_LV1718_GLIDE_FRAMES,
  CELESTIAL_STAG_LV1718_LANDING_FRAMES,
  isCelestialStagLevel1718,
  CELESTIAL_STAG_LV78_WALK_FRAMES,
  CELESTIAL_STAG_LV78_RUN_FRAMES,
  CELESTIAL_STAG_LV78_TAKEOFF_FRAMES,
  CELESTIAL_STAG_LV78_FLAP_FRAMES,
  CELESTIAL_STAG_LV78_GLIDE_FRAMES,
  CELESTIAL_STAG_LV78_LANDING_FRAMES,
  CELESTIAL_STAG_LV78_SETTLE_FRAMES,
  CELESTIAL_STAG_LV78_SLEEP_FRAMES,
  CELESTIAL_STAG_LV910_WALK_FRAMES,
  CELESTIAL_STAG_LV910_RUN_FRAMES,
  CELESTIAL_STAG_LV910_SETTLE_FRAMES,
  CELESTIAL_STAG_LV910_SLEEP_FRAMES,
  CELESTIAL_STAG_LV910_TAKEOFF_FRAMES,
  CELESTIAL_STAG_LV910_FLAP_FRAMES,
  CELESTIAL_STAG_LV910_GLIDE_FRAMES,
  CELESTIAL_STAG_LV910_LANDING_FRAMES,
  isCelestialStagLevel910,
  isCelestialStagLevel78,
  isCelestialStagLevel1314,
  isCelestialStagLevel1920,
  CELESTIAL_STAG_LV1920_WALK_FRAMES,
  CELESTIAL_STAG_LV1920_RUN_FRAMES,
  CELESTIAL_STAG_LV1920_TAKEOFF_FRAMES,
  CELESTIAL_STAG_LV1920_FLAP_FRAMES,
  CELESTIAL_STAG_LV1920_GLIDE_FRAMES,
  CELESTIAL_STAG_LV1920_LANDING_FRAMES,
  CELESTIAL_STAG_LV1920_SETTLE_FRAMES,
  CELESTIAL_STAG_LV1920_SLEEP_FRAMES,
  celestialStagFlightPlayback,
  CELESTIAL_STAG_DRAG_FLIGHT_TRACKS,
  CELESTIAL_STAG_LV12_DRAG_TRACKS,
  CELESTIAL_STAG_LV1718_DRAG_TRACKS,
  CELESTIAL_STAG_LV910_DRAG_TRACKS,
  type CelestialStagDragPhase,
  type CelestialStagFlightPhase,
  type CelestialStagHomePhase,
} from '../../services/pixelPet/celestialStagAtlas';
import { CELESTIAL_STAG_ID, puppetPlayback } from '../../services/pixelPet/celestialStagPuppet';
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
  CELESTIAL_STAG_LV12_HOP_ATLAS,
  CELESTIAL_STAG_LV12_RUN_ATLAS,
  CELESTIAL_STAG_LV12_SLEEP_ATLAS,
  CELESTIAL_STAG_LV12_WALK_ATLAS,
  CELESTIAL_STAG_LV34_WALK_ATLAS,
  CELESTIAL_STAG_LV34_RUN_ATLAS,
  CELESTIAL_STAG_LV34_FLIGHT_ATLAS,
  CELESTIAL_STAG_LV34_SLEEP_ATLAS,
  CELESTIAL_STAG_LV1314_WALK_ATLAS,
  CELESTIAL_STAG_LV1314_FLIGHT_ATLAS,
  CELESTIAL_STAG_LV1314_SLEEP_ATLAS,
  CELESTIAL_STAG_LV1516_WALK_ATLAS,
  CELESTIAL_STAG_LV1516_RUN_ATLAS,
  CELESTIAL_STAG_LV1516_FLIGHT_ATLAS,
  CELESTIAL_STAG_LV1516_SLEEP_ATLAS,
  CELESTIAL_STAG_LV1718_WALK_ATLAS,
  CELESTIAL_STAG_LV1718_RUN_ATLAS,
  CELESTIAL_STAG_LV1718_SLEEP_ATLAS,
  CELESTIAL_STAG_LV1718_FLIGHT_ATLAS,
  CELESTIAL_STAG_LV56_WALK_ATLAS,
  CELESTIAL_STAG_LV56_RUN_ATLAS,
  CELESTIAL_STAG_LV56_FLIGHT_ATLAS,
  CELESTIAL_STAG_LV56_SLEEP_ATLAS,
  CELESTIAL_STAG_LV1112_WALK_ATLAS,
  CELESTIAL_STAG_LV1112_RUN_ATLAS,
  CELESTIAL_STAG_LV1112_FLIGHT_ATLAS,
  CELESTIAL_STAG_LV1112_SLEEP_ATLAS,
  CELESTIAL_STAG_LV1920_WALK_ATLAS,
  CELESTIAL_STAG_LV1920_RUN_ATLAS,
  CELESTIAL_STAG_LV1920_FLIGHT_ATLAS,
  CELESTIAL_STAG_LV1920_SLEEP_ATLAS,
  CELESTIAL_STAG_LV78_WALK_ATLAS,
  CELESTIAL_STAG_LV78_RUN_ATLAS,
  CELESTIAL_STAG_LV78_FLIGHT_ATLAS,
  CELESTIAL_STAG_LV78_SLEEP_ATLAS,
  CELESTIAL_STAG_LV910_WALK_ATLAS,
  CELESTIAL_STAG_LV910_RUN_ATLAS,
  CELESTIAL_STAG_LV910_FLIGHT_ATLAS,
  CELESTIAL_STAG_LV910_SLEEP_ATLAS,
  PET_DRAG_ATLASES,
  PET_DRAG_ATLAS_READY,
  PET_ART,
} from './petArt';
import { PixelPetAtlas } from './PixelPetAtlas';
import { usePetPlayback } from './usePetPlayback';

/** Levels with a complete walk/run/flight/sleep set on the shared track layout. */
function celestialStagFullSet(level?: number) {
  if (level === 5 || level === 6)
    return { walk: CELESTIAL_STAG_LV56_WALK_ATLAS, run: CELESTIAL_STAG_LV56_RUN_ATLAS, flight: CELESTIAL_STAG_LV56_FLIGHT_ATLAS, sleep: CELESTIAL_STAG_LV56_SLEEP_ATLAS };
  if (level === 11 || level === 12)
    return { walk: CELESTIAL_STAG_LV1112_WALK_ATLAS, run: CELESTIAL_STAG_LV1112_RUN_ATLAS, flight: CELESTIAL_STAG_LV1112_FLIGHT_ATLAS, sleep: CELESTIAL_STAG_LV1112_SLEEP_ATLAS };
  if (isCelestialStagLevel1920(level))
    return { walk: CELESTIAL_STAG_LV1920_WALK_ATLAS, run: CELESTIAL_STAG_LV1920_RUN_ATLAS, flight: CELESTIAL_STAG_LV1920_FLIGHT_ATLAS, sleep: CELESTIAL_STAG_LV1920_SLEEP_ATLAS };
  return undefined;
}

/** The held/released Stag keeps its own level's art instead of the shared drag sheet. */
function celestialStagLevelDragArt(level?: number) {
  if (level === undefined) return undefined;
  const flight = (
    source: ImageSourcePropType,
    tracks = CELESTIAL_STAG_DRAG_FLIGHT_TRACKS,
    landing: readonly number[] = [12, 13, 14, 15],
  ) => ({ kind: 'flight' as const, source, tracks, landing, cycleMs: CELESTIAL_STAG_FLAP_CYCLE_MS });
  if (level <= 2)
    return { kind: 'hop' as const, source: CELESTIAL_STAG_LV12_HOP_ATLAS, tracks: CELESTIAL_STAG_LV12_DRAG_TRACKS, landing: [], cycleMs: 600 };
  if (level <= 4) return flight(CELESTIAL_STAG_LV34_FLIGHT_ATLAS);
  if (isCelestialStagLevel78(level)) return flight(CELESTIAL_STAG_LV78_FLIGHT_ATLAS);
  if (isCelestialStagLevel910(level))
    return flight(CELESTIAL_STAG_LV910_FLIGHT_ATLAS, CELESTIAL_STAG_LV910_DRAG_TRACKS);
  if (isCelestialStagLevel1314(level)) return flight(CELESTIAL_STAG_LV1314_FLIGHT_ATLAS);
  if (isCelestialStagLevel1516(level)) return flight(CELESTIAL_STAG_LV1516_FLIGHT_ATLAS);
  if (isCelestialStagLevel1718(level))
    return flight(
      CELESTIAL_STAG_LV1718_FLIGHT_ATLAS,
      CELESTIAL_STAG_LV1718_DRAG_TRACKS,
      CELESTIAL_STAG_LV1718_LANDING_FRAMES,
    );
  const fullSet = celestialStagFullSet(level);
  return fullSet ? flight(fullSet.flight) : undefined;
}

/** Standing (walk frame 0) and sleeping art for each authored level. */
function celestialStagLevelRestArt(level: number) {
  const sleepLoop = [12, 13, 14, 15];
  if (level <= 2) return { stand: CELESTIAL_STAG_LV12_WALK_ATLAS, sleep: CELESTIAL_STAG_LV12_SLEEP_ATLAS, sleepLoop };
  if (level <= 4) return { stand: CELESTIAL_STAG_LV34_WALK_ATLAS, sleep: CELESTIAL_STAG_LV34_SLEEP_ATLAS, sleepLoop };
  if (isCelestialStagLevel78(level)) return { stand: CELESTIAL_STAG_LV78_WALK_ATLAS, sleep: CELESTIAL_STAG_LV78_SLEEP_ATLAS, sleepLoop };
  if (isCelestialStagLevel910(level)) return { stand: CELESTIAL_STAG_LV910_WALK_ATLAS, sleep: CELESTIAL_STAG_LV910_SLEEP_ATLAS, sleepLoop };
  if (isCelestialStagLevel1314(level)) return { stand: CELESTIAL_STAG_LV1314_WALK_ATLAS, sleep: CELESTIAL_STAG_LV1314_SLEEP_ATLAS, sleepLoop };
  if (isCelestialStagLevel1516(level)) return { stand: CELESTIAL_STAG_LV1516_WALK_ATLAS, sleep: CELESTIAL_STAG_LV1516_SLEEP_ATLAS, sleepLoop };
  if (isCelestialStagLevel1718(level))
    return { stand: CELESTIAL_STAG_LV1718_WALK_ATLAS, sleep: CELESTIAL_STAG_LV1718_SLEEP_ATLAS, sleepLoop: CELESTIAL_STAG_LV1718_SLEEP_FRAMES };
  const fullSet = celestialStagFullSet(level)!;
  return { stand: fullSet.walk, sleep: fullSet.sleep, sleepLoop };
}

/**
 * Off-Home (care and admin detail screens) the Stag keeps its level's art:
 * resting lies down breathing, the buttons reuse that level's flight, hop or
 * gallop poses, and anything else stands on its walk pose.
 */
function celestialStagLevelDetailArt(
  level: number | undefined,
  clip: PixelPetAnyClipId,
  sleeping: boolean,
): { source: ImageSourcePropType; frames: readonly number[] } | undefined {
  const motion = celestialStagLevelDragArt(level);
  if (!motion || level === undefined) return undefined;
  const rest = celestialStagLevelRestArt(level);
  if (sleeping) return { source: rest.sleep, frames: rest.sleepLoop };
  const flight = motion.kind === 'flight';
  const leap = flight
    ? [0, 1, 2, 3, ...motion.landing]
    : Array.from({ length: 16 }, (_, frame) => frame);
  const frames: Partial<Record<PixelPetAnyClipId, readonly number[]>> = {
    happy: leap,
    prance: leap,
    move: motion.tracks.lifted,
    flap: motion.tracks.lifted,
    blaze: motion.tracks.lifted,
    fly: flight
      ? [4, 5, 6, 7, 4, 5, 6, 7, 4, 5, 6, 7, 8, 9, 10, 11]
      : motion.tracks.lifted,
    spin: flight
      ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, ...motion.landing]
      : leap,
  };
  // The signature skill shows the whole flight rather than a still pose.
  frames.skill = frames.spin;
  return frames[clip]
    ? { source: motion.source, frames: frames[clip] }
    : { source: rest.stand, frames: [0] };
}

/**
 * Identifies the motion a detail-screen button plays for this level, so
 * buttons that would replay the same frames can be shown once. Undefined when
 * the level has no authored art (every legacy clip is distinct).
 */
export function celestialStagDetailMotionKey(
  level: number | undefined,
  clip: PixelPetAnyClipId,
): string | undefined {
  const art = celestialStagLevelDetailArt(level, clip, false);
  if (!art) return undefined;
  const motion = celestialStagLevelDragArt(level);
  return `${art.source === motion?.source ? 'motion' : 'stand'}:${art.frames.join(',')}`;
}

type Props = {
  species: PixelPetSpecies;
  stage: PixelPetStage;
  level?: number;
  homeStagPhase?: CelestialStagHomePhase;
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

/** Packed hooves sit on y=287 of a 320px cell: 0.4 of the canvas below its centre. */
const HOOF_LINE_FROM_CENTER = 288 / 320 - 0.5;
/**
 * Home's ground line (the tab bar's top edge) below the centre of the Stag's
 * box, as a fraction of the box: HomePetRoamer lays the fitted box at
 * `height - petSize * 0.81`, so the container's bottom
 * edge falls at 0.81 × SIZE inside it.
 */
export const CELESTIAL_STAG_HOME_GROUND_FROM_CENTER = 0.81 - 0.5;

const STAGE_LABEL = {
  hatchling: 'ấu thể',
  juvenile: 'trưởng thành',
  ascended: 'thăng hoa',
} as const;

export function CelestialStagAtlas({
  species,
  stage,
  level,
  homeStagPhase,
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
  const levelDrag =
    species.id === CELESTIAL_STAG_ID && !sleeping && dragPhase !== 'roam' && dragPhase !== 'fall'
      ? celestialStagLevelDragArt(level)
      : undefined;
  const levelDragTrack = levelDrag?.tracks[dragPhase as CelestialStagDragPhase];
  const levelDetail =
    species.id === CELESTIAL_STAG_ID && homeStagPhase === undefined && dragPhase === 'roam'
      ? celestialStagLevelDetailArt(level, clip, sleeping)
      : undefined;
  const levelDetailActive = !!levelDetail;
  const levelDragPlayback = !levelDrag
    ? undefined
    : dragPhase === 'lifted' || dragPhase === 'circle'
      ? { durationMs: levelDrag.cycleMs, loop: true }
      : { durationMs: petDragDurationMs(dragPhase, fallStyle, false), loop: false };
  const dragAtlasReady =
    !levelDrag &&
    !sleeping &&
    (dragPhase === 'lifted' || dragPhase === 'descend') &&
    PET_DRAG_ATLAS_READY.celestial_stag &&
    !!PET_DRAG_ATLASES.celestial_stag &&
    !!dragAtlasTrack;
  const homeMovement = loopMovement && (clip === 'move' || clip === 'fly');
  const lv12HomeMotion =
    species.id === CELESTIAL_STAG_ID &&
    (level ?? Number.POSITIVE_INFINITY) <= 2 &&
    homeStagPhase !== undefined &&
    dragPhase === 'roam';
  const lv34 = level !== undefined && level >= 3 && level <= 4;
  const lv34HomeMotion = lv34 && homeStagPhase !== undefined && dragPhase === 'roam';
  const lv1314 = species.id === CELESTIAL_STAG_ID && isCelestialStagLevel1314(level);
  const lv1314HomeMotion = lv1314 && homeStagPhase !== undefined && dragPhase === 'roam';
  const lv1516 = species.id === CELESTIAL_STAG_ID && isCelestialStagLevel1516(level);
  const lv1718 = species.id === CELESTIAL_STAG_ID && isCelestialStagLevel1718(level);
  const lv1718HomeMotion = lv1718 && homeStagPhase !== undefined && dragPhase === 'roam';
  const lv1718GroundMotion =
    lv1718HomeMotion &&
    ['runA', 'walkToFlight', 'walkAfterLanding', 'runB'].includes(homeStagPhase);
  const lv1516HomeMotion = lv1516 && homeStagPhase !== undefined && dragPhase === 'roam';
  const lv1516FlightMotion = lv1516HomeMotion && ['takeoff', 'flap', 'glide', 'landing'].includes(homeStagPhase ?? '');
  const lv1516WalkMotion = lv1516HomeMotion && !lv1516FlightMotion && pace === 'walk' && homeStagPhase !== 'settle' && homeStagPhase !== 'sleep';
  const lv1516RunMotion = lv1516HomeMotion && !lv1516FlightMotion && pace !== 'walk' && homeStagPhase !== 'settle' && homeStagPhase !== 'sleep';
  const fullSet = celestialStagFullSet(level);
  const fullSetGroundMotion =
    species.id === CELESTIAL_STAG_ID &&
    !!fullSet &&
    ['runA', 'walkToFlight', 'walkAfterLanding', 'runB'].includes(homeStagPhase ?? '') &&
    dragPhase === 'roam';
  const fullSetRestMotion =
    species.id === CELESTIAL_STAG_ID &&
    !!fullSet &&
    (homeStagPhase === 'settle' || homeStagPhase === 'sleep') &&
    dragPhase === 'roam';
  const fullSetFlightMotion =
    species.id === CELESTIAL_STAG_ID &&
    !!fullSet &&
    ['takeoff', 'flap', 'glide', 'landing'].includes(homeStagPhase ?? '') &&
    dragPhase === 'roam';
  const fullSetFlightTrack = homeStagPhase === 'takeoff'
    ? CELESTIAL_STAG_LV1920_TAKEOFF_FRAMES
    : homeStagPhase === 'flap'
      ? CELESTIAL_STAG_LV1920_FLAP_FRAMES
      : homeStagPhase === 'glide'
        ? CELESTIAL_STAG_LV1920_GLIDE_FRAMES
        : CELESTIAL_STAG_LV1920_LANDING_FRAMES;
  const lv1314FlightMotion = lv1314HomeMotion && ['takeoff', 'flap', 'glide', 'landing'].includes(homeStagPhase ?? '');
  // No Lv13–14 run atlas: its walk loop also drives the run pace, faster,
  // rather than switching to the legacy ground art of a different design.
  const lv1314WalkMotion = lv1314HomeMotion && !lv1314FlightMotion && homeStagPhase !== 'settle' && homeStagPhase !== 'sleep';
  const lv1314RestMotion = lv1314HomeMotion && (homeStagPhase === 'settle' || homeStagPhase === 'sleep');
  const lv1314Settle = lv1314RestMotion && homeStagPhase === 'settle';
  const lv1314RestPlayback = lv1314Settle
    ? { durationMs: CELESTIAL_STAG_HOME_PHASE_DURATION.settle, loop: false }
    : undefined;
  const lv1314FlightTrack = homeStagPhase === 'takeoff'
    ? CELESTIAL_STAG_LV1314_TAKEOFF_FRAMES
    : homeStagPhase === 'glide'
      ? CELESTIAL_STAG_LV1314_GLIDE_FRAMES
      : homeStagPhase === 'landing'
        ? CELESTIAL_STAG_LV1314_LANDING_FRAMES
        : CELESTIAL_STAG_LV1314_FLAP_FRAMES;
  const lv1314FlightPlayback = !lv1314FlightMotion ? undefined : homeStagPhase === 'flap'
    ? { durationMs: CELESTIAL_STAG_FLAP_CYCLE_MS * 4, loop: true }
    : { durationMs: CELESTIAL_STAG_HOME_PHASE_DURATION[homeStagPhase!], loop: false };
  const lv1516FlightTrack = homeStagPhase === 'takeoff'
    ? CELESTIAL_STAG_LV1516_TAKEOFF_FRAMES
    : homeStagPhase === 'glide'
      ? CELESTIAL_STAG_LV1516_GLIDE_FRAMES
      : homeStagPhase === 'landing'
        ? CELESTIAL_STAG_LV1516_LANDING_FRAMES
        : CELESTIAL_STAG_LV1516_FLAP_FRAMES;
  const lv1516FlightPlayback = !lv1516FlightMotion ? undefined : homeStagPhase === 'flap'
    ? { durationMs: CELESTIAL_STAG_FLAP_CYCLE_MS * 4, loop: true }
    : { durationMs: CELESTIAL_STAG_HOME_PHASE_DURATION[homeStagPhase!], loop: false };
  const lv78HomeMotion = isCelestialStagLevel78(level) && homeStagPhase !== undefined && dragPhase === 'roam';
  const lv910HomeMotion = species.id === CELESTIAL_STAG_ID && isCelestialStagLevel910(level) && homeStagPhase !== undefined && dragPhase === 'roam';
  const lv910FlightMotion = lv910HomeMotion && ['takeoff', 'flap', 'glide', 'landing'].includes(homeStagPhase ?? '');
  const lv12FrameTrack = !lv12HomeMotion
    ? undefined
    : homeStagPhase === 'takeoff'
      ? CELESTIAL_STAG_LV12_HOP_FRAMES
      : homeStagPhase === 'settle'
        ? CELESTIAL_STAG_LV12_SETTLE_FRAMES
        : homeStagPhase === 'sleep'
          ? CELESTIAL_STAG_LV12_SLEEP_FRAMES
          : pace === 'walk'
            ? CELESTIAL_STAG_LV12_WALK_FRAMES
            : CELESTIAL_STAG_LV12_RUN_FRAMES;
  const lv12AtlasSource = !lv12HomeMotion
    ? undefined
    : homeStagPhase === 'takeoff'
      ? CELESTIAL_STAG_LV12_HOP_ATLAS
      : homeStagPhase === 'settle' || homeStagPhase === 'sleep'
        ? CELESTIAL_STAG_LV12_SLEEP_ATLAS
        : pace === 'walk'
          ? CELESTIAL_STAG_LV12_WALK_ATLAS
          : CELESTIAL_STAG_LV12_RUN_ATLAS;
  const lv12Playback = !lv12HomeMotion
    ? undefined
    : homeStagPhase === 'takeoff'
      ? { durationMs: CELESTIAL_STAG_LV12_HOP_DURATION_MS, loop: false }
      : homeStagPhase === 'settle'
        ? {
            durationMs: CELESTIAL_STAG_HOME_PHASE_DURATION.settle,
            loop: false,
          }
        : homeStagPhase === 'sleep'
          ? { durationMs: CELESTIAL_STAG_LV12_SLEEP_DURATION_MS, loop: true }
          : {
              durationMs:
                gaitCycleDurationMs ?? (pace === 'walk' ? 800 : 500),
              loop: true,
            };
  const dragLanding =
    !levelDrag &&
    !sleeping &&
    dragPhase === 'land' &&
    flightPhase === 'landing' &&
    homeMovement;
  const lv78FlightTrack = flightPhase === 'takeoff'
    ? CELESTIAL_STAG_LV78_TAKEOFF_FRAMES
    : flightPhase === 'landing'
      ? CELESTIAL_STAG_LV78_LANDING_FRAMES
      : flightPhase === 'glide'
        ? CELESTIAL_STAG_LV78_GLIDE_FRAMES
        : CELESTIAL_STAG_LV78_FLAP_FRAMES;
  const lv910FlightTrack = homeStagPhase === 'takeoff'
    ? CELESTIAL_STAG_LV910_TAKEOFF_FRAMES
    : homeStagPhase === 'landing'
      ? CELESTIAL_STAG_LV910_LANDING_FRAMES
      : homeStagPhase === 'glide'
        ? CELESTIAL_STAG_LV910_GLIDE_FRAMES
        : CELESTIAL_STAG_LV910_FLAP_FRAMES;
  const lv910FlightPlayback = !lv910FlightMotion
    ? undefined
    : homeStagPhase === 'flap'
      ? { durationMs: CELESTIAL_STAG_FLAP_CYCLE_MS * 4, loop: true }
      : { durationMs: CELESTIAL_STAG_HOME_PHASE_DURATION[homeStagPhase!], loop: false };
  const flightTrack = lv910FlightMotion
    ? lv910FlightTrack
    : lv78HomeMotion
    ? lv78FlightTrack
    : lv34HomeMotion
    ? flightPhase === 'takeoff'
      ? CELESTIAL_STAG_LV34_TAKEOFF_FRAMES
      : flightPhase === 'landing'
        ? CELESTIAL_STAG_LV34_LANDING_FRAMES
        : flightPhase === 'glide'
          ? CELESTIAL_STAG_LV34_GLIDE_FRAMES
          : CELESTIAL_STAG_LV34_FLAP_FRAMES
    : flightPhase === 'takeoff'
      ? CELESTIAL_STAG_TAKEOFF_FRAMES
      : flightPhase === 'landing'
        ? CELESTIAL_STAG_LANDING_FRAMES
        : flightPhase === 'glide'
          ? CELESTIAL_STAG_GLIDE_FRAMES
          : CELESTIAL_STAG_FLAP_FRAMES;
  const playback =
    levelDragPlayback ??
    (dragAtlasReady
      ? {
          durationMs: petDragDurationMs(dragPhase, fallStyle, false),
          loop: false,
        }
      : null) ??
    (lv34HomeMotion && homeStagPhase === 'settle'
      ? { durationMs: 2420, loop: false }
      : null) ??
    (lv78HomeMotion && homeStagPhase === 'settle'
      ? { durationMs: CELESTIAL_STAG_HOME_PHASE_DURATION.settle, loop: false }
      : null) ??
    (lv910HomeMotion && homeStagPhase === 'settle'
      ? { durationMs: CELESTIAL_STAG_HOME_PHASE_DURATION.settle, loop: false }
      : null) ??
    (lv910FlightPlayback ? lv910FlightPlayback : null) ??
    (fullSetRestMotion && homeStagPhase === 'settle'
      ? { durationMs: CELESTIAL_STAG_HOME_PHASE_DURATION.settle, loop: false }
      : null) ??
    (lv1718HomeMotion && homeStagPhase === 'settle'
      ? { durationMs: CELESTIAL_STAG_HOME_PHASE_DURATION.settle, loop: false }
      : null) ??
    (lv1516HomeMotion && homeStagPhase === 'settle'
      ? { durationMs: CELESTIAL_STAG_HOME_PHASE_DURATION.settle, loop: false }
      : null) ??
    (lv1314FlightPlayback
      ? lv1314FlightPlayback
      : null) ??
    (lv1314RestPlayback ? lv1314RestPlayback : null) ??
    (lv1516FlightPlayback
      ? lv1516FlightPlayback
      : null) ??
    (lv1314WalkMotion
      ? { durationMs: gaitCycleDurationMs ?? (pace === 'walk' ? 800 : 500), loop: true }
      : null) ??
    (lv1516WalkMotion
      ? { durationMs: gaitCycleDurationMs ?? 800, loop: true }
      : null) ??
    (lv1516RunMotion
      ? { durationMs: gaitCycleDurationMs ?? 500, loop: true }
      : null) ??
    (dragLanding
      ? { durationMs: petDragDurationMs('land', fallStyle, false), loop: false }
      : null) ??
    lv12Playback ??
    (expressionPlayback
      ? { durationMs: expressionPlayback.durationMs, loop: false }
      : null) ??
    (homeMovement
      ? walking
        ? {
            durationMs: gaitCycleDurationMs ?? (pace === 'walk' ? 1100 : 520),
            loop: true,
          }
        : celestialStagFlightPlayback(flightPhase, clip, level)
      : puppetPlayback(clip, loopMovement, walking));
  // Zero distance this phase: stand on frame 0 rather than looping a 0ms gait.
  const groundStopped = homeMovement && walking && gaitCycleDurationMs === 0;
  const playbackActive =
    active && !sleeping && !groundStopped && (!!levelDrag || lv12HomeMotion || lv34HomeMotion || lv1314HomeMotion || lv1516HomeMotion || lv1718HomeMotion || lv78HomeMotion || lv910HomeMotion || fullSetGroundMotion || fullSetFlightMotion || fullSetRestMotion || gaitCycleDurationMs !== 0);
  const playbackClockActive =
    active && !(groundStopped && !sleeping) && (sleeping || !!levelDrag || lv12HomeMotion || lv34HomeMotion || lv1314HomeMotion || lv1516HomeMotion || lv1718HomeMotion || lv78HomeMotion || lv910HomeMotion || fullSetGroundMotion || fullSetFlightMotion || fullSetRestMotion || gaitCycleDurationMs !== 0);
  const { progress, reducedMotion } = usePetPlayback({
    clip,
    speciesId: species.id,
    active: playbackClockActive,
    loopMovement,
    onClipEnd: sleeping ? undefined : onClipEnd,
    playback:
      lv12Playback ?? (sleeping ? { durationMs: 2000, loop: true } : playback),
    playbackKey:
      dragPhase === 'roam'
      ? lv12HomeMotion || lv34HomeMotion || lv1314HomeMotion || lv1516HomeMotion || lv1718HomeMotion || lv78HomeMotion || lv910HomeMotion || fullSetGroundMotion || fullSetFlightMotion || fullSetRestMotion
          ? homeStagPhase
          : undefined
        : dragPhase,
    preserveProgressWhenInactive: sleeping,
  });
  const sleepBreath = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(sleepBreath);
    sleepBreath.value = 0;
    if (sleeping && !levelDetailActive && !lv12HomeMotion && !lv34HomeMotion && !lv1314HomeMotion && !lv1516HomeMotion && !lv1718HomeMotion && !lv78HomeMotion && !lv910HomeMotion && !fullSetRestMotion && active && !reducedMotion) {
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
  }, [active, levelDetailActive, lv12HomeMotion, lv34HomeMotion, lv1314HomeMotion, lv1516HomeMotion, lv1718HomeMotion, lv78HomeMotion, lv910HomeMotion, fullSetRestMotion, reducedMotion, sleeping, sleepBreath]);
  // Size follows the level wherever it is known (Home, dragging, details).
  const levelScale = celestialStagLevelLookScale(level);
  const look =
    levelScale === undefined
      ? STAGE_LOOK[stage]
      : { ...STAGE_LOOK[stage], scale: levelScale };
  const lv12RestPose =
    (lv12HomeMotion || lv34HomeMotion || lv1314HomeMotion || lv1516HomeMotion || lv1718HomeMotion || lv78HomeMotion || lv910HomeMotion || fullSetRestMotion) &&
    (homeStagPhase === 'settle' || homeStagPhase === 'sleep');
  // Lifting swaps the clip to 'happy'; keep the roaming canvas so it doesn't shrink.
  const atlasSize =
    (homeMovement || levelDrag) && !sleeping && !lv12RestPose
      ? size * motionCanvasScale
      : size;
  const lv34Frames = Array.from({ length: 16 }, (_, index) => index);
  const frameTrack = levelDragTrack ?? levelDetail?.frames ?? lv12FrameTrack ?? (fullSetFlightMotion
    ? fullSetFlightTrack
    : lv1718GroundMotion
    ? pace === 'walk' ? CELESTIAL_STAG_LV1718_WALK_FRAMES : CELESTIAL_STAG_LV1718_RUN_FRAMES
    : lv1718HomeMotion
    ? homeStagPhase === 'settle'
      ? CELESTIAL_STAG_LV1718_SETTLE_FRAMES
      : homeStagPhase === 'sleep'
        ? CELESTIAL_STAG_LV1718_SLEEP_FRAMES
        : homeStagPhase === 'takeoff'
          ? CELESTIAL_STAG_LV1718_TAKEOFF_FRAMES
          : homeStagPhase === 'glide'
            ? CELESTIAL_STAG_LV1718_GLIDE_FRAMES
            : homeStagPhase === 'landing'
              ? CELESTIAL_STAG_LV1718_LANDING_FRAMES
              : CELESTIAL_STAG_LV1718_FLAP_FRAMES
    : fullSetRestMotion
    ? homeStagPhase === 'settle' ? CELESTIAL_STAG_LV1920_SETTLE_FRAMES : CELESTIAL_STAG_LV1920_SLEEP_FRAMES
    : fullSetGroundMotion
    ? pace === 'walk' ? CELESTIAL_STAG_LV1920_WALK_FRAMES : CELESTIAL_STAG_LV1920_RUN_FRAMES
    : lv910HomeMotion
    ? lv910FlightMotion ? lv910FlightTrack
      : homeStagPhase === 'settle' ? CELESTIAL_STAG_LV910_SETTLE_FRAMES
        : homeStagPhase === 'sleep' || sleeping ? CELESTIAL_STAG_LV910_SLEEP_FRAMES
          : pace === 'walk' ? CELESTIAL_STAG_LV910_WALK_FRAMES : CELESTIAL_STAG_LV910_RUN_FRAMES
    : lv78HomeMotion
    ? sleeping || homeStagPhase === 'sleep'
      ? CELESTIAL_STAG_LV78_SLEEP_FRAMES
      : homeStagPhase === 'settle'
        ? CELESTIAL_STAG_LV78_SETTLE_FRAMES
        : homeStagPhase === 'takeoff' || homeStagPhase === 'flap' || homeStagPhase === 'glide' || homeStagPhase === 'landing'
          ? lv78FlightTrack
          : pace === 'walk'
            ? CELESTIAL_STAG_LV78_WALK_FRAMES
            : CELESTIAL_STAG_LV78_RUN_FRAMES
    : lv1314FlightMotion
    ? lv1314FlightTrack
    : lv1516FlightMotion
    ? lv1516FlightTrack
    : lv1516WalkMotion
    ? CELESTIAL_STAG_LV1516_WALK_FRAMES
    : lv1516RunMotion
    ? CELESTIAL_STAG_LV1516_RUN_FRAMES
    : lv1516HomeMotion && homeStagPhase === 'settle'
    ? CELESTIAL_STAG_LV1516_SETTLE_FRAMES
    : lv1516HomeMotion && homeStagPhase === 'sleep'
    ? CELESTIAL_STAG_LV1516_SLEEP_FRAMES
    : lv1314WalkMotion
    ? CELESTIAL_STAG_LV1314_WALK_FRAMES
    : lv1314Settle
      ? CELESTIAL_STAG_LV1314_SETTLE_FRAMES
      : lv1314RestMotion
        ? homeStagPhase === 'settle'
          ? CELESTIAL_STAG_LV1314_SETTLE_FRAMES
          : CELESTIAL_STAG_LV1314_SLEEP_FRAMES
        : (
    sleeping
      ? lv34HomeMotion || lv1314HomeMotion ? CELESTIAL_STAG_LV34_SLEEP_FRAMES : CELESTIAL_STAG_SLEEP_FRAMES
      : lv34HomeMotion && homeStagPhase === 'settle'
        ? CELESTIAL_STAG_LV34_SETTLE_FRAMES
        : dragAtlasReady
          ? dragAtlasTrack
          : expressionPlayback
            ? CELESTIAL_STAG_FRAME_TRACKS.happy
            : homeMovement
              ? walking
                ? lv34HomeMotion ? lv34Frames : CELESTIAL_STAG_MOVEMENT_FRAMES
                : flightTrack
              : CELESTIAL_STAG_FRAME_TRACKS[clip]
  ));
  const atlasSource = levelDrag?.source ?? levelDetail?.source ?? lv12AtlasSource ?? (fullSetFlightMotion
    ? fullSet!.flight
    : fullSetRestMotion
      ? fullSet!.sleep
    : lv1718GroundMotion
    ? pace === 'walk' ? CELESTIAL_STAG_LV1718_WALK_ATLAS : CELESTIAL_STAG_LV1718_RUN_ATLAS
    : lv1718HomeMotion
    ? homeStagPhase === 'settle' || homeStagPhase === 'sleep'
      ? CELESTIAL_STAG_LV1718_SLEEP_ATLAS
      : CELESTIAL_STAG_LV1718_FLIGHT_ATLAS
    : fullSetRestMotion
    ? CELESTIAL_STAG_SLEEP_ATLAS
    : fullSetGroundMotion
    ? pace === 'walk' ? fullSet!.walk : fullSet!.run
    : lv910HomeMotion
    ? lv910FlightMotion
      ? CELESTIAL_STAG_LV910_FLIGHT_ATLAS
      : homeStagPhase === 'settle' || homeStagPhase === 'sleep' || sleeping
        ? CELESTIAL_STAG_LV910_SLEEP_ATLAS
        : pace === 'walk' ? CELESTIAL_STAG_LV910_WALK_ATLAS : CELESTIAL_STAG_LV910_RUN_ATLAS
    : lv78HomeMotion
    ? sleeping || homeStagPhase === 'settle' || homeStagPhase === 'sleep'
      ? CELESTIAL_STAG_LV78_SLEEP_ATLAS
      : homeStagPhase === 'takeoff' || homeStagPhase === 'flap' || homeStagPhase === 'glide' || homeStagPhase === 'landing' || !walking
        ? CELESTIAL_STAG_LV78_FLIGHT_ATLAS
        : pace === 'walk'
          ? CELESTIAL_STAG_LV78_WALK_ATLAS
          : CELESTIAL_STAG_LV78_RUN_ATLAS
    : lv1314FlightMotion
    ? CELESTIAL_STAG_LV1314_FLIGHT_ATLAS
    : lv1516FlightMotion
    ? CELESTIAL_STAG_LV1516_FLIGHT_ATLAS
    : lv1516WalkMotion
    ? CELESTIAL_STAG_LV1516_WALK_ATLAS
    : lv1516RunMotion
    ? CELESTIAL_STAG_LV1516_RUN_ATLAS
    : lv1516HomeMotion && (homeStagPhase === 'settle' || homeStagPhase === 'sleep')
    ? CELESTIAL_STAG_LV1516_SLEEP_ATLAS
    : lv1314WalkMotion
    ? CELESTIAL_STAG_LV1314_WALK_ATLAS
    : lv1314RestMotion
      ? CELESTIAL_STAG_LV1314_SLEEP_ATLAS
    : (
    sleeping
      ? lv34HomeMotion ? CELESTIAL_STAG_LV34_SLEEP_ATLAS : CELESTIAL_STAG_SLEEP_ATLAS
      : lv34HomeMotion && homeStagPhase === 'settle'
        ? CELESTIAL_STAG_LV34_SLEEP_ATLAS
        : dragAtlasReady
          ? PET_DRAG_ATLASES.celestial_stag!
          : homeMovement
            ? walking && clip !== 'fly'
              ? lv34HomeMotion
                ? pace === 'walk' ? CELESTIAL_STAG_LV34_WALK_ATLAS : CELESTIAL_STAG_LV34_RUN_ATLAS
                : CELESTIAL_STAG_GROUND_ATLAS
              : lv34HomeMotion
                ? CELESTIAL_STAG_LV34_FLIGHT_ATLAS
                : flightPhase === 'takeoff'
                  ? CELESTIAL_STAG_TAKEOFF_ATLAS
                  : flightPhase === 'landing'
                    ? CELESTIAL_STAG_LANDING_ATLAS
                    : CELESTIAL_STAG_FLIGHT_ATLAS
            : CELESTIAL_STAG_ATLAS
  ));
  const atlasLayout = levelDrag || levelDetail || lv12HomeMotion || sleeping || lv34HomeMotion || lv1314HomeMotion || lv1516HomeMotion || lv1718HomeMotion || lv78HomeMotion || lv910HomeMotion || fullSetGroundMotion || fullSetFlightMotion || fullSetRestMotion
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
      const breath = lv12HomeMotion ? 0 : sleepBreath.value;
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
      <View
        style={[
          styles.fill,
          {
            transform: [
              // On Home every level's hooves land on the tuned ground line,
              // whatever its scale (scaling is about the canvas centre).
              {
                translateY:
                  homeStagPhase === undefined
                    ? 0
                    : CELESTIAL_STAG_HOME_GROUND_FROM_CENTER * size -
                      HOOF_LINE_FROM_CENTER * atlasSize * look.scale,
              },
              { scale: look.scale },
            ],
          },
        ]}
      >
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
              levelDrag
                ? `level-drag-${level}-${dragPhase}`
                : levelDetail
                ? `level-detail-${level}-${sleeping ? 'sleep' : clip}`
                : lv12HomeMotion || lv1314HomeMotion || lv1516HomeMotion || lv1718HomeMotion || lv78HomeMotion || lv910HomeMotion || fullSetGroundMotion || fullSetFlightMotion || fullSetRestMotion
              ? `level-motion-${level}-${homeStagPhase}`
                : dragAtlasReady
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
              levelDragTrack && (!active || reducedMotion)
                ? levelDragTrack[levelDragTrack.length - 1]
                : dragAtlasReady && (!active || reducedMotion) && dragAtlasTrack
                ? dragAtlasTrack[dragAtlasTrack.length - 1]
                : dragLanding
                  ? CELESTIAL_STAG_LANDING_FRAMES[
                      CELESTIAL_STAG_LANDING_FRAMES.length - 1
                    ]
                : sleeping && reducedMotion
                  ? 15
                  : lv12HomeMotion &&
                      homeStagPhase === 'settle' &&
                      reducedMotion
                    ? CELESTIAL_STAG_LV12_SETTLE_FRAMES.at(-1)
                  : lv1314HomeMotion &&
                      homeStagPhase === 'settle' &&
                      reducedMotion
                    ? CELESTIAL_STAG_LV1314_SETTLE_FRAMES.at(-1)
                  : lv1314HomeMotion && sleeping && reducedMotion
                    ? 15
                  : lv34HomeMotion &&
                      homeStagPhase === 'settle' &&
                      reducedMotion
                    ? CELESTIAL_STAG_LV34_SETTLE_FRAMES.at(-1)
                  : lv78HomeMotion && homeStagPhase === 'settle' && reducedMotion
                    ? CELESTIAL_STAG_LV78_SETTLE_FRAMES.at(-1)
                  : lv910HomeMotion && homeStagPhase === 'settle' && reducedMotion
                    ? CELESTIAL_STAG_LV910_SETTLE_FRAMES.at(-1)
                    : fullSetRestMotion && homeStagPhase === 'settle' && reducedMotion
                      ? CELESTIAL_STAG_LV1920_SETTLE_FRAMES.at(-1)
                  : lv1718HomeMotion && homeStagPhase === 'settle' && reducedMotion
                    ? CELESTIAL_STAG_LV1718_SETTLE_FRAMES.at(-1)
                  : lv1516HomeMotion && homeStagPhase === 'settle' && reducedMotion
                    ? CELESTIAL_STAG_LV1516_SETTLE_FRAMES.at(-1)
                  : groundStopped
                    ? 0
                    : undefined
            }
            loop={
              lv12Playback?.loop ??
              (sleeping ? !!levelDetail || lv34HomeMotion || lv1314HomeMotion || lv1516HomeMotion || lv1718HomeMotion || lv78HomeMotion || lv910HomeMotion || fullSetRestMotion : playback.loop)
            }
            blendFrames={false}
            // Level art swaps atlases often (level picker, phases); flashing
            // the legacy winged artwork while one loads reads as a glitch.
            fallbackWhileLoading={level === undefined}
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
