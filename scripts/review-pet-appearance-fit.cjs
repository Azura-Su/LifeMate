/* global __dirname */
// Read-only asset check and contact sheet for every selectable Stag pairing.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const Jimp = require('jimp-compact');

const root = path.resolve(__dirname, '..');
const assets = path.join(root, 'assets/pixelPet/animations');
const levels = [1, 3, 4, 5, 7, 8, 9, 11, 13, 15, 17, 19];
const scenes = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
const tiers = [
  [2, '12', 140 / 193], [4, '34', 165 / 224], [6, '56', 185 / 176],
  [8, '78', 198 / 195], [10, '910', 208 / 224], [12, '1112', 214 / 228],
  [14, '1314', 218 / 212], [16, '1516', 221 / 211], [18, '1718', 224 / 222],
  [20, '1920', 226 / 223],
];
function frame(atlas, index) {
  const cell = atlas.bitmap.width / 4;
  return atlas.clone().crop(index % 4 * cell, Math.floor(index / 4) * cell, cell, cell);
}
function visibleBounds(image) {
  let left = image.bitmap.width, right = 0, top = image.bitmap.height, bottom = 0;
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, offset) {
    if (this.bitmap.data[offset + 3] < 24) return;
    left = Math.min(left, x); right = Math.max(right, x + 1);
    top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
  });
  return { left, right, top, bottom };
}
async function main() {
  const contact = new Jimp(160 * scenes.length, 160 * levels.length, 0xf7f4eeff);
  const gardens = await Promise.all(scenes.map(async (level) => {
    const name = level === 2 ? 'home_sleep_garden.png'
      : level === 8 ? 'home_sleep_garden_lv08_v2.png'
      : level === 16 ? 'home_sleep_garden_lv16_v2.png'
      : `home_sleep_garden_lv${String(level).padStart(2, '0')}.png`;
    return frame(await Jimp.read(path.join(assets, name)), 15).resize(240, 240);
  }));
  let checked = 0, maxPetWidth = 0;
  for (const [row, level] of levels.entries()) {
    const [, id, lookScale] = tiers.find(([max]) => level <= max);
    const atlas = await Jimp.read(path.join(assets, `celestial_stag_lv${id}_sleep.png`));
    const size = Math.round(144 * lookScale);
    const x = Math.round(120 - size / 2), y = Math.round(222 - size * 0.9);
    for (let pose = 12; pose <= 15; pose += 1) {
      const bounds = visibleBounds(frame(atlas, pose).resize(size, size));
      assert(x + bounds.left >= 0 && x + bounds.right <= 240 &&
        y + bounds.top >= 0 && y + bounds.bottom <= 240, `Clipped Lv${level} pose${pose}`);
      maxPetWidth = Math.max(maxPetWidth, bounds.right - bounds.left);
      checked += scenes.length;
    }
    for (const [col, garden] of gardens.entries()) {
      const composite = new Jimp(240, 240, 0xf7f4eeff).composite(garden, 0, 0)
        .composite(frame(atlas, 15).resize(size, size), x, y).resize(160, 160);
      contact.composite(composite, col * 160, row * 160);
    }
  }
  const target = path.join(root, 'tasks/previews/pet-appearance-all-stag-pairs.png');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  await contact.writeAsync(target);
  console.log(`${checked} sleep-pose pairings fit; max body width ${maxPetWidth}/240pt. ${target}`);
  console.log(`Rows (appearance): ${levels.join(', ')}; columns (scene): ${scenes.join(', ')}`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
