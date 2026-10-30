import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  PanResponder,
  StyleSheet,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import {
  HomePetRoamer,
  isGarudaHomeSleeping,
  garudaSleepTargetX,
  nextRoamBeat,
} from '../HomePetRoamer';
import { PixelPetSprite } from '../../PixelPet/PixelPetSprite';
import { HomeSleepGarden } from '../HomeSleepGarden';
import { HomeSleepScene } from '../HomeSleepScene';
import {
  PIXEL_PET_SPECIES,
  PIXEL_PET_EXCLUSIVE,
} from '../../../services/pixelPet/pixelPetCatalog';
import {
  CELESTIAL_STAG_HOME_PHASE_DURATION,
  CELESTIAL_STAG_GARDEN_GROWTH_MS,
  celestialStagGardenFrameAt,
} from '../../../services/pixelPet/celestialStagAtlas';
import { NINE_TAIL_FOX_HOME_PHASE_DURATION } from '../../../services/pixelPet/nineTailFoxHome';
import { spacing } from '../../../theme';

const FOX_BEFORE_SLEEP_MS = (
  ['walk', 'run', 'jump', 'turn', 'land', 'walkAway'] as const
).reduce((total, phase) => total + NINE_TAIL_FOX_HOME_PHASE_DURATION[phase], 0);

jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    ...jest.requireActual('react-native-reanimated/mock'),
    useReducedMotion: () => false,
    useSharedValue: (value: number) => React.useRef({ value }).current,
    // Phase timers drive this controller test; complete one-shot art explicitly.
    withTiming: (value: number) => value,
    withSequence: (...values: number[]) => values[values.length - 1],
  };
});
jest.mock('react-native-worklets', () =>
  jest.requireActual('react-native-worklets/src/mock'),
);
const pets: Record<string, unknown> = {
  owner: { speciesId: 'phoenix', stage: 'juvenile', level: 5, totalExp: 40 },
  stag: {
    speciesId: 'celestial_stag',
    stage: 'juvenile',
    level: 5,
    totalExp: 40,
  },
  fox: {
    speciesId: 'nine_tail_fox',
    stage: 'juvenile',
    level: 5,
    totalExp: 40,
  },
  garuda: {
    speciesId: 'garuda',
    stage: 'juvenile',
    level: 5,
    totalExp: 40,
  },
};
jest.mock('../../../services/pixelPet/pixelPetApi', () => ({
  readOwnedPixelPet: (uid: string) => pets[uid] ?? null,
  subscribeOwnedPixelPet: () => () => {},
}));

const renderRoamer = (props: { uid: string | null; active: boolean }) =>
  render(
    <HomePetRoamer
      {...props}
      containerWidth={390}
      containerHeight={844}
      topInset={59}
    />,
  );

it('shows the owned pet without exposing a detail navigation action', () => {
  renderRoamer({ uid: 'owner', active: true });
  expect(screen.UNSAFE_getByType(PixelPetSprite).props).toMatchObject({
    clip: 'move',
    loopMovement: true,
    active: true,
    size: 120,
  });
  expect(
    screen.getByRole('image', { name: 'Linh thú Phượng Hoàng' }),
  ).toBeTruthy();
  expect(screen.queryByLabelText(/Mở linh thú/)).toBeNull();
  expect(
    screen.getByTestId('home-pet-drag-roam').props.onPress,
  ).toBeUndefined();
});

it('uses the species Home motion atlas while roaming outside drag phases', () => {
  renderRoamer({ uid: 'owner', active: true });

  expect(screen.UNSAFE_getByType(PixelPetSprite).props).toMatchObject({
    homeMotion: true,
  });
});

it('lets the Nine-Tailed Fox roam close to both screen edges', () => {
  renderRoamer({ uid: 'fox', active: true });

  expect(
    StyleSheet.flatten(screen.getByTestId('home-pet-drag-roam').props.style)
      .left,
  ).toBe(25);
});

