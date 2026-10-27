import { readFileSync } from 'fs';
import { join } from 'path';
import { PIXEL_PET_SPECIES, pixelPetSpecies } from '../pixelPetCatalog';
import {
  EFFECT_CLIP,
  gridRects,
  MOTIF_GRIDS,
  PIXEL_CANVAS,
  PIXEL_CLIPS,
  PIXEL_RIGS,
  pixelPetLayers,
  sampleTrack,
} from '../pixelPetRig';
import { parsePixelPetState } from '../pixelPetApi';

jest.mock('@react-native-firebase/auth', () => ({}));

const valid = /^[.1234w]+$/;
const rectangular = (grid: readonly string[], w?: number, h?: number) => {
  expect(grid.every((row) => valid.test(row))).toBe(true);
  expect(new Set(grid.map((row) => row.length)).size).toBe(1);
  if (w) expect(grid[0].length).toBe(w);
  if (h) expect(grid.length).toBe(h);
};

describe('pixel pet catalog', () => {
  it('has exactly the 15 species seeded by the backend migration', () => {
    const sql = readFileSync(
      join(__dirname, '../../../../supabase/migrations/20261028090000_pixel_pet.sql'),
      'utf8',
    );
    const seeded = [...sql.matchAll(/\('([a-z_]+)',(\d+)\)/g)].map((m) => m[1]);
    expect(PIXEL_PET_SPECIES.map((species) => species.id)).toEqual(seeded);
    expect(new Set(seeded).size).toBe(15);
    expect(pixelPetSpecies('sixteenth')).toBeNull();
    expect(pixelPetSpecies('toString')).toBeNull();
  });

  it('keeps per-species art to one crest and one feature grid', () => {
    for (const species of PIXEL_PET_SPECIES) {
      rectangular(species.crest, 8, 4);
      rectangular(species.feature, 8, 8);
      expect(species.palette).toHaveLength(4);
    }
    const rigs = new Set(PIXEL_PET_SPECIES.map((species) => species.rig));
    expect([...rigs].sort()).toEqual(Object.keys(PIXEL_RIGS).sort());
    for (const grid of Object.values(MOTIF_GRIDS)) rectangular(grid, 8, 8);
  });

  it('places every stage inside the canvas using the shared rig', () => {
    for (const species of PIXEL_PET_SPECIES)
      for (const stage of ['hatchling', 'juvenile', 'ascended'] as const) {
        const layers = pixelPetLayers(species, stage);
        expect(layers.some((layer) => layer.part === 'feature')).toBe(
          stage !== 'hatchling',
        );
        for (const layer of layers) {
          rectangular(layer.grid);
          expect(layer.x).toBeGreaterThanOrEqual(0);
          expect(layer.y).toBeGreaterThanOrEqual(0);
          expect(layer.x + layer.grid[0].length).toBeLessThanOrEqual(PIXEL_CANVAS);
          expect(layer.y + layer.grid.length).toBeLessThanOrEqual(PIXEL_CANVAS);
        }
        // Body and head come from the rig, so stages never need new frames.
        expect(layers.find((layer) => layer.part === 'body')?.grid).toBe(
          PIXEL_RIGS[species.rig].body,
        );
      }
  });

  it('merges pixel runs into row rects', () => {
    expect(gridRects(['.11.22', '4..4..'])).toEqual([
      { x: 1, y: 0, w: 2, slot: '1' },
      { x: 4, y: 0, w: 2, slot: '2' },
      { x: 0, y: 1, w: 1, slot: '4' },
      { x: 3, y: 1, w: 1, slot: '4' },
    ]);
  });
});

describe('shared clips', () => {
  it('every clip covers t=0..1 for each part and loops return to rest', () => {
    for (const clip of Object.values(PIXEL_CLIPS))
      for (const track of [clip.body, clip.head, clip.feature]) {
        expect(track[0][0]).toBe(0);
        expect(track[track.length - 1][0]).toBe(1);
        expect(sampleTrack(track, 0)).toEqual(sampleTrack(track, 1));
      }
  });

  it('interpolates between keyframes', () => {
    const track = [
      [0, 0, 0, 0, 1],
      [1, 4, -2, 10, 2],
    ] as const;
    expect(sampleTrack(track, 0.5)).toEqual([2, -1, 5, 1.5]);
  });

  it('maps every finance care effect to a shared clip', () => {
    for (const clip of Object.values(EFFECT_CLIP))
      expect(PIXEL_CLIPS[clip]).toBeDefined();
  });
});

describe('parsePixelPetState', () => {
  const base = {
    status: 'none',
    rollsLeft: 3,
    restoresLeft: 3,
    reservation: null,
    pet: null,
    availability: { total: 15, owned: 2, reserved: 1 },
    now: 1,
  };
  it('accepts server state and rejects unknown species', () => {
    expect(parsePixelPetState(base).status).toBe('none');
    expect(() =>
      parsePixelPetState({
        ...base,
        status: 'reserved',
        reservation: { id: 'r', speciesId: 'dragon16', expiresAt: 5 },
      }),
    ).toThrow();
    expect(() => parsePixelPetState({ ...base, rollsLeft: -1 })).toThrow();
  });
});
