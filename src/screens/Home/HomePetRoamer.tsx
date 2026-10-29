import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  PanResponder,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type {
  PixelPetAnyClipId,
  PixelPetSpeciesId,
  PixelPetStage,
} from '../../types/pixelPet';
import { CELESTIAL_STAG_ID } from '../../services/pixelPet/celestialStagPuppet';
import {
  CELESTIAL_STAG_HOME_PHASE_DURATION as STAG_PHASE_DURATION,
  celestialStagGardenFrameAt,
  type CelestialStagHomePhase,
  type CelestialStagFlightPhase,
} from '../../services/pixelPet/celestialStagAtlas';
import { scheduleOnRN } from 'react-native-worklets';
import { PixelPetSprite } from '../PixelPet/PixelPetSprite';
import { HomeSleepGarden } from './HomeSleepGarden';
import { HomeSleepScene } from './HomeSleepScene';
import {
  runeWolfSleepAnchorX,
  runeWolfSleepSceneSize,
} from './runeWolfSleepLayout';
import { pixelPetSpecies } from '../../services/pixelPet/pixelPetCatalog';
import { STAGE_LOOK } from '../../services/pixelPet/pixelPetRig';
import {
  petFacesLeft,
  petDragDurationMs,
  petMovementKind,
} from '../../services/pixelPet/pixelPetFrames';
import {
  NINE_TAIL_FOX_HOME_PHASE_DURATION,
  nineTailFoxFlipRotation,
  nineTailFoxJumpHeight,
  nineTailFoxJumpTarget,
  nextNineTailFoxHomePhase,
  type NineTailFoxHomePhase,
} from '../../services/pixelPet/nineTailFoxHome';
import {
  readOwnedPixelPet,
  subscribeOwnedPixelPet,
} from '../../services/pixelPet/pixelPetApi';
import { colors, spacing } from '../../theme';
import {
  clampDragPosition,
  nextDragPhase,
  petFallStyle,
  type DragBounds,
  type DragPhase,
} from './homePetDrag';

import { useHomePetWakeWindow } from './useHomePetWakeWindow';
import {
  GARUDA_SCENE_DESIGN_SIZE,
  garudaSleepLandingLift,
} from './garudaSleepSceneTimeline';

const SIZE = 120;
const GARUDA_SLEEP_SCENE_SIZE = GARUDA_SCENE_DESIGN_SIZE;
const GARUDA_SLEEP_APPROACH_MS = 950;
const GARUDA_SLEEP_LANDING_SETTLE_MS = 100;
/** Approximate ground travel represented by one authored 16-frame gait loop. */
const STAG_STRIDE_DISTANCE = SIZE * 0.32;
const STAG_MOTION_CANVAS_SCALE = 7 / 6;
const STAG_FLIGHT_HEIGHT = SIZE * 0.5;
/** Travel speeds in points per second. */
const FLY_SPEED = 60;
const WALK_SPEED = 32;
/** Drop from the flight lane until the feet rest on the tab bar's top edge. */
const GROUND_Y = SIZE * 0.24 + spacing.xs;
/** Matches the level-2 sleep-scene unlock in pixelPetGuide. */
const SLEEP_SCENE_LEVEL = 2;
/** The stag's frames put its hooves lower in the canvas than other pets. */
const STAG_GROUND_LIFT = SIZE * 0.05;
const LAND_MS = 900;
const TRICK_MS = 2600;
const REST_MS = 4000;
const RUNE_WOLF_SLEEP_MS = 7000;
const GARUDA_REST_MS = 7500;
const FOX_RUN_SPEED = 92;
const FOX_WALK_SPEED = 40;
/** run → jump → turn → land → walkAway, the routine that ends in sleep. */
const FOX_ROUTINE_TO_BED_MS =
  NINE_TAIL_FOX_HOME_PHASE_DURATION.run +
  NINE_TAIL_FOX_HOME_PHASE_DURATION.jump +
  NINE_TAIL_FOX_HOME_PHASE_DURATION.turn +
  NINE_TAIL_FOX_HOME_PHASE_DURATION.land +
  NINE_TAIL_FOX_HOME_PHASE_DURATION.walkAway;
const FOX_JUMP_HEIGHT = nineTailFoxJumpHeight(SIZE);
const FOX_RUN_BOUNCE_HEIGHT = 4;
const FOX_EDGE_INSET = 25;

export type StagHomePhase = CelestialStagHomePhase;

const STAG_NEXT_PHASE: Record<StagHomePhase, StagHomePhase> = {
  runA: 'walkToFlight',
  walkToFlight: 'takeoff',
  takeoff: 'flap',
  flap: 'glide',
  glide: 'landing',
  landing: 'walkAfterLanding',
  walkAfterLanding: 'runB',
  runB: 'settle',
  settle: 'sleep',
  sleep: 'sleep',
};

const STAG_GROUND_PHASES = new Set<StagHomePhase>([
  'runA',
  'walkToFlight',
  'runB',
  'walkAfterLanding',
  'settle',
  'sleep',
]);
const STAG_GROUND_TRAVEL_PHASES = new Set<StagHomePhase>([
  'runA',
  'walkToFlight',
  'walkAfterLanding',
  'runB',
  'settle',
]);

/** Tricks per pose; the stag puppet has its own extra clips. */
const TRICKS = {
  ground: ['idle', 'happy', 'skill'],
  air: ['happy', 'skill'],
  stagGround: [
    'idle',
    'happy',
    'eat',
    'bow',
    'prance',
    'glow',
    'blaze',
    'spin',
  ],
  stagAir: ['flap', 'fly', 'spin', 'glow'],
} as const satisfies Record<string, readonly PixelPetAnyClipId[]>;

export type RoamBeat =
  | { kind: 'travel'; to: number; ms: number }
  | { kind: 'trick'; clip: PixelPetAnyClipId; ms: number }
  | { kind: 'shift' };

export function isGarudaHomeSleeping(
  garuda: boolean,
  beat: RoamBeat | null,
): boolean {
  return garuda && beat?.kind === 'trick' && beat.clip === 'idle';
}

export function garudaSleepTargetX(
  width: number,
  inset: number,
  sceneSize = GARUDA_SLEEP_SCENE_SIZE,
): number {
  const scenePadding = (sceneSize - SIZE) / 2;
  const minX = Math.max(0, scenePadding - inset);
  const maxX = Math.max(minX, width - inset - (sceneSize + SIZE) / 2);
  const centeredX = width / 2 - inset - SIZE / 2;
  return Math.max(minX, Math.min(maxX, centeredX));
}

