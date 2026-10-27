// Central EXP/level policy. The UI never hardcodes these values; it renders
// what the backend returns.
export const PET_TIME_ZONE_OFFSET_MINUTES = 7 * 60; // Asia/Ho_Chi_Minh, no DST.

export const EXP_RULES = Object.freeze({
  record_day: 10,
  care_day: 5,
  streak_3: 15,
  streak_7: 30,
  weekly_record: 20,
});
export const WEEKLY_RECORD_DAYS = 4;
export const DAILY_EFFECT_CAP = 3;

// Cumulative EXP needed for level index + 1.
export const LEVEL_THRESHOLDS = Object.freeze([
  0, 30, 80, 150, 240, 350, 480, 630, 800, 1000,
]);

export function levelForExp(totalExp) {
  const exp = Math.max(0, Math.trunc(totalExp) || 0);
  let level = 1;
  for (let index = 0; index < LEVEL_THRESHOLDS.length; index += 1)
    if (exp >= LEVEL_THRESHOLDS[index]) level = index + 1;
  return level;
}

export function stageForLevel(level) {
  if (level >= 8) return 'ascended';
  if (level >= 4) return 'juvenile';
  return 'hatchling';
}

export function skillTierForLevel(level) {
  if (level >= 8) return 2;
  if (level >= 5) return 1;
  return 0;
}

export function progressFor(totalExp) {
  const exp = Math.max(0, Math.trunc(totalExp) || 0);
  const level = levelForExp(exp);
  return {
    totalExp: exp,
    level,
    stage: stageForLevel(level),
    skillTier: skillTierForLevel(level),
    levelFloorExp: LEVEL_THRESHOLDS[level - 1],
    nextLevelExp: LEVEL_THRESHOLDS[level] ?? null,
  };
}
