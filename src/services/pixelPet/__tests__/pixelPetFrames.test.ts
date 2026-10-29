import { PIXEL_PET_SPECIES } from '../pixelPetCatalog';
import { PIXEL_CLIPS } from '../pixelPetRig';
import {
  PET_ATLAS,
  petFrameAt,
  petFrameBlendAt,
  petMovementLabel,
  petPlayback,
} from '../pixelPetFrames';

it('samples every clip inside the 16 atlas cells, including timeline boundaries', () => {
  for (const clip of Object.keys(PIXEL_CLIPS) as (keyof typeof PIXEL_CLIPS)[])
    for (const loop of [false, true])
      for (const time of [-1, 0, 0.1, 0.5, 0.9999, 1, 2]) {
        const frame = petFrameAt(clip, time, loop);
        expect(Number.isInteger(frame)).toBe(true);
        expect(frame).toBeGreaterThanOrEqual(0);
        expect(frame).toBeLessThan(PET_ATLAS.columns * PET_ATLAS.rows);
      }
});

it('holds all four locomotion poses evenly at 10fps and repeats a complete Home cycle', () => {
  expect(petPlayback('move', true)).toEqual({ durationMs: 400, loop: true });
  expect(
    [0, 0.25, 0.5, 0.75, 1].map((t) => petFrameAt('move', t, true)),
  ).toEqual([4, 5, 6, 7, 4]);
});

it('keeps the duration and completion behavior of all existing one-shot clips', () => {
  for (const clip of Object.keys(PIXEL_CLIPS) as (keyof typeof PIXEL_CLIPS)[])
    expect(petPlayback(clip, false)).toEqual({
      durationMs: PIXEL_CLIPS[clip].durationMs,
      loop: PIXEL_CLIPS[clip].loop,
    });
  expect(petFrameAt('move', 1, false)).toBe(0);
  expect(petFrameAt('happy', 0, false)).toBe(8);
  expect(petFrameAt('skill', 0, false)).toBe(12);
});

it('offers wing movement only to the five species whose art has wings', () => {
  expect(
    PIXEL_PET_SPECIES.filter((p) => petMovementLabel(p) === 'Vỗ cánh')
      .map((p) => p.id)
      .sort(),
  ).toEqual(['alicorn', 'garuda', 'lac_bird', 'phoenix', 'sphinx']);
  expect(
    petMovementLabel(PIXEL_PET_SPECIES.find((p) => p.id === 'white_tiger')!),
  ).toBe('Đi dạo');
  expect(
    petMovementLabel(PIXEL_PET_SPECIES.find((p) => p.id === 'azure_dragon')!),
  ).toBe('Lượn mình');
});

it('blends through most of each pose interval, preserving boundaries and one-shot completion', () => {
  // Looping move: 4 poses in 400ms, so each pose spans 0.25 of progress.
  expect(petFrameBlendAt('move', 0.04, true)).toEqual({ from: 4, to: 5, mix: 0 });
  const early = petFrameBlendAt('move', 0.05, true);
  const middle = petFrameBlendAt('move', 0.125, true);
  expect(early.mix).toBeGreaterThan(0);
  expect(middle.mix).toBeGreaterThan(early.mix);
  const tail = petFrameBlendAt('move', 0.24, true);
  expect(tail.from).toBe(4);
  expect(tail.to).toBe(5);
  expect(tail.mix).toBeGreaterThan(0.8);
  expect(petFrameBlendAt('move', 0.99, true).to).toBe(4);
  // One-shot clips hold their last pose instead of wrapping.
  expect(petFrameBlendAt('happy', 0.99, false)).toMatchObject({ from: 11, to: 11 });
  for (const clip of Object.keys(PIXEL_CLIPS) as (keyof typeof PIXEL_CLIPS)[])
    for (const t of [0, 0.3, 0.7, 1])
      expect(petFrameBlendAt(clip, t, false).from).toBe(petFrameAt(clip, t, false));
});
