import {
  clampDragPosition,
  nextDragPhase,
  petFallStyle,
} from '../homePetDrag';
import { PIXEL_PET_SPECIES } from '../../../services/pixelPet/pixelPetCatalog';
import { CELESTIAL_STAG_ID } from '../../../services/pixelPet/celestialStagPuppet';

describe('clampDragPosition', () => {
  it.each([
    { width: 390, height: 844, minY: 104, maxY: 720 },
    { width: 430, height: 932, minY: 118, maxY: 808 },
  ])('keeps the pet within bounds on a $width×$height screen', ({ width, minY, maxY }) => {
    const bounds = {
      minX: 0,
      maxX: width - 144,
      minY,
      maxY,
    };
    expect(
      clampDragPosition({ x: 900, y: -200 }, bounds),
    ).toEqual({ x: bounds.maxX, y: minY });
    expect(
      clampDragPosition({ x: -20, y: 900 }, bounds),
    ).toEqual({ x: 0, y: maxY });
  });

  it('normalizes collapsed bounds on a very small container', () => {
    expect(
      clampDragPosition(
        { x: 50, y: 50 },
        { minX: 0, maxX: -10, minY: 120, maxY: 80 },
      ),
    ).toEqual({ x: 0, y: 80 });
  });
});

describe('nextDragPhase', () => {
  const wings = {
    fallStyle: 'wings' as const,
    airborne: true,
    reducedMotion: false,
  };
  const ground = { ...wings, airborne: false };

  it('keeps a quick tap in roam and lifts only after the hold threshold', () => {
    expect(nextDragPhase('roam', 'advance', wings)).toBe('roam');
    expect(nextDragPhase('roam', 'lift', wings)).toBe('lifted');
  });

  it('circles, descends, lands, then resumes roaming for winged pets', () => {
    expect(nextDragPhase('lifted', 'release', wings)).toBe('circle');
    expect(nextDragPhase('circle', 'advance', wings)).toBe('descend');
    expect(nextDragPhase('descend', 'advance', wings)).toBe('land');
    expect(nextDragPhase('land', 'advance', wings)).toBe('roam');
  });

  it('falls for non-winged pets and lands directly when released near the ground', () => {
    expect(
      nextDragPhase('lifted', 'release', {
        ...wings,
        fallStyle: 'shell',
      }),
    ).toBe('fall');
    expect(nextDragPhase('lifted', 'release', ground)).toBe('land');
  });

  it('lands directly with reduced motion and cancels when Home becomes inactive', () => {
    expect(
      nextDragPhase('lifted', 'release', { ...wings, reducedMotion: true }),
    ).toBe('land');
    expect(nextDragPhase('circle', 'cancel', wings)).toBe('roam');
  });
});

describe('petFallStyle', () => {
  it('assigns a fall style to every species and the exclusive Stag', () => {
    const species = [...PIXEL_PET_SPECIES.map(({ id }) => id), CELESTIAL_STAG_ID];
    for (const id of species) expect(petFallStyle(id)).toBeTruthy();
    expect(petFallStyle('azure_dragon')).toBe('coil');
    expect(petFallStyle('koi_dragon')).toBe('flop');
    expect(petFallStyle('scylla')).toBe('tentacle');
    expect(petFallStyle('black_tortoise')).toBe('shell');
    expect(petFallStyle(CELESTIAL_STAG_ID)).toBe('wings');
  });
});
