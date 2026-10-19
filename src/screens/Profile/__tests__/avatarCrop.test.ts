import { avatarCropGeometry } from '../avatarCrop';

test('covers landscape and portrait previews with a centered square source crop', () => {
  expect(avatarCropGeometry(800, 600, 300, 1, 0, 0).crop).toEqual({
    originX: 100,
    originY: 0,
    width: 600,
    height: 600,
  });
  expect(avatarCropGeometry(600, 800, 300, 1, 0, 0).crop).toEqual({
    originX: 0,
    originY: 100,
    width: 600,
    height: 600,
  });
});
test('clamps drag at image bounds and converts zoomed preview to source pixels', () => {
  const result = avatarCropGeometry(800, 600, 300, 2, 1000, -1000);
  expect(result.offsetX).toBe(250);
  expect(result.offsetY).toBe(-150);
  expect(result.crop).toEqual({
    originX: 0,
    originY: 300,
    width: 300,
    height: 300,
  });
});
test('never leaves a gap or crops outside source even with fractional sizes', () => {
  for (const [w, h] of [
    [4031, 3023],
    [301, 701],
    [1, 2],
  ]) {
    for (const zoom of [1, 1.37, 3]) {
      const result = avatarCropGeometry(w, h, 271, zoom, -99999, 99999);
      expect(result.crop.originX).toBeGreaterThanOrEqual(0);
      expect(result.crop.originY).toBeGreaterThanOrEqual(0);
      expect(result.crop.originX + result.crop.width).toBeLessThanOrEqual(w);
      expect(result.crop.originY + result.crop.height).toBeLessThanOrEqual(h);
      expect(result.left).toBeLessThanOrEqual(0);
      expect(result.top).toBeLessThanOrEqual(0);
      expect(result.left + result.width).toBeGreaterThanOrEqual(271);
      expect(result.top + result.height).toBeGreaterThanOrEqual(271);
    }
  }
});
test('rejects invalid dimensions instead of sending invalid crops to native code', () => {
  for (const width of [0, -1, NaN, Infinity])
    expect(() => avatarCropGeometry(width, 600, 300, 1, 0, 0)).toThrow();
});
