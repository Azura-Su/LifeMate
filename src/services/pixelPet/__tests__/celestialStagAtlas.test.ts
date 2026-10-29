import {
  CELESTIAL_STAG_FLAP_CYCLE_MS,
  CELESTIAL_STAG_HOME_PHASE_DURATION,
  celestialStagFlightPlayback,
  celestialStagGardenFrameAt,
  CELESTIAL_STAG_GARDEN_GROWTH_MS,
} from '../celestialStagAtlas';

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
