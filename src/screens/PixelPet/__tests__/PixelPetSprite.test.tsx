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

it('falls back to the pixel rig for species without art', () => {
  render(<PixelPetSprite species={PIXEL_PET_BY_ID.white_tiger} stage="hatchling" size={96} />);
  expect(screen.getByLabelText('Bạch Hổ, ấu thể')).toBeTruthy();
});

it('renders the Celestial Stag puppet for every clip, including its extras', () => {
  for (const clip of [
    'idle',
    'move',
    'happy',
    'skill',
    'fly',
    'flap',
    'prance',
    'bow',
    'glow',
    'blaze',
    'spin',
  ] as const) {
    const view = render(
      <PixelPetSprite
        species={PIXEL_PET_BY_ID.celestial_stag}
        stage="ascended"
        size={224}
        clip={clip}
        loopMovement={clip === 'move'}
      />,
    );
    expect(screen.getByLabelText('Thiên Dực Linh Lộc, thăng hoa')).toBeTruthy();
    view.unmount();
  }
});

it('keeps atlas pets on the shared rig when handed a puppet-only clip', () => {
  render(<PixelPetSprite species={PIXEL_PET_BY_ID.phoenix} stage="juvenile" size={96} clip="fly" />);
  expect(screen.getByLabelText('Phượng Hoàng, trưởng thành')).toBeTruthy();
});
