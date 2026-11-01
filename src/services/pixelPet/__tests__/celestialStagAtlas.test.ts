import {
  celestialStagGaitLoopDistance,
  celestialStagLevelHeight,
  celestialStagLevelLookScale,
  celestialStagGroundTravelMs,
  celestialStagLiesDownInPlace,
  celestialStagStridesPerGaitLoop,
  CELESTIAL_STAG_MOVEMENT_FRAMES,
  CELESTIAL_STAG_FLAP_CYCLE_MS,
  CELESTIAL_STAG_HOME_PHASE_DURATION,
  celestialStagFlightPlayback,
  celestialStagGardenFrameAt,
  CELESTIAL_STAG_GARDEN_GROWTH_MS,
  CELESTIAL_STAG_LV12_WALK_FRAMES,
  CELESTIAL_STAG_LV12_RUN_FRAMES,
  CELESTIAL_STAG_LV12_HOP_FRAMES,
  CELESTIAL_STAG_LV12_SETTLE_FRAMES,
  CELESTIAL_STAG_LV12_SLEEP_FRAMES,
  CELESTIAL_STAG_LV12_RUN_B_DURATION_MS,
  CELESTIAL_STAG_LV34_HOME_PHASE_DURATION,
  celestialStagHomePhaseDuration,
  celestialStagNextHomePhase,
  isCelestialStagLevel1314,
  isCelestialStagLevel1718,
  CELESTIAL_STAG_LV1718_SETTLE_FRAMES,
  CELESTIAL_STAG_LV1718_SLEEP_FRAMES,
  isCelestialStagLevel1920,
  isCelestialStagLevel78,
  CELESTIAL_STAG_LV78_TAKEOFF_FRAMES,
  CELESTIAL_STAG_LV78_FLAP_FRAMES,
  CELESTIAL_STAG_LV78_GLIDE_FRAMES,
  CELESTIAL_STAG_LV78_LANDING_FRAMES,
  CELESTIAL_STAG_LV78_SETTLE_FRAMES,
  CELESTIAL_STAG_LV78_SLEEP_FRAMES,
  isCelestialStagLevel910,
  CELESTIAL_STAG_LV910_WALK_FRAMES,
  CELESTIAL_STAG_LV910_RUN_FRAMES,
  CELESTIAL_STAG_LV910_SETTLE_FRAMES,
  CELESTIAL_STAG_LV910_SLEEP_FRAMES,
} from '../celestialStagAtlas';

it('selects the Lv9–10 variant only for levels nine and ten', () => {
  expect(isCelestialStagLevel910(9)).toBe(true);
  expect(isCelestialStagLevel910(10)).toBe(true);
  expect(isCelestialStagLevel910(8)).toBe(false);
  expect(isCelestialStagLevel910(11)).toBe(false);
  expect(CELESTIAL_STAG_LV910_WALK_FRAMES).toHaveLength(16);
  expect(CELESTIAL_STAG_LV910_RUN_FRAMES).toHaveLength(16);
  expect(CELESTIAL_STAG_LV910_SETTLE_FRAMES).toHaveLength(12);
  expect(CELESTIAL_STAG_LV910_SLEEP_FRAMES).toEqual([12, 13, 14, 15]);
});

it('selects the Lv7–8 variant only for levels seven and eight', () => {
  expect(isCelestialStagLevel78(7)).toBe(true);
  expect(isCelestialStagLevel78(8)).toBe(true);
  expect(isCelestialStagLevel78(6)).toBe(false);
  expect(isCelestialStagLevel78(9)).toBe(false);
  expect(isCelestialStagLevel78(undefined)).toBe(false);
  expect(CELESTIAL_STAG_LV78_TAKEOFF_FRAMES).toEqual([0, 1, 2, 3]);
  expect(CELESTIAL_STAG_LV78_FLAP_FRAMES).toEqual([4, 5, 6, 7]);
  expect(CELESTIAL_STAG_LV78_GLIDE_FRAMES).toEqual([8, 9, 10, 11]);
  expect(CELESTIAL_STAG_LV78_LANDING_FRAMES).toEqual([12, 13, 14, 15]);
  expect(CELESTIAL_STAG_LV78_SETTLE_FRAMES).toHaveLength(12);
  expect(CELESTIAL_STAG_LV78_SLEEP_FRAMES).toEqual([12, 13, 14, 15]);
});

