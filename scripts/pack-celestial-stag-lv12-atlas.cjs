#!/usr/bin/env node
/* global __dirname */

const fs = require('node:fs');
const path = require('node:path');
const Jimp = require('jimp-compact');
const { PNG } = require('pngjs');

const [group, countArg] = process.argv.slice(2);
const frameCount = Number(countArg);
if (!group || ![8, 16].includes(frameCount)) {
  throw new Error('Usage: node pack-celestial-stag-lv12-atlas.cjs <walk|run|hop|sleep> <8|16>');
}

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'assets/pixelPet/sourceFrames/celestial_stag_lv12');
const previewDir = path.join(root, 'tasks/previews');
const cell = 320;
const atlasSize = cell * 4;
const paletteLevels = [7, 7, 7]; // 512 RGB colors, with Floyd–Steinberg dithering.

function quantizeWithDither(png) {
  const levels = paletteLevels.map((n) => 255 / n);
  for (let originY = 0; originY < atlasSize; originY += cell) {
    for (let originX = 0; originX < atlasSize; originX += cell) {
      for (let y = originY; y < originY + cell; y += 1) {
        for (let x = originX; x < originX + cell; x += 1) {
          const index = (y * atlasSize + x) * 4;
          if (png.data[index + 3] < 128) continue;
          for (let channel = 0; channel < 3; channel += 1) {
            const previous = png.data[index + channel];
            const quantized = Math.round(previous / levels[channel]) * levels[channel];
            const error = previous - quantized;
            png.data[index + channel] = quantized;
            for (const [dx, dy, weight] of [[1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]]) {
              const nextX = x + dx;
              const nextY = y + dy;
              if (nextX < originX || nextX >= originX + cell || nextY < originY || nextY >= originY + cell) continue;
              const nextIndex = (nextY * atlasSize + nextX) * 4;
              if (png.data[nextIndex + 3] < 128) continue;
              png.data[nextIndex + channel] = Math.max(0, Math.min(255, png.data[nextIndex + channel] + error * weight));
            }
          }
        }
      }
    }
  }
}

async function pack() {
  const rawAtlas = new Jimp(atlasSize, atlasSize, 0x00000000);
  const totalFrames = 16;
  for (let slot = 0; slot < totalFrames; slot += 1) {
    const frameIndex = (slot % frameCount) + 1;
    const name = `${group}-${String(frameIndex).padStart(2, '0')}-candidate.png`;
    const input = path.join(sourceDir, name);
    if (!fs.existsSync(input)) throw new Error(`Missing prepared frame: ${input}`);
    const sprite = await Jimp.read(input);
    sprite.resize(cell, cell, Jimp.RESIZE_BICUBIC);
    rawAtlas.composite(sprite, (slot % 4) * cell, Math.floor(slot / 4) * cell);
  }

  const atlasPath = path.join(sourceDir, `${group}-atlas-candidate.png`);
  const unquantized = path.join('/tmp', `celestial-stag-lv12-${group}-unquantized.png`);
  await rawAtlas.writeAsync(unquantized);
  const pixels = PNG.sync.read(fs.readFileSync(unquantized));
  quantizeWithDither(pixels);
  fs.writeFileSync(atlasPath, PNG.sync.write(pixels, { deflateLevel: 9, deflateStrategy: 3 }));

  const sheet = new Jimp(atlasSize, atlasSize, 0xf5efe5ff);
  const finalAtlas = await Jimp.read(atlasPath);
  sheet.composite(finalAtlas, 0, 0);
  fs.mkdirSync(previewDir, { recursive: true });
  const contactPath = path.join(previewDir, `celestial-stag-lv12-${group}-contact.png`);
  await sheet.writeAsync(contactPath);
  console.log(JSON.stringify({ group, atlasPath, contactPath, bytes: fs.statSync(atlasPath).size }));
}

pack().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
