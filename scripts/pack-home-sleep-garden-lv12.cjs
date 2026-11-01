#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { Buffer } = require('node:buffer');
const Jimp = require('jimp-compact');

const root = path.resolve(path.dirname(process.argv[1]), '..');
const frameDir = path.join(root, 'assets/pixelPet/sourceFrames/sleep_garden_lv12');
const previewDir = path.join(root, 'tasks/previews');
const cell = 320;
const atlasSize = cell * 4;
const innerWidth = 288;
const innerHeight = 272;
const baseline = 296;

const removeNearGreenFringe = (image) => {
  const { data, width, height } = image.bitmap;
  const copy = Buffer.from(data);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = (y * width + x) * 4;
      const [r, g, b, a] = data.subarray(index, index + 4);
      if (a === 0 || !(g > 175 && r < 95 && b < 145 && g - r > 95)) continue;
      let nearTransparent = false;
      for (let dy = -1; dy <= 1 && !nearTransparent; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          if (data[((y + dy) * width + x + dx) * 4 + 3] < 32) {
            nearTransparent = true;
            break;
          }
        }
      }
      if (nearTransparent) copy[index + 3] = 0;
    }
  }
  image.bitmap.data = copy;
  return image;
};

const alphaBounds = (image) => {
  const { data, width, height } = image.bitmap;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < 24) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  }
  return right < 0 ? null : { left, top, width: right - left, height: bottom - top };
};

const extractCell = async (sheet, index) => {
  const row = Math.floor(index / 4);
  const column = index % 4;
  const x = Math.round((column * sheet.bitmap.width) / 4);
  const y = Math.round((row * sheet.bitmap.height) / 4);
  const right = Math.round(((column + 1) * sheet.bitmap.width) / 4);
  const bottom = Math.round(((row + 1) * sheet.bitmap.height) / 4);
  const cellImage = sheet.clone().crop(x, y, right - x, bottom - y);
  const { data, width, height } = cellImage.bitmap;
  const insetX = Math.round(width * 0.04);
  const insetY = Math.round(height * 0.05);
  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const indexInCell = (py * width + px) * 4;
      if (
        px < insetX || px >= width - insetX ||
        py < insetY || py >= height - insetY ||
        data[indexInCell + 3] < 80
      ) data[indexInCell + 3] = 0;
    }
  }
  return cellImage;
};

const fittedScene = (source) => {
  const cleaned = removeNearGreenFringe(source.clone());
  const bounds = alphaBounds(cleaned);
  const output = new Jimp(cell, cell, 0x00000000);
  if (!bounds) return output;
  const sprite = cleaned.crop(bounds.left, bounds.top, bounds.width, bounds.height);
  const scale = Math.min(innerWidth / sprite.bitmap.width, innerHeight / sprite.bitmap.height);
  const width = Math.max(1, Math.round(sprite.bitmap.width * scale));
  const height = Math.max(1, Math.round(sprite.bitmap.height * scale));
  sprite.resize(width, height, Jimp.RESIZE_BICUBIC);
  output.composite(sprite, Math.round((cell - width) / 2), baseline - height);
  return output;
};

const quantizeForRuntime = (atlas) => {
  const { data } = atlas.bitmap;
  const colorStep = 51;
  const alphaStep = 85;
  for (let originY = 0; originY < atlasSize; originY += cell) {
    for (let originX = 0; originX < atlasSize; originX += cell) {
      for (let y = originY; y < originY + cell; y += 1) {
        for (let x = originX; x < originX + cell; x += 1) {
          const index = (y * atlasSize + x) * 4;
          data[index + 3] = Math.round(data[index + 3] / alphaStep) * alphaStep;
          if (data[index + 3] < 85) {
            data[index + 3] = 0;
            data[index] = 0;
            data[index + 1] = 0;
            data[index + 2] = 0;
            continue;
          }
          for (let channel = 0; channel < 3; channel += 1)
            data[index + channel] = Math.round(data[index + channel] / colorStep) * colorStep;
        }
      }
    }
  }
};

const readSheet = async (filename) => {
  const image = await Jimp.read(path.join(frameDir, filename));
  if (image.bitmap.width < 4 || image.bitmap.height < 4) throw new Error(`Invalid sheet ${filename}`);
  return image;
};

const assertTransparent = (atlas, index, label) => {
  const frame = atlas.clone().crop((index % 4) * cell, Math.floor(index / 4) * cell, cell, cell);
  for (let offset = 3; offset < frame.bitmap.data.length; offset += 4)
    if (frame.bitmap.data[offset] !== 0) throw new Error(`${label} must be transparent`);
};

const pack = async (name, sheet, approvedFrame) => {
  const atlas = new Jimp(atlasSize, atlasSize, 0x00000000);
  for (let index = 0; index < 16; index += 1) {
    const isApprovedFrame = index === approvedFrame.index;
    const raw = isApprovedFrame
      ? await Jimp.read(approvedFrame.path)
      : await extractCell(sheet, index);
    const sprite = fittedScene(raw);
    atlas.composite(sprite, (index % 4) * cell, Math.floor(index / 4) * cell);
    const rawPath = path.join(frameDir, `${name}${String(index).padStart(2, '0')}.png`);
    await (isApprovedFrame ? raw : raw.clone()).writeAsync(rawPath);
  }

  quantizeForRuntime(atlas);
  const atlasPath = path.join(root, `assets/pixelPet/animations/home_sleep_garden_lv12${name === 'frame' ? '' : '_decay'}.png`);
  await atlas.writeAsync(atlasPath);
  const contact = new Jimp(atlasSize, atlasSize, 0xf5efe5ff);
  contact.composite(atlas, 0, 0);
  await contact.writeAsync(path.join(previewDir, `celestial-stag-lv12-sleep-scene-${name === 'frame' ? 'growth' : 'decay'}-contact.png`));
  const bytes = fs.statSync(atlasPath).size;
  console.log(`${atlasPath}: ${atlasSize}x${atlasSize}, ${bytes} bytes`);
  if (bytes > 700 * 1024) throw new Error(`Atlas exceeds 700 KB: ${atlasPath}`);
};

async function main() {
  fs.mkdirSync(frameDir, { recursive: true });
  fs.mkdirSync(previewDir, { recursive: true });
  const growth = await readSheet('growth-sheet.png');
  const decay = await readSheet('decay-sheet.png');
  const finalPath = path.join(frameDir, 'frame15-approved.png');
  await pack('frame', growth, { index: 15, path: finalPath });
  await pack('decay', decay, { index: 0, path: finalPath });
  // Both endpoints must be identical by construction.
  const growthAtlas = await Jimp.read(path.join(root, 'assets/pixelPet/animations/home_sleep_garden_lv12.png'));
  const decayAtlas = await Jimp.read(path.join(root, 'assets/pixelPet/animations/home_sleep_garden_lv12_decay.png'));
  assertTransparent(growthAtlas, 0, 'Growth frame 0');
  assertTransparent(decayAtlas, 15, 'Decay frame 15');
  const last = growthAtlas.clone().crop(3 * cell, 3 * cell, cell, cell);
  const first = decayAtlas.clone().crop(0, 0, cell, cell);
  if (!last.bitmap.data.equals(first.bitmap.data)) throw new Error('Growth frame 15 and decay frame 0 do not match');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
