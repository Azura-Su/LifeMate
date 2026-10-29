export const GARUDA_SCENE_DESIGN_SIZE = 340;
export const GARUDA_PLATFORM_DESIGN_SIZE = 86;
export const GARUDA_PLATFORM_BOTTOM_GAP = 59;
export const GARUDA_SCENE_BASELINE_Y = 111;
const GARUDA_PET_VISIBLE_BOTTOM = 102;
const GARUDA_PLATFORM_SEAT_CENTER = 0.85;

export const GARUDA_CLOUD_MERGE_MS = 1500;
export const GARUDA_PLATFORM_ASSEMBLY_MS = 1400;
export const GARUDA_SHRINE_REVEAL_MS = 4500;
export const GARUDA_SCENE_DISSOLVE_MS = 1800;
export const GARUDA_SCENE_TOTAL_MS =
  GARUDA_CLOUD_MERGE_MS + GARUDA_PLATFORM_ASSEMBLY_MS + GARUDA_SHRINE_REVEAL_MS;

export type GarudaSleepSceneTimeline = {
  cloudProgress: number;
  platformProgress: number;
  shrineProgress: number;
};

/** Lift the grounded sprite so its visible feet meet the platform's top edge. */
export function garudaSleepLandingLift(sceneSize: number) {
  const platformSize = Math.round(
    GARUDA_PLATFORM_DESIGN_SIZE * (sceneSize / GARUDA_SCENE_DESIGN_SIZE),
  );
  const platformTopFromGround =
    GARUDA_SCENE_BASELINE_Y -
    sceneSize * (296 / 320) +
    sceneSize -
    platformSize -
    GARUDA_PLATFORM_BOTTOM_GAP;
  const seatY =
    platformTopFromGround + platformSize * GARUDA_PLATFORM_SEAT_CENTER;
  return Math.max(0, Math.round(GARUDA_PET_VISIBLE_BOTTOM - seatY));
}

function easedProgress(progress: number) {
  'worklet';
  const clamped = Math.max(0, Math.min(1, progress));
  return clamped * clamped * (3 - 2 * clamped);
}

/** Sequentially merge clouds, assemble the dais, then reveal the shrine. */
export function garudaSleepSceneTimelineAt(
  progress: number,
): GarudaSleepSceneTimeline {
  'worklet';
  const elapsed = Math.max(0, Math.min(1, progress)) * GARUDA_SCENE_TOTAL_MS;
  const cloudProgress = easedProgress(elapsed / GARUDA_CLOUD_MERGE_MS);
  const platformElapsed = elapsed - GARUDA_CLOUD_MERGE_MS;
  const platformProgress = easedProgress(
    platformElapsed / GARUDA_PLATFORM_ASSEMBLY_MS,
  );
  const shrineElapsed =
    elapsed - GARUDA_CLOUD_MERGE_MS - GARUDA_PLATFORM_ASSEMBLY_MS;
  const shrineProgress = easedProgress(shrineElapsed / GARUDA_SHRINE_REVEAL_MS);

  return {
    cloudProgress,
    platformProgress,
    shrineProgress,
  };
}
