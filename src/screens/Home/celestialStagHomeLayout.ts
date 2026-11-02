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

const PET_SCENE_MIN_HEIGHT = 130;
/** Breathing room between the last card and the docked scene. */
const PET_SCENE_CARDS_GAP = spacing.lg;
const PET_SCENE_MAX_SHARE = 0.55;

/** Largest pet scene that still leaves the cards fully visible (never below the floor). */
export function petSceneBudget(available: number, cardsBottom: number) {
  const space = Math.max(0, available);
  const byShare = space * PET_SCENE_MAX_SHARE;
  const byCards = cardsBottom > 0 ? space - cardsBottom - PET_SCENE_CARDS_GAP : byShare;
  return Math.max(PET_SCENE_MIN_HEIGHT, Math.min(byShare, byCards));
}
