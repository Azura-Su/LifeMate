import { render, screen } from '@testing-library/react-native';
import { PIXEL_PET_BY_ID } from '../../../services/pixelPet/pixelPetCatalog';
import { PixelPetSprite } from '../PixelPetSprite';

jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

it('renders a stage of a species from the shared rig', () => {
  render(
    <PixelPetSprite species={PIXEL_PET_BY_ID.phoenix} stage="ascended" size={96} clip="skill" />,
  );
  expect(screen.getByLabelText('Phượng Hoàng, thăng hoa')).toBeTruthy();
});
