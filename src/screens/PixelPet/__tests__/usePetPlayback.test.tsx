import { act, renderHook } from '@testing-library/react-native';
import { usePetPlayback } from '../usePetPlayback';

const mockTimings: ((finished: boolean) => void)[] = [];
const mockTimingConfigs: { duration: number }[] = [];
const mockQueued: (() => void)[] = [];
let mockReducedMotion = false;
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => mockReducedMotion,
  useSharedValue: (initial: number) =>
    jest.requireActual('react').useRef({ value: initial }).current,
  withTiming: (
    _to: number,
    config: { duration: number },
    callback: (finished: boolean) => void,
  ) => {
    mockTimings.push(callback);
    mockTimingConfigs.push(config);
    return 0;
  },
}));
jest.mock('react-native-worklets', () => ({
  ...jest.requireActual('react-native-worklets/src/mock'),
  scheduleOnRN: (callback: () => void) => mockQueued.push(callback),
}));

beforeEach(() => {
  mockTimings.length = 0;
  mockTimingConfigs.length = 0;
  mockQueued.length = 0;
  mockReducedMotion = false;
});

it('pauses and resumes a sleep animation without losing its current progress', () => {
  const view = renderHook(
    ({ active }: { active: boolean }) =>
      usePetPlayback({
        clip: 'move',
        speciesId: 'celestial_stag',
        active,
        loopMovement: false,
        playback: { durationMs: 1000, loop: false },
        preserveProgressWhenInactive: true,
      }),
    { initialProps: { active: true } },
  );

  act(() => {
    view.result.current.progress.value = 0.4;
  });
  view.rerender({ active: false });
  expect(view.result.current.progress.value).toBe(0.4);

  view.rerender({ active: true });
  expect(mockTimingConfigs.at(-1)?.duration).toBe(600);
});

it('completes a preserved one-shot if it reached its last frame before pausing', () => {
  const onClipEnd = jest.fn();
  const view = renderHook(
    ({ active }: { active: boolean }) =>
      usePetPlayback({
        clip: 'move',
        speciesId: 'celestial_stag',
        active,
        loopMovement: false,
        playback: { durationMs: 1000, loop: false },
        onClipEnd,
        preserveProgressWhenInactive: true,
      }),
    { initialProps: { active: true } },
  );

  act(() => {
    view.result.current.progress.value = 1;
  });
  view.rerender({ active: false });
  view.rerender({ active: true });
  expect(onClipEnd).toHaveBeenCalledTimes(1);
});

it('ignores an old completion already queued before a newer clip starts', () => {
  const end = jest.fn();
  const view = renderHook(
    ({ clip }: { clip: 'happy' | 'skill' }) =>
      usePetPlayback({
        clip,
        speciesId: 'phoenix',
        active: true,
        loopMovement: false,
        onClipEnd: end,
      }),
    { initialProps: { clip: 'happy' as 'happy' | 'skill' } },
  );
  mockTimings[0](true);
  view.rerender({ clip: 'skill' });
  mockQueued.shift()!();
  expect(end).not.toHaveBeenCalled();
  mockTimings.at(-1)!(true);
  const complete = mockQueued.shift()!;
  complete();
  complete();
  expect(end).toHaveBeenCalledTimes(1);
});

it.each(['inactive', 'unmounted'])(
  'does not finish a clip after it is %s',
  (reason) => {
    const end = jest.fn();
    const view = renderHook(
      ({ active }: { active: boolean }) =>
        usePetPlayback({
          clip: 'happy',
          speciesId: 'phoenix',
          active,
          loopMovement: false,
          onClipEnd: end,
        }),
      { initialProps: { active: true } },
    );
    mockTimings[0](true);
    if (reason === 'inactive') view.rerender({ active: false });
    else view.unmount();
    mockQueued.shift()!();
    expect(end).not.toHaveBeenCalled();
  },
);

it('does not restart playback just because the callback identity changed', () => {
  const first = jest.fn(),
    second = jest.fn();
  const view = renderHook(
    ({ callback }: { callback: () => void }) =>
      usePetPlayback({
        clip: 'happy',
        speciesId: 'phoenix',
        active: true,
        loopMovement: false,
        onClipEnd: callback,
      }),
    { initialProps: { callback: first } },
  );
  view.rerender({ callback: second });
  expect(mockTimings).toHaveLength(1);
  mockTimings[0](true);
  mockQueued.shift()!();
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
});

it('restarts a same-duration custom atlas track when its playback key changes', () => {
  const view = renderHook(
    ({ track }: { track: 'sleeping' | 'waking' }) =>
      usePetPlayback({
        clip: 'move',
        speciesId: 'phoenix',
        active: true,
        loopMovement: false,
        playback: { durationMs: 1600, loop: false },
        playbackKey: track,
      }),
    { initialProps: { track: 'sleeping' as 'sleeping' | 'waking' } },
  );
  view.rerender({ track: 'waking' });
  expect(mockTimings).toHaveLength(2);
});

it('settles an active reduced-motion one-shot once without scheduling animation', () => {
  mockReducedMotion = true;
  const end = jest.fn();
  renderHook(() =>
    usePetPlayback({
      clip: 'happy',
      speciesId: 'phoenix',
      active: true,
      loopMovement: false,
      onClipEnd: end,
    }),
  );
  expect(mockTimings).toHaveLength(0);
  expect(end).toHaveBeenCalledTimes(1);
});
