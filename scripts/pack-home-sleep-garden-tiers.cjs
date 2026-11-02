/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const Jimp = require('jimp-compact');
const { PNG } = require('pngjs');

const root = path.resolve(__dirname, '..');
const animationDir = path.join(root, 'assets/pixelPet/animations');
const CELL = 320;
const ATLAS = CELL * 4;
const specs = [
  { level: 8, source: 'frame15.png' },
  { level: 10, source: 'normalized320/frame15_candidate.png' },
  { level: 14, source: 'frame15-candidate.png' },
];

function alphaBounds(image, threshold = 24) {
  const { data, width, height } = image.bitmap;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < threshold) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  }
  return right < 0 ? null : { left, top, width: right - left, height: bottom - top };
}

function sampleNoise(x, y) {
  const step = 24;
  const ix = Math.floor(x / step);
  const iy = Math.floor(y / step);
  const fx = (x % step) / step;
  const fy = (y % step) / step;
  const valueAt = (cx, cy) => {
    let value = Math.sin((cx + 1) * 127.1 + (cy + 1) * 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  const top = valueAt(ix, iy) * (1 - fx) + valueAt(ix + 1, iy) * fx;
  const bottom = valueAt(ix, iy + 1) * (1 - fx) + valueAt(ix + 1, iy + 1) * fx;
  return top * (1 - fy) + bottom * fy;
}

function revealScene(scene, progress) {
  const output = new PNG({ width: CELL, height: CELL });
  if (progress <= 0) return output;
  if (progress >= 1) return PNG.sync.read(PNG.sync.write(scene));
  const { data: source } = scene;
  const smooth = (a, b, value) => {
    const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (let y = 0; y < CELL; y += 1) {
    for (let x = 0; x < CELL; x += 1) {
      const index = (y * CELL + x) * 4;
      const threshold = (1 - y / CELL) * 0.52 + sampleNoise(x, y) * 0.48;
      const alpha = smooth(threshold - 0.09, threshold + 0.09, progress);
      output.data[index] = source[index];
      output.data[index + 1] = source[index + 1];
      output.data[index + 2] = source[index + 2];
      output.data[index + 3] = Math.round(source[index + 3] * alpha);
    }
  }
  return output;
}

function pack(frames, outputPath) {
  const atlas = new PNG({ width: ATLAS, height: ATLAS });
  frames.forEach((frame, index) => {
    const offsetX = (index % 4) * CELL;
    const offsetY = Math.floor(index / 4) * CELL;
    for (let y = 0; y < CELL; y += 1) {
      const from = y * CELL * 4;
      const to = ((offsetY + y) * ATLAS + offsetX) * 4;
      frame.data.copy(atlas.data, to, from, from + CELL * 4);
    }
  });
  for (let index = 0; index < atlas.data.length; index += 4) {
    const alpha = Math.round(atlas.data[index + 3] / 17) * 17;
    atlas.data[index + 3] = alpha;
    if (alpha < 17) {
      atlas.data[index] = 0;
      atlas.data[index + 1] = 0;
      atlas.data[index + 2] = 0;
      atlas.data[index + 3] = 0;
    } else {
      atlas.data[index] = Math.round(atlas.data[index] / 51) * 51;
      atlas.data[index + 1] = Math.round(atlas.data[index + 1] / 51) * 51;
      atlas.data[index + 2] = Math.round(atlas.data[index + 2] / 51) * 51;
    }
  }
  fs.writeFileSync(outputPath, PNG.sync.write(atlas));
}

async function normalizeFrame(sourcePath, finalBounds) {
  const source = await Jimp.read(sourcePath);
  const bounds = finalBounds ?? alphaBounds(source);
  if (!bounds) return new PNG({ width: CELL, height: CELL });
  const width = Math.min(288, Math.round((bounds.width / bounds.height) * 272));
  const height = Math.min(272, Math.round((bounds.height / bounds.width) * 288));
  const cropped = source.clone().crop(bounds.left, bounds.top, bounds.width, bounds.height);
  cropped.resize(width, height, Jimp.RESIZE_BICUBIC);
  const normalized = new Jimp(CELL, CELL, 0x00000000);
  normalized.composite(cropped, Math.round((CELL - width) / 2), 296 - height);
  const buffer = await normalized.getBufferAsync(Jimp.MIME_PNG);
  return PNG.sync.read(buffer);
}

async function main() {
  for (const { level, source } of specs) {
    const key = String(level).padStart(2, '0');
    const sourceDir = path.join(root, `assets/pixelPet/sourceFrames/sleep_garden_lv${key}`);
    const candidatePath = path.join(sourceDir, source);
    const candidate = await Jimp.read(candidatePath);
    const bounds = alphaBounds(candidate);
    if (!bounds) throw new Error(`No painted pixels in ${candidatePath}`);
    const final = await normalizeFrame(candidatePath, bounds);
    const packedFrames = path.join(sourceDir, 'packed320');
    fs.mkdirSync(packedFrames, { recursive: true });
    const growth = [];
    const decay = [];
    for (let index = 0; index < 16; index += 1) {
      const progress = index / 15;
      const frame = revealScene(final, Math.pow(progress, 0.72));
      const dying = revealScene(final, 1 - Math.pow(progress, 0.72));
      growth.push(frame);
      decay.push(dying);
      fs.writeFileSync(path.join(packedFrames, `frame${String(index).padStart(2, '0')}.png`), PNG.sync.write(frame));
      fs.writeFileSync(path.join(packedFrames, `decay${String(index).padStart(2, '0')}.png`), PNG.sync.write(dying));
    }
    decay[0] = PNG.sync.read(PNG.sync.write(growth[15]));
    fs.writeFileSync(path.join(packedFrames, 'frame15.png'), PNG.sync.write(growth[15]));
    fs.writeFileSync(path.join(packedFrames, 'decay00.png'), PNG.sync.write(decay[0]));
    pack(growth, path.join(animationDir, `home_sleep_garden_lv${key}.png`));
    pack(decay, path.join(animationDir, `home_sleep_garden_lv${key}_decay.png`));
    console.log(`Packed Lv${key} growth and decay atlases from ${source}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
