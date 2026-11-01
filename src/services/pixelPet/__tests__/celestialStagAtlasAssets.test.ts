import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { inflateSync } from 'zlib';

const ANIMATIONS = join(__dirname, '../../../../assets/pixelPet/animations');
const CELL = 320;
/** Lowest hoof row that the shared Home ground line expects in each cell. */
const HOOF_Y = 287;

/** Decodes the alpha channel of an 8-bit palette or RGBA PNG. */
function decodeAlpha(file: string) {
  const bytes = readFileSync(file);
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  let paletteAlpha = Buffer.alloc(0);
  const data: Buffer[] = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      expect(body[8]).toBe(8);
      colorType = body[9];
      expect(body[12]).toBe(0);
    } else if (type === 'tRNS') paletteAlpha = Buffer.from(body);
    else if (type === 'IDAT') data.push(body);
    offset += length + 12;
  }
  expect([3, 6]).toContain(colorType);
  const channels = colorType === 6 ? 4 : 1;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(data));
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const value = raw[y * (stride + 1) + 1 + x];
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0;
      const paeth = () => {
        const p = left + up - upLeft;
        const [a, b, c] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - upLeft)];
        return a <= b && a <= c ? left : b <= c ? up : upLeft;
      };
      const predictor = [0, left, up, (left + up) >> 1, paeth()][filter];
      pixels[y * stride + x] = (value + predictor) & 0xff;
    }
  }
  const alphaAt = (x: number, y: number) =>
    colorType === 6
      ? pixels[(y * width + x) * 4 + 3]
      : paletteAlpha[pixels[y * width + x]] ?? 255;
  return { width, height, alphaAt };
}

const homeAtlases = readdirSync(ANIMATIONS).filter((name) =>
  /^celestial_stag_lv\d+_(walk|run|hop|flight|sleep)\.png$/.test(name),
);

it('finds every shipped Celestial Stag level atlas', () => {
  expect(homeAtlases.length).toBeGreaterThanOrEqual(30);
});

it.each(homeAtlases)('keeps every %s pose inside its own 320px cell', (name) => {
  const { width, height, alphaAt } = decodeAlpha(join(ANIMATIONS, name));
  expect([width, height]).toEqual([CELL * 4, CELL * 4]);
  for (let slot = 0; slot < 16; slot++) {
    const left = (slot % 4) * CELL;
    const top = Math.floor(slot / 4) * CELL;
    let edgePixels = 0;
    let bottom = -1;
    for (let y = 0; y < CELL; y++)
      for (let x = 0; x < CELL; x++) {
        if (alphaAt(left + x, top + y) < 32) continue;
        bottom = Math.max(bottom, y);
        if (x < 2 || y < 2 || x >= CELL - 2 || y >= CELL - 2) edgePixels++;
      }
    // A pose touching the cell border is cropped, and its neighbour's pixels
    // bleed into the frame next to it on Home.
    expect({ slot, edgePixels }).toEqual({ slot, edgePixels: 0 });
    expect(bottom).toBeGreaterThan(0);
    expect(bottom).toBeLessThanOrEqual(HOOF_Y + 1);
  }
});
