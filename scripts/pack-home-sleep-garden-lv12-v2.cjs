#!/usr/bin/env node

// Keep the existing atlases intact while the independently painted frames are reviewed.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { Buffer } = require('node:buffer');
const Jimp = require('jimp-compact');

const root = path.resolve(path.dirname(process.argv[1]), '..');
const sourceDir = path.join(root, 'assets/pixelPet/sourceFrames/sleep_garden_lv12/v2');
const previewDir = path.join(root, 'tasks/previews');
const packedDir = path.join(sourceDir, 'packed320');
const cell = 320;
const baseline = 296;

function bounds(image) {
  const { width, height, data } = image.bitmap;
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
  return right ? { left, top, right, bottom } : null;
}

function clearInvisible(image) {
  for (let index = 0; index < image.bitmap.data.length; index += 4) {
    if (image.bitmap.data[index + 3] < 24) image.bitmap.data.fill(0, index, index + 4);
  }
}

// Same indexed-PNG packing pattern as build-pet-drag-atlases.cjs. Preserve
// partial alpha in tRNS; decoding the temporary GIF would flatten that alpha.
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
  const rgb = Buffer.alloc(palette.size * 3);
  const alpha = Buffer.alloc(palette.size);
  for (const [rgba, index] of palette) {
    rgb[index * 3] = rgba >>> 24;
    rgb[index * 3 + 1] = (rgba >>> 16) & 255;
    rgb[index * 3 + 2] = (rgba >>> 8) & 255;
    alpha[index] = rgba & 255;
  }
  function chunk(name, bytes) {
    const type = Buffer.from(name);
    const length = Buffer.alloc(4);
    const crc = Buffer.alloc(4);
    length.writeUInt32BE(bytes.length);
    let checksum = 0xffffffff;
    for (const byte of Buffer.concat([type, bytes])) {
      checksum ^= byte;
      for (let bit = 0; bit < 8; bit += 1) checksum = (checksum >>> 1) ^ (checksum & 1 ? 0xedb88320 : 0);
    }
    crc.writeUInt32BE((checksum ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, type, bytes, crc]);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 3;
  const scanlines = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y += 1) indices.copy(scanlines, y * (width + 1) + 1, y * width, (y + 1) * width);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), chunk('PLTE', rgb), chunk('tRNS', alpha),
    chunk('IDAT', zlib.deflateSync(scanlines, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

async function main() {
  fs.mkdirSync(packedDir, { recursive: true });
  const final = await Jimp.read(path.join(sourceDir, 'frame15.png'));
  const reference = bounds(final);
  if (!reference) throw new Error('The final scene is empty');
  // Every frame keeps the same complete source canvas and the same scale.
  // A tight crop/fit per cell changes tree size and clips leaves at sheet borders.
  // Reserve two pixels for small edge differences between the painted canvases.
  const scale = Math.min(286 / (reference.right - reference.left), 272 / (reference.bottom - reference.top));
  const width = Math.round(final.bitmap.width * scale);
  const height = Math.round(final.bitmap.height * scale);
  const left = Math.round(160 - ((reference.left + reference.right) / 2) * scale);

  async function frameAt(name, index) {
    if ((name === 'frame' && index === 0) || (name === 'decay' && index === 15)) {
      return new Jimp(cell, cell, 0x00000000);
    }
    const filename = name === 'decay' && index === 0 ? 'frame15.png' : `${name}${String(index).padStart(2, '0')}.png`;
    const source = await Jimp.read(path.join(sourceDir, filename));
    if (source.bitmap.width !== final.bitmap.width || source.bitmap.height !== final.bitmap.height) {
      throw new Error(`${filename}: source canvas must match frame15.png`);
    }
    // Generated cutouts contain saturated RGB in almost invisible pixels.
    // Clear it before resampling so it cannot bleed into the painted edge.
    clearInvisible(source);
    source.resize(width, height, Jimp.RESIZE_BICUBIC);
    clearInvisible(source);
    const sourceBounds = bounds(source);
    if (!sourceBounds) throw new Error(`${filename}: unexpectedly empty`);
    const top = baseline - sourceBounds.bottom;
    if (left + sourceBounds.left < 12 || left + sourceBounds.right > 308 || top + sourceBounds.top < 16) {
      throw new Error(`${filename}: scene exceeds the shared transparent margin`);
    }
    return new Jimp(cell, cell, 0x00000000).composite(source, left, top);
  }

  const combined = new Jimp(cell * 4, cell * 8, 0x00000000);
  for (const [row, name] of ['frame', 'decay'].entries()) {
    const atlas = new Jimp(cell * 4, cell * 4, 0x00000000);
    for (let index = 0; index < 16; index += 1) {
      const frame = await frameAt(name, index);
      const frameBounds = bounds(frame);
      if (frameBounds && frameBounds.bottom !== baseline) throw new Error(`${name}${index}: ground moved`);
      atlas.composite(frame, (index % 4) * cell, Math.floor(index / 4) * cell);
    }
    combined.composite(atlas, 0, row * cell * 4);
  }
  // Jimp's GIF encoder quantizes its input bitmap in place to an adaptive
  // 256-color RGBA palette. Quantize both tracks together for an exact handoff.
  await combined.getBufferAsync(Jimp.MIME_GIF);
  const tracks = {};
  for (const [row, name] of ['frame', 'decay'].entries()) {
    const output = combined.clone().crop(0, row * cell * 4, cell * 4, cell * 4);
    const bytes = indexedPng(output);
    const label = name === 'frame' ? 'growth' : 'decay';
    const atlasPath = path.join(previewDir, `celestial-stag-lv12-sleep-scene-${label}-v2-atlas.png`);
    if (bytes.length > 700 * 1024) throw new Error(`${label}: ${bytes.length} bytes exceeds 700KB`);
    fs.writeFileSync(atlasPath, bytes);
    const atlas = await Jimp.read(bytes);
    tracks[name] = [];
    for (let index = 0; index < 16; index += 1) {
      const frame = atlas.clone().crop((index % 4) * cell, Math.floor(index / 4) * cell, cell, cell);
      const visible = frame.bitmap.data.some((value, offset) => offset % 4 === 3 && value > 0);
      const empty = (name === 'frame' && index === 0) || (name === 'decay' && index === 15);
      if (visible === empty) throw new Error(`${name}${index}: invalid empty endpoint`);
      const box = bounds(frame);
      if (box && (box.right - box.left > 288 || box.bottom > baseline || box.left < 12 || box.right > 308 || box.top < 16)) {
        throw new Error(`${name}${index}: unsafe packed footprint`);
      }
      tracks[name].push(frame);
      await frame.writeAsync(path.join(packedDir, `${name}${String(index).padStart(2, '0')}.png`));
    }
    await new Jimp(cell * 4, cell * 4, 0xf5efe5ff)
      .composite(atlas, 0, 0)
      .writeAsync(path.join(previewDir, `celestial-stag-lv12-sleep-scene-${label}-v2-contact.png`));
    console.log(`${label}: 16 frames, 1280x1280, ${bytes.length} bytes`);
  }
  if (!tracks.frame[15].bitmap.data.equals(tracks.decay[0].bitmap.data)) {
    throw new Error('Growth frame15 and decay frame00 must match pixel for pixel');
  }
  // Mirror Home's 168pt garden at (-24, -44) and its 120pt pet canvas.
  // The Lv12 scene is also used at Lv13, which has a different pet atlas/scale.
  const pointsToPixels = cell / 168;
  const review = new Jimp(cell * 2, cell * 2, 0xf5efe5ff);
  const pets = [
    { atlas: 'celestial_stag_lv1112_sleep.png', scale: 214 / 228 },
    { atlas: 'celestial_stag_lv1314_sleep.png', scale: 218 / 212 },
  ];
  for (const [index, { atlas, scale: petScale }] of pets.entries()) {
    const petAtlas = await Jimp.read(path.join(root, 'assets/pixelPet/animations', atlas));
    const pet = petAtlas.clone().crop(0, 3 * cell, cell, cell);
    const petSize = 120 * petScale * pointsToPixels;
    const petCenterY = (44 + 60 + 0.31 * 120 - 0.4 * 120 * petScale) * pointsToPixels;
    pet.resize(Math.round(petSize), Math.round(petSize), Jimp.RESIZE_BICUBIC);
    const overlay = tracks.frame[15].clone().composite(pet, Math.round((cell - petSize) / 2), Math.round(petCenterY - petSize / 2));
    review.composite(overlay, index * cell, 0);
    review.composite(new Jimp(cell, cell, 0x172b2aff).composite(overlay, 0, 0), index * cell, cell);
  }
  await review.writeAsync(path.join(previewDir, 'celestial-stag-lv12-sleep-scene-pet-overlay-v2.png'));
  if (process.argv.includes('--install')) {
    for (const [label, suffix] of [['growth', ''], ['decay', '_decay']]) {
      fs.copyFileSync(
        path.join(previewDir, `celestial-stag-lv12-sleep-scene-${label}-v2-atlas.png`),
        path.join(root, `assets/pixelPet/animations/home_sleep_garden_lv12${suffix}.png`),
      );
    }
    console.log('Installed the approved Lv12 growth and decay atlases');
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