it('shows the Nine-Tailed Fox shrine scene when the fox reaches sleep', () => {
  jest.useFakeTimers();
  const view = renderRoamer({ uid: 'fox', active: true });
  try {
    for (const phase of ['walk', 'run', 'jump', 'turn', 'land'] as const) {
      act(() =>
        jest.advanceTimersByTime(NINE_TAIL_FOX_HOME_PHASE_DURATION[phase]),
      );
    }
    act(() =>
      jest.advanceTimersByTime(NINE_TAIL_FOX_HOME_PHASE_DURATION.walkAway),
    );

    // The fox's authored sequence is shorter than its mandatory awake window.
    act(() => jest.advanceTimersByTime(20_000 - FOX_BEFORE_SLEEP_MS));
    expect(screen.getByTestId('home-pet-sleep-scene')).toBeTruthy();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('home-pet-sleep-scene').props.style,
      ),
    ).toMatchObject({ width: 240, height: 240, left: -60 });
    expect(screen.UNSAFE_getByType(HomeSleepScene).props).toMatchObject({
      scene: 'nine_tail_fox',
      visible: true,
      active: true,
    });
    view.rerender(
      <HomePetRoamer
        uid="fox"
        active={false}
        containerWidth={390}
        containerHeight={844}
        topInset={59}
      />,
    );
    expect(screen.UNSAFE_getByType(HomeSleepScene).props).toMatchObject({
      visible: true,
      active: false,
    });
    view.rerender(
      <HomePetRoamer
        uid="fox"
        active
        containerWidth={390}
        containerHeight={844}
        topInset={59}
      />,
    );
    expect(screen.UNSAFE_getByType(HomeSleepScene).props).toMatchObject({
      visible: true,
      active: true,
    });
    const getTranslateX = (testID: string) => {
      const transforms = StyleSheet.flatten(
        screen.getByTestId(testID).props.style,
      ).transform as { translateX?: number }[];
      return transforms.find((transform) => 'translateX' in transform)
        ?.translateX;
    };
    expect(getTranslateX('home-pet-drag-roam')).toBe(
      getTranslateX('home-pet-sleep-scene-anchor'),
    );
  } finally {
    view.unmount();
    jest.useRealTimers();
  }
});

it('selects the Garuda mountain scene while the bird is in its idle rest beat', () => {
  expect(
    isGarudaHomeSleeping(true, { kind: 'trick', clip: 'idle', ms: 4000 }),
  ).toBe(true);
  expect(
    isGarudaHomeSleeping(true, { kind: 'trick', clip: 'happy', ms: 2600 }),
  ).toBe(false);
  expect(
    isGarudaHomeSleeping(false, { kind: 'trick', clip: 'idle', ms: 4000 }),
  ).toBe(false);
});

it('keeps the full Garuda sleep scene inside the screen edges', () => {
  const width = 390;
  const inset = 16;
  const x = garudaSleepTargetX(width, inset);
  const sceneSize = 250;
  const sceneLeft = inset + x - (sceneSize - 120) / 2;

  expect(x).toBe(119);
  expect(sceneLeft).toBeGreaterThanOrEqual(0);
  expect(sceneLeft + sceneSize).toBeLessThanOrEqual(width);
});

it('shrinks and centers Garuda scene on a narrow Home viewport', () => {
  const width = 262;
  const inset = 16;
  const sceneSize = 230;
  const x = garudaSleepTargetX(width, inset, sceneSize);
  const sceneLeft = inset + x - (sceneSize - 120) / 2;

  expect(x).toBe(55);
  expect(sceneLeft).toBe(16);
  expect(sceneLeft + sceneSize).toBe(width - inset);
});

it('mounts the Garuda sleep-scene anchor behind its Home sprite', () => {
  renderRoamer({ uid: 'garuda', active: false });

  expect(screen.UNSAFE_getByType(HomeSleepScene).props).toMatchObject({
    scene: 'garuda',
    visible: false,
    active: false,
    viewportWidth: 390,
    size: 250,
  });
  expect(screen.getByTestId('home-pet-sleep-scene-anchor')).toBeTruthy();
});

it('leaves the Fox sleep scene at its old spot while blossoms and the gate decay', () => {
  jest.useFakeTimers();
  const view = renderRoamer({ uid: 'fox', active: true });
  try {
    for (const phase of [
      'walk',
      'run',
      'jump',
      'turn',
      'land',
      'walkAway',
    ] as const) {
      act(() =>
        jest.advanceTimersByTime(NINE_TAIL_FOX_HOME_PHASE_DURATION[phase]),
      );
    }
    act(() => jest.advanceTimersByTime(20_000 - FOX_BEFORE_SLEEP_MS));
    const anchor = () =>
      StyleSheet.flatten(
        screen.getByTestId('home-pet-sleep-scene-anchor').props.style,
      ).transform[0].translateX;
    const sleepSpot = anchor();

    fireEvent(screen.getByLabelText(/Đánh thức linh thú/), 'accessibilityTap');

    expect(screen.getByTestId('home-pet-departing-scene')).toBeTruthy();
    const witheringScene = screen
      .UNSAFE_getAllByType(HomeSleepScene)
      .find((scene) => scene.props.mode === 'withering');
    expect(witheringScene?.props).toMatchObject({
      visible: true,
      active: true,
      mode: 'withering',
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('home-pet-departing-scene').props.style,
      ).transform[0].translateX,
    ).toBe(sleepSpot);

    act(() => witheringScene?.props.onFinished());
    expect(screen.queryByTestId('home-pet-departing-scene')).toBeNull();
  } finally {
    view.unmount();
    jest.useRealTimers();
  }
});

