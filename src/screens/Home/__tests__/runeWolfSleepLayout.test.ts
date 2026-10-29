import { spacing } from '../../../theme';
import {
  runeWolfSleepAnchorX,
  runeWolfSleepSceneSize,
} from '../runeWolfSleepLayout';

it.each([180, 230, 320, 390, 768])(
  'keeps the complete wolf landscape inside a %d point viewport at both edges',
  (width) => {
    const inset = spacing.md;
    const size = runeWolfSleepSceneSize(width);
    for (const position of [-100, 0, width / 2, width, width + 100]) {
      const anchor = runeWolfSleepAnchorX(position, width, inset);
      const sceneLeft = inset + anchor + (120 - size) / 2;
      expect(sceneLeft).toBeGreaterThanOrEqual(spacing.sm);
      expect(sceneLeft + size).toBeLessThanOrEqual(width - spacing.sm);
      expect(runeWolfSleepAnchorX(anchor, width, inset)).toBe(anchor);
    }
  },
);
