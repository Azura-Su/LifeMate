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
  Pressable,
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
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { PixelPetAnyClipId } from '../../types/pixelPet';
import { CELESTIAL_STAG_ID } from '../../services/pixelPet/celestialStagPuppet';
import {
  CELESTIAL_STAG_HOME_PHASE_DURATION as STAG_PHASE_DURATION,
  CELESTIAL_STAG_GARDEN_GROWTH_MS,
  celestialStagGardenFrameAt,
  type CelestialStagHomePhase,
  type CelestialStagFlightPhase,
} from '../../services/pixelPet/celestialStagAtlas';
import { scheduleOnRN } from 'react-native-worklets';
import { PixelPetSprite } from '../PixelPet/PixelPetSprite';
import { HomeSleepGarden } from './HomeSleepGarden';
import { pixelPetSpecies } from '../../services/pixelPet/pixelPetCatalog';
import { STAGE_LOOK } from '../../services/pixelPet/pixelPetRig';
import {
  petFacesLeft,
  petDragDurationMs,
  petMovementKind,
} from '../../services/pixelPet/pixelPetFrames';
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

const SIZE = 120;
/** Approximate ground travel represented by one authored 16-frame gait loop. */
const STAG_STRIDE_DISTANCE = SIZE * 0.32;
const STAG_MOTION_CANVAS_SCALE = 7 / 6;
const STAG_FLIGHT_HEIGHT = SIZE * 0.5;
/** Travel speeds in points per second. */
const FLY_SPEED = 60;
const WALK_SPEED = 32;
/** Drop from the flight lane until the feet rest on the tab bar's top edge. */
const GROUND_Y = SIZE * 0.24 + spacing.xs;
const LAND_MS = 900;
const TRICK_MS = 2600;
const REST_MS = 4000;
const DRAG_HOLD_MS = 250;
const DRAG_CANCEL_DISTANCE = 8;

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
  ground: ['idle', 'happy', 'eat', 'heal'],
  air: ['happy'],
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
  },
  random: () => number = Math.random,
): RoamBeat {
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
      const clip = list[Math.floor(random() * list.length)];
      return { kind: 'trick', clip, ms: clip === 'idle' ? REST_MS : TRICK_MS };
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
  headerBottom: number;
  onPress: () => void;
};

type DepartingGarden = {
  id: number;
  x: number;
  scaleX: number;
  growthFrame: number;
};

