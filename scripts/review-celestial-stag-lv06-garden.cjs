/* global __dirname */
// Review by default; --install publishes the approved atlas pair after validation.
const fs = require('node:fs');
const path = require('node:path');
const Jimp = require('jimp-compact');
const { PNG } = require('pngjs');

const root = path.resolve(__dirname, '..');
const sources = path.join(root, 'assets/pixelPet/sourceFrames/sleep_garden_lv06');
const output = path.join(sources, 'review320');
const previews = path.join(root, 'tasks/previews');
const cell = 320;
const key = (index) => String(index).padStart(2, '0');
// Optional path to the bundled Sharp module, supplied by the workspace runtime.
const paletteModule = process.argv.slice(2).find((argument) => argument !== '--install');
const install = process.argv.includes('--install');

function runtimeColors(image) {
  const { data, width } = image.bitmap;
  for (let offset = 0; offset < data.length; offset += 4) {
    const y = Math.floor(offset / 4 / width);
    data[offset + 3] = y >= 296 ? 0 : Math.round(data[offset + 3] / 17) * 17;
    for (let channel = 0; channel < 3; channel += 1) {
      data[offset + channel] = data[offset + 3] ? Math.round(data[offset + channel] / 17) * 17 : 0;
    }
  }
  return image;
}

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

