import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import { PIXEL_PET_SPECIES } from '../pixelPetCatalog';
import { PET_ATLAS } from '../pixelPetFrames';
import { PET_ATLASES } from '../../../screens/PixelPet/petArt';

it('ships one 16-pose transparent PNG atlas for each of the 15 existing species', () => {
  expect(Object.keys(PET_ATLASES).sort()).toEqual(
    PIXEL_PET_SPECIES.map((p) => p.id).sort(),
  );
  let totalBytes = 0;
  for (const species of PIXEL_PET_SPECIES) {
    const file = join(
      __dirname,
      '../../../../assets/pixelPet/animations',
      `${species.id}.png`,
    );
    const bytes = readFileSync(file);
    expect([...bytes.subarray(0, 8)]).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ]);
    expect(bytes.readUInt32BE(16)).toBe(PET_ATLAS.columns * PET_ATLAS.cellSize);
    expect(bytes.readUInt32BE(20)).toBe(PET_ATLAS.rows * PET_ATLAS.cellSize);
    // RGBA or a palette with an explicit transparency chunk; opaque atlases are invalid.
    expect(
      bytes[25] === 6 ||
        (bytes[25] === 3 && bytes.includes(Buffer.from('tRNS'))),
    ).toBe(true);
    totalBytes += statSync(file).size;
  }
  expect(totalBytes).toBeLessThan(12 * 1024 * 1024);
});
