import { fireEvent, render, screen } from '@testing-library/react-native';
import { HomePetRoamer } from '../HomePetRoamer';
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
