import { spacing } from '../../../theme';
import { celestialStagLevelLookScale } from '../../../services/pixelPet/celestialStagAtlas';
import {
  celestialStagHomeLayout,
  petSceneBudget,
} from '../celestialStagHomeLayout';

it.each([[320, 568, 20, 80], [390, 844, 59, 80], [430, 932, 62, 80]])(
  'enlarges every level while keeping the whole scene below cards on %ix%i',
  (width, height, inset, header) => {
    const available = (height - inset - header) * 0.55;
    const layout = celestialStagHomeLayout(width, available);
    expect(layout.sceneSize).toBeGreaterThan(188);
    expect(layout.petSize).toBeGreaterThan(120);
    expect(layout.reservedHeight).toBeLessThanOrEqual(available);
    const sceneTop = height - layout.sceneSize * (296 / 320);
    const cardsBottom = height - layout.reservedHeight;
    expect(sceneTop - cardsBottom).toBeGreaterThanOrEqual(spacing.md);
    for (let level = 1; level <= 20; level += 1) {
      const scale = celestialStagLevelLookScale(level)!;
      expect(layout.petSize * scale).toBeGreaterThan(120 * scale);
    }
    for (const x of [layout.sleepMinX, layout.sleepMaxX]) {
      const left = spacing.md + x + (layout.petSize - layout.sceneSize) / 2;
      expect(left).toBeGreaterThanOrEqual(spacing.sm - 0.001);
      expect(left + layout.sceneSize).toBeLessThanOrEqual(width - spacing.sm + 0.001);
    }
  },
);

it.each([[240, 200], [844, 140], [180, 85]])(
  'fits the pet and scene together within width %i and reserved height %i',
  (width, height) => {
    const layout = celestialStagHomeLayout(width, height);
    expect(layout.sceneSize).toBeLessThanOrEqual(width - spacing.sm * 2);
    expect(layout.reservedHeight).toBeLessThanOrEqual(height);
    expect(layout.petSize / layout.sceneSize).toBeCloseTo(144 / 240);
    expect(layout.sleepMinX).toBeLessThanOrEqual(layout.sleepMaxX);
  },
);

it('does not reserve an unusable scene when the header leaves no height', () => {
  const layout = celestialStagHomeLayout(320, 0);
  expect(layout.petSize).toBe(0);
  expect(layout.sceneSize).toBe(0);
  expect(layout.reservedHeight).toBe(0);
});

describe('petSceneBudget', () => {
  it('shrinks the pet scene so the cards stay fully visible', () => {
    // iPhone 13-like: 617pt available, cards need 450pt.
    expect(petSceneBudget(617, 450)).toBe(617 - 450 - spacing.lg);
  });

  it('keeps a minimum scene on very short screens', () => {
    expect(petSceneBudget(500, 480)).toBe(130);
  });

  it('caps the scene at the share of space before cards are measured', () => {
    expect(petSceneBudget(700, 0)).toBeCloseTo(385);
  });

  it('never exceeds the share when the cards are short', () => {
    expect(petSceneBudget(700, 200)).toBeCloseTo(385);
  });
});
