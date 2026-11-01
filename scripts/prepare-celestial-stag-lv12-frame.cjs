#!/usr/bin/env node

const fs = require('node:fs');
const { PNG } = require('pngjs');

const [sourcePath, outputPath, heightRatioArg = '0.6', groundLineArg = '0.9', fixedScaleArg] = process.argv.slice(2);

if (!sourcePath || !outputPath) {
  throw new Error('Usage: node prepare-celestial-stag-lv12-frame.cjs <source.png> <output.png> [heightRatio] [groundLine]');
}

const heightRatio = Number(heightRatioArg);
const groundLine = Number(groundLineArg);
const fixedScale = fixedScaleArg === undefined ? undefined : Number(fixedScaleArg);
if (!(heightRatio > 0 && heightRatio < 1) || !(groundLine > 0 && groundLine < 1)
  || (fixedScale !== undefined && !(fixedScale > 0 && fixedScale < 2))) {
  throw new Error('heightRatio and groundLine must be between 0 and 1; fixedScale, when provided, must be between 0 and 2');
}

const source = PNG.sync.read(fs.readFileSync(sourcePath));
if (source.width !== source.height) throw new Error('Source image must be square');

let minX = source.width;
let minY = source.height;
let maxX = -1;
let maxY = -1;
for (let y = 0; y < source.height; y += 1) {
  for (let x = 0; x < source.width; x += 1) {
    if (source.data[(y * source.width + x) * 4 + 3] <= 8) continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
}
if (maxX < minX || maxY < minY) throw new Error('Source image has no visible alpha pixels');

const canvasSize = source.width;
const boundsWidth = maxX - minX + 1;
const boundsHeight = maxY - minY + 1;
const targetHeight = Math.round(fixedScale === undefined ? canvasSize * heightRatio : boundsHeight * fixedScale);
const targetWidth = Math.round(fixedScale === undefined ? boundsWidth * targetHeight / boundsHeight : boundsWidth * fixedScale);
const left = Math.round((canvasSize - targetWidth) / 2);
const top = Math.round(canvasSize * groundLine) - targetHeight;
const output = new PNG({ width: canvasSize, height: canvasSize });

function sample(x, y, channel) {
  const sx = Math.max(minX, Math.min(maxX, x));
  const sy = Math.max(minY, Math.min(maxY, y));
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const x1 = Math.min(maxX, x0 + 1);
  const y1 = Math.min(maxY, y0 + 1);
  const fx = sx - x0;
  const fy = sy - y0;
  return source.data[(y0 * canvasSize + x0) * 4 + channel] * (1 - fx) * (1 - fy)
    + source.data[(y0 * canvasSize + x1) * 4 + channel] * fx * (1 - fy)
    + source.data[(y1 * canvasSize + x0) * 4 + channel] * (1 - fx) * fy
    + source.data[(y1 * canvasSize + x1) * 4 + channel] * fx * fy;
}

for (let y = 0; y < targetHeight; y += 1) {
  for (let x = 0; x < targetWidth; x += 1) {
    const sourceX = minX + (x + 0.5) * boundsWidth / targetWidth - 0.5;
    const sourceY = minY + (y + 0.5) * boundsHeight / targetHeight - 0.5;
    const alpha = sample(sourceX, sourceY, 3);
    const outputIndex = ((top + y) * canvasSize + left + x) * 4;
    output.data[outputIndex + 3] = Math.round(alpha);
    for (let channel = 0; channel < 3; channel += 1) {
      const premultiplied = sample(sourceX, sourceY, channel) * sample(sourceX, sourceY, 3) / 255;
      output.data[outputIndex + channel] = alpha === 0 ? 0 : Math.round(premultiplied * 255 / alpha);
    }
  }
}

fs.mkdirSync(require('node:path').dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, PNG.sync.write(output));
console.log(JSON.stringify({
  outputPath,
  canvasSize,
  characterSize: [targetWidth, targetHeight],
  characterHeightRatio: targetHeight / canvasSize,
  baselineRatio: (top + targetHeight) / canvasSize,
}));
