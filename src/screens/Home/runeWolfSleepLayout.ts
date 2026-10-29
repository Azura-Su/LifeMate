import { spacing } from '../../theme';

const PET_SIZE = 120;
export const RUNE_WOLF_SLEEP_SCENE_SIZE = 240;

export function runeWolfSleepSceneSize(width: number): number {
  return Math.max(
    1,
    Math.min(RUNE_WOLF_SLEEP_SCENE_SIZE, width - spacing.sm * 2),
  );
}

/** Keep the whole landscape and moon inside the viewport, including narrow phones. */
export function runeWolfSleepAnchorX(
  x: number,
  width: number,
  inset: number,
): number {
  'worklet';
  const size = Math.max(
    1,
    Math.min(RUNE_WOLF_SLEEP_SCENE_SIZE, width - spacing.sm * 2),
  );
  const overhang = (size - PET_SIZE) / 2;
  const min = spacing.sm + overhang - inset;
  const max = Math.max(min, width - spacing.sm - size + overhang - inset);
  return Math.max(min, Math.min(max, x));
}
