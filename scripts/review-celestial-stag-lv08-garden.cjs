/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Jimp = require('jimp-compact');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(
  root,
  'assets/pixelPet/sourceFrames/sleep_garden_lv08',
);
const reviewDir = path.join(sourceDir, 'review320');
const previewDir = path.join(root, 'tasks/previews');
const cell = 320;
const pack = process.argv.includes('--pack');
const paletteModule = process.argv
  .slice(2)
  .find((argument) => argument !== '--pack');

function bounds(image, fromY = 0) {
  const { width, height, data } = image.bitmap;
  let left = width,
    top = height,
    right = -1,
    bottom = -1;
  for (let y = fromY; y < height; y += 1) {
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

function transform(image) {
  const all = bounds(image);
  if (!all) return null;
  const ground = bounds(image, Math.floor(image.bitmap.height * 0.78)) ?? all;
  // Anchor the grass patch, excluding isolated falling leaves below it.
  let denseBottom = ground.bottom;
  for (
    let row = Math.floor(image.bitmap.height * 0.78);
    row < image.bitmap.height;
    row += 1
  ) {
    let painted = 0;
    for (let column = 0; column < image.bitmap.width; column += 1) {
      if (image.bitmap.data[(row * image.bitmap.width + column) * 4 + 3] >= 64)
        painted += 1;
    }
    if (painted > image.bitmap.width * 0.06) denseBottom = row + 1;
  }
  const scale = Math.min(
    288 / (ground.right - ground.left),
    272 / (ground.bottom - all.top),
  );
  return {
    scale,
    x: 160 - ((ground.left + ground.right) / 2) * scale,
    y: 296 - denseBottom * scale,
  };
}

function normalize(image, alignment) {
  const output = new Jimp(cell, cell, 0);
  if (!alignment) return output;
  const { scale, x, y } = alignment;
  const resized = image.clone();
  // Generation leaves saturated matte RGB at alpha=1. Clear it before
  // resampling so bicubic interpolation cannot bleed red/green into the edge.
  for (let index = 0; index < resized.bitmap.data.length; index += 4) {
    if (resized.bitmap.data[index + 3] < 16) {
      resized.bitmap.data.fill(0, index, index + 4);
    }
  }
  resized.resize(
    Math.round(image.bitmap.width * scale),
    Math.round(image.bitmap.height * scale),
    Jimp.RESIZE_BICUBIC,
  );
  output.composite(resized, Math.round(x), Math.round(y));
  for (let row = 0; row < cell; row += 1) {
    for (let column = 0; column < cell; column += 1) {
      if (column >= 16 && column < 304 && row < 296) continue;
      const index = (row * cell + column) * 4;
      output.bitmap.data.fill(0, index, index + 4);
    }
  }
  return output;
}

function validateEndpoints(tracks) {
  assert(
    tracks.frame[15].bitmap.data.equals(tracks.decay[0].bitmap.data),
    'Decay must begin with the exact final growth frame',
  );
  for (const empty of [tracks.frame[0], tracks.decay[15]]) {
    assert(
      empty.bitmap.data.every((value, index) => index % 4 !== 3 || value === 0),
      'Endpoint must be transparent',
    );
  }
}

async function packAtlases(tracks) {
  // Like the Lv6 packer, accept the bundled Sharp path without adding an app dependency.
  const sharp = require(paletteModule ?? 'sharp');
  const joint = new Jimp(cell * 4, cell * 8, 0);
  Object.values(tracks).forEach((frames, clip) =>
    frames.forEach((frame, index) => {
      joint.composite(
        frame,
        (index % 4) * cell,
        (clip * 4 + Math.floor(index / 4)) * cell,
      );
    }),
  );
  // A joint palette and no spatial dithering preserve identical sleep/wake pixels.
  const shared = await sharp(joint.bitmap.data, {
    raw: { width: cell * 4, height: cell * 8, channels: 4 },
  })
    .png({ palette: true, colours: 256, dither: 0, compressionLevel: 9 })
    .toBuffer();
  const buffers = await Promise.all(
    [0, 1].map((row) =>
      sharp(shared)
        .extract({
          left: 0,
          top: row * cell * 4,
          width: cell * 4,
          height: cell * 4,
        })
        .png({
          palette: true,
          colours: 256,
          quality: 100,
          dither: 0,
          compressionLevel: 9,
        })
        .toBuffer(),
    ),
  );
  buffers.forEach((buffer) =>
    assert(
      buffer.length <= 700 * 1024,
      'Candidate atlas exceeds the 700 KiB budget',
    ),
  );
  for (const [clip, prefix] of ['frame', 'decay'].entries()) {
    const atlas = await Jimp.read(buffers[clip]);
    tracks[prefix] = Array.from({ length: 16 }, (_, index) =>
      atlas
        .clone()
        .crop((index % 4) * cell, Math.floor(index / 4) * cell, cell, cell),
    );
  }
  validateEndpoints(tracks);
  for (const [index, suffix] of ['', '_decay'].entries()) {
    fs.writeFileSync(
      path.join(
        root,
        `assets/pixelPet/animations/home_sleep_garden_lv08${suffix}_v2.png`,
      ),
      buffers[index],
    );
  }
  console.log(
    `Packed shared 256-color atlases: ${buffers[0].length}/${buffers[1].length} bytes`,
  );
}

async function homeComposite(scene) {
  const preview = new Jimp(672, 672, 0xf3efe5ff);
  const levels = [
    { file: 'celestial_stag_lv78_sleep.png', scale: 198 / 195 },
    { file: 'celestial_stag_lv910_sleep.png', scale: 208 / 224 },
  ];
  for (const [row, { file, scale }] of levels.entries()) {
    const atlas = await Jimp.read(
      path.join(root, 'assets/pixelPet/animations', file),
    );
    const petSize = 120 * scale;
    const pet = atlas
      .crop(960, 960, cell, cell)
      .resize(Math.round(petSize * 2), Math.round(petSize * 2));
    // Match Home's 168pt scene, (-24,-44) offset and scaled 120pt pet box.
    const left = Math.round((24 + (120 - petSize) / 2) * 2);
    const top = Math.round(
      (44 + (120 - petSize) / 2 + 0.31 * 120 - 0.4 * petSize) * 2,
    );
    for (const column of [0, 1]) {
      const x = column * 336,
        y = row * 336;
      if (column) preview.composite(new Jimp(336, 336, 0x18262dff), x, y);
      preview.composite(scene.clone().resize(336, 336), x, y);
      preview.composite(pet, x + left, y + top);
    }
  }
  await preview.writeAsync(
    path.join(previewDir, 'celestial-stag-lv08-sleep-scene-home-composite.png'),
  );
}

async function main() {
  const tracks = { frame: [], decay: [] };
  const missing = [];
  const master = await Jimp.read(path.join(sourceDir, 'frame15.png'));
  const masterTransform = transform(master);
  for (const prefix of Object.keys(tracks)) {
    for (let index = 0; index < 16; index += 1) {
      const stem = `${prefix}${String(index).padStart(2, '0')}`;
      const revised = path.join(sourceDir, `${stem}-v2.png`);
      const source = fs.existsSync(revised)
        ? revised
        : path.join(sourceDir, `${stem}.png`);
      if (!fs.existsSync(source)) {
        missing.push(stem);
        tracks[prefix].push(null);
        continue;
      }
      const image = await Jimp.read(source);
      assert.equal(
        image.bitmap.width,
        master.bitmap.width,
        `${stem}: source canvas width`,
      );
      assert.equal(
        image.bitmap.height,
        master.bitmap.height,
        `${stem}: source canvas height`,
      );
      // Late airborne dust keeps the final scene's transform as its ground disappears.
      const alignment =
        prefix === 'decay' && index >= 13 ? masterTransform : transform(image);
      tracks[prefix].push(normalize(image, alignment));
    }
  }
  if (pack && missing.length)
    throw new Error(
      `Cannot pack an incomplete authored sequence: ${missing.join(', ')}`,
    );
  if (!missing.length) validateEndpoints(tracks);
  if (pack) await packAtlases(tracks);
  fs.mkdirSync(reviewDir, { recursive: true });
  fs.mkdirSync(previewDir, { recursive: true });
  await homeComposite(tracks.frame[15]);
  for (const [prefix, frames] of Object.entries(tracks)) {
    const contact = new Jimp(cell * 4, cell * 4, 0xf3efe5ff);
    for (let index = 0; index < frames.length; index += 1) {
      const frame = frames[index];
      const x = (index % 4) * cell,
        y = Math.floor(index / 4) * cell;
      if (frame) {
        await frame.writeAsync(
          path.join(
            reviewDir,
            `${prefix}${String(index).padStart(2, '0')}.png`,
          ),
        );
        contact.composite(frame, x, y);
      } else
        contact.composite(
          new Jimp(cell - 2, cell - 2, 0xe3e0daff),
          x + 1,
          y + 1,
        );
    }
    await contact.writeAsync(
      path.join(
        previewDir,
        `celestial-stag-lv08-${prefix === 'frame' ? 'growth' : 'decay'}-review-contact.png`,
      ),
    );
  }
  console.log(
    JSON.stringify({
      authoredGrowth: 16 - tracks.frame.filter((frame) => !frame).length,
      authoredDecay: 16 - tracks.decay.filter((frame) => !frame).length,
      missing,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
