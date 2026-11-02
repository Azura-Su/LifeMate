import { spacing } from '../../theme';

export const CELESTIAL_STAG_HOME_PET_SIZE = 144;
export const CELESTIAL_STAG_HOME_GARDEN_SIZE = 240;

/** Fit the whole scene below Home's card viewport, preserving the pet ratio. */
export function celestialStagHomeLayout(
  width: number,
  maxReservedHeight = CELESTIAL_STAG_HOME_GARDEN_SIZE + spacing.md,
) {
  const sceneSize = Math.max(0, Math.min(
    CELESTIAL_STAG_HOME_GARDEN_SIZE,
    width - spacing.sm * 2,
    maxReservedHeight - spacing.md,
  ));
  const petSize = sceneSize * CELESTIAL_STAG_HOME_PET_SIZE / CELESTIAL_STAG_HOME_GARDEN_SIZE;
  const sleepMinX = Math.max(0, spacing.sm - spacing.md + (sceneSize - petSize) / 2);
  const sleepMaxX = Math.max(sleepMinX,
    width - spacing.sm - spacing.md - (sceneSize + petSize) / 2);
  return {
    petSize,
    sceneSize,
    reservedHeight: sceneSize > 0 ? sceneSize + spacing.md : 0,
    sleepMinX,
    sleepMaxX,
  };
}