it('shows nothing without an owned pet', () => {
  renderRoamer({ uid: 'nobody', active: true });
  expect(screen.queryByRole('button')).toBeNull();
});

it('captures a direct drag immediately and keeps it after leaving the pet frame', () => {
  jest.useFakeTimers();
  const responderSpy = jest.spyOn(PanResponder, 'create');
  const view = renderRoamer({ uid: 'owner', active: true });
  const responder = () =>
    responderSpy.mock.calls[responderSpy.mock.calls.length - 1][0];
  const event = {} as GestureResponderEvent;
  const gesture = (dx: number, dy: number) =>
    ({ dx, dy }) as PanResponderGestureState;

  try {
    expect(
      responder().onStartShouldSetPanResponder!(event, gesture(0, 0)),
    ).toBe(true);
    act(() => responder().onPanResponderGrant!(event, gesture(0, 0)));
    const liftedPet = screen.getByTestId('home-pet-drag-lifted');
    expect(screen.UNSAFE_getByType(PixelPetSprite).props.homeMotion).toBe(
      false,
    );
    const startTop = StyleSheet.flatten(liftedPet.props.style).transform.find(
      (transform: { translateY?: number }) => 'translateY' in transform,
    ).translateY;
    expect(liftedPet).toBeTruthy();
    expect(StyleSheet.flatten(liftedPet.props.style)).toMatchObject({
      zIndex: 10,
      elevation: 10,
      shadowOpacity: 0.24,
      shadowRadius: 12,
    });
    expect(
      responder().onPanResponderTerminationRequest!(event, gesture(40, -50)),
    ).toBe(false);
    expect(screen.getByTestId('home-pet-drag-lifted')).toBeTruthy();
    act(() => {
      responder().onPanResponderMove!(event, gesture(40, -50));
      responder().onPanResponderRelease!(event, gesture(40, -50));
    });
    expect(screen.getByTestId('home-pet-drag-circle')).toBeTruthy();
    view.rerender(
      <HomePetRoamer
        uid="owner"
        active
        containerWidth={390}
        containerHeight={844}
        topInset={59}
      />,
    );
    // Winged pets circle at the height where they were dropped before landing.
    expect(
      StyleSheet.flatten(screen.getByTestId('home-pet-drag-circle').props.style)
        .transform,
    ).toEqual(expect.arrayContaining([{ translateY: startTop - 50 }]));
    expect(
      StyleSheet.flatten(
        screen.getByTestId('home-pet-drag-circle').props.style,
      ),
    ).toMatchObject({ zIndex: 10, elevation: 10 });
    act(() => jest.advanceTimersByTime(1500));
    expect(screen.getByTestId('home-pet-drag-descend')).toBeTruthy();
    act(() => jest.advanceTimersByTime(750));
    expect(screen.getByTestId('home-pet-drag-land')).toBeTruthy();
    act(() => jest.advanceTimersByTime(180));
    expect(screen.getByTestId('home-pet-drag-roam')).toBeTruthy();
  } finally {
    view.unmount();
    responderSpy.mockRestore();
    jest.useRealTimers();
  }
});

it('keeps the Celestial Stag sharp after releasing it in the air', () => {
  jest.useFakeTimers();
  const responderSpy = jest.spyOn(PanResponder, 'create');
  const view = renderRoamer({ uid: 'stag', active: true });
  const responder = () =>
    responderSpy.mock.calls[responderSpy.mock.calls.length - 1][0];
  const event = {} as GestureResponderEvent;
  const gesture = (dx: number, dy: number) =>
    ({ dx, dy }) as PanResponderGestureState;
  const expectCrispLift = (phase: string) =>
    expect(
      StyleSheet.flatten(
        screen.getByTestId(`home-pet-drag-${phase}`).props.style,
      ).shadowOpacity,
    ).toBeUndefined();

  try {
    act(() => responder().onPanResponderGrant!(event, gesture(0, 0)));
    const liftedStyle = StyleSheet.flatten(
      screen.getByTestId('home-pet-drag-lifted').props.style,
    );
    expect(liftedStyle.shadowOpacity).toBeUndefined();
    act(() => {
      responder().onPanResponderMove!(event, gesture(20, -80));
      responder().onPanResponderRelease!(event, gesture(20, -80));
    });
    expect(screen.getByTestId('home-pet-drag-circle')).toBeTruthy();
    expectCrispLift('circle');
    act(() => jest.advanceTimersByTime(1500));
    expect(screen.getByTestId('home-pet-drag-descend')).toBeTruthy();
    expectCrispLift('descend');
    act(() => jest.advanceTimersByTime(750));
    expect(screen.getByTestId('home-pet-drag-land')).toBeTruthy();
    expectCrispLift('land');
  } finally {
    view.unmount();
    responderSpy.mockRestore();
    jest.useRealTimers();
  }
});

