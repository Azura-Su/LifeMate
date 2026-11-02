/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Jimp = require('jimp-compact');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'assets/pixelPet/sourceFrames/sleep_garden_lv04');
const frameDir = path.join(sourceDir, 'review320');
const previewDir = path.join(root, 'tasks/previews');
const cell = 320;
const key = (index) => String(index).padStart(2, '0');

function bounds(image) {
  const { width, height, data } = image.bitmap;
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y += 1) {
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
  const { data } = image.bitmap;
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset + 3] = Math.round(data[offset + 3] / 17) * 17;
    for (let channel = 0; channel < 3; channel += 1) {
      data[offset + channel] = data[offset + 3] === 0
        ? 0 : Math.round(data[offset + channel] / 51) * 51;
    }
  }
  return image;
}

async function main() {
  const sequences = {};
  for (const prefix of ['frame', 'decay']) {
    sequences[prefix] = [];
    for (let index = 0; index < 16; index += 1) {
      const image = await Jimp.read(path.join(sourceDir, `${prefix}${key(index)}.png`));
      assert.equal(image.bitmap.width, 1254);
      assert.equal(image.bitmap.height, 1254);
      sequences[prefix].push({ image, box: bounds(image) });
    }
  }
  assert.equal(sequences.frame[0].box, null, 'Growth must start empty');
  assert.equal(sequences.decay[15].box, null, 'Decay must end empty');

  // A single scale preserves tree size. Translate each ground line to y=296;
  // never stretch a shrinking stump or a sparse ash cloud to fill the cell.
  const boxes = Object.values(sequences).flat().map(({ box }) => box).filter(Boolean);
  const left = Math.min(...boxes.map((box) => box.left));
  const right = Math.max(...boxes.map((box) => box.right));
  const center = (left + right) / 2;
  const scale = Math.min(288 / (right - left), 272 / Math.max(...boxes.map((box) => box.bottom - box.top)));
  fs.mkdirSync(frameDir, { recursive: true });
  fs.mkdirSync(previewDir, { recursive: true });

  const frames = {};
  for (const [prefix, sources] of Object.entries(sequences)) {
    frames[prefix] = sources.map(({ image, box }, index) => {
      const frame = new Jimp(cell, cell, 0x00000000);
      if (!box) return frame;
      const width = Math.round((box.right - box.left) * scale);
      const height = Math.round((box.bottom - box.top) * scale);
      const sprite = image.clone().crop(box.left, box.top, box.right - box.left, box.bottom - box.top);
      sprite.resize(width, height, Jimp.RESIZE_BICUBIC);
      // Keep the ash in the preceding frame's coordinates, capped at ground level.
      const baseline = prefix === 'decay' && index === 14
        ? Math.max(sources[13].box.bottom, box.bottom) : box.bottom;
      frame.composite(sprite, Math.round(160 + (box.left - center) * scale), 296 - height + Math.round((box.bottom - baseline) * scale));
      return quantize(frame);
    });
  }
  frames.decay[0] = frames.frame[15].clone();
  assert.deepEqual(frames.decay[0].bitmap.data, frames.frame[15].bitmap.data);

  for (const [prefix, sequence] of Object.entries(frames)) {
    const atlas = new Jimp(cell * 4, cell * 4, 0x00000000);
    for (const [index, frame] of sequence.entries()) {
      const box = bounds(frame);
      if (box) {
        assert(box.left >= 16 && box.right <= 304, `${prefix}${key(index)} exceeds footprint`);
        assert(box.top >= 24 && box.bottom <= 296, `${prefix}${key(index)} exceeds vertical margins`);
        if (index < 14 || prefix === 'frame') assert.equal(box.bottom, 296);
      }
      await frame.writeAsync(path.join(frameDir, `${prefix}${key(index)}.png`));
      atlas.composite(frame, (index % 4) * cell, Math.floor(index / 4) * cell);
    }
    const name = `home_sleep_garden_lv04-authored-${prefix === 'frame' ? 'growth' : 'decay'}`;
    const atlasPath = path.join(previewDir, `${name}.png`);
    await atlas.writeAsync(atlasPath);
    assert(fs.statSync(atlasPath).size <= 700 * 1024, 'Atlas exceeds 700 KiB');
    const contact = new Jimp(cell * 4, cell * 4, 0xeee9e2ff).composite(atlas, 0, 0);
    await contact.writeAsync(path.join(previewDir, `${name}-contact.png`));
    console.log(`${name}: 16 frames, ${fs.statSync(atlasPath).size} bytes`);
  }

  // Match HomeSleepGarden's 10% larger Lv4 scene, fixed ground and the resting sprite's
  // 120px canvas, level scale 165/224, centered transform and hoof anchor.
  const gardenSize = 168 * 1.1;
  const gardenLeft = -24 - (gardenSize - 168) / 2;
  const gardenTop = -44 - (gardenSize - 168) * (296 / 320);
  const previewSize = Math.round(gardenSize * 2);
  const composite = new Jimp(previewSize, previewSize, 0xf3eee6ff);
  composite.composite(frames.frame[15].clone().resize(previewSize, previewSize), 0, 0);
  const stagAtlas = await Jimp.read(path.join(root, 'assets/pixelPet/animations/celestial_stag_lv34_sleep.png'));
  const stag = stagAtlas.crop(3 * cell, 3 * cell, cell, cell);
  const lookScale = 165 / 224;
  const stagSize = Math.round(120 * lookScale * 2);
  stag.resize(stagSize, stagSize);
  const shiftY = (0.81 - 0.5) * 120 - (288 / 320 - 0.5) * 120 * lookScale;
  composite.composite(stag, Math.round((-gardenLeft + 60 - 60 * lookScale) * 2), Math.round((-gardenTop + 60 - 60 * lookScale + shiftY) * 2));
  await composite.writeAsync(path.join(previewDir, 'celestial-stag-lv04-authored-home-composite.png'));
  if (process.argv.includes('--install')) {
    const packedDir = path.join(sourceDir, 'packed320');
    fs.mkdirSync(packedDir, { recursive: true });
    for (const prefix of ['frame', 'decay']) {
      for (let index = 0; index < 16; index += 1) {
        const file = `${prefix}${key(index)}.png`;
        fs.copyFileSync(path.join(frameDir, file), path.join(packedDir, file));
      }
      const name = prefix === 'frame' ? 'growth' : 'decay';
      fs.copyFileSync(
        path.join(previewDir, `home_sleep_garden_lv04-authored-${name}.png`),
        path.join(root, `assets/pixelPet/animations/home_sleep_garden_lv04${prefix === 'frame' ? '' : '_decay'}.png`),
      );
      fs.copyFileSync(
        path.join(previewDir, `home_sleep_garden_lv04-authored-${name}-contact.png`),
        path.join(previewDir, `home_sleep_garden_lv04-${name}-contact.png`),
      );
    }
    console.log('Installed the approved Lv4 growth/decay atlases and packed frames.');
  } else {
    console.log('Review only: runtime atlases unchanged. Use --install after art approval.');
  }
  console.log(`Shared source scale: ${scale.toFixed(6)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
