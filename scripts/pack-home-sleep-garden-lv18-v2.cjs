/* global __dirname */
// Candidate artwork only. The approved runtime atlases remain untouched.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { Buffer } = require('node:buffer');
const { PNG } = require('pngjs');
const Jimp = require('jimp-compact');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'assets/pixelPet/sourceFrames/sleep_garden_lv18/v2');
const previewDir = path.join(root, 'tasks/previews');
const cell = 320;
const baseline = 296;
const previewSceneScale = 1.08;

function removeEdgeFragments(image) {
  const { data, width, height } = image.bitmap;
  const visited = new Uint8Array(width * height);
  for (let start = 0; start < visited.length; start += 1) {
    if (visited[start] || data[start * 4 + 3] < 8) continue;
    const pixels = [start];
    visited[start] = 1;
    let edge = false;
    for (let cursor = 0; cursor < pixels.length; cursor += 1) {
      const pixel = pixels[cursor], x = pixel % width, y = Math.floor(pixel / width);
      edge ||= x === 0 || x === width - 1 || y === 0 || y === height - 1;
      for (const next of [x > 0 ? pixel - 1 : -1, x + 1 < width ? pixel + 1 : -1,
        y > 0 ? pixel - width : -1, y + 1 < height ? pixel + width : -1]) {
        if (next < 0 || visited[next] || data[next * 4 + 3] < 8) continue;
        visited[next] = 1;
        pixels.push(next);
      }
    }
    // Keep detached leaves and dust inside the cell; discard neighbouring art.
    if (edge && pixels.length < width * height * 0.02)
      pixels.forEach((pixel) => data.fill(0, pixel * 4, pixel * 4 + 4));
  }
  return image;
}

function bounds(image, minY = 0) {
  const { data, width, height } = image.bitmap;
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = minY; y < height; y += 1) {
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

// Generated sheets have uneven gutters; find the transparent gap near each cut.
function separators(image, vertical) {
  const { data, width, height } = image.bitmap;
  const length = vertical ? width : height;
  const density = new Uint32Array(length);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1)
      if (data[(y * width + x) * 4 + 3] >= 80) density[vertical ? x : y] += 1;
  const cuts = [0];
  for (let index = 1; index < 4; index += 1) {
    const expected = Math.round(length * index / 4);
    let best = expected;
    for (let offset = -42; offset <= 42; offset += 1) {
      const candidate = expected + offset;
      if (density[candidate] < density[best] ||
        (density[candidate] === density[best] && Math.abs(offset) < Math.abs(best - expected)))
        best = candidate;
    }
    cuts.push(best);
  }
  return [...cuts, length];
}

function fitScene(image, label) {
  const box = bounds(image);
  if (!box) throw new Error(`Missing ${label}`);
  const ground = bounds(image, Math.floor(image.bitmap.height * 0.72));
  if (!ground) throw new Error(`Missing ground in ${label}`);
  // Measure grass, not the canopy: a growing tree must not shrink its floor.
  const scale = Math.min(288 / ground.width, 272 / box.height, 300 / box.width);
  const width = Math.round(box.width * scale), height = Math.round(box.height * scale);
  const sprite = image.crop(box.left, box.top, box.width, box.height)
    .resize(width, height, Jimp.RESIZE_BICUBIC);
  const center = ground.left + ground.width / 2;
  const left = Math.max(8, Math.min(cell - 8 - width,
    Math.round(cell / 2 + (box.left - center) * scale)));
  return new Jimp(cell, cell, 0x00000000).composite(sprite, left, baseline - height);
}

async function extract(kind) {
  const sheet = await Jimp.read(path.join(sourceDir, `${kind}-source.png`));
  // Alpha 1-3 contains vivid hidden RGB from generation; remove it before resize.
  sheet.scan(0, 0, sheet.bitmap.width, sheet.bitmap.height, function (_x, _y, i) {
    if (this.bitmap.data[i + 3] < 8) this.bitmap.data.fill(0, i, i + 4);
  });
  const columns = separators(sheet, true);
  const rows = separators(sheet, false);
  const frames = [];
  for (let index = 0; index < 16; index += 1) {
    const output = new Jimp(cell, cell, 0x00000000);
    const column = index % 4, row = Math.floor(index / 4);
    if ((kind === 'growth' && index === 0) || (kind === 'decay' && index === 15)) {
      frames.push(output);
      continue;
    }
    const image = removeEdgeFragments(sheet.clone().crop(columns[column], rows[row],
      columns[column + 1] - columns[column], rows[row + 1] - rows[row]));
    frames.push(fitScene(image, `${kind} frame ${index}`));
  }
  console.log(`${kind} gutters: x=${columns}, y=${rows}`);
  return frames;
}