it('follows the pointer to all four edges, including the Home header', () => {
  const responderSpy = jest.spyOn(PanResponder, 'create');
  const view = renderRoamer({ uid: 'owner', active: true });
  const responder =
    responderSpy.mock.calls[responderSpy.mock.calls.length - 1][0];
  const event = {} as GestureResponderEvent;
  const move = (dx: number, dy: number) => {
    act(() =>
      responder.onPanResponderMove!(event, {
        dx,
        dy,
      } as PanResponderGestureState),
    );
    view.rerender(
      <HomePetRoamer
        uid="owner"
        active
        containerWidth={390}
        containerHeight={844}
        topInset={59}
      />,
    );
    return StyleSheet.flatten(
      screen.getByTestId('home-pet-drag-lifted').props.style,
    ).transform;
  };
  try {
    act(() =>
      responder.onPanResponderGrant!(event, {} as PanResponderGestureState),
    );
    expect(move(-1000, -1000)).toEqual(
      expect.arrayContaining([{ translateX: 0 }, { translateY: 59 }]),
    );
    expect(move(1000, -1000)).toEqual(
      expect.arrayContaining([{ translateX: 246 }, { translateY: 59 }]),
    );
    const lowerRight = move(1000, 1000);
    expect(lowerRight).toEqual(expect.arrayContaining([{ translateX: 246 }]));
    const lowerLeft = move(-1000, 1000);
    expect(lowerLeft).toEqual(expect.arrayContaining([{ translateX: 0 }]));
    const bottom = lowerLeft.find(
      (transform: { translateY?: number }) => 'translateY' in transform,
    ).translateY;
    expect(bottom).toBeGreaterThan(724);
    expect(bottom).toBeLessThan(844);
    expect(lowerRight).toEqual(
      expect.arrayContaining([{ translateY: bottom }]),
    );
  } finally {
    view.unmount();
    responderSpy.mockRestore();
  }
});

it('cancels a drag when Home becomes inactive and stops accepting touches', () => {
  jest.useFakeTimers();
  const responderSpy = jest.spyOn(PanResponder, 'create');
  const view = renderRoamer({ uid: 'owner', active: true });
  const responder = () =>
    responderSpy.mock.calls[responderSpy.mock.calls.length - 1][0];
  try {
    act(() =>
      responder().onPanResponderGrant!(
        {} as GestureResponderEvent,
        {} as PanResponderGestureState,
      ),
    );
    view.rerender(
      <HomePetRoamer
        uid="owner"
        active={false}
        containerWidth={390}
        containerHeight={844}
        topInset={59}
      />,
    );
    act(() => jest.advanceTimersByTime(100));
    expect(screen.getByTestId('home-pet-drag-roam')).toBeTruthy();
    expect(screen.getByTestId('home-pet-drag-roam').props.pointerEvents).toBe(
      'none',
    );
    expect(
      responder().onStartShouldSetPanResponder!(
        {} as GestureResponderEvent,
        {} as PanResponderGestureState,
      ),
    ).toBe(false);
  } finally {
    view.unmount();
    responderSpy.mockRestore();
    jest.useRealTimers();
  }
});

