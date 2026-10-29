import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import { render, screen } from '@testing-library/react-native';
import {
  PIXEL_PET_BY_ID,
  PIXEL_PET_SPECIES,
} from '../../../services/pixelPet/pixelPetCatalog';
import { PixelPetSprite } from '../PixelPetSprite';
import { PixelPetAtlas } from '../PixelPetAtlas';
import {
  petDragFallbackClip,
  petDragFrameTrack,
} from '../../../services/pixelPet/pixelPetFrames';
import {
  CELESTIAL_STAG_LANDING_ATLAS,
  PET_DRAG_ATLAS_READY,
  PET_DRAG_ATLASES,
} from '../petArt';
import { CELESTIAL_STAG_LANDING_FRAMES } from '../../../services/pixelPet/celestialStagAtlas';

jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
jest.mock('react-native-worklets', () =>
  jest.requireActual('react-native-worklets/src/mock'),
);

it('renders a stage of a species from the shared rig', () => {
  render(
    <PixelPetSprite
      species={PIXEL_PET_BY_ID.phoenix}
      stage="ascended"
      size={96}
      clip="skill"
    />,
  );
  expect(screen.getByLabelText('Phượng Hoàng, thăng hoa')).toBeTruthy();
});

it('renders Bạch Hổ from its illustrated art', () => {
  render(
    <PixelPetSprite
      species={PIXEL_PET_BY_ID.white_tiger}
      stage="hatchling"
      size={96}
    />,
  );
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
  render(
    <PixelPetSprite
      species={PIXEL_PET_BY_ID.phoenix}
      stage="juvenile"
      size={96}
      clip="fly"
    />,
  );
  expect(screen.getByLabelText('Phượng Hoàng, trưởng thành')).toBeTruthy();
});

it('has a dedicated drag atlas for every user pet and the admin Stag', () => {
  expect(Object.keys(PET_DRAG_ATLASES).sort()).toEqual(
    [
      ...PIXEL_PET_SPECIES.map((species) => species.id),
      'celestial_stag',
    ].sort(),
  );
  for (const species of PIXEL_PET_SPECIES) {
    expect(PET_DRAG_ATLAS_READY[species.id]).toBe(true);
    expect(PET_DRAG_ATLASES[species.id]).toBeDefined();
    for (const phase of [
      'lifted',
      'circle',
      'descend',
      'fall',
      'land',
    ] as const) {
      const hasReadyAtlas =
        PET_DRAG_ATLAS_READY[species.id] &&
        (species.id === 'celestial_stag' || !!PET_DRAG_ATLASES[species.id]) &&
        !!petDragFrameTrack(phase);
      const hasFallback = !!petDragFallbackClip(phase);
      expect(hasReadyAtlas || hasFallback).toBe(true);
    }
  }
  expect(PET_DRAG_ATLAS_READY.celestial_stag).toBe(true);
});

it('bundles a 4×4 transparent drag frame atlas for all 15 user pets', () => {
  const allSpecies = [
    ...PIXEL_PET_SPECIES.map((species) => species.id),
    'celestial_stag',
  ];
  for (const speciesId of allSpecies) {
    const file = join(
      __dirname,
      '../../../../assets/pixelPet/animations',
      `drag_${speciesId}.png`,
    );
    const bytes = readFileSync(file);
    expect(bytes.readUInt32BE(16)).toBe(1024);
    expect(bytes.readUInt32BE(20)).toBe(1024);
    expect(bytes[24]).toBe(8);
    expect([3, 6].includes(bytes[25])).toBe(true);
    expect(statSync(file).size).toBeLessThan(700_000);
  }
});

it('renders the existing rig for a drag phase before its atlas is ready', () => {
  render(
    <PixelPetSprite
      species={PIXEL_PET_BY_ID.phoenix}
      stage="juvenile"
      size={96}
      clip="move"
      dragPhase="lifted"
      fallStyle="wings"
    />,
  );
  expect(screen.getByLabelText('Phượng Hoàng, trưởng thành')).toBeTruthy();
});

it('uses Scylla’s dedicated sprite frames during its fall', () => {
  render(
    <PixelPetSprite
      species={PIXEL_PET_BY_ID.scylla}
      stage="juvenile"
      size={96}
      clip="move"
      dragPhase="fall"
      fallStyle="tentacle"
    />,
  );
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({
    source: PET_DRAG_ATLASES.scylla,
    frameTrack: petDragFrameTrack('fall'),
  });
});

it('holds the Stag landing contact pose through the short land phase', () => {
  render(
    <PixelPetSprite
      species={PIXEL_PET_BY_ID.celestial_stag}
      stage="juvenile"
      size={120}
      clip="move"
      loopMovement
      dragPhase="land"
      fallStyle="wings"
      flightPhase="landing"
    />,
  );
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({
    source: CELESTIAL_STAG_LANDING_ATLAS,
    staticFrame: CELESTIAL_STAG_LANDING_FRAMES.at(-1),
    animating: false,
  });
});

it('mounts the reviewed Stag drag atlas only for its authored descent phase', () => {
  render(
    <PixelPetSprite
      species={PIXEL_PET_BY_ID.celestial_stag}
      stage="juvenile"
      size={120}
      clip="move"
      loopMovement
      dragPhase="descend"
      fallStyle="wings"
      flightPhase="landing"
    />,
  );
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({
    source: PET_DRAG_ATLASES.celestial_stag,
    frameTrack: [4, 5, 6, 7],
    loop: false,
  });
});

it('uses the reviewed Alicorn flight frames while being lifted and descending', () => {
  render(
    <PixelPetSprite
      species={PIXEL_PET_BY_ID.alicorn}
      stage="juvenile"
      size={120}
      clip="move"
      dragPhase="descend"
      fallStyle="wings"
    />,
  );
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({
    source: PET_DRAG_ATLASES.alicorn,
    frameTrack: [4, 5, 6, 7],
    loop: false,
  });
});
