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
  expect(colors.background).toBe('#F6FBFE');
  expect(colors.surface).toBe('#FFFFFF');
  expect(colors.primary).toBe(colors.earthLight);
  expect(colors.onPrimary).toBe(colors.ink);
  expect(colors.primary).toBe('#F1E7DE');
  expect(colors.primarySoft).toBe('#F8F3EF');
  expect(colors.bottomBar).toBe('#FAF7F3');
  expect(colors.sunlightSoft).toBe('#FFF9E8');
  expect(colors.sunlightFaint).toBe('#FFFCF5');
  expect(colors.sunlightLine).toBe('#F0E5C5');
  expect(colors.sunlightAction).toBe('#F6ECC9');
  expect(colors.successSoft).toBe('#EAF2EC');
  expect(colors.cloudShadow).toBe('#536774');
  expect(contrast(colors.ink, colors.background)).toBeGreaterThanOrEqual(7);
  expect(contrast(colors.ink, colors.sunlightSoft)).toBeGreaterThanOrEqual(7);
  expect(contrast(colors.ink, colors.earthLight)).toBeGreaterThanOrEqual(7);
  [
    colors.background,
    colors.surface,
    colors.primarySoft,
    colors.bottomBar,
    colors.skySoft,
    colors.sunlightSoft,
    colors.sunlightFaint,
  ].forEach((surface) => {
    expect(contrast(colors.muted, surface)).toBeGreaterThanOrEqual(4.5);
  });
  expect(contrast(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(7);
  expect(contrast(colors.earth, colors.primary)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.earth, colors.sunlightSoft)).toBeGreaterThanOrEqual(
    4.5,
  );
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
  expect(contrast(colors.success, colors.successSoft)).toBeGreaterThanOrEqual(
    4.5,
  );
  expect(contrast(colors.danger, colors.dangerSoft)).toBeGreaterThanOrEqual(
    4.5,
  );
});
