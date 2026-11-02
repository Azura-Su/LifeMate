#!/usr/bin/env node
/* global __dirname */

const path = require('node:path');
const { Buffer } = require('node:buffer');
const Jimp = require('jimp-compact');

const root = path.resolve(__dirname, '..');
const frameDir = path.join(root, 'assets/pixelPet/sourceFrames/sleep_garden_lv16');
const previewDir = path.join(root, 'tasks/previews');
const cell = 320;
const atlasSize = cell * 4;

const frameName = (index) => `frame${String(index).padStart(2, '0')}.png`;
const decayName = (index) => `decay${String(index).padStart(2, '0')}.png`;

const cleanWhiteArtifacts = (image) => {
  const { data, width, height } = image.bitmap;
  const seen = new Uint8Array(width * height);
  const isNeutralWhite = (offset) => {
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    return (
      data[offset + 3] >= 16 &&
      r >= 205 && g >= 205 && b >= 205 &&
      Math.max(r, g, b) - Math.min(r, g, b) <= 28
    );
  };

  for (let start = 0; start < width * height; start += 1) {
    if (seen[start] || !isNeutralWhite(start * 4)) continue;
    const queue = [start];
    const component = [];
    seen[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const pixel = queue[cursor];
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      component.push(pixel);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const neighbour = ny * width + nx;
          if (!seen[neighbour] && isNeutralWhite(neighbour * 4)) {
            seen[neighbour] = 1;
            queue.push(neighbour);
          }
        }
      }
    }
    // Keep isolated star points; remove the large white wedges from extraction.
    if (component.length > 20) {
      for (const pixel of component) data[pixel * 4 + 3] = 0;
    }
  }
  return image;
};

const pixelIsStar = (r, g, b) => Math.max(r, g, b) > 215 && Math.min(r, g, b) > 115;
const pixelIsPurpleSky = (r, g, b, y) =>
  y < 255 && r > 70 && b > 105 && r > g * 1.12 && b > g * 1.08;
const pixelIsFoliage = (r, g, b, y) =>
  y < 220 && g > r * 1.2 && b > r * 1.12;

const addRisingMotes = (image, frame) => {
  if (frame < 12 || frame > 14) return image;
  const motes = new Jimp(cell, cell, 0x00000000);
  const sources = [
    [92, 232], [124, 214], [154, 238], [188, 220], [224, 235],
    [72, 184], [246, 188], [108, 150], [202, 162], [165, 195],
  ];
  const rise = (frame - 11) * 28;
  const alpha = frame === 12 ? 125 : frame === 13 ? 105 : 75;
  for (let index = 0; index < sources.length; index += 1) {
    const [sourceX, sourceY] = sources[index];
    const x = sourceX + ((index % 3) - 1) * (frame - 12) * 4;
    const y = sourceY - rise - (index % 4) * 3;
    if (y < 4 || y >= cell - 4) continue;
    const rgba = Jimp.intToRGBA(image.getPixelColor(sourceX, sourceY));
    const color = Jimp.rgbaToInt(rgba.r || 90, rgba.g || 210, rgba.b || 255, alpha);
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const distance = Math.abs(dx) + Math.abs(dy);
        if (distance > 3) continue;
        const moteAlpha = Math.round(alpha * (distance <= 1 ? 1 : 0.45));
        motes.setPixelColor(Jimp.rgbaToInt(rgba.r || 90, rgba.g || 210, rgba.b || 255, moteAlpha), x + dx, y + dy);
      }
    }
    // A small brighter core gives each fragment a soft celestial glint.
    motes.setPixelColor(color, x, y);
  }
  image.composite(motes, 0, 0);
  return image;
};