function atlas(frames) {
  const output = new Jimp(cell * 4, cell * 4, 0x00000000);
  frames.forEach((frame, index) => output.composite(frame, index % 4 * cell, Math.floor(index / 4) * cell));
  return output;
}

// Same indexed-PNG layout used by build-pet-drag-atlases.cjs, sized to this atlas.
function indexedPng(image) {
  const { width, height, data } = image.bitmap;
  const palette = new Map();
  const indices = Buffer.alloc(width * height);
  for (let pixel = 0; pixel < indices.length; pixel += 1) {
    const rgba = data.readUInt32BE(pixel * 4);
    if (!palette.has(rgba)) palette.set(rgba, palette.size);
    indices[pixel] = palette.get(rgba);
  }
  if (palette.size > 256) throw new Error(`Palette has ${palette.size} colors`);
  const rgb = Buffer.alloc(palette.size * 3), alpha = Buffer.alloc(palette.size);
  for (const [rgba, index] of palette) {
    rgb[index * 3] = rgba >>> 24;
    rgb[index * 3 + 1] = rgba >>> 16 & 255;
    rgb[index * 3 + 2] = rgba >>> 8 & 255;
    alpha[index] = rgba & 255;
  }
  const chunk = (name, bytes) => {
    const type = Buffer.from(name), length = Buffer.alloc(4), crc = Buffer.alloc(4);
    length.writeUInt32BE(bytes.length);
    let checksum = 0xffffffff;
    for (const byte of Buffer.concat([type, bytes])) {
      checksum ^= byte;
      for (let bit = 0; bit < 8; bit += 1)
        checksum = checksum >>> 1 ^ (checksum & 1 ? 0xedb88320 : 0);
    }
    crc.writeUInt32BE((checksum ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, type, bytes, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 3;
  const scanlines = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y += 1)
    indices.copy(scanlines, y * (width + 1) + 1, y * width, (y + 1) * width);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), chunk('PLTE', rgb), chunk('tRNS', alpha),
    chunk('IDAT', zlib.deflateSync(scanlines, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

async function petPreviews(mature) {
  // Reproduce Home's 168pt garden, 120pt pet, (-24,-44) garden offset,
  // level scale, and the renderer's 0.81 ground anchor / 288px hoof line.
  // Enlarge the candidate garden around its ground centre; keep the pet fixed.
  const sceneSize = Math.round(cell * previewSceneScale);
  const scene = mature.clone().resize(sceneSize, sceneSize, Jimp.RESIZE_BICUBIC);
  const sceneLeft = Math.round(40 - (sceneSize - cell) / 2);
  const sceneTop = Math.round(16 - (sceneSize - cell) * (baseline / cell));
  for (const [level, group, scale] of [[18, '1718', 224 / 222], [19, '1920', 226 / 223]]) {
    const pet = await Jimp.read(path.join(root, `assets/pixelPet/animations/celestial_stag_lv${group}_sleep.png`));
    const size = Math.round(120 / 168 * cell * scale);
    pet.crop(0, 960, cell, cell).resize(size, size, Jimp.RESIZE_BICUBIC);
    const x = Math.round((24 + (120 - 120 * scale) / 2) * cell / 168);
    const y = Math.round((44 + 120 * (0.31 - 0.4 * scale) + (120 - 120 * scale) / 2) * cell / 168);
    const preview = new Jimp(400, 360, 0xf4f1ebff)
      .composite(scene, sceneLeft, sceneTop).composite(pet, 40 + x, 16 + y);
    await preview.writeAsync(path.join(previewDir, `celestial-stag-lv18-v2-pet-lv${level}.png`));
  }
}

async function main() {
  fs.mkdirSync(previewDir, { recursive: true });
  const growth = await extract('growth');
  const decay = await extract('decay');
  for (const index of [4, 7]) {
    const image = await Jimp.read(path.join(sourceDir, `growth-${String(index).padStart(2, '0')}-source.png`));
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (_x, _y, i) {
      if (this.bitmap.data[i + 3] < 8) this.bitmap.data.fill(0, i, i + 4);
    });
    growth[index] = fitScene(image, `growth frame ${index}`);
  }
  decay[0] = growth[15].clone();
  // Quantize both tracks together so the handoff shares the exact same palette.
  // Jimp's GIF encoder quantizes its input bitmap in place. Keep that RGBA
  // bitmap: decoding the GIF would flatten partial alpha on mirages and dust.
  const combined = new Jimp(cell * 4, cell * 8, 0x00000000)
    .composite(atlas(growth), 0, 0).composite(atlas(decay), 0, cell * 4);
  await combined.getBufferAsync(Jimp.MIME_GIF);
  const quantized = combined;
  for (const [kind, frames, row] of [['growth', growth, 0], ['decay', decay, 1]]) {
    for (let index = 0; index < 16; index += 1)
      await frames[index].writeAsync(path.join(sourceDir, `${kind}-${String(index).padStart(2, '0')}.png`));
    const output = quantized.clone().crop(0, row * cell * 4, cell * 4, cell * 4);
    const bytes = indexedPng(output);
    if (bytes.length > 700_000) throw new Error(`${kind} exceeds 700KB: ${bytes.length}`);
    fs.writeFileSync(path.join(sourceDir, `${kind}-atlas.png`), bytes);
    const contact = new Jimp(cell * 4, cell * 4, 0xf4f1ebff).composite(output, 0, 0);
    await contact.writeAsync(path.join(previewDir, `celestial-stag-lv18-${kind}-v2-contact.png`));
    console.log(`${kind}: 1280×1280, adaptive palette, ${bytes.length} bytes`);
  }
  if (!growth[15].bitmap.data.equals(decay[0].bitmap.data)) throw new Error('Wake handoff differs');
  const packed = ['growth', 'decay'].map((kind) =>
    PNG.sync.read(fs.readFileSync(path.join(sourceDir, `${kind}-atlas.png`))));
  const pixelsAt = (image, frame) => {
    const pixels = Buffer.alloc(cell * cell * 4);
    PNG.bitblt(image, { width: cell, height: cell, data: pixels },
      frame % 4 * cell, Math.floor(frame / 4) * cell, cell, cell, 0, 0);
    return pixels;
  };
  for (const [track, image] of packed.entries()) {
    if (image.width !== 1280 || image.height !== 1280) throw new Error('Invalid atlas dimensions');
    for (let index = 0; index < 16; index += 1) {
      const pixels = pixelsAt(image, index);
      const empty = (track === 0 && index === 0) || (track === 1 && index === 15);
      let visible = 0;
      for (let pixel = 0; pixel < cell * cell; pixel += 1) {
        if (!pixels[pixel * 4 + 3]) continue;
        visible += 1;
        const x = pixel % cell, y = Math.floor(pixel / cell);
        if (x < 8 || x >= 312 || y < 8 || y >= baseline)
          throw new Error(`Unsafe gutter in track ${track}, frame ${index}`);
      }
      if (empty ? visible !== 0 : visible === 0) throw new Error(`Invalid frame ${track}/${index}`);
    }
    if (!image.data.some((alpha, offset) => offset % 4 === 3 && alpha > 0 && alpha < 240))
      throw new Error(`Track ${track} lost its soft alpha edges`);
  }
  if (!pixelsAt(packed[0], 15).equals(pixelsAt(packed[1], 0)))
    throw new Error('Quantization changed the sleep/wake handoff');
  const finalScene = new Jimp({ width: cell, height: cell, data: pixelsAt(packed[0], 15) });
  await petPreviews(finalScene);
  console.log('Prepared 32 painted candidate frames at 320px; exact sleep/wake handoff.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