async function main() {
  const final = await Jimp.read(path.join(sources, 'frame15-approved.png'));
  const reference = bounds(final);
  const referenceGround = bounds(final, Math.floor(final.bitmap.height * 0.85));
  const scale = Math.min(288 / (reference.right - reference.left), 272 / (reference.bottom - reference.top));
  fs.mkdirSync(output, { recursive: true });
  const manifest = [];

  async function normalize(filename, groundPresent) {
    const image = await Jimp.read(path.join(sources, filename));
    // One scene scale, including immature trees; never fit every frame's height.
    image.resize(final.bitmap.width, final.bitmap.height, Jimp.RESIZE_BICUBIC);
    const anchor = groundPresent
      ? bounds(image, Math.floor(image.bitmap.height * 0.85))
      : referenceGround;
    if (!anchor) throw new Error(`Missing ground anchor: ${filename}`);
    const center = (anchor.left + anchor.right) / 2;
    const scaled = image.resize(Math.round(image.bitmap.width * scale), Math.round(image.bitmap.height * scale), Jimp.RESIZE_BICUBIC);
    return new Jimp(cell, cell, 0x00000000).composite(scaled, Math.round(160 - center * scale), Math.round(296 - anchor.bottom * scale));
  }

  for (const kind of ['growth', 'decay']) {
    const frames = [];
    for (let index = 0; index < 16; index += 1) {
      const name = kind === 'growth' ? `frame${key(index)}` : `decay${key(index)}`;
      const versioned = `${name}-v2-source.png`;
      const filename = fs.existsSync(path.join(sources, versioned))
        ? versioned
        : kind === 'growth' && index === 15
        ? 'frame15-approved.png'
        : `${name}-source.png`;
      let image;
      if ((kind === 'growth' && index === 0) || (kind === 'decay' && index === 15)) {
        image = new Jimp(cell, cell, 0x00000000);
      } else if (kind === 'decay' && index === 0) {
        image = await Jimp.read(path.join(output, 'frame15.png'));
      } else if (!fs.existsSync(path.join(sources, filename))) {
        manifest.push({ kind, index, missing: filename });
        image = new Jimp(cell, cell, 0x00000000);
      } else {
        image = await normalize(filename, kind === 'growth' || index <= 11);
      }
      runtimeColors(image);
      frames.push(image);
      if (!manifest.some((item) => item.kind === kind && item.index === index)) {
        await image.writeAsync(path.join(output, `${name}.png`));
      }
    }
    const contact = new Jimp(cell * 4, cell * 4, 0xf5efe5ff);
    frames.forEach((frame, index) => contact.composite(frame, (index % 4) * cell, Math.floor(index / 4) * cell));
    await contact.writeAsync(path.join(previews, `celestial-stag-lv06-${kind}-review-contact.png`));
    const target = path.join(previews, `celestial-stag-lv06-${kind}-atlas-candidate.png`);
    if (manifest.some((item) => item.kind === kind)) {
      fs.rmSync(target, { force: true });
      continue;
    }
    const atlas = new Jimp(cell * 4, cell * 4, 0x00000000);
    frames.forEach((frame, index) => atlas.composite(frame, (index % 4) * cell, Math.floor(index / 4) * cell));
    const { width, height, data } = atlas.bitmap;
    fs.writeFileSync(target, PNG.sync.write({ width, height, data }, { deflateLevel: 9 }));
    const bytes = fs.statSync(target).size;
    if (bytes > 700 * 1024 && !paletteModule) throw new Error(`${kind} candidate exceeds 700KB; supply a Sharp module path for shared palette encoding (${bytes} bytes)`);
    console.log(`${kind}: ${bytes} bytes; 16 levels per RGBA channel`);
  }
  if (!manifest.length && paletteModule) {
    const sharp = require(paletteModule);
    const joint = new Jimp(cell * 4, cell * 8, 0x00000000);
    const kinds = ['growth', 'decay'];
    for (const [index, kind] of kinds.entries()) {
      const atlas = await Jimp.read(path.join(previews, `celestial-stag-lv06-${kind}-atlas-candidate.png`));
      joint.composite(atlas, 0, index * cell * 4);
    }
    // One palette for both clips keeps matching pixels identical at sleep/wake.
    // No spatial dithering: identical source pixels must share one mapped color.
    const encoded = await sharp(joint.bitmap.data, { raw: { width: cell * 4, height: cell * 8, channels: 4 } })
      .png({ palette: true, colours: 256, dither: 0, compressionLevel: 9 }).toBuffer();
    for (const [row, kind] of kinds.entries()) {
      const target = path.join(previews, `celestial-stag-lv06-${kind}-atlas-candidate.png`);
      const packed = await sharp(encoded)
        .extract({ left: 0, top: row * cell * 4, width: cell * 4, height: cell * 4 })
        .png({ palette: true, colours: 256, quality: 100, dither: 0, compressionLevel: 9 }).toBuffer();
      fs.writeFileSync(target, packed);
      const atlas = await Jimp.read(packed);
      const bytes = fs.statSync(target).size;
      if (bytes > 700 * 1024) throw new Error(`${kind} still exceeds 700KB: ${bytes}`);
      const contact = new Jimp(cell * 4, cell * 4, 0xf5efe5ff).composite(atlas, 0, 0);
      await contact.writeAsync(path.join(previews, `celestial-stag-lv06-${kind}-review-contact.png`));
      for (let index = 0; index < 16; index += 1) {
        const name = `${kind === 'growth' ? 'frame' : 'decay'}${key(index)}.png`;
        await atlas.clone().crop((index % 4) * cell, Math.floor(index / 4) * cell, cell, cell).writeAsync(path.join(output, name));
      }
      console.log(`${kind}: ${bytes} bytes with the shared 256-color palette`);
    }
  }
  const petAtlas = await Jimp.read(path.join(root, 'assets/pixelPet/animations/celestial_stag_lv56_sleep.png'));
  const petSize = Math.round(cell * (120 / 168) * (185 / 176));
  const pet = petAtlas.crop(960, 960, 320, 320).resize(petSize, petSize, Jimp.RESIZE_BICUBIC);
  const overlay = new Jimp(cell, cell, 0xf5efe5ff);
  overlay.composite(await Jimp.read(path.join(output, 'frame15.png')), 0, 0);
  // Same scene/pet size ratio as Home; place the sleeping pose on the grass.
  overlay.composite(pet, Math.round((cell - petSize) / 2), Math.round(296 - petSize * (288 / 320)));
  await overlay.writeAsync(path.join(previews, 'celestial-stag-lv06-sleep-scene-pet-overlay-review.png'));
  fs.writeFileSync(path.join(output, 'missing.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  if (!manifest.length) {
    const read = (name) => PNG.sync.read(fs.readFileSync(path.join(output, `${name}.png`)));
    const finalPixels = read('frame15').data;
    if (!finalPixels.equals(read('decay00').data)) throw new Error('Growth/decay boundary differs');
    const report = [];
    for (const kind of ['frame', 'decay']) {
      for (let index = 0; index < 16; index += 1) {
        const name = `${kind}${key(index)}`;
        const frame = read(name);
        if (frame.width !== cell || frame.height !== cell) throw new Error(`Invalid cell: ${name}`);
        let painted = 0;
        let bottom = 0;
        for (let y = 0; y < cell; y += 1) {
          for (let x = 0; x < cell; x += 1) {
            if (!frame.data[(y * cell + x) * 4 + 3]) continue;
            painted += 1;
            bottom = Math.max(bottom, y + 1);
            if (x === 0 || x === cell - 1 || y === 0 || y >= 296) throw new Error(`Clipped/bleeding art: ${name}`);
          }
        }
        const empty = (kind === 'frame' && index === 0) || (kind === 'decay' && index === 15);
        if (empty ? painted !== 0 : painted === 0) throw new Error(`Invalid empty state: ${name}`);
        if (kind === 'frame' && !empty && bottom !== 296) throw new Error(`Ground line drift: ${name}`);
        report.push({ name, painted, bottom });
      }
    }
    fs.writeFileSync(path.join(output, 'checks.json'), `${JSON.stringify({ boundaryPixelMatch: true, frames: report }, null, 2)}\n`);
  }
  if (install) {
    if (manifest.length) throw new Error('Cannot install an incomplete sequence');
    const packedDir = path.join(sources, 'packed320');
    fs.mkdirSync(packedDir, { recursive: true });
    for (const kind of ['growth', 'decay']) {
      const filename = kind === 'growth' ? 'home_sleep_garden_lv06.png' : 'home_sleep_garden_lv06_decay.png';
      fs.copyFileSync(path.join(previews, `celestial-stag-lv06-${kind}-atlas-candidate.png`), path.join(root, 'assets/pixelPet/animations', filename));
      for (let index = 0; index < 16; index += 1) {
        const frame = `${kind === 'growth' ? 'frame' : 'decay'}${key(index)}.png`;
        fs.copyFileSync(path.join(output, frame), path.join(packedDir, frame));
      }
    }
    console.log('Installed the approved Lv6 growth and decay atlases');
  }
  console.log(manifest.length ? `${manifest.length} authored source frames still missing; partial contact sheets only` : '32 frames ready for visual review');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
