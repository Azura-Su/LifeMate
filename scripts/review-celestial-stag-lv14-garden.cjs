/* global __dirname */
// Authored-frame review only; app atlases are left for the reviewed, complete set.
const fs = require('node:fs');
const path = require('node:path');
const Jimp = require('jimp-compact');
const { PNG } = require('pngjs');

const root = path.resolve(__dirname, '..');
const sources = path.join(root, 'assets/pixelPet/sourceFrames/sleep_garden_lv14');
const output = path.join(sources, 'review320');
const previews = path.join(root, 'tasks/previews');
const cell = 320;
const key = (index) => String(index).padStart(2, '0');

function bounds(image, minimumY = 0) {
  const { width, height, data } = image.bitmap;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = minimumY; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < 24) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  }
  return right < 0 ? null : { left, top, right, bottom };
}

function quantize(image) {
  const { data, width } = image.bitmap;
  for (let offset = 0; offset < data.length; offset += 4) {
    const x = (offset / 4) % width;
    const y = Math.floor(offset / 4 / width);
    data[offset + 3] = y >= 296 || x < 16 || x >= 304
      ? 0 : Math.round(data[offset + 3] / 85) * 85;
    for (let channel = 0; channel < 3; channel += 1) {
      data[offset + channel] = data[offset + 3]
        ? Math.round(Math.round(data[offset + channel] / 42.5) * 42.5) : 0;
    }
  }
  return image;
}

async function main() {
  fs.mkdirSync(output, { recursive: true });
  fs.mkdirSync(previews, { recursive: true });
  const manifest = { missing: [], frames: [] };
  // Compensate for imagegen reframing by anchoring the grass, never tree height.
  const final = await Jimp.read(path.join(sources, 'frame15-candidate-source.png'));
  const finalBounds = bounds(final);
  const finalGround = bounds(final, Math.max(0, finalBounds.bottom - Math.round(final.bitmap.height * 0.15)));

  async function normalize(filename, anchorGround) {
    const image = await Jimp.read(path.join(sources, filename));
    const painted = bounds(image);
    if (!painted) throw new Error(`Empty authored source: ${filename}`);
    const ground = anchorGround
      ? bounds(image, Math.max(0, painted.bottom - Math.round(image.bitmap.height * 0.15)))
      : finalGround;
    const scale = 288 / (ground.right - ground.left);
    const x = Math.round(160 - ((ground.left + ground.right) / 2) * scale);
    const y = Math.round(296 - ground.bottom * scale);
    const sourceWidth = image.bitmap.width;
    const sourceHeight = image.bitmap.height;
    image.resize(Math.round(sourceWidth * scale), Math.round(sourceHeight * scale), Jimp.RESIZE_BICUBIC);
    const normalized = quantize(new Jimp(cell, cell, 0x00000000).composite(image, x, y));
    manifest.frames.push({ filename, bounds: bounds(normalized), scale, sourceEdge: painted.top === 0 || painted.left === 0 || painted.right === sourceWidth || painted.bottom === sourceHeight });
    return normalized;
  }

  for (const kind of ['growth', 'decay']) {
    const frames = [];
    for (let index = 0; index < 16; index += 1) {
      const name = `${kind === 'growth' ? 'frame' : 'decay'}${key(index)}`;
      const versioned = `${name}-v2-source.png`;
      const filename = fs.existsSync(path.join(sources, versioned))
        ? versioned : kind === 'growth' && (index === 3 || index === 15)
        ? `${name}-candidate-source.png` : `${name}-source.png`;
      let image;
      if ((kind === 'growth' && index === 0) || (kind === 'decay' && index === 15)) {
        image = new Jimp(cell, cell, 0x00000000);
      } else if (kind === 'decay' && index === 0) {
        image = await Jimp.read(path.join(output, 'frame15.png'));
      } else if (!fs.existsSync(path.join(sources, filename))) {
        manifest.missing.push({ kind, index, filename });
        frames.push(new Jimp(cell, cell, 0x00000000));
        continue;
      } else {
        image = await normalize(filename, kind === 'growth' || index <= 12);
      }
      frames.push(image);
      await image.writeAsync(path.join(output, `${name}.png`));
    }
    const atlas = new Jimp(cell * 4, cell * 4, 0x00000000);
    frames.forEach((frame, index) => atlas.composite(frame, (index % 4) * cell, Math.floor(index / 4) * cell));
    await new Jimp(cell * 4, cell * 4, 0xf5efe5ff).composite(atlas, 0, 0)
      .writeAsync(path.join(previews, `celestial-stag-lv14-${kind}-review-contact.png`));
    const target = path.join(previews, `celestial-stag-lv14-${kind}-atlas-candidate.png`);
    if (manifest.missing.some((item) => item.kind === kind)) {
      fs.rmSync(target, { force: true });
      continue;
    }
    const { width, height, data } = atlas.bitmap;
    fs.writeFileSync(target, PNG.sync.write({ width, height, data }, { deflateLevel: 9, deflateStrategy: 0 }));
    const bytes = fs.statSync(target).size;
    if (bytes > 700 * 1024) throw new Error(`${kind} exceeds 700KB: ${bytes}`);
    console.log(`${kind}: 16 authored frames, ${width}x${height}, ${bytes} bytes`);
  }
  if (!manifest.missing.length) {
    const last = await Jimp.read(path.join(output, 'frame15.png'));
    const first = await Jimp.read(path.join(output, 'decay00.png'));
    if (!last.bitmap.data.equals(first.bitmap.data)) throw new Error('Growth/decay endpoints differ');
    for (const filename of ['frame00.png', 'decay15.png']) {
      const image = await Jimp.read(path.join(output, filename));
      if (image.bitmap.data.some((value, index) => index % 4 === 3 && value !== 0)) {
        throw new Error(`${filename} must be fully transparent`);
      }
    }
    // Mirror HomeSleepGarden's (-24, -44, 168pt) scene and the 120pt Stag
    // canvas, including level-14 look scale and its common hoof-line lift.
    const petAtlas = await Jimp.read(path.join(root, 'assets/pixelPet/animations/celestial_stag_lv1314_sleep.png'));
    const lookScale = 218 / 212;
    const petSize = (120 * lookScale) / (168 / cell);
    const petTop = (60 + 0.31 * 120 - 0.4 * 120 * lookScale + 44) / (168 / cell) - petSize / 2;
    const overlay = new Jimp(cell * 2, cell * 2, 0xf5efe5ff);
    for (let index = 0; index < 4; index += 1) {
      const pet = petAtlas.clone().crop(index * cell, 3 * cell, cell, cell)
        .resize(Math.round(petSize), Math.round(petSize), Jimp.RESIZE_BICUBIC);
      const scene = new Jimp(cell, cell, 0xf5efe5ff).composite(last, 0, 0)
        .composite(pet, Math.round(160 - petSize / 2), Math.round(petTop));
      overlay.composite(scene, (index % 2) * cell, Math.floor(index / 2) * cell);
    }
    await overlay.writeAsync(path.join(previews, 'celestial-stag-lv14-pet-overlay-review.png'));
  }
  fs.writeFileSync(path.join(output, 'review.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`${manifest.missing.length} source frames missing; app assets unchanged`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
