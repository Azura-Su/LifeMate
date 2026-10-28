/**
 * Cuts the matted Celestial Stag illustration into puppet layers.
 *   node scripts/build-celestial-stag-layers.cjs <matted.png> <outDir>
 * <matted.png> is the reference art with the white background removed (alpha).
 * Writes wing_l/wing_r/tail/head/body PNGs, art.png (384px square) and
 * layers.json (placement as fractions of the square canvas).
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const [, , input, outDir] = process.argv;
const src = PNG.sync.read(fs.readFileSync(input));
const { width: W, height: H, data } = src;

// Square canvas in source pixels; layers are downscaled to OUT px per canvas.
const CANVAS = { x: 163, y: -137, size: 1000 };
const OUT = 750;
const K = OUT / CANVAS.size;

const PIVOT = {
  wingL: [590, 385],
  wingR: [758, 388],
  tail: [935, 468],
  head: [650, 352],
};
const POLY = {
  wingL: [[170,20],[525,20],[525,150],[530,215],[560,255],[575,300],[592,335],[588,420],[572,462],[170,470]],
  wingR: [[1160,20],[815,20],[815,200],[795,235],[793,300],[770,360],[738,395],[735,415],[800,428],[900,418],[960,410],[960,405],[1010,352],[1110,312],[1160,312]],
  tail: [[965,410],[985,330],[1160,330],[1160,640],[985,610],[940,570],[912,515],[930,455]],
  head: [[515,15],[820,15],[820,240],[790,300],[760,345],[700,372],[610,372],[575,340],[560,262],[515,215]],
};
const HEAD_CUT_Y = 345; // body keeps the neck below this so the nod has no seam
const ROOT_KEEP = { wingL: 70, wingR: 70, tail: 40 };

function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

const owner = new Uint8Array(W * H); // 0 body, else index into NAMES
const NAMES = ['body', 'wingL', 'wingR', 'tail', 'head'];
const keepInBody = new Uint8Array(W * H);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const p = y * W + x;
    if (data[p * 4 + 3] === 0) continue;
    let o = 0;
    for (const name of ['wingL', 'wingR', 'tail', 'head']) {
      if (inside(POLY[name], x, y)) {
        o = NAMES.indexOf(name);
        break;
      }
    }
    owner[p] = o;
    if (o === 4 && y >= HEAD_CUT_Y) keepInBody[p] = 1;
    if (o > 0 && o < 4) {
      const [px, py] = PIVOT[NAMES[o]];
      if (Math.hypot(x - px, y - py) <= ROOT_KEEP[NAMES[o]]) keepInBody[p] = 1;
    }
  }
}

// Source pixels per output pixel (the 4:3 box filter is uneven), for true coverage.
const footprint = new Float64Array(OUT * OUT);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const ox = Math.floor((x - CANVAS.x) * K);
    const oy = Math.floor((y - CANVAS.y) * K);
    if (ox >= 0 && oy >= 0 && ox < OUT && oy < OUT) footprint[oy * OUT + ox] += 1;
  }

function render(include) {
  const buf = new PNG({ width: OUT, height: OUT });
  const acc = new Float64Array(OUT * OUT * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const a = data[p * 4 + 3] / 255;
      if (!a || !include(p, x, y)) continue;
      const ox = Math.floor((x - CANVAS.x) * K);
      const oy = Math.floor((y - CANVAS.y) * K);
      if (ox < 0 || oy < 0 || ox >= OUT || oy >= OUT) continue;
      const q = oy * OUT + ox;
      acc[q * 4] += data[p * 4] * a;
      acc[q * 4 + 1] += data[p * 4 + 1] * a;
      acc[q * 4 + 2] += data[p * 4 + 2] * a;
      acc[q * 4 + 3] += a;
    }
  }
  for (let q = 0; q < OUT * OUT; q++) {
    const a = acc[q * 4 + 3];
    if (!a) continue;
    buf.data[q * 4] = Math.round(acc[q * 4] / a);
    buf.data[q * 4 + 1] = Math.round(acc[q * 4 + 1] / a);
    buf.data[q * 4 + 2] = Math.round(acc[q * 4 + 2] / a);
    buf.data[q * 4 + 3] = Math.round(Math.min(1, a / footprint[q]) * 255);
  }
  return buf;
}

function crop(png, pad = 2) {
  let minx = OUT, miny = OUT, maxx = -1, maxy = -1;
  for (let y = 0; y < OUT; y++)
    for (let x = 0; x < OUT; x++)
      if (png.data[(y * OUT + x) * 4 + 3] > 8) {
        minx = Math.min(minx, x); maxx = Math.max(maxx, x);
        miny = Math.min(miny, y); maxy = Math.max(maxy, y);
      }
  minx = Math.max(0, minx - pad); miny = Math.max(0, miny - pad);
  maxx = Math.min(OUT - 1, maxx + pad); maxy = Math.min(OUT - 1, maxy + pad);
  const w = maxx - minx + 1, h = maxy - miny + 1;
  const out = new PNG({ width: w, height: h });
  PNG.bitblt(png, out, minx, miny, w, h, 0, 0);
  return { out, left: minx, top: miny, w, h };
}

fs.mkdirSync(outDir, { recursive: true });
const meta = {};
NAMES.forEach((name, index) => {
  const png = render((p) =>
    index === 0 ? owner[p] === 0 || keepInBody[p] : owner[p] === index || (index === 4 && owner[p] === 4),
  );
  const c = crop(png);
  const file = { body: 'body', wingL: 'wing_l', wingR: 'wing_r', tail: 'tail', head: 'head' }[name];
  fs.writeFileSync(path.join(outDir, `${file}.png`), PNG.sync.write(c.out, { colorType: 6 }));
  meta[name] = {
    file: `${file}.png`,
    left: +(c.left / OUT).toFixed(5),
    top: +(c.top / OUT).toFixed(5),
    width: +(c.w / OUT).toFixed(5),
    height: +(c.h / OUT).toFixed(5),
  };
  if (PIVOT[name]) {
    meta[name].pivot = [
      +(((PIVOT[name][0] - CANVAS.x) / CANVAS.size)).toFixed(5),
      +(((PIVOT[name][1] - CANVAS.y) / CANVAS.size)).toFixed(5),
    ];
  }
});
// Full static art, 384px, for thumbnails and as the loading fallback.
{
  const full = render(() => true);
  const art = new PNG({ width: 384, height: 384 });
  const f = OUT / 384;
  for (let y = 0; y < 384; y++)
    for (let x = 0; x < 384; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let dy = 0; dy < f; dy++)
        for (let dx = 0; dx < f; dx++) {
          const sx = Math.min(OUT - 1, Math.floor(x * f + dx)), sy = Math.min(OUT - 1, Math.floor(y * f + dy));
          const i = (sy * OUT + sx) * 4, al = full.data[i + 3] / 255;
          r += full.data[i] * al; g += full.data[i + 1] * al; b += full.data[i + 2] * al; a += al; n++;
        }
      const i = (y * 384 + x) * 4;
      if (a) { art.data[i] = r / a; art.data[i + 1] = g / a; art.data[i + 2] = b / a; art.data[i + 3] = Math.round((a / n) * 255); }
    }
  fs.writeFileSync(path.join(outDir, 'art.png'), PNG.sync.write(art, { colorType: 6 }));
}
const anchors = {
  hooves: [[545, 690], [722, 674], [750, 668], [886, 690]],
  gems: [[621, 222], [607, 393], [792, 44], [598, 100], [797, 150], [716, 105], [700, 445], [735, 440], [680, 436], [641, 402]],
  eyes: [[590, 252], [656, 257]],
};
const norm = ([x, y]) => [+((x - CANVAS.x) / CANVAS.size).toFixed(5), +((y - CANVAS.y) / CANVAS.size).toFixed(5)];
meta.anchors = { hooves: anchors.hooves.map(norm), gems: anchors.gems.map(norm), eyes: anchors.eyes.map(norm) };
fs.writeFileSync(path.join(outDir, 'layers.json'), JSON.stringify(meta, null, 2));
console.log(JSON.stringify(meta, null, 1));