export function isRuneWolfHomeSleeping(
  runeWolf: boolean,
  beat: RoamBeat | null,
): boolean {
  return runeWolf && beat?.kind === 'trick' && beat.clip === 'idle';
}

/**
 * Picks what the pet does next: after travelling it often stops for a trick
 * and, if it has wings, sometimes lands or takes off; otherwise it travels to
 * a fresh spot at least a third of the bar away.
 */
export function nextRoamBeat(
  previous: RoamBeat['kind'] | null,
  at: {
    x: number;
    range: number;
    walking: boolean;
    flier: boolean;
    stag: boolean;
    garuda?: boolean;
    runeWolf?: boolean;
    allowSleep?: boolean;
  },
  random: () => number = Math.random,
): RoamBeat {
  const allowSleep = at.allowSleep ?? true;
  if (previous === 'travel' && at.runeWolf)
    return {
      kind: 'trick',
      clip: allowSleep ? 'idle' : 'skill',
      ms: allowSleep ? RUNE_WOLF_SLEEP_MS : TRICK_MS,
    };
  if (previous === 'shift' && at.garuda && at.walking && allowSleep)
    return { kind: 'trick', clip: 'idle', ms: GARUDA_REST_MS };
  if (previous === 'travel') {
    const roll = random();
    if (roll < 0.55) {
      const list = at.stag
        ? at.walking
          ? TRICKS.stagGround
          : TRICKS.stagAir
        : at.walking
          ? TRICKS.ground
          : TRICKS.air;
      const available = allowSleep
        ? list
        : list.filter((clip) => clip !== 'idle');
      const clip = available[Math.floor(random() * available.length)];
      return {
        kind: 'trick',
        clip,
        ms: clip === 'idle' ? (at.garuda ? GARUDA_REST_MS : REST_MS) : TRICK_MS,
      };
    }
    if (at.flier && roll < 0.8) return { kind: 'shift' };
  }
  let to = random() * at.range;
  if (Math.abs(to - at.x) < at.range / 3)
    to = at.x < at.range / 2 ? at.range : 0;
  const speed = at.walking ? WALK_SPEED : FLY_SPEED;
  return { kind: 'travel', to, ms: (Math.abs(to - at.x) / speed) * 1000 };
}

type Props = {
  uid: string | null;
  active: boolean;
  containerWidth: number;
  containerHeight: number;
  topInset: number;
  /** Shows this species instead of the owned pet (admin preview). */
  preview?: { speciesId: PixelPetSpeciesId; stage: PixelPetStage };
};

type DepartingGarden = {
  id: number;
  x: number;
  scaleX: number;
  growthFrame: number;
};

type DepartingFoxScene = {
  id: number;
  x: number;
};