it('lands a woken Stag into runB and keeps it awake for the full 20 seconds', () => {
  jest.useFakeTimers();
  const responderSpy = jest.spyOn(PanResponder, 'create');
  const view = renderRoamer({ uid: 'stag', active: true });
  const responder = () =>
    responderSpy.mock.calls[responderSpy.mock.calls.length - 1][0];
  const event = {} as GestureResponderEvent;
  const gesture = { dx: 0, dy: 0 } as PanResponderGestureState;
  const sprite = () => screen.UNSAFE_getByType(PixelPetSprite).props;
  const advance = (phase: keyof typeof CELESTIAL_STAG_HOME_PHASE_DURATION) =>
    act(() =>
      jest.advanceTimersByTime(CELESTIAL_STAG_HOME_PHASE_DURATION[phase]),
    );

  try {
    for (const phase of [
      'runA',
      'walkToFlight',
      'takeoff',
      'flap',
      'glide',
      'landing',
      'walkAfterLanding',
      'runB',
      'settle',
    ] as const)
      advance(phase);
    expect(sprite().sleeping).toBe(true);
    const heldResponder = responder();
    act(() => responder().onPanResponderGrant!(event, gesture));
    expect(sprite().sleeping).toBe(false);
    expect(responder()).toBe(heldResponder);
    act(() => {
      responder().onPanResponderRelease!(event, gesture);
    });
    expect(sprite()).toMatchObject({
      dragPhase: 'land',
      clip: 'move',
      flightPhase: 'landing',
    });
    act(() => jest.advanceTimersByTime(180));
    expect(sprite()).toMatchObject({ walking: true, sleeping: false });
    advance('runB');
    advance('settle');
    expect(sprite().sleeping).toBe(false);
    const remaining =
      20_000 -
      180 -
      CELESTIAL_STAG_HOME_PHASE_DURATION.runB -
      CELESTIAL_STAG_HOME_PHASE_DURATION.settle;
    act(() => jest.advanceTimersByTime(remaining - 1));
    expect(sprite().sleeping).toBe(false);
    act(() => jest.advanceTimersByTime(1));
    expect(sprite().sleeping).toBe(true);
  } finally {
    view.unmount();
    responderSpy.mockRestore();
    jest.useRealTimers();
  }
});

it('completes the Stag flight and grounded approach before sleeping at 20 seconds', () => {
  jest.useFakeTimers();
  const view = renderRoamer({ uid: 'stag', active: true });
  const sprite = () => screen.UNSAFE_getByType(PixelPetSprite).props;
  const advance = (phase: keyof typeof CELESTIAL_STAG_HOME_PHASE_DURATION) => {
    act(() =>
      jest.advanceTimersByTime(CELESTIAL_STAG_HOME_PHASE_DURATION[phase]),
    );
  };
  try {
    expect(sprite()).toMatchObject({ walking: true, sleeping: false });
    advance('runA');
    expect(sprite().gaitCycleDurationMs).toBeCloseTo(1232);
    advance('walkToFlight');
    expect(sprite()).toMatchObject({ flightPhase: 'takeoff', walking: false });
    advance('takeoff');
    expect(sprite().flightPhase).toBe('flap');
    advance('flap');
    expect(sprite()).toMatchObject({ flightPhase: 'glide', clip: 'fly' });
    advance('glide');
    expect(sprite().flightPhase).toBe('landing');
    advance('landing');
    expect(sprite()).toMatchObject({ walking: true, flightPhase: undefined });
    expect(sprite().gaitCycleDurationMs).toBeCloseTo(1232);
    advance('walkAfterLanding');
    advance('runB');
    expect(sprite()).toMatchObject({ walking: true, sleeping: false });
    if (sprite().gaitCycleDurationMs > 0)
      expect(sprite().gaitCycleDurationMs).toBeGreaterThanOrEqual(1232 - 0.01);
    advance('settle');
    expect(sprite().sleeping).toBe(true);
    fireEvent(screen.getByLabelText(/Đánh thức linh thú/), 'accessibilityTap');
    expect(sprite().sleeping).toBe(false);
  } finally {
    view.unmount();
    jest.useRealTimers();
  }
});

it('keeps the sleeping pose and garden growth progress when Home loses focus', () => {
  jest.useFakeTimers();
  const view = renderRoamer({ uid: 'stag', active: true });
  const phases = Object.entries(CELESTIAL_STAG_HOME_PHASE_DURATION).filter(
    ([, duration]) => Number.isFinite(duration),
  );
  const advance = (duration: number) =>
    act(() => jest.advanceTimersByTime(duration));
  const sprite = () => screen.UNSAFE_getByType(PixelPetSprite).props;

  try {
    for (const [, duration] of phases) advance(duration);
    advance(CELESTIAL_STAG_GARDEN_GROWTH_MS / 2);
    expect(sprite().sleeping).toBe(true);

    view.rerender(
      <HomePetRoamer
        uid="stag"
        active={false}
        containerWidth={390}
        containerHeight={844}
        topInset={59}
      />,
    );
    advance(10_000);
    view.rerender(
      <HomePetRoamer
        uid="stag"
        active
        containerWidth={390}
        containerHeight={844}
        topInset={59}
      />,
    );
    expect(sprite().sleeping).toBe(true);
    expect(
      screen
        .UNSAFE_getAllByType(HomeSleepGarden)
        .some(
          (garden) => garden.props.visible && garden.props.mode !== 'withering',
        ),
    ).toBe(true);

    fireEvent(screen.getByLabelText(/Đánh thức linh thú/), 'accessibilityTap');
    const witheringGarden = screen
      .UNSAFE_getAllByType(HomeSleepGarden)
      .find((garden) => garden.props.mode === 'withering');
    expect(witheringGarden?.props.growthFrame).toBe(
      celestialStagGardenFrameAt(CELESTIAL_STAG_GARDEN_GROWTH_MS / 2),
    );
  } finally {
    view.unmount();
    jest.useRealTimers();
  }
});

