/* global __dirname */
// Package authored candidates only. Runtime atlas replacement follows visual approval.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Buffer } = require('node:buffer');
const { deflateSync } = require('node:zlib');
const { PNG } = require('pngjs');
const { crc32 } = require('pngjs/lib/crc');
const Jimp = require('jimp-compact');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'assets/pixelPet/sourceFrames/sleep_garden_lv10');
const frameDir = path.join(sourceDir, 'authored320');
const previewDir = path.join(root, 'tasks/previews');
const prefix = 'celestial-stag-lv10-sleep-scene';
const cell = 320;
const baseline = 296;
const key = (index) => String(index).padStart(2, '0');

function bounds(image, groundOnly = false) {
  const { data, width, height } = image.bitmap;
  let left = width, top = height, right = 0, bottom = 0;
  for (let y = groundOnly ? Math.floor(height * 0.78) : 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < 128) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  }
  assert(right > left && bottom > top, 'Missing solid scene/ground pixels');
  return { left, top, right, bottom };
}

function colorSample(data, offset) {
  const alpha = data[offset + 3];
  const value = [data[offset] * alpha / 255, data[offset + 1] * alpha / 255, data[offset + 2] * alpha / 255, alpha];
  const bin = ((value[0] >> 3) << 13) | ((value[1] >> 3) << 8) | ((value[2] >> 3) << 3) | (alpha >> 5);
  return { value, bin };
}

function sharedPalette(frames) {
  // Median cut in premultiplied RGBA retains soft dust and gives both endpoints identical colors.
  const histogram = new Map();
  for (const { bitmap: { data } } of frames) {
    for (let offset = 0; offset < data.length; offset += 4) {
      if (data[offset + 3] < 8) continue;
      const { value, bin } = colorSample(data, offset);
      const entry = histogram.get(bin) ?? { sum: [0, 0, 0, 0], count: 0 };
      value.forEach((channel, index) => { entry.sum[index] += channel; });
      entry.count += 1;
      histogram.set(bin, entry);
    }
  }
  const points = [...histogram.values()].map(({ sum, count }) => ({ value: sum.map((v) => v / count), count }));
  const box = (items) => {
    const ranges = [0, 1, 2, 3].map((channel) => {
      let min = 255, max = 0;
      for (const point of items) { min = Math.min(min, point.value[channel]); max = Math.max(max, point.value[channel]); }
      return (max - min) * (channel === 3 ? 1.3 : 1);
    });
    const axis = ranges.indexOf(Math.max(...ranges));
    const count = items.reduce((sum, point) => sum + point.count, 0);
    return { items, count, axis, score: items.length > 1 ? ranges[axis] ** 2 * count : 0 };
  };
  const boxes = [box(points)];
  while (boxes.length < 255) {
    const index = boxes.reduce((best, item, i) => item.score > boxes[best].score ? i : best, 0);
    const current = boxes[index];
    if (current.score === 0) break;
    current.items.sort((a, b) => a.value[current.axis] - b.value[current.axis]);
    let middle = 1, weight = current.items[0].count;
    while (middle < current.items.length - 1 && weight < current.count / 2) weight += current.items[middle++].count;
    boxes.splice(index, 1, box(current.items.slice(0, middle)), box(current.items.slice(middle)));
  }
  return [[0, 0, 0, 0], ...boxes.map(({ items, count }) => {
    const sum = [0, 0, 0, 0];
    for (const point of items) point.value.forEach((channel, index) => { sum[index] += channel * point.count / count; });
    const alpha = Math.round(sum[3]);
    return [...sum.slice(0, 3).map((value) => Math.min(255, Math.round(value * 255 / sum[3]))), alpha];
  })];
}

