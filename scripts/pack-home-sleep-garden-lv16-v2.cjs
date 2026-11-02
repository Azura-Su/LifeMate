#!/usr/bin/env node
/* global __dirname */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Jimp = require('jimp-compact');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'assets/pixelPet/sourceFrames/sleep_garden_lv16/v2');
const frameDir = path.join(sourceDir, 'packed320');
const previewDir = path.join(root, 'tasks/previews');
const cell = 320;
const baseline = 296;
const footprint = 288;

function alphaBounds(image) {
  const { data, width, height } = image.bitmap;
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < 80) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return right < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function extractFrames(kind, rowEdges) {
  const sheet = await Jimp.read(path.join(sourceDir, `${kind}-sheet.png`));
  assert.equal(sheet.bitmap.width, 1254, 'Source sheet width changed; review cell boundaries');
  assert.equal(sheet.bitmap.height, 1254, 'Source sheet height changed; review row boundaries');
  const frames = [];
  for (let index = 0; index < 16; index += 1) {
    const output = new Jimp(cell, cell, 0x00000000);
    const row = Math.floor(index / 4);
    const col = index % 4;
    const left = Math.round(col * sheet.bitmap.width / 4);
    const right = Math.round((col + 1) * sheet.bitmap.width / 4);
    const raw = sheet.clone().crop(left, rowEdges[row], right - left, rowEdges[row + 1] - rowEdges[row]);
    // Keep generated alpha; discard only the faint halo outside the painted prop.
    for (let offset = 3; offset < raw.bitmap.data.length; offset += 4) {
      if (raw.bitmap.data[offset] < 80) raw.bitmap.data[offset] = 0;
    }
    const bounds = alphaBounds(raw);
    const empty = (kind === 'growth' && index === 0) || (kind === 'decay' && index === 15);
    if (!empty) {
      assert.ok(bounds, `${kind} frame ${index} is unexpectedly empty`);
      const sprite = raw.crop(bounds.left, bounds.top, bounds.width, bounds.height);
      const scale = Math.min(footprint / bounds.width, 272 / bounds.height);
      const width = Math.round(bounds.width * scale);
      const height = Math.round(bounds.height * scale);
      sprite.resize(width, height, Jimp.RESIZE_BICUBIC);
      output.composite(sprite, Math.round((cell - width) / 2), baseline - height);
    }
    frames.push(output);
  }
  return frames;
}

async function pack(kind, frames) {
  const atlas = new Jimp(cell * 4, cell * 4, 0x00000000);
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    const { data } = frame.bitmap;
    for (let offset = 0; offset < data.length; offset += 4) {
      data[offset + 3] = Math.round(data[offset + 3] / 51) * 51;
      for (let channel = 0; channel < 3; channel += 1) {
        data[offset + channel] = data[offset + 3] === 0
          ? 0 : Math.min(255, Math.round(data[offset + channel] / 32) * 32);
      }
    }
    const bounds = alphaBounds(frame);
    if (bounds) {
      assert.ok(bounds.left >= 16 && bounds.left + bounds.width <= 304, `${kind} frame ${index} has no gutter`);
      assert.ok(bounds.top >= 24 && bounds.top + bounds.height <= baseline, `${kind} frame ${index} leaves its cell`);
    }
    await frame.writeAsync(path.join(frameDir, `${kind}${String(index).padStart(2, '0')}.png`));
    atlas.composite(frame, (index % 4) * cell, Math.floor(index / 4) * cell);
  }
  const basename = `home_sleep_garden_lv16${kind === 'decay' ? '_decay' : ''}_v2`;
  const atlasPath = path.join(root, 'assets/pixelPet/animations', `${basename}.png`);
  await atlas.writeAsync(atlasPath);
  const bytes = fs.statSync(atlasPath).size;
  assert.ok(bytes <= 700 * 1024, `${basename} exceeds 700KB: ${bytes}`);
  const contact = new Jimp(cell * 4, cell * 4, 0xf5efe5ff);
  contact.composite(atlas, 0, 0);
  await contact.writeAsync(path.join(previewDir, `${basename}-contact.png`));
  console.log(`${basename}: 1280×1280, ${bytes} bytes`);
}

async function main() {
  fs.mkdirSync(frameDir, { recursive: true });
  fs.mkdirSync(previewDir, { recursive: true });
  // Source rows are separated by measured transparent gutters, not exact quarters.
  // In particular, the mature growth canopies begin above y=940.5.
  const growth = await extractFrames('growth', [0, 333, 625, 910, 1254]);
  const decay = await extractFrames('decay', [0, 330, 645, 1000, 1254]);
  decay[0] = growth[15].clone();
  await pack('growth', growth);
  await pack('decay', decay);
  assert.ok(growth[0].bitmap.data.every((value) => value === 0), 'Growth must start empty');
  assert.ok(decay[15].bitmap.data.every((value) => value === 0), 'Decay must end empty');
  assert.ok(growth[15].bitmap.data.equals(decay[0].bitmap.data), 'Growth/decay handoff must match pixel-for-pixel');

  // Reproduce HomeSleepGarden/CelestialStagAtlas geometry for visual review.
  const sleepAtlas = await Jimp.read(path.join(root, 'assets/pixelPet/animations/celestial_stag_lv1516_sleep.png'));
  const pet = sleepAtlas.crop(3 * cell, 3 * cell, cell, cell);
  const sceneSize = 188;
  const sceneScale = cell / sceneSize;
  const petSize = 120 * (221 / 211);
  const petPixels = Math.round(petSize * sceneScale);
  pet.resize(petPixels, petPixels, Jimp.RESIZE_BICUBIC);
  const petX = Math.round(((sceneSize - 120) / 2 + (120 - petSize) / 2) * sceneScale);
  const gardenTop = 120 * 0.81 - sceneSize * (296 / 320);
  const petY = Math.round((-gardenTop + 60 + 0.31 * 120 - 0.9 * petSize) * sceneScale);
  const overlay = new Jimp(2 * cell, cell, 0xf5efe5ff);
  overlay.composite(new Jimp(cell, cell, 0x142332ff), cell, 0);
  for (const left of [0, cell]) {
    overlay.composite(growth[15], left, 0);
    overlay.composite(pet, left + petX, petY);
  }
  await overlay.writeAsync(path.join(previewDir, 'celestial-stag-lv16-sleep-scene-v2-overlay.png'));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