/** The owned pet roams above the tab bar: flies, lands, walks and plays. */
export function HomePetRoamer({
  uid,
  active,
  containerWidth,
  containerHeight,
  topInset,
  preview,
}: Props) {
  const read = useCallback(() => (uid ? readOwnedPixelPet(uid) : null), [uid]);
  const owned = useSyncExternalStore(subscribeOwnedPixelPet, read, read);
  const pet = preview ?? owned;
  // Sleep backdrops unlock at level 2; the admin preview always shows them.
  const sceneUnlocked = !!preview || (owned?.level ?? 0) >= SLEEP_SCENE_LEVEL;
  const species = pixelPetSpecies(pet?.speciesId ?? '');
  const {
    asleep: timedAsleep,
    wake: restartWakeWindow,
    timeLeft: awakeTimeLeft,
  } = useHomePetWakeWindow(
    pet
      ? preview
        ? `preview:${pet.speciesId}:${pet.stage}`
        : `${uid}:${pet.speciesId}`
      : '',
    active,
  );
  const timedAsleepRef = useRef(timedAsleep);
  timedAsleepRef.current = timedAsleep;
  const reducedMotion = useReducedMotion();
  // The lane spans the screen; onLayout on a box-none overlay never fired.
  const window = useWindowDimensions();
  const width = containerWidth || window.width;
  const height = containerHeight || window.height;
  const fox = species?.id === 'nine_tail_fox';
  const garuda = species?.id === 'garuda';
  const runeWolf = species?.id === 'rune_wolf';
  const horizontalInset = fox ? FOX_EDGE_INSET : spacing.md;
  const range = Math.max(0, width - SIZE - horizontalInset * 2);
  const laneTop = Math.max(0, height - SIZE - spacing.xs);
  const facing = species && petFacesLeft(species) ? -1 : 1;
  const garudaSceneSize = Math.max(
    SIZE,
    Math.min(GARUDA_SLEEP_SCENE_SIZE, width - horizontalInset * 2),
  );
  const garudaLandingLift = garudaSleepLandingLift(garudaSceneSize);
  const flier = !!species && petMovementKind(species) === 'wings';
  const stag = species?.id === CELESTIAL_STAG_ID;
  const groundY = stag ? GROUND_Y - STAG_GROUND_LIFT : GROUND_Y;
  const stagStrideDistance =
    STAG_STRIDE_DISTANCE *
    STAG_MOTION_CANVAS_SCALE *
    (pet ? STAGE_LOOK[pet.stage].scale : 1);
  const [walking, setWalking] = useState<boolean | null>(null);
  const [beat, setBeat] = useState<RoamBeat | null>(null);
  const [garudaLanded, setGarudaLanded] = useState(false);
  const [stagPhase, setStagPhase] = useState<StagHomePhase>('runA');
  const [stagGaitCycleMs, setStagGaitCycleMs] = useState<number>();
  const [foxPhase, setFoxPhase] = useState<NineTailFoxHomePhase>('walk');
  const [sleepSceneCycle, setSleepSceneCycle] = useState(0);
  const [departingGarudaScene, setDepartingGarudaScene] = useState<{
    id: number;
    x: number;
  } | null>(null);
  const garudaSceneDepartureId = useRef(0);
  const [departingWolfScene, setDepartingWolfScene] = useState<{
    id: number;
    x: number;
    size: number;
  } | null>(null);
  const wolfSceneDepartureId = useRef(0);
  const [departingFoxScene, setDepartingFoxScene] =
    useState<DepartingFoxScene | null>(null);
  const [departingGarden, setDepartingGarden] =
    useState<DepartingGarden | null>(null);
  const [dragPhase, setDragPhaseState] = useState<DragPhase>('roam');
  const dragPhaseRef = useRef<DragPhase>('roam');
  const stagStarted = useRef(false);
  const foxStarted = useRef(false);
  const foxDirection = useRef(1);
  const foxSceneDepartureId = useRef(0);
  const gardenDepartureId = useRef(0);
  const gardenElapsedMs = useRef(0);
  const gardenStartedAt = useRef<number | null>(null);
  const lastSleepSpot = useRef<number | null>(null);
  const x = useSharedValue(0);
  const heading = useSharedValue(1);
  const ground = useSharedValue(walking ? 1 : 0);
  const travelling = useSharedValue(0);
  const sleepTarget = useSharedValue(0);
  const airHeight = useSharedValue(0);
  const garudaSleepLift = useSharedValue(0);
  const foxJumpHeight = useSharedValue(0);
  const foxRotation = useSharedValue(0);
  const foxRunStride = useSharedValue(0);
  const dragTop = useSharedValue(0);
  const dragMode = useSharedValue(0);
  const dragScale = useSharedValue(1);
  const dragRotation = useSharedValue(0);
  const dragCompleted = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const fallStyle = petFallStyle(species?.id ?? '');
  const bounds: DragBounds = {
    minX: 0,
    maxX: range,
    minY: topInset,
    maxY: Math.max(topInset, laneTop + groundY),
  };
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const groundTop = bounds.maxY;
  const stagActive =
    stag &&
    !!pet &&
    active &&
    !reducedMotion &&
    range > 0 &&
    dragPhase === 'roam' &&
    !timedAsleep;
  const foxActive =
    fox &&
    !!pet &&
    active &&
    !reducedMotion &&
    range > 0 &&
    dragPhase === 'roam' &&
    !timedAsleep;
  const foxSleeping = fox && foxPhase === 'sleep';
  const garudaSleeping = isGarudaHomeSleeping(garuda, beat);
  const garudaSleepFlight = garudaSleeping && !garudaLanded;
  const garudaSleepPose = garudaSleeping && garudaLanded;
  const runeWolfSleeping = isRuneWolfHomeSleeping(runeWolf, beat);
  const stagSleeping = stag && stagPhase === 'sleep';
  const timedSleepPose = timedAsleep && !(garudaSleeping && !garudaLanded);
  const sleeping =
    timedSleepPose || stagSleeping || garudaSleepPose || runeWolfSleeping;
  // Keep the same responder while waking the pet during an active touch.
  const sleepingRef = useRef(sleeping);
  sleepingRef.current =
    sleeping || foxSleeping || garudaSleeping || runeWolfSleeping;
  const roaming =
    !!species &&
    !!pet &&
    !stag &&
    !fox &&
    walking !== null &&
    active &&
    !reducedMotion &&
    range > 0 &&
    dragPhase === 'roam' &&
    !timedAsleep;

  const chooseNextSleepSpot = useCallback(() => {
    if (range <= 1) {
      sleepTarget.value = 0;
      lastSleepSpot.current = 0;
      return;
    }
    let target = Math.random() * range;
    if (
      lastSleepSpot.current !== null &&
      range > SIZE * 0.6 &&
      Math.abs(target - lastSleepSpot.current) < range * 0.2
    ) {
      target = (target + range * 0.5) % range;
    }
    lastSleepSpot.current = target;
    sleepTarget.value = target;
  }, [range, sleepTarget]);

  const wakeStag = useCallback(() => {
    const growthFrame = celestialStagGardenFrameAt(
      gardenElapsedMs.current +
        (gardenStartedAt.current === null
          ? 0
          : Date.now() - gardenStartedAt.current),
    );
    setDepartingGarden(
      growthFrame > 0
        ? {
            id: ++gardenDepartureId.current,
            x: x.value,
            scaleX: heading.value * facing,
            growthFrame,
          }
        : null,
    );
    chooseNextSleepSpot();
    setStagPhase('runA');
  }, [chooseNextSleepSpot, facing, heading, x]);

  const wakeFox = useCallback(() => {
    if (foxSleeping) {
      setDepartingFoxScene({ id: ++foxSceneDepartureId.current, x: x.value });
    }
    foxDirection.current *= -1;
    setFoxPhase('wake');
  }, [foxSleeping, x]);

  const wakeGaruda = useCallback(() => {
    setBeat({ kind: 'trick', clip: 'happy', ms: TRICK_MS });
  }, []);

  const wakeRuneWolf = useCallback(() => {
    if (runeWolfSleeping)
      setDepartingWolfScene({
        id: ++wolfSceneDepartureId.current,
        x: runeWolfSleepAnchorX(x.value, width, horizontalInset),
        size: runeWolfSleepSceneSize(width),
      });
    setBeat({ kind: 'trick', clip: 'skill', ms: TRICK_MS });
  }, [runeWolfSleeping, x, width, horizontalInset]);

  useEffect(() => {
    if (!runeWolf) setDepartingWolfScene(null);
  }, [runeWolf]);

  const setDragPhase = useCallback((phase: DragPhase) => {
    dragPhaseRef.current = phase;
    setDragPhaseState(phase);
  }, []);

  const currentRoamTop = useCallback(
    () =>
      laneTop +
      ground.value * groundY -
      airHeight.value * STAG_FLIGHT_HEIGHT +
      -foxJumpHeight.value * FOX_JUMP_HEIGHT +
      -Math.max(0, (1 - Math.cos(foxRunStride.value * Math.PI * 4)) / 2) *
        FOX_RUN_BOUNCE_HEIGHT +
      Math.sin((x.value / 40) * Math.PI) *
        5 *
        (1 - ground.value) *
        travelling.value,
    [
      airHeight,
      foxJumpHeight,
      foxRunStride,
      ground,
      groundY,
      laneTop,
      travelling,
      x,
    ],
  );

  const freezePetForLift = useCallback(() => {
    const current = clampDragPosition(
      {
        x: x.value,
        y: dragMode.value ? dragTop.value : currentRoamTop(),
      },
      boundsRef.current,
    );
    cancelAnimation(x);
    cancelAnimation(ground);
    cancelAnimation(airHeight);
    cancelAnimation(foxJumpHeight);
    cancelAnimation(foxRotation);
    cancelAnimation(foxRunStride);
    cancelAnimation(dragTop);
    cancelAnimation(dragRotation);
    travelling.value = 0;
    x.value = current.x;
    dragTop.value = current.y;
    dragMode.value = 1;
    dragStart.current = current;
  }, [
    airHeight,
    currentRoamTop,
    dragMode,
    dragRotation,
    dragTop,
    foxJumpHeight,
    foxRotation,
    foxRunStride,
    ground,
    travelling,
    x,
  ]);

  const advanceDragPhase = useCallback(() => {
    const next = nextDragPhase(dragPhaseRef.current, 'advance', {
      fallStyle,
      airborne: false,
      reducedMotion,
    });
    setDragPhase(next);
    if (next === 'roam') {
      dragMode.value = 0;
      dragScale.value = withTiming(1, { duration: 150 });
      dragRotation.value = withTiming(0, { duration: 150 });
      ground.value = 1;
      airHeight.value = 0;
      if (stag) setStagPhase('runB');
      else if (fox) {
        foxJumpHeight.value = 0;
        foxRotation.value = 0;
        foxRunStride.value = 0;
        setFoxPhase('walk');
      } else if (flier) setWalking(true);
    }
  }, [
    airHeight,
    dragMode,
    dragRotation,
    dragScale,
    fallStyle,
    flier,
    fox,
    foxJumpHeight,
    foxRotation,
    foxRunStride,
    ground,
    reducedMotion,
    setDragPhase,
    stag,
  ]);

  const releaseDrag = useCallback(
    (dx = 0, dy = 0) => {
      if (dragCompleted.current) return;
      dragCompleted.current = true;
      if (stag) {
        // Fractional scaling makes the Stag's full-body atlas look soft.
        cancelAnimation(dragScale);
        dragScale.value = 1;
      }
      const position = clampDragPosition(
        { x: dragStart.current.x + dx, y: dragStart.current.y + dy },
        boundsRef.current,
      );
      x.value = position.x;
      dragTop.value = position.y;
      const next = nextDragPhase(dragPhaseRef.current, 'release', {
        fallStyle,
        airborne: position.y < groundTop - 1,
        reducedMotion,
      });
      setDragPhase(next);
    },
    [
      dragScale,
      dragTop,
      fallStyle,
      groundTop,
      reducedMotion,
      setDragPhase,
      stag,
      x,
    ],
  );

  const cancelDrag = useCallback(() => {
    dragCompleted.current = true;
    cancelAnimation(x);
    cancelAnimation(ground);
    cancelAnimation(airHeight);
    cancelAnimation(foxJumpHeight);
    cancelAnimation(foxRotation);
    cancelAnimation(foxRunStride);
    cancelAnimation(dragScale);
    cancelAnimation(dragRotation);
    travelling.value = 0;
    dragMode.value = 0;
    dragTop.value = groundTop;
    dragScale.value = 1;
    dragRotation.value = 0;
    ground.value = 1;
    airHeight.value = 0;
    foxJumpHeight.value = 0;
    foxRotation.value = 0;
    foxRunStride.value = 0;
    setDragPhase('roam');
    if (stag) setStagPhase(timedAsleepRef.current ? 'sleep' : 'runB');
    else if (fox) setFoxPhase(timedAsleepRef.current ? 'sleep' : 'walk');
    else if (flier) setWalking(true);
  }, [
    airHeight,
    dragMode,
    dragRotation,
    dragScale,
    dragTop,
    flier,
    fox,
    foxJumpHeight,
    foxRotation,
    foxRunStride,
    ground,
    travelling,
    groundTop,
    setDragPhase,
    stag,
    x,
  ]);

  useEffect(() => {
    if (dragPhase === 'roam') return;
    if (dragPhase === 'lifted') {
      dragScale.value =
        reducedMotion || stag
          ? 1
          : withSequence(
              withTiming(1.12, { duration: 90 }),
              withTiming(1.08, { duration: 100 }),
            );
      return () => cancelAnimation(dragScale);
    }

    const duration = petDragDurationMs(dragPhase, fallStyle, reducedMotion);

    if (dragPhase === 'circle') {
      const startX = x.value;
      const radius = Math.min(range * 0.3, SIZE * 0.3);
      const rightX = Math.max(0, Math.min(range, startX + radius));
      const leftX = Math.max(0, Math.min(range, startX - radius));
      x.value = withSequence(
        withTiming(rightX, {
          duration: 500,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(leftX, { duration: 500, easing: Easing.inOut(Easing.quad) }),
        withTiming(startX, {
          duration: 500,
          easing: Easing.inOut(Easing.quad),
        }),
      );
      // Circle around the release point before descending. Moving directly
      // toward the floor here makes a high drop look like a failed drag.
      const startTop = dragTop.value;
      const riseTop = Math.max(boundsRef.current.minY, startTop - radius / 2);
      const dipTop = Math.min(groundTop, startTop + radius / 2);
      dragTop.value = withSequence(
        withTiming(riseTop, { duration: 500 }),
        withTiming(dipTop, { duration: 500 }),
        withTiming(startTop, { duration: 500 }),
      );
    } else if (dragPhase === 'fall' || dragPhase === 'descend') {
      dragTop.value = withTiming(groundTop, {
        duration,
        easing:
          dragPhase === 'descend' ||
          fallStyle === 'coil' ||
          fallStyle === 'flop'
            ? Easing.out(Easing.quad)
            : Easing.in(Easing.quad),
      });
      const rotation =
        fallStyle === 'shell'
          ? 360
          : fallStyle === 'tentacle'
            ? 28
            : fallStyle === 'coil'
              ? -18
              : 0;
      dragRotation.value = withTiming(rotation, { duration });
    } else if (dragPhase === 'land') {
      if (reducedMotion) {
        dragTop.value = groundTop;
        dragScale.value = 1;
        dragRotation.value = 0;
      } else {
        dragTop.value = withSequence(
          withTiming(groundTop + 3, { duration: 80 }),
          withTiming(groundTop, { duration: 100 }),
        );
        dragScale.value = stag
          ? 1
          : withSequence(
              withTiming(0.94, { duration: 80 }),
              withTiming(1, { duration: 100 }),
            );
        dragRotation.value = withTiming(0, { duration: 180 });
      }
    }

    const timer = setTimeout(advanceDragPhase, duration);
    return () => {
      clearTimeout(timer);
      cancelAnimation(dragTop);
      cancelAnimation(dragRotation);
      if (dragPhase === 'land') cancelAnimation(dragScale);
      if (dragPhase === 'circle') cancelAnimation(x);
    };
  }, [
    advanceDragPhase,
    dragPhase,
    dragRotation,
    dragScale,
    dragTop,
    fallStyle,
    groundTop,
    range,
    reducedMotion,
    stag,
    x,
  ]);

  useEffect(() => {
    if (!active && dragPhaseRef.current !== 'roam') cancelDrag();
  }, [active, cancelDrag]);

  useEffect(() => {
    return () => {
      cancelAnimation(dragTop);
      cancelAnimation(dragRotation);
      cancelAnimation(dragScale);
    };
  }, [dragRotation, dragScale, dragTop]);

  const finishGarden = useCallback((id: number) => {
    setDepartingGarden((current) => (current?.id === id ? null : current));
  }, []);

  const finishFoxScene = useCallback((id: number) => {
    setDepartingFoxScene((current) => (current?.id === id ? null : current));
  }, []);

  useEffect(() => {
    if (!active) setDepartingGarden(null);
  }, [active]);

  const advance = useCallback(() => {
    if (timedAsleepRef.current) return;
    setBeat((previous) =>
      nextRoamBeat(previous?.kind ?? null, {
        x: x.value,
        range,
        walking: walking ?? !flier,
        flier,
        stag,
        garuda,
        runeWolf,
        allowSleep: false,
      }),
    );
  }, [x, range, walking, flier, stag, garuda, runeWolf]);

  // Wait for the owned pet to load before choosing ground or flight. Without
  // this, an initially empty cache leaves flying pets stuck in the ground pose.
  useEffect(() => {
    if (!species) return;
    const startsWalking = !flier;
    setWalking(startsWalking);
    ground.value = startsWalking || stag ? 1 : 0;
  }, [species, flier, stag, ground]);

  useEffect(() => {
    if (!stag || !pet) {
      stagStarted.current = false;
      gardenStartedAt.current = null;
      setDepartingGarden(null);
      return;
    }
    if (stagStarted.current) return;
    stagStarted.current = true;
    chooseNextSleepSpot();
    setStagPhase('runA');
  }, [stag, pet, chooseNextSleepSpot]);

  useEffect(() => {
    if (!stag || stagPhase !== 'sleep') {
      gardenElapsedMs.current = 0;
      gardenStartedAt.current = null;
      return;
    }
    if (!active) return;
    gardenStartedAt.current = Date.now();
    return () => {
      if (gardenStartedAt.current !== null) {
        gardenElapsedMs.current += Date.now() - gardenStartedAt.current;
        gardenStartedAt.current = null;
      }
    };
  }, [active, stag, stagPhase]);

  useEffect(() => {
    if (!stagActive || stagPhase === 'sleep') return;
    const timer = setTimeout(() => {
      const next = STAG_NEXT_PHASE[stagPhase];
      setStagPhase(next === 'sleep' && !timedAsleepRef.current ? 'runA' : next);
    }, STAG_PHASE_DURATION[stagPhase]);
    return () => clearTimeout(timer);
  }, [stagActive, stagPhase]);

  useEffect(() => {
    if (!fox || !pet) {
      foxStarted.current = false;
      setDepartingFoxScene(null);
      foxJumpHeight.value = 0;
      foxRotation.value = 0;
      foxRunStride.value = 0;
      setFoxPhase('walk');
      return;
    }
    if (foxStarted.current) return;
    foxStarted.current = true;
    foxDirection.current = Math.random() < 0.5 ? -1 : 1;
    x.value = range * (foxDirection.current > 0 ? 0.04 : 0.96);
    heading.value = foxDirection.current;
    ground.value = 1;
    setFoxPhase('walk');
  }, [
    fox,
    pet,
    range,
    foxJumpHeight,
    foxRotation,
    foxRunStride,
    ground,
    heading,
    x,
  ]);

  useEffect(() => {
    if (!foxActive || foxPhase === 'sleep') return;
    const timer = setTimeout(() => {
      if (foxPhase === 'walkAway') setSleepSceneCycle((cycle) => cycle + 1);
      let next = nextNineTailFoxHomePhase(foxPhase);
      // Too little awake time for the run-and-flip routine: stroll off to bed
      // instead of starting a sprint that the sleep timer would cut short.
      if (next === 'run' && awakeTimeLeft() < FOX_ROUTINE_TO_BED_MS)
        next = 'walkAway';
      if (next === 'sleep' && !timedAsleepRef.current) {
        // Keep roaming: head back across the lane rather than reversing.
        foxDirection.current *= -1;
        next = 'walk';
      }
      setFoxPhase(next);
    }, NINE_TAIL_FOX_HOME_PHASE_DURATION[foxPhase]);
    return () => clearTimeout(timer);
  }, [awakeTimeLeft, foxActive, foxPhase, wakeFox]);

  const garudaSceneShown = garudaSleeping && garudaLanded;
  const garudaSceneWasShown = useRef(false);
  useEffect(() => {
    if (garudaSceneWasShown.current && !garudaSceneShown && garuda)
      setDepartingGarudaScene({
        id: ++garudaSceneDepartureId.current,
        x: x.value,
      });
    garudaSceneWasShown.current = garudaSceneShown;
  }, [garudaSceneShown, garuda, x]);

  useEffect(() => {
    if (garudaSleeping) setSleepSceneCycle((cycle) => cycle + 1);
    else setGarudaLanded(false);
  }, [garudaSleeping]);

  useEffect(() => {
    if (runeWolfSleeping) setSleepSceneCycle((cycle) => cycle + 1);
  }, [runeWolfSleeping]);

  useEffect(() => {
    if (!garudaSleeping) {
      garudaSleepLift.value = 0;
      return;
    }
    const targetX = garudaSleepTargetX(width, horizontalInset, garudaSceneSize);
    if (reducedMotion) {
      x.value = targetX;
      ground.value = 1;
      garudaSleepLift.value = 1;
      setGarudaLanded(true);
    }
  }, [
    garudaSleeping,
    reducedMotion,
    width,
    horizontalInset,
    garudaSceneSize,
    x,
    ground,
    garudaSleepLift,
  ]);

  useEffect(() => {
    if (!garudaSleeping || !active || reducedMotion || garudaLanded) return;
    const targetX = garudaSleepTargetX(width, horizontalInset, garudaSceneSize);
    heading.value = targetX >= x.value ? 1 : -1;
    ground.value = withTiming(1, {
      duration: GARUDA_SLEEP_APPROACH_MS,
      easing: Easing.inOut(Easing.quad),
    });
    x.value = withTiming(targetX, {
      duration: GARUDA_SLEEP_APPROACH_MS,
      easing: Easing.inOut(Easing.quad),
    });
    garudaSleepLift.value = withTiming(1, {
      duration: GARUDA_SLEEP_APPROACH_MS,
      easing: Easing.out(Easing.quad),
    });
    const timer = setTimeout(
      () => setGarudaLanded(true),
      GARUDA_SLEEP_APPROACH_MS + GARUDA_SLEEP_LANDING_SETTLE_MS,
    );
    return () => {
      clearTimeout(timer);
      cancelAnimation(x);
      cancelAnimation(ground);
      cancelAnimation(garudaSleepLift);
    };
  }, [
    garudaSleeping,
    active,
    reducedMotion,
    garudaLanded,
    width,
    horizontalInset,
    garudaSceneSize,
    heading,
    ground,
    x,
    garudaSleepLift,
  ]);

  useEffect(() => {
    if (!foxActive) return;
    const direction = foxDirection.current;
    const edge = direction > 0 ? range : 0;
    let target: number | null = null;
    let duration: number = NINE_TAIL_FOX_HOME_PHASE_DURATION[foxPhase];
    let easing = Easing.inOut(Easing.quad);

    switch (foxPhase) {
      case 'walk':
        foxRunStride.value = 0;
        target = range * (direction > 0 ? 0.48 : 0.52);
        // Face where it is actually going so it never moonwalks.
        if (Math.abs(target - x.value) > 1)
          heading.value = Math.sign(target - x.value);
        duration = Math.min(
          duration,
          Math.max(900, (Math.abs(target - x.value) / FOX_WALK_SPEED) * 1000),
        );
        break;
      case 'run':
        foxRunStride.value = withRepeat(
          withTiming(1, {
            duration: NINE_TAIL_FOX_HOME_PHASE_DURATION.run,
            easing: Easing.linear,
          }),
          -1,
          false,
        );
        target = edge;
        heading.value = direction;
        duration = Math.min(
          duration,
          Math.max(700, (Math.abs(target - x.value) / FOX_RUN_SPEED) * 1000),
        );
        easing = Easing.in(Easing.quad);
        break;
      case 'jump':
        foxRunStride.value = 0;
        target = nineTailFoxJumpTarget(x.value, range);
        foxJumpHeight.value = withSequence(
          withTiming(1, {
            duration: 220,
            easing: Easing.out(Easing.quad),
          }),
          withTiming(0, {
            duration: NINE_TAIL_FOX_HOME_PHASE_DURATION.jump - 220,
            easing: Easing.in(Easing.quad),
          }),
        );
        foxRotation.value = withTiming(nineTailFoxFlipRotation(direction), {
          duration: NINE_TAIL_FOX_HOME_PHASE_DURATION.jump,
          easing: Easing.inOut(Easing.quad),
        });
        easing = Easing.out(Easing.quad);
        break;
      case 'turn':
        foxRunStride.value = 0;
        target = nineTailFoxJumpTarget(x.value, range);
        heading.value = -direction;
        break;
      case 'land':
        foxRunStride.value = 0;
        target = nineTailFoxJumpTarget(x.value, range);
        // 360deg and 0deg have the same rendered orientation; reset without
        // making the fox perform an accidental second backward flip.
        foxRotation.value = 0;
        break;
      case 'walkAway': {
        foxRunStride.value = 0;
        // Stroll a short way inward from wherever it is before lying down.
        const inward = x.value > range / 2 ? -1 : 1;
        target = nineTailFoxJumpTarget(x.value + inward * range * 0.18, range);
        heading.value = inward;
        duration = Math.min(
          duration,
          Math.max(900, (Math.abs(target - x.value) / FOX_WALK_SPEED) * 1000),
        );
        break;
      }
      case 'sleep':
        foxRunStride.value = 0;
        foxJumpHeight.value = 0;
        foxRotation.value = 0;
        return;
      case 'wake':
        return;
    }

    if (target === null) return;
    travelling.value = 1;
    x.value = withTiming(target, { duration, easing });
    return () => {
      travelling.value = 0;
      cancelAnimation(x);
      cancelAnimation(foxJumpHeight);
      cancelAnimation(foxRotation);
      cancelAnimation(foxRunStride);
    };
  }, [
    foxActive,
    foxPhase,
    range,
    heading,
    travelling,
    x,
    foxJumpHeight,
    foxRotation,
    foxRunStride,
  ]);

  useEffect(() => {
    if (!stag) return;
    cancelAnimation(airHeight);
    if (stagPhase === 'takeoff') {
      ground.value = withTiming(0, {
        duration: STAG_PHASE_DURATION.takeoff,
        easing: Easing.inOut(Easing.quad),
      });
      airHeight.value = withTiming(1, {
        duration: STAG_PHASE_DURATION.takeoff,
        easing: Easing.inOut(Easing.quad),
      });
    } else if (stagPhase === 'flap') {
      ground.value = 0;
      airHeight.value = 1;
    } else if (stagPhase === 'glide') {
      ground.value = 0;
      airHeight.value = withTiming(0.28, {
        duration: STAG_PHASE_DURATION.glide,
        easing: Easing.linear,
      });
    } else if (stagPhase === 'landing') {
      ground.value = withTiming(1, {
        duration: STAG_PHASE_DURATION.landing,
        easing: Easing.inOut(Easing.quad),
      });
      airHeight.value = withTiming(0, {
        duration: STAG_PHASE_DURATION.landing,
        easing: Easing.inOut(Easing.quad),
      });
    } else if (STAG_GROUND_PHASES.has(stagPhase)) {
      ground.value = 1;
      airHeight.value = 0;
    }
  }, [stag, stagPhase, ground, airHeight]);

  useEffect(() => {
    if (!stagActive) return;
    let to: number | null = null;
    switch (stagPhase) {
      case 'runA':
        to = range * 0.72;
        break;
      case 'walkToFlight':
        to = Math.max(
          0,
          x.value - (WALK_SPEED * STAG_PHASE_DURATION.walkToFlight) / 1000,
        );
        break;
      case 'takeoff':
        to = Math.min(range * 0.9, x.value + range * 0.18);
        break;
      case 'flap':
        to = range * 0.9;
        break;
      case 'glide':
        to = range * 0.35;
        break;
      case 'runB': {
        const walkInDistance = (WALK_SPEED * STAG_PHASE_DURATION.settle) / 1000;
        const left = Math.max(0, sleepTarget.value - walkInDistance);
        const right = Math.min(range, sleepTarget.value + walkInDistance);
        to =
          Math.abs(left - x.value) > Math.abs(right - x.value) ? left : right;
        break;
      }
      case 'walkAfterLanding':
        to = Math.min(
          range,
          x.value + (WALK_SPEED * STAG_PHASE_DURATION.walkAfterLanding) / 1000,
        );
        break;
      case 'settle':
        to = sleepTarget.value;
        break;
      default:
        break;
    }
    if (to === null) {
      setStagGaitCycleMs(undefined);
      travelling.value = 0;
      return;
    }
    const duration = STAG_PHASE_DURATION[stagPhase];
    const distance = Math.abs(to - x.value);
    setStagGaitCycleMs(
      STAG_GROUND_TRAVEL_PHASES.has(stagPhase)
        ? distance > 1
          ? (duration * stagStrideDistance) / distance
          : 0
        : undefined,
    );
    if (distance > 1) heading.value = to > x.value ? 1 : -1;
    travelling.value = 1;
    x.value = withTiming(to, {
      duration,
      easing:
        STAG_GROUND_TRAVEL_PHASES.has(stagPhase) || stagPhase === 'glide'
          ? Easing.linear
          : Easing.inOut(Easing.quad),
    });
    return () => {
      travelling.value = 0;
      cancelAnimation(x);
    };
  }, [
    stagActive,
    stagPhase,
    stagStrideDistance,
    range,
    heading,
    travelling,
    x,
    sleepTarget,
  ]);

  // Start (or restart after a pause) with a fresh beat.
  useEffect(() => {
    if (!roaming) {
      cancelAnimation(x);
      setBeat((current) =>
        timedAsleep ||
        isGarudaHomeSleeping(garuda, current) ||
        isRuneWolfHomeSleeping(runeWolf, current)
          ? current
          : null,
      );
      return;
    }
    if (garudaSleeping || runeWolfSleeping) return;
    // Waking changes roaming from false to true. Keep its selected signature
    // action instead of replacing it immediately with a fresh travel beat.
    if (beat?.kind === 'trick' && beat.clip !== 'idle') return;
    advance();
    // Only (re)start when roaming toggles; later beats chain from `advance`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roaming]);

  useEffect(() => {
    if (stag || !beat || !roaming) return;
    if (beat.kind === 'travel') {
      heading.value = beat.to >= x.value ? 1 : -1;
      travelling.value = 1;
      x.value = withTiming(
        beat.to,
        { duration: beat.ms, easing: Easing.inOut(Easing.quad) },
        (finished) => {
          if (finished) scheduleOnRN(advance);
        },
      );
      return () => {
        travelling.value = 0;
        cancelAnimation(x);
      };
    }
    travelling.value = 0;
    if (beat.kind === 'shift') {
      const next = !walking;
      let landed = false;
      ground.value = withTiming(next ? 1 : 0, { duration: LAND_MS });
      const timer = setTimeout(() => {
        landed = true;
        setWalking(next);
      }, LAND_MS);
      return () => {
        clearTimeout(timer);
        // Interrupted mid-shift: return to the pose `walking` still describes.
        if (!landed)
          ground.value = withTiming(walking ? 1 : 0, { duration: LAND_MS });
      };
    }
    if (garudaSleeping || runeWolfSleeping) return;
    const timer = setTimeout(advance, beat.ms);
    return () => clearTimeout(timer);
    // `walking` changing after a shift must not replay the shift.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat, roaming]);

  // A finished shift continues once `walking` (and so `advance`) is updated.
  useEffect(() => {
    if (!stag && beat?.kind === 'shift') advance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walking, stag]);

  const flight = useAnimatedStyle(() => {
    const g = ground.value;
    const bob = Math.sin((x.value / 40) * Math.PI) * 5 * (1 - g);
    const runArc =
      foxActive && foxPhase === 'run'
        ? Math.max(0, (1 - Math.cos(foxRunStride.value * Math.PI * 4)) / 2)
        : 0;
    const runLean =
      foxActive && foxPhase === 'run'
        ? Math.sin(foxRunStride.value * Math.PI * 4) * heading.value * -2.5
        : 0;
    return {
      transform: [
        { translateX: x.value },
        {
          translateY: dragMode.value
            ? dragTop.value
            : laneTop +
              g * groundY -
              airHeight.value * STAG_FLIGHT_HEIGHT +
              garudaSleepLift.value * -garudaLandingLift +
              foxJumpHeight.value * -FOX_JUMP_HEIGHT +
              -runArc * FOX_RUN_BOUNCE_HEIGHT +
              bob * travelling.value,
        },
        { rotate: `${dragRotation.value + foxRotation.value + runLean}deg` },
        {
          scaleY: foxActive && foxPhase === 'run' ? 0.965 + runArc * 0.055 : 1,
        },
        { scaleX: heading.value * facing },
        { scale: dragScale.value },
      ],
    };
  });
  const sleepSceneAnchor = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: runeWolf
          ? runeWolfSleepAnchorX(x.value, width, horizontalInset)
          : x.value,
      },
      { translateY: laneTop + groundY },
    ],
  }));

  const wakePet = useCallback(() => {
    if (!active) return;
    restartWakeWindow();
    if (!sleepingRef.current) return;
    if (stag) wakeStag();
    else if (fox) wakeFox();
    else if (garuda) wakeGaruda();
    else if (runeWolf) wakeRuneWolf();
    else setBeat(null);
  }, [
    active,
    restartWakeWindow,
    stag,
    fox,
    garuda,
    runeWolf,
    wakeStag,
    wakeFox,
    wakeGaruda,
    wakeRuneWolf,
  ]);

  useEffect(() => {
    if (!timedAsleep) return;
    cancelDrag();
    setWalking(true);
    if (stag) setStagPhase('sleep');
    else if (fox) setFoxPhase('sleep');
    else setBeat({ kind: 'trick', clip: 'idle', ms: Infinity });
  }, [timedAsleep, cancelDrag, stag, fox]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        // This view covers only the pet. Claim the touch immediately so moving
        // outside its original frame cannot cancel a drag or press a card below.
        onStartShouldSetPanResponder: () => active,
        onPanResponderGrant: () => {
          dragCompleted.current = false;
          freezePetForLift();
          wakePet();
          setDragPhase('lifted');
        },
        onPanResponderMove: (_event, gesture) => {
          if (!active) return;
          const next = clampDragPosition(
            {
              x: dragStart.current.x + gesture.dx,
              y: dragStart.current.y + gesture.dy,
            },
            boundsRef.current,
          );
          x.value = next.x;
          dragTop.value = next.y;
          if (Math.abs(gesture.dx) > 1) heading.value = gesture.dx > 0 ? 1 : -1;
        },
        onPanResponderRelease: (_event, gesture) => {
          if (!active) cancelDrag();
          else releaseDrag(gesture.dx, gesture.dy);
        },
        onPanResponderTerminate: cancelDrag,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }),
    [
      active,
      cancelDrag,
      dragTop,
      freezePetForLift,
      heading,
      releaseDrag,
      setDragPhase,
      wakePet,
      x,
    ],
  );
  if (!species || !pet || (!stag && walking === null)) return null;
  const trick = beat?.kind === 'trick' ? beat.clip : null;
  const stagClip: PixelPetAnyClipId =
    dragPhase === 'roam' && stagPhase === 'glide' ? 'fly' : 'move';
  const stagFlightPhase: CelestialStagFlightPhase | undefined = !stag
    ? undefined
    : dragPhase === 'circle'
      ? 'glide'
      : dragPhase === 'descend' || dragPhase === 'land'
        ? 'landing'
        : dragPhase === 'roam' &&
            (stagPhase === 'takeoff' ||
              stagPhase === 'flap' ||
              stagPhase === 'glide' ||
              stagPhase === 'landing')
          ? stagPhase
          : undefined;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {sceneUnlocked && (fox || garuda || runeWolf) && (
        <Animated.View
          pointerEvents="none"
          testID="home-pet-sleep-scene-anchor"
          style={[styles.pet, { left: horizontalInset }, sleepSceneAnchor]}
        >
          <HomeSleepScene
            key={`${garuda ? 'garuda' : runeWolf ? 'rune_wolf' : 'fox'}-${sleepSceneCycle}`}
            scene={garuda ? 'garuda' : runeWolf ? 'rune_wolf' : 'nine_tail_fox'}
            visible={
              foxSleeping ||
              (garudaSleeping && garudaLanded) ||
              runeWolfSleeping
            }
            active={active}
            viewportWidth={width}
            size={runeWolf ? runeWolfSleepSceneSize(width) : undefined}
          />
        </Animated.View>
      )}
      {sceneUnlocked && runeWolf && departingWolfScene && (
        <View
          key={departingWolfScene.id}
          pointerEvents="none"
          testID="home-pet-departing-wolf-scene"
          style={[
            styles.pet,
            {
              left: horizontalInset,
              transform: [
                { translateX: departingWolfScene.x },
                { translateY: laneTop + groundY },
              ],
            },
          ]}
        >
          <HomeSleepScene
            scene="rune_wolf"
            visible
            active={active}
            mode="withering"
            size={departingWolfScene.size}
            onFinished={() =>
              setDepartingWolfScene((current) =>
                current?.id === departingWolfScene.id ? null : current,
              )
            }
          />
        </View>
      )}
      {sceneUnlocked && garuda && departingGarudaScene && (
        <View
          key={departingGarudaScene.id}
          pointerEvents="none"
          testID="home-pet-departing-garuda-scene"
          style={[
            styles.pet,
            {
              left: horizontalInset,
              transform: [
                { translateX: departingGarudaScene.x },
                { translateY: laneTop + groundY },
              ],
            },
          ]}
        >
          <HomeSleepScene
            scene="garuda"
            visible
            active={active}
            mode="withering"
            viewportWidth={width}
            onFinished={() =>
              setDepartingGarudaScene((current) =>
                current?.id === departingGarudaScene.id ? null : current,
              )
            }
          />
        </View>
      )}
      {sceneUnlocked && fox && departingFoxScene && (
        <View
          key={departingFoxScene.id}
          pointerEvents="none"
          testID="home-pet-departing-scene"
          style={[
            styles.pet,
            {
              left: horizontalInset,
              transform: [
                { translateX: departingFoxScene.x },
                { translateY: laneTop + groundY },
              ],
            },
          ]}
        >
          <HomeSleepScene
            scene="nine_tail_fox"
            visible
            active={active}
            mode="withering"
            onFinished={() => finishFoxScene(departingFoxScene.id)}
          />
        </View>
      )}
      {sceneUnlocked && stag && departingGarden && (
        <View
          key={departingGarden.id}
          pointerEvents="none"
          testID="home-pet-departing-garden"
          style={[
            styles.pet,
            {
              transform: [
                { translateX: departingGarden.x },
                { translateY: laneTop + groundY },
                { scaleX: departingGarden.scaleX },
              ],
            },
          ]}
        >
          <HomeSleepGarden
            visible
            active={active}
            mode="withering"
            growthFrame={departingGarden.growthFrame}
            onFinished={() => finishGarden(departingGarden.id)}
          />
        </View>
      )}
      <Animated.View
        {...responder.panHandlers}
        pointerEvents={active ? 'box-only' : 'none'}
        accessible
        accessibilityRole={
          sleeping || foxSleeping || garudaSleeping || runeWolfSleeping
            ? 'button'
            : 'image'
        }
        accessibilityLabel={
          sleeping || foxSleeping || garudaSleeping || runeWolfSleeping
            ? `Đánh thức linh thú ${species.name}`
            : `Linh thú ${species.name}`
        }
        accessibilityHint="Chạm và kéo để di chuyển linh thú trên màn hình"
        onAccessibilityTap={active ? wakePet : undefined}
        testID={`home-pet-drag-${dragPhase}`}
        style={[
          styles.pet,
          fox && { left: horizontalInset },
          flight,
          dragPhase !== 'roam' &&
            (stag ? styles.stagPetLifted : styles.petLifted),
        ]}
      >
        {sceneUnlocked && stag && (
          <HomeSleepGarden visible={sleeping} active={active} />
        )}
        <PixelPetSprite
          species={species}
          stage={pet.stage}
          size={SIZE}
          clip={
            stag ? stagClip : garudaSleepFlight ? 'move' : (trick ?? 'move')
          }
          dragPhase={dragPhase}
          fallStyle={fallStyle}
          flightPhase={stagFlightPhase}
          loopMovement={stag ? true : garudaSleepFlight || !trick}
          walking={
            dragPhase !== 'roam'
              ? false
              : stag
                ? STAG_GROUND_PHASES.has(stagPhase)
                : (walking ?? !flier)
          }
          pace={
            stag &&
            ['walkToFlight', 'walkAfterLanding', 'settle'].includes(stagPhase)
              ? 'walk'
              : 'run'
          }
          gaitCycleDurationMs={stag ? stagGaitCycleMs : undefined}
          motionCanvasScale={stag ? STAG_MOTION_CANVAS_SCALE : undefined}
          active={active}
          sleeping={sleeping || foxSleeping}
          homeFoxPhase={fox && dragPhase === 'roam' ? foxPhase : undefined}
          homeMotion={dragPhase === 'roam' && !stag && !fox}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  pet: {
    position: 'absolute',
    top: 0,
    left: spacing.md,
    width: SIZE,
    height: SIZE,
  },
  petLifted: {
    zIndex: 10,
    elevation: 10,
    shadowColor: colors.earth,
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  stagPetLifted: { zIndex: 10, elevation: 10 },
});
