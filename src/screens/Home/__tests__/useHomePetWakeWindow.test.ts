import { act, renderHook } from '@testing-library/react-native';
import { useHomePetWakeWindow } from '../useHomePetWakeWindow';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('gives a full new 20 seconds after touching an awake pet', () => {
  const { result } = renderHook(() => useHomePetWakeWindow('pet', true));
  act(() => jest.advanceTimersByTime(15_000));
  act(() => result.current.wake());
  act(() => jest.advanceTimersByTime(19_999));
  expect(result.current.asleep).toBe(false);
  act(() => jest.advanceTimersByTime(1));
  expect(result.current.asleep).toBe(true);
});

it('pauses the remaining time off Home and never wakes a sleeper on focus', () => {
  const { result, rerender } = renderHook<
    ReturnType<typeof useHomePetWakeWindow>,
    { active: boolean }
  >(({ active }) => useHomePetWakeWindow('pet', active), {
    initialProps: { active: true },
  });
  act(() => jest.advanceTimersByTime(12_000));
  rerender({ active: false });
  act(() => jest.advanceTimersByTime(60_000));
  rerender({ active: true });
  act(() => jest.advanceTimersByTime(7_999));
  expect(result.current.asleep).toBe(false);
  act(() => jest.advanceTimersByTime(1));
  expect(result.current.asleep).toBe(true);
  rerender({ active: false });
  rerender({ active: true });
  expect(result.current.asleep).toBe(true);
});

it('starts a new window for a different preview pet and clears old timers', () => {
  const { result, rerender, unmount } = renderHook<
    ReturnType<typeof useHomePetWakeWindow>,
    { id: string }
  >(({ id }) => useHomePetWakeWindow(id, true), {
    initialProps: { id: 'one' },
  });
  act(() => jest.advanceTimersByTime(20_000));
  rerender({ id: 'two' });
  expect(result.current.asleep).toBe(false);
  act(() => jest.advanceTimersByTime(19_999));
  expect(result.current.asleep).toBe(false);
  unmount();
  expect(jest.getTimerCount()).toBe(0);
});

it('gives a sleeping pet a full new 20 second window every time it wakes', () => {
  const { result } = renderHook(() => useHomePetWakeWindow('pet', true));
  act(() => jest.advanceTimersByTime(20_000));
  for (let wakeCount = 0; wakeCount < 3; wakeCount++) {
    expect(result.current.asleep).toBe(true);
    act(() => result.current.wake());
    act(() => jest.advanceTimersByTime(19_999));
    expect(result.current.asleep).toBe(false);
    act(() => jest.advanceTimersByTime(1));
  }
  expect(result.current.asleep).toBe(true);
});
