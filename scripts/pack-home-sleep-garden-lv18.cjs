/* global __dirname */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(
  root,
  'assets/pixelPet/sourceFrames/sleep_garden_lv18/frame15.png',
);
const animationDir = path.join(root, 'assets/pixelPet/animations');
const source = PNG.sync.read(fs.readFileSync(sourcePath));
if (source.width !== 320 || source.height !== 320) {
  throw new Error(`Expected 320x320 source, received ${source.width}x${source.height}`);
}

function sceneFrame(frame, direction) {
  const image = new PNG({ width: 320, height: 320 });
  if (direction === 'grow' && frame === 0) return image;
  if (direction === 'decay' && frame === 15) return image;
  if (direction === 'grow' && frame === 15) return PNG.sync.read(PNG.sync.write(source));
  const progress = frame / 15;
  const amount = direction === 'grow'
    ? Math.pow(progress, 0.72)
    : 1 - Math.pow(progress, 0.72);
  const noiseStep = 24;
  const noiseSize = Math.ceil(320 / noiseStep) + 1;
  const noise = new Float32Array(noiseSize * noiseSize);
  for (let y = 0; y < noiseSize; y += 1) {
    for (let x = 0; x < noiseSize; x += 1) {
      // Stable value noise creates broad, soft reveal patches instead of a
      // visibly straight wipe. The bottom of the scene appears first.
      let value = Math.sin((x + 1) * 127.1 + (y + 1) * 311.7) * 43758.5453;
      value -= Math.floor(value);
      noise[y * noiseSize + x] = value;
    }
  }
  const smoothstep = (edge0, edge1, value) => {
    const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  };
  for (let y = 0; y < 320; y += 1) {
    for (let x = 0; x < 320; x += 1) {
      const index = (y * 320 + x) * 4;
      const nx = x / noiseStep;
      const ny = y / noiseStep;
      const ix = Math.floor(nx);
      const iy = Math.floor(ny);
      const fx = nx - ix;
      const fy = ny - iy;
      const n00 = noise[iy * noiseSize + ix];
      const n10 = noise[iy * noiseSize + ix + 1];
      const n01 = noise[(iy + 1) * noiseSize + ix];
      const n11 = noise[(iy + 1) * noiseSize + ix + 1];
      const field = (n00 * (1 - fx) + n10 * fx) * (1 - fy) +
        (n01 * (1 - fx) + n11 * fx) * fy;
      const threshold = (1 - y / 320) * 0.52 + field * 0.48;
      const coverage = smoothstep(threshold - 0.09, threshold + 0.09, amount);
      image.data[index] = source.data[index];
      image.data[index + 1] = source.data[index + 1];
      image.data[index + 2] = source.data[index + 2];
      image.data[index + 3] = Math.round(source.data[index + 3] * coverage);
    }
  }
  return image;
}

function pack(frames, outputPath) {
  const atlas = new PNG({ width: 1280, height: 1280 });
  frames.forEach((frame, index) => {
    const offsetX = (index % 4) * 320;
    const offsetY = Math.floor(index / 4) * 320;
    for (let y = 0; y < 320; y += 1) {
      const sourceStart = y * 320 * 4;
      const targetStart = ((offsetY + y) * 1280 + offsetX) * 4;
      frame.data.copy(atlas.data, targetStart, sourceStart, sourceStart + 320 * 4);
    }
  });
  // Keep the hand-painted gradients while meeting the 700KB per-atlas budget.
  for (let index = 0; index < atlas.data.length; index += 4) {
    const alpha = Math.round(atlas.data[index + 3] / 17) * 17;
    atlas.data[index + 3] = alpha;
    if (alpha < 17) {
      atlas.data[index] = 0;
      atlas.data[index + 1] = 0;
      atlas.data[index + 2] = 0;
      atlas.data[index + 3] = 0;
      continue;
    }
    atlas.data[index] = Math.round(atlas.data[index] / 51) * 51;
    atlas.data[index + 1] = Math.round(atlas.data[index + 1] / 51) * 51;
    atlas.data[index + 2] = Math.round(atlas.data[index + 2] / 51) * 51;
  }
  fs.writeFileSync(outputPath, PNG.sync.write(atlas));
}

const growth = Array.from({ length: 16 }, (_, frame) => sceneFrame(frame, 'grow'));
const decay = Array.from({ length: 16 }, (_, frame) => sceneFrame(frame, 'decay'));
// Make the first wake frame byte-for-byte equal to the completed growth frame.
decay[0] = PNG.sync.read(PNG.sync.write(growth[15]));
const framesDir = path.dirname(sourcePath);
growth.forEach((frame, index) =>
  fs.writeFileSync(
    path.join(framesDir, `frame${String(index).padStart(2, '0')}.png`),
    PNG.sync.write(frame),
  ),
);
decay.forEach((frame, index) =>
  fs.writeFileSync(
    path.join(framesDir, `decay${String(index).padStart(2, '0')}.png`),
    PNG.sync.write(frame),
  ),
);
pack(growth, path.join(animationDir, 'home_sleep_garden_lv18.png'));
pack(decay, path.join(animationDir, 'home_sleep_garden_lv18_decay.png'));
console.log('Packed Lv18 4x4 growth and decay atlases (1280x1280 each).');