it('selects the Lv13–14 variant only for levels 13 and 14', () => {
  expect(isCelestialStagLevel1314(13)).toBe(true);
  expect(isCelestialStagLevel1314(14)).toBe(true);
  expect(isCelestialStagLevel1314(12)).toBe(false);
  expect(isCelestialStagLevel1314(15)).toBe(false);
  expect(isCelestialStagLevel1314(undefined)).toBe(false);
});

it('selects the final Stag motion set only from level 19 upward', () => {
  expect(isCelestialStagLevel1920(18)).toBe(false);
  expect(isCelestialStagLevel1920(19)).toBe(true);
  expect(isCelestialStagLevel1920(20)).toBe(true);
  expect(isCelestialStagLevel1920(undefined)).toBe(false);
});

it('selects the level 17–18 motion set only for those two levels', () => {
  expect(isCelestialStagLevel1718(16)).toBe(false);
  expect(isCelestialStagLevel1718(17)).toBe(true);
  expect(isCelestialStagLevel1718(18)).toBe(true);
  expect(isCelestialStagLevel1718(19)).toBe(false);
  expect(isCelestialStagLevel1718(undefined)).toBe(false);
  expect(CELESTIAL_STAG_LV1718_SETTLE_FRAMES).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  expect(CELESTIAL_STAG_LV1718_SLEEP_FRAMES).toEqual([8, 9, 10, 11, 12, 13, 14, 15]);
});

it('uses an eight-beat Home walk with six authored poses and contact holds', () => {
  expect(CELESTIAL_STAG_MOVEMENT_FRAMES).toHaveLength(8);
  expect(new Set(CELESTIAL_STAG_MOVEMENT_FRAMES).size).toBe(6);
  expect(CELESTIAL_STAG_MOVEMENT_FRAMES).toEqual([0, 1, 2, 3, 4, 5, 4, 1]);
});

it('finishes the active Home sequence in 20 seconds before sleeping', () => {
  const duration = Object.values(CELESTIAL_STAG_HOME_PHASE_DURATION)
    .filter(Number.isFinite)
    .reduce((total, value) => total + value, 0);
  expect(duration).toBe(20_000);
});

it.each(['takeoff', 'glide', 'landing'] as const)(
  '%s completes the full pose track in the same time as the Home path',
  (phase) => {
    expect(celestialStagFlightPlayback(phase, 'move')).toEqual({
      durationMs: CELESTIAL_STAG_HOME_PHASE_DURATION[phase],
      loop: false,
    });
  },
);

it('plays the Lv3–4 glide atlas for its full shortened phase', () => {
  expect(celestialStagFlightPlayback('glide', 'move', 3)).toEqual({
    durationMs: 2000,
    loop: false,
  });
  expect(celestialStagFlightPlayback('glide', 'move', 4)).toEqual({
    durationMs: 2000,
    loop: false,
  });
  expect(celestialStagFlightPlayback('glide', 'move', 5)).toEqual({
    durationMs: 3300,
    loop: false,
  });
});

it('captures partial growth on an early wake and clamps mature growth to the last frame', () => {
  expect(celestialStagGardenFrameAt(-20)).toBe(0);
  expect(celestialStagGardenFrameAt(0)).toBe(0);
  expect(celestialStagGardenFrameAt(CELESTIAL_STAG_GARDEN_GROWTH_MS / 2)).toBe(
    8,
  );
  expect(celestialStagGardenFrameAt(CELESTIAL_STAG_GARDEN_GROWTH_MS)).toBe(15);
  expect(celestialStagGardenFrameAt(30_000)).toBe(15);
});

it('ends flapping at a complete wingbeat before starting the glide track', () => {
  expect(
    CELESTIAL_STAG_HOME_PHASE_DURATION.flap % CELESTIAL_STAG_FLAP_CYCLE_MS,
  ).toBe(0);
  expect(celestialStagFlightPlayback('flap', 'move')).toEqual({
    durationMs: CELESTIAL_STAG_FLAP_CYCLE_MS,
    loop: true,
  });
});