it('leaves a withering garden at the old sleep spot while the Stag moves away', () => {
  jest.useFakeTimers();
  const random = jest.spyOn(Math, 'random').mockReturnValue(0.2);
  const view = renderRoamer({ uid: 'stag', active: true });
  const phases = Object.entries(CELESTIAL_STAG_HOME_PHASE_DURATION).filter(
    ([, duration]) => Number.isFinite(duration),
  );
  const advance = (duration: number) =>
    act(() => jest.advanceTimersByTime(duration));
  const decay = () =>
    screen
      .UNSAFE_getAllByType(HomeSleepGarden)
      .find((garden) => garden.props.mode === 'withering')!;
  try {
    for (const [, duration] of phases) advance(duration);
    advance(CELESTIAL_STAG_GARDEN_GROWTH_MS);
    fireEvent(screen.getByLabelText(/Đánh thức linh thú/), 'accessibilityTap');
    expect(decay().props).toMatchObject({ visible: true, growthFrame: 15 });
    const oldTransform = screen.getByTestId('home-pet-departing-garden').props
      .style[1].transform;
    const oldFinished = decay().props.onFinished;
    expect(oldTransform[0].translateX).toBeGreaterThan(0);
    advance(CELESTIAL_STAG_HOME_PHASE_DURATION.runA);
    expect(
      screen.getByTestId('home-pet-departing-garden').props.style[1].transform,
    ).toEqual(oldTransform);
    act(() => oldFinished());
    expect(screen.queryByTestId('home-pet-departing-garden')).toBeNull();
    for (const [, duration] of phases.slice(1)) advance(duration);
    advance(CELESTIAL_STAG_GARDEN_GROWTH_MS);
    fireEvent(screen.getByLabelText(/Đánh thức linh thú/), 'accessibilityTap');
    // An already queued callback from the first scene cannot clear a later scene.
    act(() => oldFinished());
    expect(screen.getByTestId('home-pet-departing-garden')).toBeTruthy();
    act(() => decay().props.onFinished());
    expect(screen.queryByTestId('home-pet-departing-garden')).toBeNull();
  } finally {
    view.unmount();
    random.mockRestore();
    jest.useRealTimers();
  }
});

describe('nextRoamBeat', () => {
  const at = { x: 0, range: 300, walking: true, flier: true, stag: true };
  const rolls =
    (...values: number[]) =>
    () =>
      values.shift() ?? 0;

  it('travels at least a third of the bar away', () => {
    expect(nextRoamBeat(null, at, rolls(0.1))).toEqual({
      kind: 'travel',
      to: 300,
      ms: (300 / 32) * 1000,
    });
  });

  it('stops for a trick after travelling', () => {
    expect(nextRoamBeat('travel', at, rolls(0.1, 0.4))).toMatchObject({
      kind: 'trick',
      clip: 'bow',
    });
  });

  it('lands or takes off only with wings', () => {
    expect(nextRoamBeat('travel', at, rolls(0.7))).toEqual({ kind: 'shift' });
    expect(
      nextRoamBeat('travel', { ...at, flier: false }, rolls(0.7, 0.9)).kind,
    ).toBe('travel');
  });

  it('rests Garuda after it lands from flight so its sleep scene is shown', () => {
    expect(
      nextRoamBeat(
        'shift',
        { ...at, walking: true, garuda: true },
        rolls(0.99),
      ),
    ).toEqual({ kind: 'trick', clip: 'idle', ms: 7500 });
  });
});

