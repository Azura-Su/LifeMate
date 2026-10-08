import { colors } from '..';

function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(first: string, second: string) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

it('uses the earth and cloud-sky palette with accessible text and controls', () => {
  expect(colors.background).toBe('#F7FAFC');
  expect(colors.surface).toBe('#FFFFFF');
  expect(colors.primary).toBe(colors.earthLight);
  expect(colors.onPrimary).toBe(colors.ink);
  expect(colors.sunlightSoft).toBe('#FBF4DD');
  expect(colors.sunlightAction).toBe('#EAD89D');
  expect(contrast(colors.ink, colors.background)).toBeGreaterThanOrEqual(7);
  expect(contrast(colors.ink, colors.sunlightSoft)).toBeGreaterThanOrEqual(7);
  expect(contrast(colors.ink, colors.earthLight)).toBeGreaterThanOrEqual(7);
  [
    colors.background,
    colors.surface,
    colors.primarySoft,
    colors.skySoft,
    colors.sunlightSoft,
  ].forEach((surface) => {
    expect(contrast(colors.muted, surface)).toBeGreaterThanOrEqual(4.5);
  });
  expect(contrast(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(7);
  expect(contrast(colors.ink, colors.sunlightAction)).toBeGreaterThanOrEqual(7);
  expect(contrast(colors.earth, colors.surface)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.sky, colors.skySoft)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.sunlight, colors.earthLight)).toBeGreaterThanOrEqual(
    3,
  );
  expect(contrast(colors.sunlight, colors.sunlightSoft)).toBeGreaterThanOrEqual(
    3,
  );
  expect(contrast(colors.success, colors.surface)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.danger, colors.dangerSoft)).toBeGreaterThanOrEqual(
    4.5,
  );
});