const createDecayFrames = async () => {
  const finalScene = await Jimp.read(path.join(frameDir, frameName(15)));
  const original = Buffer.from(finalScene.bitmap.data);

  for (let frame = 0; frame < 16; frame += 1) {
    const output = await Jimp.read(path.join(frameDir, frameName(15)));
    const { data, width } = output.bitmap;
    if (frame === 15) {
      output.bitmap.data.fill(0);
    } else if (frame > 0) {
      for (let pixel = 0; pixel < data.length; pixel += 4) {
        const x = (pixel / 4) % width;
        const y = Math.floor(pixel / 4 / width);
        const [r, g, b, alpha] = original.subarray(pixel, pixel + 4);
        if (alpha === 0) continue;

        let opacity = 1;
        if (frame <= 3 && pixelIsStar(r, g, b)) {
          opacity = [1, 0.82, 0.58, 0.28][frame];
        } else if (frame >= 4 && frame <= 6 && pixelIsPurpleSky(r, g, b, y)) {
          opacity = [0, 0, 0, 0, 0.72, 0.38, 0.08][frame];
        } else if (frame >= 7 && frame <= 9 && pixelIsFoliage(r, g, b, y)) {
          opacity = [0, 0, 0, 0, 0, 0, 0, 0.72, 0.48, 0.24][frame];
        } else if (frame >= 10 && frame <= 12 && y < 270) {
          const front = 92 + (frame - 10) * 52 + 12 * Math.sin(x / 21) + 7 * Math.sin(x / 8);
          const dissolve = Math.max(0, Math.min(1, (y - (front - 34)) / 68));
          opacity = 0.06 + dissolve * 0.86;
        } else if (frame === 13) {
          opacity = y < 250 ? 0.18 : 0.5;
        } else if (frame === 14) {
          opacity = 0.18;
        }
        data[pixel + 3] = Math.round(alpha * opacity);
      }
    }
    await addRisingMotes(output, frame).writeAsync(path.join(frameDir, decayName(frame)));
  }
};

const pack = async (kind, outputName) => {
  const atlas = new Jimp(atlasSize, atlasSize, 0x00000000);
  for (let index = 0; index < 16; index += 1) {
    const image = await Jimp.read(path.join(frameDir, kind === 'growth' ? frameName(index) : decayName(index)));
    if (image.bitmap.width !== cell || image.bitmap.height !== cell)
      throw new Error(`${kind} frame ${index} must be 320×320`);
    atlas.composite(image, (index % 4) * cell, Math.floor(index / 4) * cell);
  }

  const { data } = atlas.bitmap;
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset + 3] = Math.round(data[offset + 3] / 17) * 17;
    if (data[offset + 3] < 17) {
      data[offset] = data[offset + 1] = data[offset + 2] = data[offset + 3] = 0;
      continue;
    }
    for (let channel = 0; channel < 3; channel += 1)
      data[offset + channel] = Math.round(data[offset + channel] / 51) * 51;
  }

  const atlasPath = path.join(root, 'assets/pixelPet/animations', outputName);
  await atlas.writeAsync(atlasPath);
  const contact = new Jimp(atlasSize, atlasSize, 0xf5efe5ff);
  contact.composite(atlas, 0, 0);
  await contact.writeAsync(path.join(previewDir, outputName.replace('.png', '-contact.png')));
  if (require('node:fs').statSync(atlasPath).size > 700 * 1024)
    throw new Error(`${outputName} exceeds 700KB`);
  return Jimp.read(atlasPath);
};

async function main() {
  for (let frame = 2; frame < 15; frame += 1) {
    const image = await Jimp.read(path.join(frameDir, frameName(frame)));
    await cleanWhiteArtifacts(image).writeAsync(path.join(frameDir, frameName(frame)));
  }
  await createDecayFrames();
  const growth = await pack('growth', 'home_sleep_garden_lv16.png');
  const decay = await pack('decay', 'home_sleep_garden_lv16_decay.png');
  const cropCell = (atlas, index) => atlas.clone().crop(
    (index % 4) * cell,
    Math.floor(index / 4) * cell,
    cell,
    cell,
  );
  const growthStart = cropCell(growth, 0);
  const decayEnd = cropCell(decay, 15);
  if (growthStart.bitmap.data.some((_, offset) => offset % 4 === 3 && growthStart.bitmap.data[offset] !== 0))
    throw new Error('Growth frame 0 must be transparent');
  if (decayEnd.bitmap.data.some((_, offset) => offset % 4 === 3 && decayEnd.bitmap.data[offset] !== 0))
    throw new Error('Decay frame 15 must be transparent');
  if (!cropCell(growth, 15).bitmap.data.equals(cropCell(decay, 0).bitmap.data))
    throw new Error('Growth frame 15 and decay frame 0 must match exactly');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
