import { homePetFrameTrack, homePetPlayback } from '../homePetMotion';
import {
  NINE_TAIL_FOX_HOME_FRAME_TRACKS,
  nineTailFoxJumpHeight,
  nineTailFoxFlipRotation,
  nineTailFoxJumpTarget,
} from '../nineTailFoxHome';

it('maps Home clips to the authored pose rows', () => {
  expect(homePetFrameTrack('move')).toEqual([4, 5, 6, 7]);
  expect(homePetFrameTrack('happy')).toEqual([8, 9, 10, 11]);
  expect(homePetFrameTrack('skill')).toEqual([12, 13, 14, 15]);
});

it('paces Home locomotion to match each species anatomy', () => {
  expect(homePetPlayback('white_tiger', 'move', true)).toEqual({
    durationMs: 500,
    loop: true,
  });
  expect(homePetPlayback('black_tortoise', 'move', true)).toEqual({
    durationMs: 980,
    loop: true,
  });
  expect(homePetPlayback('azure_dragon', 'move', true)).toEqual({
    durationMs: 840,
    loop: true,
  });
  expect(homePetPlayback('nine_tail_fox', 'move', true)).toEqual({
    durationMs: 560,
    loop: true,
  });
});

it('keeps signature actions as one-shots and idle poses looping', () => {
  expect(homePetPlayback('phoenix', 'skill', false)).toEqual({
    durationMs: 2200,
    loop: false,
  });
  expect(homePetPlayback('garuda', 'idle', false)).toEqual({
    durationMs: 2200,
    loop: true,
  });
});

it('gives the fox a small hop, playful turn and soft landing poses', () => {
  expect(NINE_TAIL_FOX_HOME_FRAME_TRACKS.jump).toEqual([8, 9, 10, 11]);
  expect(NINE_TAIL_FOX_HOME_FRAME_TRACKS.turn).toEqual([11, 12]);
  expect(NINE_TAIL_FOX_HOME_FRAME_TRACKS.land).toEqual([14, 15]);
});

it('keeps the fox jump destination inside both phone edges', () => {
  expect(nineTailFoxJumpTarget(100, 230)).toBe(100);
  expect(nineTailFoxJumpTarget(225, 230)).toBe(225);
  expect(nineTailFoxJumpTarget(250, 230)).toBe(230);
  expect(nineTailFoxJumpTarget(-5, 230)).toBe(0);
});

it('sets the fox hop to the requested 90px height', () => {
  expect(nineTailFoxJumpHeight(120)).toBe(90);
});

it('turns the fox through a full playful flip in its travel direction', () => {
  expect(nineTailFoxFlipRotation(1)).toBe(-360);
  expect(nineTailFoxFlipRotation(-1)).toBe(360);
});

it('holds the Wolf muzzle-up howl frame in its signature action', () => {
  expect(homePetFrameTrack('skill', 'rune_wolf')).toEqual([
    12, 13, 13, 13, 14, 15,
  ]);
  expect(homePetPlayback('rune_wolf', 'skill', false).loop).toBe(false);
});
