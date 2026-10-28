import { fireEvent, render, screen } from '@testing-library/react-native';
import { HomePetRoamer, nextRoamBeat } from '../HomePetRoamer';
import { PixelPetSprite } from '../../PixelPet/PixelPetSprite';

jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
jest.mock('react-native-worklets', () =>
  jest.requireActual('react-native-worklets/src/mock'),
);
const pets: Record<string, unknown> = {
  owner: { speciesId: 'phoenix', stage: 'juvenile', level: 5, totalExp: 40 },
};
jest.mock('../../../services/pixelPet/pixelPetApi', () => ({
  readOwnedPixelPet: (uid: string) => pets[uid] ?? null,
  subscribeOwnedPixelPet: () => () => {},
}));

it('flies the owned pet above the tab bar and opens it on tap', () => {
  const onPress = jest.fn();
  render(<HomePetRoamer uid="owner" active onPress={onPress} />);
  expect(screen.UNSAFE_getByType(PixelPetSprite).props).toMatchObject({
    clip: 'move',
    loopMovement: true,
    active: true,
  });
  fireEvent.press(screen.getByLabelText('Mở linh thú Phượng Hoàng'));
  expect(onPress).toHaveBeenCalled();
});

it('shows nothing without an owned pet', () => {
  render(<HomePetRoamer uid="nobody" active onPress={jest.fn()} />);
  expect(screen.queryByRole('button')).toBeNull();
});

describe('nextRoamBeat', () => {
  const at = { x: 0, range: 300, walking: true, flier: true, stag: true };
  const rolls = (...values: number[]) => () => values.shift() ?? 0;

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
