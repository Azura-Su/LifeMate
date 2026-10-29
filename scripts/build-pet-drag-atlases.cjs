/* global __dirname, Buffer */
/*
 * Builds dedicated falling sprite sheets from the pixel animation atlas already
 * shipped for each species. This is deterministic image processing; it does not
 * call an image-generation model or create new artwork.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const pngjsPath = require.resolve('pngjs', {
  paths: [require.resolve('parse-png')],
});
const { PNG } = require(pngjsPath);

const ROOT = path.resolve(__dirname, '..');
const ANIMATIONS = path.join(ROOT, 'assets/pixelPet/animations');
const CELL = 256;
const COLUMNS = 4;

const SPECIES_FALL_STYLE = {
  nine_tail_fox: 'flop',
  qilin: 'fall',
  rune_wolf: 'fall',
  black_tortoise: 'shell',
  sphinx: 'wings',
  centaur: 'fall',
  white_tiger: 'fall',
  azure_dragon: 'coil',
  koi_dragon: 'flop',
  scylla: 'tentacle',
  lac_bird: 'wings',
  phoenix: 'wings',
  anubis: 'fall',
  garuda: 'wings',
};

const FALL_POSES = {
  fall: [
    [-12, 1.02, 0.96, -3],
    [9, 0.97, 1.04, 2],
    [-7, 1.03, 0.95, 3],
    [4, 0.98, 1.02, 0],
  ],
  coil: [
    [-18, 0.9, 1.08, -2],
    [-4, 0.95, 1.05, 1],
    [12, 0.92, 1.07, 3],
    [0, 1, 1, 0],
  ],
  flop: [
    [-24, 1.05, 0.93, -3],
    [20, 0.96, 1.08, 2],
    [-16, 1.06, 0.94, 3],
    [10, 0.98, 1.02, 0],
  ],
  tentacle: [
    [-10, 0.96, 1.12, -4],
    [12, 1.05, 0.9, 2],
    [-8, 0.95, 1.1, 4],
    [8, 1.04, 0.94, 0],
  ],
  shell: [
    [28, 1.02, 0.98, -2],
    [118, 0.98, 1.02, 0],
    [208, 1.02, 0.98, 2],
    [298, 0.98, 1.02, 0],
  ],
  wings: [
    [-8, 1, 1.05, -3],
    [6, 1.02, 0.93, 1],
    [-10, 1, 1.06, 2],
    [4, 0.99, 0.95, 0],
  ],
};

const LIFT_POSES = [
  [-3, 1, 1, 0],
  [-8, 0.98, 0.98, -2],
  [0, 0.97, 1.04, -6],
  [7, 1, 1.02, -3],
];
const LAND_POSES = [
  [-8, 1, 0.9, -2],
  [3, 0.97, 1.1, 3],
  [0, 1.03, 0.95, 1],
  [0, 1, 1, 0],
];
const RECOVERY_POSES = [
  [0, 0.98, 1.03, 1],
  [-5, 1.02, 0.97, -1],
  [0, 1, 1.02, 0],
  [3, 1, 1, 0],
];

const SOURCE_FRAMES = [
  0,
  1,
  3,
  0, // lift
  4,
  5,
  6,
  7, // fall
  8,
  9,
  10,
  11, // impact and landing
  11,
  10,
  9,
  8, // settle and recover
];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function encodeIndexedPng(indices, palette) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(CELL * COLUMNS, 0);
  header.writeUInt32BE(CELL * COLUMNS, 4);
  header[8] = 8; // indexed, 256 palette entries
  header[9] = 3;

  const rgb = Buffer.alloc(palette.length * 3);
  const alpha = Buffer.alloc(palette.length);
  let lastTransparent = -1;
  palette.forEach((color, index) => {
    rgb[index * 3] = color[0];
    rgb[index * 3 + 1] = color[1];
    rgb[index * 3 + 2] = color[2];
    alpha[index] = color[3];
    if (color[3] !== 255) lastTransparent = index;
  });

  const rowBytes = CELL * COLUMNS;
  const filtered = Buffer.alloc((rowBytes + 1) * rowBytes);
  for (let y = 0; y < rowBytes; y++) {
    const outputStart = y * (rowBytes + 1);
    filtered[outputStart] = 0; // PNG filter None; preserves exact palette indices.
    indices.copy(filtered, outputStart + 1, y * rowBytes, (y + 1) * rowBytes);
  }

  const parts = [
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('PLTE', rgb),
  ];
  if (lastTransparent >= 0)
    parts.push(chunk('tRNS', alpha.subarray(0, lastTransparent + 1)));
  parts.push(chunk('IDAT', zlib.deflateSync(filtered, { level: 9 })));
  parts.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

function createAtlas(speciesId, fallStyle) {
  const sourcePath = path.join(ANIMATIONS, `${speciesId}.png`);
  const source = PNG.sync.read(fs.readFileSync(sourcePath));
  if (source.width !== CELL * COLUMNS || source.height !== CELL * COLUMNS)
    throw new Error(`${speciesId} atlas must be a 4×4 256px-cell sprite sheet`);
  if (source.colorType !== 3 || source.palette?.length !== 256)
    throw new Error(
      `${speciesId} source atlas must use the expected indexed palette`,
    );

  const colorToIndex = new Map(
    source.palette.map((color, index) => [color.join(','), index]),
  );
  const clearIndex = source.palette.findIndex((color) => color[3] === 0);
  if (clearIndex < 0)
    throw new Error(`${speciesId} atlas has no transparent palette entry`);

  const frames = Buffer.alloc(CELL * COLUMNS * CELL * COLUMNS, clearIndex);
  for (let outputFrame = 0; outputFrame < 16; outputFrame++) {
    const sourceFrame = SOURCE_FRAMES[outputFrame];
    const pose =
      outputFrame < 4
        ? LIFT_POSES[outputFrame]
        : outputFrame < 8
          ? FALL_POSES[fallStyle][outputFrame - 4]
          : outputFrame < 12
            ? LAND_POSES[outputFrame - 8]
            : RECOVERY_POSES[outputFrame - 12];
    const [angle, scaleX, scaleY, shiftY] = pose;
    const radians = (angle * Math.PI) / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const sourceLeft = (sourceFrame % COLUMNS) * CELL;
    const sourceTop = Math.floor(sourceFrame / COLUMNS) * CELL;
    const targetLeft = (outputFrame % COLUMNS) * CELL;
    const targetTop = Math.floor(outputFrame / COLUMNS) * CELL;

    for (let y = 0; y < CELL; y++) {
      const relativeY = y - CELL / 2 - shiftY;
      for (let x = 0; x < CELL; x++) {
        const relativeX = x - CELL / 2;
        const sourceX = Math.round(
          CELL / 2 + (relativeX * cosine + relativeY * sine) / scaleX,
        );
        const sourceY = Math.round(
          CELL / 2 + (-relativeX * sine + relativeY * cosine) / scaleY,
        );
        if (sourceX < 0 || sourceX >= CELL || sourceY < 0 || sourceY >= CELL)
          continue;

        const sourceIndex =
          ((sourceTop + sourceY) * source.width + sourceLeft + sourceX) * 4;
        const color = source.data.subarray(sourceIndex, sourceIndex + 4);
        const paletteIndex = colorToIndex.get(
          `${color[0]},${color[1]},${color[2]},${color[3]}`,
        );
        if (paletteIndex === undefined)
          throw new Error(
            `${speciesId} pixel was missing from its source palette`,
          );
        frames[(targetTop + y) * source.width + targetLeft + x] = paletteIndex;
      }
    }
  }

  return encodeIndexedPng(frames, source.palette);
}

for (const [speciesId, fallStyle] of Object.entries(SPECIES_FALL_STYLE)) {
  const output = createAtlas(speciesId, fallStyle);
  const outputPath = path.join(ANIMATIONS, `drag_${speciesId}.png`);
  fs.writeFileSync(outputPath, output);
  console.log(`${speciesId}: ${Math.round(output.length / 1024)}KB`);
}