describe('Home wake window', () => {
  it.each(
    [...PIXEL_PET_SPECIES, ...PIXEL_PET_EXCLUSIVE].map((species) => species.id),
  )(
    '%s sleeps within 20 seconds and waits for a touch in Home preview',
    (speciesId) => {
      jest.useFakeTimers();
      const view = render(
        <HomePetRoamer
          uid={null}
          preview={{ speciesId, stage: 'juvenile' }}
          active
          containerWidth={390}
          containerHeight={844}
          topInset={59}
        />,
      );
      try {
        for (let i = 0; i < 39; i++) {
          act(() => jest.advanceTimersByTime(500));
          expect(screen.UNSAFE_getByType(PixelPetSprite).props.sleeping).toBe(
            false,
          );
        }
        act(() => jest.advanceTimersByTime(499));
        expect(screen.UNSAFE_getByType(PixelPetSprite).props.sleeping).toBe(
          false,
        );
        act(() => jest.advanceTimersByTime(1));
        if (speciesId === 'garuda') {
          expect(screen.UNSAFE_getByType(PixelPetSprite).props).toMatchObject({
            clip: 'move',
            sleeping: false,
            homeMotion: true,
          });
          const flightTransforms = StyleSheet.flatten(
            screen.getByTestId('home-pet-drag-roam').props.style,
          ).transform as { translateX?: number; translateY?: number }[];
          expect(
            flightTransforms.find((item) => 'translateX' in item)?.translateX,
          ).toBe(garudaSleepTargetX(390, spacing.md));
          expect(
            flightTransforms.find((item) => 'translateY' in item)?.translateY,
          ).toBeLessThan(720);
          expect(screen.UNSAFE_getByType(HomeSleepScene).props.visible).toBe(
            false,
          );
          act(() => jest.advanceTimersByTime(1050));
          expect(screen.UNSAFE_getByType(HomeSleepScene).props.visible).toBe(
            true,
          );
        }
        expect(screen.UNSAFE_getByType(PixelPetSprite).props.sleeping).toBe(
          true,
        );
        act(() => jest.advanceTimersByTime(120_000));
        expect(screen.UNSAFE_getByType(PixelPetSprite).props.sleeping).toBe(
          true,
        );
        fireEvent(
          screen.getByLabelText(/Đánh thức linh thú/),
          'accessibilityTap',
        );
        expect(screen.UNSAFE_getByType(PixelPetSprite).props.sleeping).toBe(
          false,
        );
        for (let i = 0; i < 39; i++) {
          act(() => jest.advanceTimersByTime(500));
          expect(screen.UNSAFE_getByType(PixelPetSprite).props.sleeping).toBe(
            false,
          );
        }
        act(() => jest.advanceTimersByTime(499));
        expect(screen.UNSAFE_getByType(PixelPetSprite).props.sleeping).toBe(
          false,
        );
        act(() => jest.advanceTimersByTime(1));
        if (speciesId === 'garuda') {
          expect(screen.UNSAFE_getByType(PixelPetSprite).props.sleeping).toBe(
            false,
          );
          act(() => jest.advanceTimersByTime(1050));
        }
        expect(screen.UNSAFE_getByType(PixelPetSprite).props.sleeping).toBe(
          true,
        );
      } finally {
        view.unmount();
        jest.useRealTimers();
      }
    },
  );
});

it('keeps the Fox asleep when a held touch is terminated after the deadline', () => {
  jest.useFakeTimers();
  const spy = jest.spyOn(PanResponder, 'create');
  const view = renderRoamer({ uid: 'fox', active: true });
  const responder = () => spy.mock.calls.at(-1)![0];
  const event = {} as GestureResponderEvent;
  const gesture = { dx: 0, dy: 0 } as PanResponderGestureState;
  try {
    act(() => responder().onPanResponderGrant!(event, gesture));
    act(() => jest.advanceTimersByTime(20_000));
    act(() => responder().onPanResponderTerminate!(event, gesture));
    expect(screen.UNSAFE_getByType(PixelPetSprite).props).toMatchObject({
      sleeping: true,
      homeFoxPhase: 'sleep',
    });
  } finally {
    view.unmount();
    spy.mockRestore();
    jest.useRealTimers();
  }
});

it('does not wake an owned sleeping pet when its growth stage refreshes', () => {
  jest.useFakeTimers();
  const previous = pets.owner;
  const view = renderRoamer({ uid: 'owner', active: true });
  try {
    act(() => jest.advanceTimersByTime(20_000));
    pets.owner = {
      speciesId: 'phoenix',
      stage: 'ascended',
      level: 20,
      totalExp: 500,
    };
    view.rerender(
      <HomePetRoamer
        uid="owner"
        active
        containerWidth={390}
        containerHeight={844}
        topInset={59}
      />,
    );
    expect(screen.UNSAFE_getByType(PixelPetSprite).props.sleeping).toBe(true);
  } finally {
    view.unmount();
    pets.owner = previous;
    jest.useRealTimers();
  }
});

