/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const Jimp = require('jimp-compact');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'assets/pixelPet/sourceFrames/sleep_garden_lv20');
const frameDir = path.join(sourceDir, 'packed320');
const animationDir = path.join(root, 'assets/pixelPet/animations');
const previewDir = path.join(root, 'tasks/previews');
const cell = 320;
const baseline = 296;

function bounds(image) {
  const { data, width, height } = image.bitmap;
  let left = width;
  let top = height;
  let right = 0;
  let bottom = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < 24) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  }
  return right > left ? { left, top, right, bottom } : null;
}

function cleanAlpha(frame) {
  // Clear nearly invisible matte residues before resampling. Retain painted
  // clouds, dust and soft edges rather than keying colours inside the scene.
  for (let offset = 0; offset < frame.bitmap.data.length; offset += 4) {
    if (frame.bitmap.data[offset + 3] < 24)
      frame.bitmap.data.fill(0, offset, offset + 4);
  }
  return frame;
}

async function readFrames(filename) {
  const sheet = await Jimp.read(path.join(sourceDir, filename));
  return Array.from({ length: 16 }, (_, index) => {
    const x = Math.round(((index % 4) * sheet.bitmap.width) / 4);
    const y = Math.round((Math.floor(index / 4) * sheet.bitmap.height) / 4);
    const right = Math.round((((index % 4) + 1) * sheet.bitmap.width) / 4);
    const bottom = Math.round(((Math.floor(index / 4) + 1) * sheet.bitmap.height) / 4);
    return cleanAlpha(sheet.clone().crop(x, y, right - x, bottom - y));
  });
}

function normalize(frame, scale, anchorBottom) {
  const output = new Jimp(cell, cell, 0x00000000);
  const width = Math.round(frame.bitmap.width * scale);
  const height = Math.round(frame.bitmap.height * scale);
  const sprite = frame.clone().resize(width, height, Jimp.RESIZE_BICUBIC);
  const bottom = anchorBottom === undefined
    ? bounds(sprite)?.bottom ?? baseline
    : Math.round(anchorBottom * scale);
  output.composite(sprite, Math.round((cell - width) / 2), baseline - bottom);
  return output;
}

function quantize(image) {
  const { data } = image.bitmap;
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset + 3] = Math.round(data[offset + 3] / 17) * 17;
    if (data[offset + 3] < 17) {
      data.fill(0, offset, offset + 4);
      continue;
    }
    for (let channel = 0; channel < 3; channel += 1)
      data[offset + channel] = Math.round(data[offset + channel] / 51) * 51;
  }
  return image;
}

async function pack(frames, kind) {
  const atlas = new Jimp(cell * 4, cell * 4, 0x00000000);
  for (const [index, frame] of frames.entries()) {
    await frame.writeAsync(path.join(frameDir, `${kind}${String(index).padStart(2, '0')}.png`));
    atlas.composite(frame, (index % 4) * cell, Math.floor(index / 4) * cell);
  }
  const name = `home_sleep_garden_lv20${kind === 'decay' ? '_decay' : ''}.png`;
  const outputPath = path.join(animationDir, name);
  await atlas.writeAsync(outputPath);
  const bytes = fs.statSync(outputPath).size;
  assert(bytes <= 700_000, `${name} exceeds 700KB: ${bytes}`);
  const contact = new Jimp(cell * 4, cell * 4, 0xf5f0e8ff);
  contact.composite(atlas, 0, 0);
  const label = kind === 'decay' ? 'decay' : 'growth';
  await contact.writeAsync(path.join(previewDir, `home_sleep_garden_lv20-${label}-contact.png`));
  console.log(`${name}: 1280x1280; ${bytes} bytes`);
}

