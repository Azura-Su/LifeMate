import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  PanResponder,
  StyleSheet,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import { HomePetRoamer, nextRoamBeat } from '../HomePetRoamer';
import { PixelPetSprite } from '../../PixelPet/PixelPetSprite';
import { HomeSleepGarden } from '../HomeSleepGarden';
import {
  CELESTIAL_STAG_HOME_PHASE_DURATION,
  CELESTIAL_STAG_GARDEN_GROWTH_MS,
} from '../../../services/pixelPet/celestialStagAtlas';

jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    ...jest.requireActual('react-native-reanimated/mock'),
    useReducedMotion: () => false,
    useSharedValue: (value: number) => React.useRef({ value }).current,
    // Phase timers drive this controller test; complete one-shot art explicitly.
    withTiming: (value: number) => value,
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
};
jest.mock('../../../services/pixelPet/pixelPetApi', () => ({
  readOwnedPixelPet: (uid: string) => pets[uid] ?? null,
  subscribeOwnedPixelPet: () => () => {},
}));

const renderRoamer = (props: {
  uid: string | null;
  active: boolean;
  onPress: () => void;
}) =>
  render(
    <HomePetRoamer
      {...props}
      containerWidth={390}
      containerHeight={844}
      headerBottom={104}
    />,
  );

it('flies the owned pet above the tab bar and opens it on tap', async () => {
  const onPress = jest.fn();
  renderRoamer({ uid: 'owner', active: true, onPress });
  expect(screen.UNSAFE_getByType(PixelPetSprite).props).toMatchObject({
    clip: 'move',
    loopMovement: true,
    active: true,
    size: 120,
  });
  await act(async () => {});
  fireEvent.press(screen.getByLabelText('Mở linh thú Phượng Hoàng'));
  expect(onPress).toHaveBeenCalled();
});

it('shows nothing without an owned pet', () => {
  renderRoamer({ uid: 'nobody', active: true, onPress: jest.fn() });
  expect(screen.queryByRole('button')).toBeNull();
});

it('opens on a quick tap and takes over only after a 250ms hold', () => {
  jest.useFakeTimers();
  const responderSpy = jest.spyOn(PanResponder, 'create');
  const onPress = jest.fn();
  const view = renderRoamer({ uid: 'owner', active: true, onPress });
  const pressable = screen.getByLabelText('Mở linh thú Phượng Hoàng');
  const responder = () =>
    responderSpy.mock.calls[responderSpy.mock.calls.length - 1][0];
  const event = {} as GestureResponderEvent;
  const gesture = (dx: number, dy: number) =>
    ({ dx, dy }) as PanResponderGestureState;

  try {
    fireEvent.press(pressable);
    expect(onPress).toHaveBeenCalledTimes(1);

    fireEvent(pressable, 'pressIn');
    act(() => jest.advanceTimersByTime(249));
    expect(screen.getByTestId('home-pet-drag-roam')).toBeTruthy();
    expect(responder().onMoveShouldSetPanResponderCapture!(event, gesture(0, 12))).toBe(
      false,
    );
    fireEvent(pressable, 'pressOut');
    act(() => jest.advanceTimersByTime(1));
    expect(screen.getByTestId('home-pet-drag-roam')).toBeTruthy();

    fireEvent(pressable, 'pressIn');
    act(() => jest.advanceTimersByTime(250));
    const liftedPet = screen.getByTestId('home-pet-drag-lifted');
    expect(liftedPet).toBeTruthy();
    expect(StyleSheet.flatten(liftedPet.props.style)).toMatchObject({
      zIndex: 10,
      elevation: 10,
      shadowOpacity: 0.24,
      shadowRadius: 12,
    });
    expect(
      responder().onMoveShouldSetPanResponderCapture!(event, gesture(1, 0)),
    ).toBe(true);
    fireEvent(pressable, 'pressOut');
    expect(screen.getByTestId('home-pet-drag-lifted')).toBeTruthy();
    act(() => {
      responder().onPanResponderGrant!(event, gesture(0, 0));
      responder().onPanResponderMove!(event, gesture(40, -50));
      responder().onPanResponderRelease!(event, gesture(40, -50));
    });
    expect(screen.getByTestId('home-pet-drag-circle')).toBeTruthy();
    expect(
      StyleSheet.flatten(screen.getByTestId('home-pet-drag-circle').props.style),
    ).toMatchObject({ zIndex: 10, elevation: 10 });
    expect(onPress).toHaveBeenCalledTimes(1);
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

it('does not steal Home scrolling before the hold threshold', () => {
  const responderSpy = jest.spyOn(PanResponder, 'create');
  const view = renderRoamer({ uid: 'owner', active: true, onPress: jest.fn() });
  const responder = responderSpy.mock.calls[responderSpy.mock.calls.length - 1][0];
  try {
    expect(
      responder.onMoveShouldSetPanResponderCapture!(
        {} as GestureResponderEvent,
        { dx: 0, dy: 20 } as PanResponderGestureState,
      ),
    ).toBe(false);
  } finally {
    view.unmount();
    responderSpy.mockRestore();
  }
});

it('clears an unfinished hold when Home becomes inactive', () => {
  jest.useFakeTimers();
  const view = renderRoamer({ uid: 'owner', active: true, onPress: jest.fn() });
  try {
    fireEvent(screen.getByLabelText('Mở linh thú Phượng Hoàng'), 'pressIn');
    act(() => jest.advanceTimersByTime(200));
    view.rerender(
      <HomePetRoamer
        uid="owner"
        active={false}
        containerWidth={390}
        containerHeight={844}
        headerBottom={104}
        onPress={jest.fn()}
      />,
    );
    act(() => jest.advanceTimersByTime(100));
    expect(screen.getByTestId('home-pet-drag-roam')).toBeTruthy();
  } finally {
    view.unmount();
    jest.useRealTimers();
  }
});

it('lands a sleeping Stag into runB and lets its existing cycle reach sleep', () => {
  jest.useFakeTimers();
  const responderSpy = jest.spyOn(PanResponder, 'create');
  const view = renderRoamer({ uid: 'stag', active: true, onPress: jest.fn() });
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
    fireEvent(screen.getByLabelText(/Đánh thức linh thú/), 'pressIn');
    act(() => jest.advanceTimersByTime(250));
    expect(sprite().sleeping).toBe(false);
    act(() => {
      responder().onPanResponderGrant!(event, gesture);
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
    expect(sprite().sleeping).toBe(true);
  } finally {
    view.unmount();
    responderSpy.mockRestore();
    jest.useRealTimers();
  }
});

it('completes the Stag flight and grounded approach before sleeping at 20 seconds', () => {
  jest.useFakeTimers();
  const view = renderRoamer({ uid: 'stag', active: true, onPress: jest.fn() });
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
    fireEvent.press(screen.getByLabelText(/Đánh thức linh thú/));
    expect(sprite().sleeping).toBe(false);
  } finally {
    view.unmount();
    jest.useRealTimers();
  }
});

it('leaves a withering garden at the old sleep spot while the Stag moves away', () => {
  jest.useFakeTimers();
  const random = jest.spyOn(Math, 'random').mockReturnValue(0.2);
  const view = renderRoamer({ uid: 'stag', active: true, onPress: jest.fn() });
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
    fireEvent.press(screen.getByLabelText(/Đánh thức linh thú/));
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
    fireEvent.press(screen.getByLabelText(/Đánh thức linh thú/));
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
});