it('defines complete authored tracks for the Lv1–2 Stag motion atlases', () => {
  expect(CELESTIAL_STAG_LV12_WALK_FRAMES).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  expect(CELESTIAL_STAG_LV12_RUN_FRAMES).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  expect(CELESTIAL_STAG_LV12_HOP_FRAMES).toHaveLength(16);
  expect(CELESTIAL_STAG_LV12_SETTLE_FRAMES).toEqual(
    Array.from({ length: 12 }, (_, frame) => frame),
  );
  expect(CELESTIAL_STAG_LV12_SLEEP_FRAMES).toEqual([12, 13, 14, 15]);
});

it('uses the short hop only for levels one and two and preserves higher level timing', () => {
  expect(celestialStagHomePhaseDuration('takeoff', 2)).toBe(1600);
  expect(celestialStagHomePhaseDuration('runB', 2)).toBe(
    CELESTIAL_STAG_LV12_RUN_B_DURATION_MS,
  );
  expect(celestialStagHomePhaseDuration('takeoff', 3)).toBe(
    CELESTIAL_STAG_HOME_PHASE_DURATION.takeoff,
  );
  expect(celestialStagNextHomePhase('takeoff', 2)).toBe('walkAfterLanding');
  expect(celestialStagNextHomePhase('takeoff', 3)).toBe('flap');
});

it('keeps the level 3–4 flight cycle at 20 seconds with a short glide and three wingbeats', () => {
  const duration = Object.values(CELESTIAL_STAG_LV34_HOME_PHASE_DURATION)
    .filter(Number.isFinite)
    .reduce((total, value) => total + value, 0);
  expect(duration).toBe(20_000);
  expect(celestialStagHomePhaseDuration('glide', 3)).toBe(2000);
  expect(celestialStagHomePhaseDuration('glide', 4)).toBe(2000);
  expect(CELESTIAL_STAG_LV34_HOME_PHASE_DURATION.flap).toBe(
    CELESTIAL_STAG_FLAP_CYCLE_MS * 3,
  );
  expect(celestialStagHomePhaseDuration('glide', 5)).toBe(
    CELESTIAL_STAG_HOME_PHASE_DURATION.glide,
  );
});

it('draws one gait stride per loop only on eight-frame ground tracks', () => {
  expect([undefined, 1, 2].map(celestialStagStridesPerGaitLoop)).toEqual([1, 1, 1]);
  expect(Array.from({ length: 18 }, (_, i) => celestialStagStridesPerGaitLoop(i + 3)))
    .toEqual(Array(18).fill(2));
  expect(celestialStagGaitLoopDistance(40, 'walk', 13)).toBe(80);
  expect(celestialStagGaitLoopDistance(40, 'run', 13)).toBeCloseTo(104);
  expect(celestialStagGaitLoopDistance(40, 'run', 2)).toBeCloseTo(52);
});

it('lies down in place on every level with an authored sleep atlas', () => {
  expect(celestialStagLiesDownInPlace(undefined)).toBe(false);
  expect(Array.from({ length: 20 }, (_, i) => i + 1).every(celestialStagLiesDownInPlace)).toBe(true);
});

it('walks a short ground leg at walk speed instead of crawling', () => {
  // 20px in 2.3s would be 8.7px/s: walk it in 625ms, then stand.
  expect(celestialStagGroundTravelMs(20, 2300, 32)).toBeCloseTo(625);
  expect(celestialStagGroundTravelMs(80, 2300, 32)).toBe(2300);
  expect(celestialStagGroundTravelMs(0, 2300, 32)).toBe(2300);
});

it('grows the displayed Stag with every level pair and never shrinks', () => {
  const heights = Array.from({ length: 20 }, (_, index) => celestialStagLevelHeight(index + 1)!);
  for (let level = 2; level <= 20; level++) {
    expect(heights[level - 1]).toBeGreaterThanOrEqual(heights[level - 2]);
    // Both levels of a pair share one art set and one size.
    if (level % 2 === 0) expect(heights[level - 1]).toBe(heights[level - 2]);
    else expect(heights[level - 1]).toBeGreaterThan(heights[level - 2]);
  }
  expect(celestialStagLevelLookScale(undefined)).toBeUndefined();
  // Lv7–8 walk art is drawn 195px tall, so it is scaled up to reach 198px.
  expect(celestialStagLevelLookScale(7)! * 195).toBeCloseTo(198);
});