it('keeps the wolf at its current horizontal position when it falls asleep', () => {
  jest.useFakeTimers();
  const random = jest.spyOn(Math, 'random').mockReturnValue(0.99);
  const view = render(
    <HomePetRoamer
      uid={null}
      preview={{ speciesId: 'rune_wolf', stage: 'juvenile' }}
      active
      containerWidth={390}
      containerHeight={844}
      topInset={59}
    />,
  );
  const position = () => {
    const style = StyleSheet.flatten(
      screen.getByTestId('home-pet-drag-roam').props.style,
    );
    return (style.transform as { translateX?: number }[]).find(
      (part) => 'translateX' in part,
    )?.translateX;
  };
  try {
    act(() => jest.advanceTimersByTime(19_999));
    // Reanimated's test mock applies timing immediately but its rendered style
    // is refreshed only on a React render. Read the current, rather than initial, x.
    view.rerender(
      <HomePetRoamer
        uid={null}
        preview={{ speciesId: 'rune_wolf', stage: 'juvenile' }}
        active
        containerWidth={390}
        containerHeight={844}
        topInset={59}
      />,
    );
    const beforeSleep = position();
    act(() => jest.advanceTimersByTime(1));
    expect(screen.UNSAFE_getByType(PixelPetSprite).props.sleeping).toBe(true);
    expect(position()).toBe(beforeSleep);
    expect(screen.UNSAFE_getByType(HomeSleepScene).props.visible).toBe(true);
  } finally {
    view.unmount();
    random.mockRestore();
    jest.useRealTimers();
  }
});

it('leaves the Wolf night/day desert scene at its old sleep spot until its clip finishes', () => {
  jest.useFakeTimers();
  const props = {
    uid: null,
    preview: { speciesId: 'rune_wolf', stage: 'juvenile' } as const,
    active: true,
    containerWidth: 390,
    containerHeight: 844,
    topInset: 59,
  };
  const view = render(<HomePetRoamer {...props} />);
  try {
    act(() => jest.advanceTimersByTime(20_000));
    const sleepingPosition = StyleSheet.flatten(
      screen.getByTestId('home-pet-sleep-scene-anchor').props.style,
    ).transform;
    fireEvent(screen.getByLabelText(/Đánh thức linh thú/), 'accessibilityTap');
    const wakeScene = () =>
      screen
        .UNSAFE_getAllByType(HomeSleepScene)
        .find(
          (scene) =>
            scene.props.scene === 'rune_wolf' &&
            scene.props.mode === 'withering',
        )!;
    expect(wakeScene().props).toMatchObject({ visible: true, active: true });
    const oldPosition = StyleSheet.flatten(
      screen.getByTestId('home-pet-departing-wolf-scene').props.style,
    ).transform;
    expect(oldPosition).toEqual(sleepingPosition);
    expect(screen.UNSAFE_getByType(PixelPetSprite).props.sleeping).toBe(false);
    act(() => jest.advanceTimersByTime(2600));
    expect(
      StyleSheet.flatten(
        screen.getByTestId('home-pet-departing-wolf-scene').props.style,
      ).transform,
    ).toEqual(oldPosition);
    view.rerender(<HomePetRoamer {...props} active={false} />);
    expect(wakeScene().props.active).toBe(false);
    expect(typeof wakeScene().props.onFinished).toBe('function');
    // The test timing mock immediately reaches 1, so resuming completes the clip.
    view.rerender(<HomePetRoamer {...props} />);
    expect(screen.queryByTestId('home-pet-departing-wolf-scene')).toBeNull();
  } finally {
    view.unmount();
    jest.useRealTimers();
  }
});

it('plays the Wolf howl after waking instead of skipping straight into another sleep', () => {
  jest.useFakeTimers();
  const view = render(
    <HomePetRoamer
      uid={null}
      preview={{ speciesId: 'rune_wolf', stage: 'juvenile' }}
      active
      containerWidth={390}
      containerHeight={844}
      topInset={59}
    />,
  );
  try {
    act(() => jest.advanceTimersByTime(20_000));
    fireEvent(screen.getByLabelText(/Đánh thức linh thú/), 'accessibilityTap');
    expect(screen.UNSAFE_getByType(PixelPetSprite).props).toMatchObject({
      sleeping: false,
      clip: 'skill',
      homeMotion: true,
    });
    act(() => jest.advanceTimersByTime(2600));
    expect(screen.UNSAFE_getByType(PixelPetSprite).props).toMatchObject({
      sleeping: false,
      clip: 'move',
      loopMovement: true,
    });
  } finally {
    view.unmount();
    jest.useRealTimers();
  }
});

it('uses a howl instead of a sleep beat for the Wolf while the awake window is open', () => {
  expect(
    nextRoamBeat('travel', {
      x: 0,
      range: 240,
      walking: true,
      flier: false,
      stag: false,
      runeWolf: true,
      allowSleep: false,
    }),
  ).toMatchObject({ kind: 'trick', clip: 'skill' });
  expect(
    nextRoamBeat('shift', {
      x: 0,
      range: 240,
      walking: true,
      flier: true,
      stag: false,
      garuda: true,
      allowSleep: false,
    }),
  ).toMatchObject({ kind: 'travel' });
});
