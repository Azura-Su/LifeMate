import { act, render, screen } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { CardGameWinnerEffects } from '../CardGameWinnerEffects';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('anchors winner particles to their seat and ends the single animation under two seconds', () => {
  const timing = jest.spyOn(Animated, 'timing');

  render(
    <CardGameWinnerEffects
      playerUID="winner-uid"
      animationKey="winner-first"
    />,
  );

  expect(screen.getByTestId('winner-effects-winner-uid')).toBeTruthy();
  expect(timing.mock.calls.some(([, config]) => config.duration === 1900)).toBe(
    true,
  );
  act(() => jest.advanceTimersByTime(2000));
  expect(screen.queryByTestId('winner-fireworks')).toBeNull();
  timing.mockRestore();
});

it('does not replay the same match on remount but celebrates the next match for the same winner', () => {
  const timing = jest.spyOn(Animated, 'timing');
  const view = render(
    <CardGameWinnerEffects playerUID="a" animationKey="dedupe-match-1" />,
  );
  const bursts = () =>
    timing.mock.calls.filter(([, config]) => config.duration === 1900).length;
  expect(bursts()).toBe(1);
  view.rerender(
    <CardGameWinnerEffects playerUID="a" animationKey="dedupe-match-2" />,
  );
  expect(bursts()).toBe(2);
  view.unmount();
  render(<CardGameWinnerEffects playerUID="a" animationKey="dedupe-match-2" />);
  expect(bursts()).toBe(2);
  expect(screen.queryByTestId('winner-fireworks')).toBeNull();
  timing.mockRestore();
});