async function overlayPreview(final) {
  const atlas = await Jimp.read(path.join(animationDir, 'celestial_stag_lv1920_sleep.png'));
  const stag = atlas.clone().crop(960, 960, cell, cell);
  // Lv20 uses a 184px garden, enlarged about the original centre/ground.
  // The pet stays 120px with level scale 226/223 and hoof line 288/320.
  const gardenSize = 184;
  const gardenTop = -44 - (gardenSize - 168) * (296 / 320);
  const displayScale = (120 / gardenSize) * (226 / 223);
  const petSize = Math.round(cell * displayScale);
  const x = Math.round((cell - petSize) / 2);
  const ground = ((120 * 0.81 - gardenTop) / gardenSize) * cell;
  const y = Math.round(ground - (288 / cell) * petSize);
  const preview = new Jimp(cell * 2, cell, 0xf5f0e8ff);
  preview.composite(final, 0, 0);
  const composite = final.clone().composite(stag.resize(petSize, petSize, Jimp.RESIZE_BICUBIC), x, y);
  preview.composite(composite, cell, 0);
  await preview.writeAsync(path.join(previewDir, 'celestial-stag-lv20-sleep-scene-overlay.png'));
  await final.writeAsync(path.join(sourceDir, 'frame15-v2.png'));
}

async function tierPreview() {
  const size = 168;
  const strip = new Jimp(size * 10, size, 0xf5f0e8ff);
  for (let index = 0; index < 10; index += 1) {
    const level = (index + 1) * 2;
    let name = level === 2 ? 'home_sleep_garden.png'
      : `home_sleep_garden_lv${String(level).padStart(2, '0')}.png`;
    // Home currently selects the separately authored Lv16 v2 scene.
    if (level === 16 && fs.existsSync(path.join(animationDir, 'home_sleep_garden_lv16_v2.png')))
      name = 'home_sleep_garden_lv16_v2.png';
    const atlas = await Jimp.read(path.join(animationDir, name));
    const final = atlas.crop(960, 960, cell, cell).resize(size, size, Jimp.RESIZE_BICUBIC);
    strip.composite(final, index * size, 0);
  }
  await strip.writeAsync(path.join(previewDir, 'celestial-stag-lv20-sleep-scene-tiers.png'));
}

async function main() {
  fs.mkdirSync(frameDir, { recursive: true });
  fs.mkdirSync(previewDir, { recursive: true });
  const growth = await readFrames('growth-sheet-source.png');
  const decay = await readFrames('decay-sheet-source.png');
  // Independently repainted early stages keep the emerald's identity/position
  // and retain the cloud/grass island underneath the newly opened dais.
  for (const index of [1, 2, 3, 4, 5, 6]) {
    const source = cleanAlpha(await Jimp.read(path.join(sourceDir, `frame0${index}-source.png`)));
    growth[index] = source.resize(
      growth[index].bitmap.width, growth[index].bitmap.height, Jimp.RESIZE_BICUBIC,
    );
  }
  const painted = [...growth.slice(1), ...decay.slice(0, 15)];
  const allBounds = painted.map(bounds).filter(Boolean);
  // A single scale for both tracks; do not magnify early scenes or dust.
  const scale = Math.min(
    288 / Math.max(...painted.map((frame) => frame.bitmap.width)),
    272 / Math.max(...allBounds.map((box) => box.bottom - box.top)),
  );
  // The floating seed uses the first cloud's anchor, so it stays in place
  // while the island forms beneath it instead of snapping down to the ground.
  const growthBottom = bounds(growth[2]).bottom;
  const decayBottom = bounds(decay[0]).bottom;
  const growFrames = growth.map((frame, index) => normalize(
    frame, scale, index > 1 ? undefined : growthBottom,
  ));
  const decayFrames = decay.map((frame, index) => normalize(
    frame, scale, index < 13 ? undefined : decayBottom,
  ));
  growFrames[0] = new Jimp(cell, cell, 0x00000000);
  decayFrames[15] = new Jimp(cell, cell, 0x00000000);
  growFrames.forEach(quantize);
  decayFrames.forEach(quantize);
  decayFrames[0] = growFrames[15].clone();
  assert(growFrames[15].bitmap.data.equals(decayFrames[0].bitmap.data));
  assert.equal(bounds(growFrames[0]), null);
  assert.equal(bounds(decayFrames[15]), null);
  for (const frame of [...growFrames, ...decayFrames]) {
    const box = bounds(frame);
    if (box) assert(box.left >= 16 && box.right <= 304 && box.top >= 16 && box.bottom <= baseline,
      `Scene exceeds its padded footprint: ${JSON.stringify(box)}`);
  }
  await pack(growFrames, 'frame');
  await pack(decayFrames, 'decay');
  await overlayPreview(growFrames[15]);
  await tierPreview();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