/** The owned pet roams above the tab bar: flies, lands, walks and plays. */
export function HomePetRoamer({
  uid,
  active,
  containerWidth,
  containerHeight,
  headerBottom,
  onPress,
}: Props) {
  const read = useCallback(() => (uid ? readOwnedPixelPet(uid) : null), [uid]);
  const pet = useSyncExternalStore(subscribeOwnedPixelPet, read, read);
  const species = pixelPetSpecies(pet?.speciesId ?? '');
  const reducedMotion = useReducedMotion();
  // The lane spans the screen; onLayout on a box-none overlay never fired.
  const window = useWindowDimensions();
  const width = containerWidth || window.width;
  const height = containerHeight || window.height;
  const range = Math.max(0, width - SIZE - spacing.md * 2);
  const laneTop = Math.max(0, height - SIZE - spacing.xs);
  const facing = species && petFacesLeft(species) ? -1 : 1;
  const flier = !!species && petMovementKind(species) === 'wings';
  const stag = species?.id === CELESTIAL_STAG_ID;
  const stagStrideDistance =
    STAG_STRIDE_DISTANCE *
    STAG_MOTION_CANVAS_SCALE *
    (pet ? STAGE_LOOK[pet.stage].scale : 1);
  const [walking, setWalking] = useState<boolean | null>(null);
  const [beat, setBeat] = useState<RoamBeat | null>(null);
  const [stagPhase, setStagPhase] = useState<StagHomePhase>('runA');
  const [stagGaitCycleMs, setStagGaitCycleMs] = useState<number>();
  const [departingGarden, setDepartingGarden] =
    useState<DepartingGarden | null>(null);
  const [dragPhase, setDragPhaseState] = useState<DragPhase>('roam');
  const dragPhaseRef = useRef<DragPhase>('roam');
  const stagStarted = useRef(false);
  const gardenDepartureId = useRef(0);
  const gardenStartedAt = useRef<number | null>(null);
  const lastSleepSpot = useRef<number | null>(null);
  const x = useSharedValue(0);
  const heading = useSharedValue(1);
  const ground = useSharedValue(walking ? 1 : 0);
  const travelling = useSharedValue(0);
  const sleepTarget = useSharedValue(0);
  const airHeight = useSharedValue(0);
  const dragTop = useSharedValue(0);
  const dragMode = useSharedValue(0);
  const dragScale = useSharedValue(1);
  const dragRotation = useSharedValue(0);
  const dragReady = useRef(false);
  const pressConsumed = useRef(false);
  const dragging = useRef(false);
  const dragCompleted = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallStyle = petFallStyle(species?.id ?? '');
  const bounds: DragBounds = {
    minX: 0,
    maxX: range,
    minY: headerBottom,
    maxY: Math.max(headerBottom, laneTop + GROUND_Y),
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
    dragPhase === 'roam';
  const sleeping = stag && stagPhase === 'sleep';
  const roaming =
    !!species &&
    !!pet &&
    !stag &&
    walking !== null &&
    active &&
    !reducedMotion &&
    range > 0 &&
    dragPhase === 'roam';

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
      gardenStartedAt.current === null
        ? CELESTIAL_STAG_GARDEN_GROWTH_MS
        : Date.now() - gardenStartedAt.current,
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

  const setDragPhase = useCallback((phase: DragPhase) => {
    dragPhaseRef.current = phase;
    setDragPhaseState(phase);
  }, []);

  const clearPressTimer = useCallback(() => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }, []);

  const currentRoamTop = useCallback(
    () =>
      laneTop +
      ground.value * GROUND_Y -
      airHeight.value * STAG_FLIGHT_HEIGHT +
      Math.sin((x.value / 40) * Math.PI) *
        5 *
        (1 - ground.value) *
        travelling.value,
    [airHeight, ground, laneTop, travelling, x],
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
      else if (flier) setWalking(true);
    }
  }, [
    airHeight,
    dragMode,
    dragRotation,
    dragScale,
    fallStyle,
    flier,
    ground,
    reducedMotion,
    setDragPhase,
    stag,
  ]);

  const releaseDrag = useCallback(
    (dx = 0, dy = 0) => {
      if (dragCompleted.current) return;
      dragCompleted.current = true;
      clearPressTimer();
      const position = clampDragPosition(
        { x: dragStart.current.x + dx, y: dragStart.current.y + dy },
        boundsRef.current,
      );
      x.value = position.x;
      dragTop.value = position.y;
      dragReady.current = false;
      dragging.current = false;
      const next = nextDragPhase(dragPhaseRef.current, 'release', {
        fallStyle,
        airborne: position.y < groundTop - 1,
        reducedMotion,
      });
      setDragPhase(next);
    }, [clearPressTimer, dragTop, fallStyle, groundTop, reducedMotion, setDragPhase, x],
  );

  const beginPress = useCallback(() => {
    if (!active) return;
    clearPressTimer();
    dragReady.current = false;
    pressConsumed.current = false;
    dragCompleted.current = false;
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      if (!active) return;
      dragReady.current = true;
      pressConsumed.current = true;
      freezePetForLift();
      if (sleeping) wakeStag();
      setDragPhase('lifted');
    }, DRAG_HOLD_MS);
  }, [
    active,
    clearPressTimer,
    freezePetForLift,
    setDragPhase,
    sleeping,
    wakeStag,
  ]);

  const endPress = useCallback(() => {
    clearPressTimer();
    if (!active) return;
    if (!dragReady.current || dragging.current || dragCompleted.current) return;
    const top = clampDragPosition(
      { x: x.value, y: dragMode.value ? dragTop.value : currentRoamTop() },
      boundsRef.current,
    );
    dragStart.current = top;
    dragTop.value = top.y;
    dragMode.value = 1;
    releaseDrag();
  }, [active, clearPressTimer, currentRoamTop, dragMode, dragTop, releaseDrag, x]);

  const cancelDrag = useCallback(() => {
    clearPressTimer();
    dragReady.current = false;
    dragging.current = false;
    dragCompleted.current = true;
    cancelAnimation(x);
    cancelAnimation(ground);
    cancelAnimation(airHeight);
    cancelAnimation(dragScale);
    cancelAnimation(dragRotation);
    travelling.value = 0;
    dragMode.value = 0;
    dragTop.value = groundTop;
    dragScale.value = 1;
    dragRotation.value = 0;
    ground.value = 1;
    airHeight.value = 0;
    setDragPhase('roam');
    if (stag) setStagPhase('runB');
    else if (flier) setWalking(true);
  }, [
    airHeight,
    clearPressTimer,
    dragMode,
    dragRotation,
    dragScale,
    dragTop,
    flier,
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
      dragScale.value = reducedMotion
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
        withTiming(rightX, { duration: 500, easing: Easing.inOut(Easing.quad) }),
        withTiming(leftX, { duration: 500, easing: Easing.inOut(Easing.quad) }),
        withTiming(startX, { duration: 500, easing: Easing.inOut(Easing.quad) }),
      );
      const remainingHeight = Math.max(0, groundTop - dragTop.value);
      const circleTop = groundTop - Math.min(SIZE * 0.3, remainingHeight * 0.4);
      dragTop.value = withTiming(circleTop, { duration });
    } else if (dragPhase === 'fall' || dragPhase === 'descend') {
      dragTop.value = withTiming(groundTop, {
        duration,
        easing:
          dragPhase === 'descend' || fallStyle === 'coil' || fallStyle === 'flop'
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
        dragScale.value = withSequence(
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
    x,
  ]);

  useEffect(() => {
    if (!active) {
      clearPressTimer();
      dragReady.current = false;
      if (dragPhaseRef.current !== 'roam') cancelDrag();
    }
  }, [active, cancelDrag, clearPressTimer]);

  useEffect(() => {
    return () => {
      clearPressTimer();
      cancelAnimation(dragTop);
      cancelAnimation(dragRotation);
      cancelAnimation(dragScale);
    };
  }, [clearPressTimer, dragRotation, dragScale, dragTop]);

  const finishGarden = useCallback((id: number) => {
    setDepartingGarden((current) => (current?.id === id ? null : current));
  }, []);

  useEffect(() => {
    if (!active) setDepartingGarden(null);
  }, [active]);

  const advance = useCallback(() => {
    setBeat((previous) =>
      nextRoamBeat(previous?.kind ?? null, {
        x: x.value,
        range,
        walking: walking ?? !flier,
        flier,
        stag,
      }),
    );
  }, [x, range, walking, flier, stag]);

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
    if (stag && stagPhase === 'sleep' && active) {
      gardenStartedAt.current = Date.now();
    } else if (stagPhase !== 'sleep') {
      gardenStartedAt.current = null;
    }
  }, [active, stag, stagPhase]);

  useEffect(() => {
    if (!stagActive || stagPhase === 'sleep') return;
    const timer = setTimeout(
      () => setStagPhase(STAG_NEXT_PHASE[stagPhase]),
      STAG_PHASE_DURATION[stagPhase],
    );
    return () => clearTimeout(timer);
  }, [stagActive, stagPhase]);

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
      setBeat(null);
      return;
    }
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
    return {
      transform: [
        { translateX: x.value },
        {
          translateY: dragMode.value
            ? dragTop.value
            : laneTop +
              g * GROUND_Y -
              airHeight.value * STAG_FLIGHT_HEIGHT +
              bob * travelling.value,
        },
        { rotate: `${dragRotation.value}deg` },
        { scaleX: heading.value * facing },
        { scale: dragScale.value },
      ],
    };
  });

  const handlePress = () => {
    if (pressConsumed.current) return;
    if (sleeping) {
      wakeStag();
      return;
    }
    onPress();
  };
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponderCapture: (_event, gesture) => {
          if (!active) return false;
          const distance = Math.hypot(gesture.dx, gesture.dy);
          if (!dragReady.current && distance > DRAG_CANCEL_DISTANCE) {
            clearPressTimer();
            return false;
          }
          if (dragReady.current && distance > 0) {
            // Pressable may emit pressOut while its child loses the responder.
            // Mark the gesture before that callback so it cannot land early.
            dragging.current = true;
            return true;
          }
          return false;
        },
        onPanResponderGrant: () => {
          clearPressTimer();
          dragging.current = true;
          dragCompleted.current = false;
          cancelAnimation(x);
          cancelAnimation(ground);
          cancelAnimation(airHeight);
          cancelAnimation(dragTop);
          const start = clampDragPosition(
            {
              x: x.value,
              y: dragMode.value ? dragTop.value : currentRoamTop(),
            },
            boundsRef.current,
          );
          travelling.value = 0;
          dragStart.current = start;
          x.value = start.x;
          dragTop.value = start.y;
          dragMode.value = 1;
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
          if (Math.abs(gesture.dx) > 1)
            heading.value = gesture.dx > 0 ? 1 : -1;
        },
        onPanResponderRelease: (_event, gesture) => {
          if (!active) cancelDrag();
          else releaseDrag(gesture.dx, gesture.dy);
        },
        onPanResponderTerminate: cancelDrag,
        onPanResponderTerminationRequest: () => !dragging.current,
      }),
    [
      active,
      airHeight,
      cancelDrag,
      clearPressTimer,
      currentRoamTop,
      dragMode,
      dragTop,
      ground,
      heading,
      releaseDrag,
      travelling,
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
      {stag && departingGarden && (
        <View
          key={departingGarden.id}
          pointerEvents="none"
          testID="home-pet-departing-garden"
          style={[
            styles.pet,
            {
              transform: [
                { translateX: departingGarden.x },
                { translateY: laneTop + GROUND_Y },
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
        testID={`home-pet-drag-${dragPhase}`}
        style={[
          styles.pet,
          flight,
          dragPhase !== 'roam' && styles.petLifted,
        ]}
      >
        {stag && <HomeSleepGarden visible={sleeping} active={active} />}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            sleeping
              ? `Đánh thức linh thú ${species.name}`
              : `Mở linh thú ${species.name}`
          }
          onPress={handlePress}
          onPressIn={beginPress}
          onPressOut={endPress}
          hitSlop={spacing.sm}
        >
          <PixelPetSprite
            species={species}
            stage={pet.stage}
            size={SIZE}
            clip={stag ? stagClip : (trick ?? 'move')}
            dragPhase={dragPhase}
            fallStyle={fallStyle}
            flightPhase={stagFlightPhase}
            loopMovement={stag ? true : !trick}
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
            sleeping={sleeping}
          />
        </Pressable>
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
});
