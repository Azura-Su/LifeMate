import { PIXEL_PET_SPECIES } from '../pixelPetCatalog';
import { PIXEL_CLIPS } from '../pixelPetRig';
import {
  PET_ATLAS,
  petFrameAt,
  petFrameBlendAt,
  petDragFallbackFrameTrack,
  petDragPoseAt,
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

it('gives every fall archetype a distinct, deterministic pixel pose', () => {
  const styles = [
    'fall',
    'coil',
    'flop',
    'tentacle',
    'shell',
    'wings',
  ] as const;
  const poses = styles.map((style) => petDragPoseAt(style, 0.25));
  expect(new Set(poses.map((pose) => JSON.stringify(pose))).size).toBe(
    styles.length,
  );
  expect(styles.map((style) => petDragPoseAt(style, 0.25))).toEqual(poses);
  for (const pose of poses) {
    expect(pose.scaleX).toBeGreaterThan(0.8);
    expect(pose.scaleX).toBeLessThan(1.2);
    expect(pose.scaleY).toBeGreaterThan(0.8);
    expect(pose.scaleY).toBeLessThan(1.2);
  }
});

it('eases through explicit fall keyframes and settles back to neutral', () => {
  expect(petDragPoseAt('fall', 0.2).rotateDeg).toBe(-15);
  expect(petDragPoseAt('fall', 0.4).rotateDeg).toBe(9);
  expect(petDragPoseAt('fall', 0.1).rotateDeg).toBe(-9.5);
  expect(petDragPoseAt('fall', 1)).toEqual({
    translateY: 0,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
  });
});

it('selects fall frames by body archetype and uses only cells from the pet atlas', () => {
  const styles = [
    'fall',
    'coil',
    'flop',
    'tentacle',
    'shell',
    'wings',
  ] as const;
  const tracks = styles.map((style) =>
    petDragFallbackFrameTrack('fall', style),
  );
  expect(new Set(tracks.map((track) => JSON.stringify(track))).size).toBe(
    styles.length,
  );
  for (const track of tracks) {
    expect(track!.length).toBeGreaterThan(3);
    expect(track!.every((frame) => frame >= 0 && frame < 16)).toBe(true);
  }
  expect(petDragFallbackFrameTrack('lifted', 'fall')).toEqual([8, 9, 10, 11]);
  expect(petDragFallbackFrameTrack('roam', 'fall')).toBeUndefined();
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
  expect(petFrameBlendAt('move', 0.04, true)).toEqual({
    from: 4,
    to: 5,
    mix: 0,
  });
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
  expect(petFrameBlendAt('happy', 0.99, false)).toMatchObject({
    from: 11,
    to: 11,
  });
  for (const clip of Object.keys(PIXEL_CLIPS) as (keyof typeof PIXEL_CLIPS)[])
    for (const t of [0, 0.3, 0.7, 1])
      expect(petFrameBlendAt(clip, t, false).from).toBe(
        petFrameAt(clip, t, false),
      );
});