function indexedPNG(image, palette, cache) {
  const { width, height, data } = image.bitmap;
  const samples = palette.map(([r, g, b, a]) => [r * a / 255, g * a / 255, b * a / 255, a]);
  const scanlines = Buffer.alloc((width + 1) * height); // Filter 0 + palette indices.
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] < 8) continue;
    const { value, bin } = colorSample(data, offset);
    if (!cache.has(bin)) {
      let best = 1, distance = Infinity;
      for (let index = 1; index < samples.length; index += 1) {
        const d = samples[index].reduce((sum, channel, c) => sum + (channel - value[c]) ** 2 * (c === 3 ? 1.69 : 1), 0);
        if (d < distance) { best = index; distance = d; }
      }
      cache.set(bin, best);
    }
    const pixel = offset / 4;
    scanlines[Math.floor(pixel / width) * (width + 1) + pixel % width + 1] = cache.get(bin);
  }
  const chunk = (type, bytes) => {
    const body = Buffer.concat([Buffer.from(type), bytes]);
    const header = Buffer.alloc(4), checksum = Buffer.alloc(4);
    header.writeUInt32BE(bytes.length);
    checksum.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([header, body, checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 3; // 8-bit indexed PNG, standard compression/filtering.
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
    chunk('PLTE', Buffer.from(palette.flatMap((color) => color.slice(0, 3)))),
    chunk('tRNS', Buffer.from(palette.map((color) => color[3]))),
    chunk('IDAT', deflateSync(scanlines, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function main() {
  fs.mkdirSync(frameDir, { recursive: true });
  fs.mkdirSync(previewDir, { recursive: true });
  const growthSources = await Promise.all(Array.from({ length: 15 }, (_, n) =>
    Jimp.read(path.join(sourceDir, n >= 1 && n <= 3 ? `frame${key(n + 1)}.png` : `frame${key(n + 1)}-source.png`))));
  const decaySources = await Promise.all(Array.from({ length: 14 }, (_, n) =>
    Jimp.read(path.join(sourceDir, `decay${key(n + 1)}-source.png`))));
  const solidScenes = [...growthSources, ...decaySources.slice(0, 13)];
  for (const image of [...solidScenes, decaySources[13]])
    assert.deepEqual([image.bitmap.width, image.bitmap.height], [1254, 1254]);
  // One scale for EVERY frame. Only the ground translation varies to register generation drift.
  const scale = Math.min(...solidScenes.map((image) => {
    const box = bounds(image);
    return Math.min(288 / (box.right - box.left), 272 / (box.bottom - box.top));
  }));
  const registration = [];
  const normalize = (image, label, anchorImage = image) => {
    const resized = image.clone().resize(Math.round(image.bitmap.width * scale), Math.round(image.bitmap.height * scale), Jimp.RESIZE_BICUBIC);
    const anchor = anchorImage === image ? resized : anchorImage.clone().resize(resized.bitmap.width, resized.bitmap.height, Jimp.RESIZE_BICUBIC);
    const ground = bounds(anchor, true);
    const x = Math.round(cell / 2 - (ground.left + ground.right) / 2);
    const y = baseline - ground.bottom;
    const output = new Jimp(cell, cell, 0x00000000).composite(resized, x, y);
    registration.push({ frame: label, x, y, scale });
    return output;
  };
  const growth = [new Jimp(cell, cell, 0x00000000), ...growthSources.map((image, n) => normalize(image, `frame${key(n + 1)}`))];
  const decay = [growth[15].clone(), ...decaySources.map((image, n) => normalize(image, `decay${key(n + 1)}`, n === 13 ? decaySources[12] : image)), new Jimp(cell, cell, 0x00000000)];
  const palette = sharedPalette([...growth, ...decay]);
  const colorCache = new Map();
  const atlases = [];
  for (const [kind, frames] of [['growth', growth], ['decay', decay]]) {
    const atlas = new Jimp(cell * 4, cell * 4, 0x00000000);
    for (let index = 0; index < 16; index += 1) {
      await frames[index].writeAsync(path.join(frameDir, `${kind === 'growth' ? 'frame' : 'decay'}${key(index)}.png`));
      atlas.composite(frames[index], (index % 4) * cell, Math.floor(index / 4) * cell);
    }
    const outputPath = path.join(previewDir, `${prefix}-${kind}-atlas-candidate.png`);
    const buffer = indexedPNG(atlas, palette, colorCache);
    fs.writeFileSync(outputPath, buffer);
    // Decode the actual PNG to validate both its container and palette/alpha round trip.
    const decoded = PNG.sync.read(buffer, { checkCRC: true });
    assert.deepEqual([decoded.width, decoded.height], [1280, 1280]);
    const bytes = fs.statSync(outputPath).size;
    assert(bytes <= 700 * 1024, `${kind} atlas exceeds 700 KiB: ${bytes}`);
    const candidate = await Jimp.read(buffer);
    atlases.push(candidate);
    const contact = new Jimp(cell * 4, cell * 4, 0xf5efe5ff).composite(candidate, 0, 0);
    await contact.writeAsync(path.join(previewDir, `${prefix}-${kind}-contact.png`));
    console.log(`${kind}: 16 authored frames, 1280x1280 indexed RGBA palette, ${bytes} bytes`);
  }
  const crop = (atlas, index) => atlas.clone().crop((index % 4) * cell, Math.floor(index / 4) * cell, cell, cell);
  assert(crop(atlases[0], 15).bitmap.data.equals(crop(atlases[1], 0).bitmap.data), 'Mature/wake endpoints must match pixel for pixel');
  for (const image of [crop(atlases[0], 0), crop(atlases[1], 15)])
    assert(image.bitmap.data.every((value, offset) => offset % 4 !== 3 || value === 0), 'Empty endpoints must be fully transparent');
  for (const image of [...growth.slice(1), ...decay.slice(0, 14)]) {
    const box = bounds(image);
    assert(box.left >= 12 && box.right <= 308 && box.top >= 12 && box.bottom === baseline, `Scene outside registration bounds: ${JSON.stringify(box)}`);
  }
  const dust = crop(atlases[1], 14);
  assert(dust.bitmap.data.some((value, offset) => offset % 4 === 3 && value > 0), 'Penultimate dust must survive palette encoding');
  // Match the Home scene (168pt, offset -24/-44) and Lv10 sleeping sprite transform.
  const scene = crop(atlases[0], 15).resize(168, 168, Jimp.RESIZE_BICUBIC);
  const petSize = 120 * (208 / 224);
  const pet = (await Jimp.read(path.join(root, 'assets/pixelPet/animations/celestial_stag_lv910_sleep.png')))
    .crop(960, 960, cell, cell).resize(Math.round(petSize), Math.round(petSize), Jimp.RESIZE_BICUBIC);
  const overlay = new Jimp(168, 168, 0xf5efe5ff).composite(scene, 0, 0);
  overlay.composite(pet, Math.round(24 + (120 - petSize) / 2), Math.round(44 + (120 - petSize) / 2 + 0.31 * 120 - 0.4 * petSize));
  await overlay.writeAsync(path.join(previewDir, `${prefix}-pet-overlay-168.png`));
  await overlay.clone().resize(504, 504, Jimp.RESIZE_NEAREST_NEIGHBOR).writeAsync(path.join(previewDir, `${prefix}-pet-overlay-large.png`));
  fs.writeFileSync(path.join(frameDir, 'registration.json'), JSON.stringify({ scale, baseline, registration }, null, 2) + '\n');
  console.log('Verified common scale, ground y=296, cell margins, transparent endpoints and exact mature/wake match.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
