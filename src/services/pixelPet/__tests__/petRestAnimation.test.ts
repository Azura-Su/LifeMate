import {
  PET_REST_DURATION_MS,
  PET_REST_FRAMES,
  PET_WAKE_DURATION_MS,
  PET_WAKE_FRAMES,
  petRestPlayback,
} from '../petRestAnimation';

it('plays every authored rest frame once in both sleep and wake directions', () => {
  expect(PET_REST_FRAMES).toEqual(Array.from({ length: 16 }, (_, i) => i));
  expect(PET_WAKE_FRAMES).toEqual([...PET_REST_FRAMES].reverse());
  expect(petRestPlayback('sleeping')).toEqual({
    durationMs: PET_REST_DURATION_MS,
    loop: false,
  });
  expect(petRestPlayback('waking')).toEqual({
    durationMs: PET_WAKE_DURATION_MS,
    loop: false,
  });
});
