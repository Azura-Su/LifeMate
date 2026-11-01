import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  PIXEL_PET_BY_ID,
  PIXEL_PET_SPECIES,
} from '../../../services/pixelPet/pixelPetCatalog';
import { PixelPetSprite } from '../PixelPetSprite';
import { celestialStagDetailMotionKey } from '../CelestialStagAtlas';
import { PixelPetAtlas } from '../PixelPetAtlas';
import {
  petDragFallbackClip,
  petDragFrameTrack,
} from '../../../services/pixelPet/pixelPetFrames';
import {
  CELESTIAL_STAG_LANDING_ATLAS,
  CELESTIAL_STAG_LV12_WALK_ATLAS,
  CELESTIAL_STAG_LV12_RUN_ATLAS,
  CELESTIAL_STAG_LV12_HOP_ATLAS,
  CELESTIAL_STAG_LV12_SLEEP_ATLAS,
  CELESTIAL_STAG_LV34_WALK_ATLAS,
  CELESTIAL_STAG_SLEEP_ATLAS,
  CELESTIAL_STAG_LV34_SLEEP_ATLAS,
  CELESTIAL_STAG_LV1718_FLIGHT_ATLAS,
  CELESTIAL_STAG_LV34_FLIGHT_ATLAS,
  CELESTIAL_STAG_LV78_WALK_ATLAS,
  CELESTIAL_STAG_LV78_RUN_ATLAS,
  CELESTIAL_STAG_LV78_FLIGHT_ATLAS,
  CELESTIAL_STAG_LV78_SLEEP_ATLAS,
  CELESTIAL_STAG_LV910_WALK_ATLAS,
  CELESTIAL_STAG_LV910_RUN_ATLAS,
  CELESTIAL_STAG_LV910_FLIGHT_ATLAS,
  CELESTIAL_STAG_LV910_SLEEP_ATLAS,
  CELESTIAL_STAG_LV1314_WALK_ATLAS,
  CELESTIAL_STAG_LV1516_WALK_ATLAS,
  CELESTIAL_STAG_LV1718_WALK_ATLAS,
  CELESTIAL_STAG_LV1718_RUN_ATLAS,
  CELESTIAL_STAG_LV1718_SLEEP_ATLAS,
  CELESTIAL_STAG_LV1516_RUN_ATLAS,
  CELESTIAL_STAG_LV1516_FLIGHT_ATLAS,
  CELESTIAL_STAG_LV1516_SLEEP_ATLAS,
  CELESTIAL_STAG_LV1314_FLIGHT_ATLAS,
  CELESTIAL_STAG_LV1314_SLEEP_ATLAS,
  CELESTIAL_STAG_LV1920_WALK_ATLAS,
  CELESTIAL_STAG_LV1920_RUN_ATLAS,
  CELESTIAL_STAG_LV1920_FLIGHT_ATLAS,
  CELESTIAL_STAG_LV1920_SLEEP_ATLAS,
  PET_DRAG_ATLAS_READY,
  PET_DRAG_ATLASES,
  PET_HOME_ATLASES,
  PET_HOME_MOVE_ATLASES,
  PET_REST_ATLASES,
  CELESTIAL_STAG_LV56_WALK_ATLAS,
  CELESTIAL_STAG_LV56_RUN_ATLAS,
  CELESTIAL_STAG_LV56_FLIGHT_ATLAS,
  CELESTIAL_STAG_LV56_SLEEP_ATLAS,
  CELESTIAL_STAG_LV1112_WALK_ATLAS,
  CELESTIAL_STAG_LV1112_RUN_ATLAS,
  CELESTIAL_STAG_LV1112_FLIGHT_ATLAS,
  CELESTIAL_STAG_LV1112_SLEEP_ATLAS,
} from '../petArt';
import {
  CELESTIAL_STAG_LANDING_FRAMES,
  celestialStagLevelLookScale,
} from '../../../services/pixelPet/celestialStagAtlas';
import * as petPlayback from '../usePetPlayback';

it.each([
  ['walkToFlight', 'walk', CELESTIAL_STAG_LV12_WALK_ATLAS, [0, 1, 2, 3, 4, 5, 6, 7], true],
  ['runA', 'run', CELESTIAL_STAG_LV12_RUN_ATLAS, [0, 1, 2, 3, 4, 5, 6, 7], true],
  ['takeoff', 'run', CELESTIAL_STAG_LV12_HOP_ATLAS, Array.from({ length: 16 }, (_, i) => i), false],
  ['settle', 'walk', CELESTIAL_STAG_LV12_SLEEP_ATLAS, Array.from({ length: 12 }, (_, i) => i), false],
  ['sleep', 'walk', CELESTIAL_STAG_LV12_SLEEP_ATLAS, [12, 13, 14, 15], true],
] as const)(
  'uses the level-one/two Stag %s animation from its authored atlas',
  (homeStagPhase, pace, source, frameTrack, loop) => {
    render(
      <PixelPetSprite
        species={PIXEL_PET_BY_ID.celestial_stag}
        stage="hatchling"
        level={2}
        size={120}
        clip="move"
        loopMovement
        homeStagPhase={homeStagPhase}
        pace={pace}
        walking={homeStagPhase !== 'takeoff'}
        sleeping={homeStagPhase === 'sleep'}
      />,
    );

    expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({
      source,
      frameTrack,
      loop,
      blendFrames: false,
    });
  },
);

it.each([3, 4])('uses the level 3–4 Stag atlas at level %i', (level) => {
  render(
    <PixelPetSprite
      species={PIXEL_PET_BY_ID.celestial_stag}
      stage={level === 3 ? 'hatchling' : 'juvenile'}
      level={level}
      size={120}
      clip="move"
      loopMovement
      homeStagPhase="walkToFlight"
      pace="walk"
      walking
    />,
  );

  expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({
    source: CELESTIAL_STAG_LV34_WALK_ATLAS,
    loop: true,
  });
});

it.each([13, 14])('uses the Lv13–14 sleep transition and breathing atlas at level %i', (level) => {
  const renderPhase = (phase: 'settle' | 'sleep') => render(
    <PixelPetSprite species={PIXEL_PET_BY_ID.celestial_stag} stage="ascended" level={level}
      size={120} clip="move" loopMovement homeStagPhase={phase} pace="walk"
      walking sleeping={phase === 'sleep'} />,
  );
  const settle = renderPhase('settle');
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({
    source: CELESTIAL_STAG_LV1314_SLEEP_ATLAS,
    frameTrack: Array.from({ length: 12 }, (_, index) => index),
    loop: false,
  });
  settle.unmount();
  renderPhase('sleep');
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({
    source: CELESTIAL_STAG_LV1314_SLEEP_ATLAS,
    frameTrack: [12, 13, 14, 15],
    loop: true,
  });
});

it.each([7, 8])('uses the shared Lv7–8 atlas set at level %i', (level) => {
  const view = render(
    <PixelPetSprite species={PIXEL_PET_BY_ID.celestial_stag}
      stage={level === 7 ? 'juvenile' : 'ascended'} level={level} size={120}
      clip="move" loopMovement homeStagPhase="walkToFlight" pace="walk" walking />,
  );
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props.source).toBe(CELESTIAL_STAG_LV78_WALK_ATLAS);
  view.unmount();

  render(
    <PixelPetSprite species={PIXEL_PET_BY_ID.celestial_stag}
      stage={level === 7 ? 'juvenile' : 'ascended'} level={level} size={120}
      clip="move" loopMovement homeStagPhase="runA" pace="run" walking />,
  );
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props.source).toBe(CELESTIAL_STAG_LV78_RUN_ATLAS);
});

it('uses Lv7–8 flight and settle/sleep atlases', () => {
  const renderPhase = (phase: 'takeoff' | 'flap' | 'glide' | 'landing' | 'settle' | 'sleep') => render(
    <PixelPetSprite species={PIXEL_PET_BY_ID.celestial_stag} stage="juvenile" level={7}
      size={120} clip="fly" loopMovement homeStagPhase={phase} flightPhase={phase === 'settle' || phase === 'sleep' ? undefined : phase}
      walking={phase === 'settle' || phase === 'sleep'} sleeping={phase === 'sleep'} />,
  );
  for (const phase of ['takeoff', 'flap', 'glide', 'landing'] as const) {
    const view = renderPhase(phase);
    expect(screen.UNSAFE_getByType(PixelPetAtlas).props.source).toBe(CELESTIAL_STAG_LV78_FLIGHT_ATLAS);
    view.unmount();
  }
  for (const phase of ['settle', 'sleep'] as const) {
    const view = renderPhase(phase);
    expect(screen.UNSAFE_getByType(PixelPetAtlas).props.source).toBe(CELESTIAL_STAG_LV78_SLEEP_ATLAS);
    view.unmount();
  }
});

it.each([9, 10])('uses Lv9–10 authored walk and rest atlases at level %i', (level) => {
  const props = { species: PIXEL_PET_BY_ID.celestial_stag, stage: 'ascended' as const, level, size: 120, clip: 'move' as const, loopMovement: true };
  const view = render(<PixelPetSprite {...props} homeStagPhase="walkToFlight" pace="walk" walking />);
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props.source).toBe(CELESTIAL_STAG_LV910_WALK_ATLAS);
  view.unmount();
  const runView = render(<PixelPetSprite {...props} homeStagPhase="runA" pace="run" walking />);
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props.source).toBe(CELESTIAL_STAG_LV910_RUN_ATLAS);
  runView.unmount();
  const restView = render(<PixelPetSprite {...props} homeStagPhase="settle" pace="walk" walking />);
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({ source: CELESTIAL_STAG_LV910_SLEEP_ATLAS, frameTrack: Array.from({ length: 12 }, (_, i) => i), loop: false });
  restView.unmount();
  render(<PixelPetSprite {...props} homeStagPhase="sleep" pace="walk" walking sleeping />);
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({ source: CELESTIAL_STAG_LV910_SLEEP_ATLAS, frameTrack: [12, 13, 14, 15], loop: true });
});

it('keeps Lv8 on the existing atlas set', () => {
  render(<PixelPetSprite species={PIXEL_PET_BY_ID.celestial_stag} stage="ascended" level={8} size={120} clip="move" loopMovement homeStagPhase="walkToFlight" pace="walk" walking />);
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props.source).toBe(CELESTIAL_STAG_LV78_WALK_ATLAS);
});

it('uses the authored Lv9–10 flight atlas across the four Home flight phases', () => {
  for (const phase of ['takeoff', 'flap', 'glide', 'landing'] as const) {
    const view = render(<PixelPetSprite species={PIXEL_PET_BY_ID.celestial_stag} stage="ascended" level={9} size={120} clip="fly" loopMovement homeStagPhase={phase} flightPhase={phase} walking={false} />);
    expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({
      source: CELESTIAL_STAG_LV910_FLIGHT_ATLAS,
      frameTrack: phase === 'takeoff' ? [0, 1, 2, 3] : phase === 'flap' ? [4, 5, 6, 7] : phase === 'glide' ? [8, 9, 10, 11] : [12, 13, 14, 15],
    });
    view.unmount();
  }
});

it.each([13, 14])('uses the level 13–14 walk atlas at level %i', (level) => {
  render(
    <PixelPetSprite
      species={PIXEL_PET_BY_ID.celestial_stag}
      stage="ascended"
      level={level}
      size={120}
      clip="move"
      loopMovement
      homeStagPhase="walkToFlight"
      pace="walk"
      walking
    />,
  );

  expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({
    source: CELESTIAL_STAG_LV1314_WALK_ATLAS,
    frameTrack: Array.from({ length: 16 }, (_, index) => index),
    loop: true,
  });
});

it.each([13, 14])('runs on the level 13–14 walk atlas, not legacy art, at level %i', (level) => {
  render(
    <PixelPetSprite species={PIXEL_PET_BY_ID.celestial_stag} stage="ascended"
      level={level} size={120} clip="move" loopMovement
      homeStagPhase="runA" pace="run" walking />,
  );
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({
    source: CELESTIAL_STAG_LV1314_WALK_ATLAS,
    loop: true,
  });
});

it.each([17, 18])('lies down once at Lv%i and keeps one canvas size into sleep', (level) => {
  const props = {
    species: PIXEL_PET_BY_ID.celestial_stag, stage: 'ascended' as const, level,
    size: 120, clip: 'move' as const, loopMovement: true, pace: 'walk' as const,
    walking: true, gaitCycleDurationMs: 640, motionCanvasScale: 7 / 6,
  };
  const settle = render(<PixelPetSprite {...props} homeStagPhase="settle" />);
  const settleAtlas = screen.UNSAFE_getByType(PixelPetAtlas).props;
  expect(settleAtlas).toMatchObject({
    source: CELESTIAL_STAG_LV1718_SLEEP_ATLAS,
    frameTrack: Array.from({ length: 8 }, (_, i) => i),
    loop: false,
    size: 120,
  });
  settle.unmount();
  render(<PixelPetSprite {...props} homeStagPhase="sleep" sleeping />);
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({
    source: CELESTIAL_STAG_LV1718_SLEEP_ATLAS,
    frameTrack: Array.from({ length: 8 }, (_, i) => i + 8),
    loop: true,
    size: settleAtlas.size,
  });
});

it.each([
  [3, 'hatchling'],
  [4, 'juvenile'],
] as const)('draws the repacked Lv%i atlas at the shared Lv3–4 size', (level, stage) => {
  const scale = celestialStagLevelLookScale(level);
  expect(scale).toBeCloseTo(165 / 224);
  render(
    <PixelPetSprite species={PIXEL_PET_BY_ID.celestial_stag} stage={stage}
      level={level} size={120} clip="move" loopMovement
      homeStagPhase="walkToFlight" pace="walk" walking />,
  );
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props.source).toBe(CELESTIAL_STAG_LV34_WALK_ATLAS);
  expect(JSON.stringify(screen.toJSON())).toContain(`{"scale":${scale}}`);
});

describe('Stag detail screens follow the pet level', () => {
  const detail = (props: Record<string, unknown>) => {
    const view = render(
      <PixelPetSprite species={PIXEL_PET_BY_ID.celestial_stag} stage="hatchling"
        level={3} size={240} clip="idle" loopMovement={false} {...props} />,
    );
    const atlas = screen.UNSAFE_getByType(PixelPetAtlas).props;
    view.unmount();
    return atlas;
  };

  it('rests lying down on the level sleep loop', () => {
    expect(detail({ sleeping: true })).toMatchObject({
      source: CELESTIAL_STAG_LV34_SLEEP_ATLAS, frameTrack: [12, 13, 14, 15], loop: true,
      columns: 4, rows: 4,
    });
    expect(detail({ sleeping: true, level: 17, stage: 'ascended' })).toMatchObject({
      source: CELESTIAL_STAG_LV1718_SLEEP_ATLAS, frameTrack: Array.from({ length: 8 }, (_, i) => i + 8),
    });
  });

  it('plays the level flight art for the wing, flight and joy buttons', () => {
    expect(detail({ clip: 'move', loopMovement: true })).toMatchObject({
      source: CELESTIAL_STAG_LV34_FLIGHT_ATLAS, frameTrack: [4, 5, 6, 7],
    });
    expect(detail({ clip: 'fly', loopMovement: true, flightPhase: 'glide' }).frameTrack)
      .toEqual([4, 5, 6, 7, 4, 5, 6, 7, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(detail({ clip: 'happy', expression: 'excited' })).toMatchObject({
      source: CELESTIAL_STAG_LV34_FLIGHT_ATLAS, frameTrack: [0, 1, 2, 3, 12, 13, 14, 15],
    });
    expect(detail({ clip: 'spin', level: 1 })).toMatchObject({
      source: CELESTIAL_STAG_LV12_HOP_ATLAS, frameTrack: Array.from({ length: 16 }, (_, i) => i),
    });
  });

  it('stands on the level walk pose when awake and idle', () => {
    expect(detail({ clip: 'idle' })).toMatchObject({ source: CELESTIAL_STAG_LV34_WALK_ATLAS, frameTrack: [0] });
  });

  it('keeps legacy art only when the level is unknown', () => {
    expect(detail({ sleeping: true, level: undefined, stage: 'juvenile' }).source).toBe(CELESTIAL_STAG_SLEEP_ATLAS);
  });
});

it.each([
  [5, 'juvenile', CELESTIAL_STAG_LV56_WALK_ATLAS, CELESTIAL_STAG_LV56_RUN_ATLAS, CELESTIAL_STAG_LV56_FLIGHT_ATLAS, CELESTIAL_STAG_LV56_SLEEP_ATLAS],
  [6, 'juvenile', CELESTIAL_STAG_LV56_WALK_ATLAS, CELESTIAL_STAG_LV56_RUN_ATLAS, CELESTIAL_STAG_LV56_FLIGHT_ATLAS, CELESTIAL_STAG_LV56_SLEEP_ATLAS],
  [11, 'ascended', CELESTIAL_STAG_LV1112_WALK_ATLAS, CELESTIAL_STAG_LV1112_RUN_ATLAS, CELESTIAL_STAG_LV1112_FLIGHT_ATLAS, CELESTIAL_STAG_LV1112_SLEEP_ATLAS],
  [12, 'ascended', CELESTIAL_STAG_LV1112_WALK_ATLAS, CELESTIAL_STAG_LV1112_RUN_ATLAS, CELESTIAL_STAG_LV1112_FLIGHT_ATLAS, CELESTIAL_STAG_LV1112_SLEEP_ATLAS],
] as const)('plays the complete Lv%i set on Home, while dragged and in details', (level, stage, walk, run, flight, sleep) => {
  const base = {
    species: PIXEL_PET_BY_ID.celestial_stag, stage, level, size: 120, loopMovement: true,
  } as const;
  const atlas = (element: Parameters<typeof render>[0]) => {
    const view = render(element);
    const props = screen.UNSAFE_getByType(PixelPetAtlas).props;
    view.unmount();
    return props;
  };
  const sixteen = Array.from({ length: 16 }, (_, i) => i);
  expect(atlas(<PixelPetSprite {...base} clip="move" homeStagPhase="walkToFlight" pace="walk" walking />))
    .toMatchObject({ source: walk, frameTrack: sixteen, loop: true });
  expect(atlas(<PixelPetSprite {...base} clip="move" homeStagPhase="runA" pace="run" walking />))
    .toMatchObject({ source: run, frameTrack: sixteen });
  for (const [phase, frames] of [
    ['takeoff', [0, 1, 2, 3]], ['flap', [4, 5, 6, 7]], ['glide', [8, 9, 10, 11]], ['landing', [12, 13, 14, 15]],
  ] as const)
    expect(atlas(<PixelPetSprite {...base} clip="fly" homeStagPhase={phase} flightPhase={phase} walking={false} />))
      .toMatchObject({ source: flight, frameTrack: frames, columns: 4, rows: 4 });
  expect(atlas(<PixelPetSprite {...base} clip="move" homeStagPhase="settle" pace="walk" walking />))
    .toMatchObject({ source: sleep, frameTrack: Array.from({ length: 12 }, (_, i) => i), loop: false });
  expect(atlas(<PixelPetSprite {...base} clip="move" homeStagPhase="sleep" walking sleeping />))
    .toMatchObject({ source: sleep, frameTrack: [12, 13, 14, 15], loop: true });
  expect(atlas(<PixelPetSprite {...base} clip="move" homeStagPhase="runA" dragPhase="lifted" fallStyle="wings" />))
    .toMatchObject({ source: flight, frameTrack: [4, 5, 6, 7] });
  expect(atlas(<PixelPetSprite {...base} clip="idle" loopMovement={false} sleeping />))
    .toMatchObject({ source: sleep, frameTrack: [12, 13, 14, 15] });
});

it.each([15, 16])('uses the level 15–16 walk atlas at level %i', (level) => {
  render(
    <PixelPetSprite species={PIXEL_PET_BY_ID.celestial_stag} stage="ascended"
      level={level} size={120} clip="move" loopMovement
      homeStagPhase="walkToFlight" pace="walk" walking />,
  );
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({
    source: CELESTIAL_STAG_LV1516_WALK_ATLAS,
    frameTrack: Array.from({ length: 16 }, (_, index) => index),
    loop: true,
  });
});

it('uses the level 15–16 run, flight, and sleep atlases', () => {
  const renderPhase = (phase: 'runA' | 'takeoff' | 'flap' | 'glide' | 'landing' | 'settle' | 'sleep') => render(
    <PixelPetSprite species={PIXEL_PET_BY_ID.celestial_stag} stage="ascended" level={15}
      size={120} clip={phase === 'takeoff' || phase === 'flap' || phase === 'glide' || phase === 'landing' ? 'fly' : 'move'}
      loopMovement homeStagPhase={phase} flightPhase={phase === 'takeoff' || phase === 'flap' || phase === 'glide' || phase === 'landing' ? phase : undefined}
      pace="run" walking={phase === 'settle' || phase === 'sleep'} sleeping={phase === 'sleep'} />,
  );
  const expected = [
    ['runA', CELESTIAL_STAG_LV1516_RUN_ATLAS],
    ['takeoff', CELESTIAL_STAG_LV1516_FLIGHT_ATLAS],
    ['flap', CELESTIAL_STAG_LV1516_FLIGHT_ATLAS],
    ['glide', CELESTIAL_STAG_LV1516_FLIGHT_ATLAS],
    ['landing', CELESTIAL_STAG_LV1516_FLIGHT_ATLAS],
    ['settle', CELESTIAL_STAG_LV1516_SLEEP_ATLAS],
    ['sleep', CELESTIAL_STAG_LV1516_SLEEP_ATLAS],
  ] as const;
  for (const [phase, source] of expected) {
    const view = renderPhase(phase);
    expect(screen.UNSAFE_getByType(PixelPetAtlas).props.source).toBe(source);
    view.unmount();
  }
  const settle = renderPhase('settle');
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props.frameTrack).toEqual(
    Array.from({ length: 12 }, (_, index) => index),
  );
  settle.unmount();
  const sleep = renderPhase('sleep');
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props.frameTrack).toEqual([12, 13, 14, 15]);
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props.loop).toBe(true);
  sleep.unmount();
});

it.each([14, 17])('does not select the level 15–16 atlases at level %i', (level) => {
  render(
    <PixelPetSprite species={PIXEL_PET_BY_ID.celestial_stag} stage="ascended"
      level={level} size={120} clip="move" loopMovement
      homeStagPhase="walkToFlight" pace="walk" walking />,
  );
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props.source).not.toBe(CELESTIAL_STAG_LV1516_WALK_ATLAS);
});

it.each([
  ['takeoff', [0, 1, 2, 3], false],
  ['flap', [4, 5, 6, 7], true],
  ['glide', [8, 9, 10, 11], false],
  ['landing', [12, 13, 14, 15], false],
] as const)('uses the Lv13–14 %s flight track', (phase, frameTrack, loop) => {
  render(
    <PixelPetSprite species={PIXEL_PET_BY_ID.celestial_stag} stage="ascended" level={13}
      size={120} clip="fly" loopMovement homeStagPhase={phase} flightPhase={phase}
      pace="run" walking={false} />,
  );
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({
    source: CELESTIAL_STAG_LV1314_FLIGHT_ATLAS,
    frameTrack,
    loop,
  });
});

it.each([19, 20])('uses Lv19–20 authored ground atlases at level %i', (level) => {
  const stage = 'ascended' as const;
  const view = render(
    <PixelPetSprite species={PIXEL_PET_BY_ID.celestial_stag} stage={stage} level={level}
      size={120} clip="move" loopMovement homeStagPhase="walkToFlight"
      pace="walk" walking />,
  );
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({
    source: CELESTIAL_STAG_LV1920_WALK_ATLAS,
    frameTrack: Array.from({ length: 16 }, (_, index) => index),
    loop: true,
  });
  view.unmount();

  render(
    <PixelPetSprite species={PIXEL_PET_BY_ID.celestial_stag} stage={stage} level={level}
      size={120} clip="move" loopMovement homeStagPhase="runA"
      pace="run" walking />,
  );
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props.source).toBe(CELESTIAL_STAG_LV1920_RUN_ATLAS);
});

it.each([17, 18])('uses dedicated Lv17–18 walk and run atlases at level %i', (level) => {
  const view = render(
    <PixelPetSprite species={PIXEL_PET_BY_ID.celestial_stag} stage="ascended" level={level}
      size={120} clip="move" loopMovement homeStagPhase="walkToFlight"
      pace="walk" walking />,
  );
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props.source).toBe(CELESTIAL_STAG_LV1718_WALK_ATLAS);
  view.unmount();

  render(
    <PixelPetSprite species={PIXEL_PET_BY_ID.celestial_stag} stage="ascended" level={level}
      size={120} clip="move" loopMovement homeStagPhase="runA"
      pace="run" walking={false} />,
  );
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props.source).toBe(CELESTIAL_STAG_LV1718_RUN_ATLAS);
});

it('keeps Lv16 on Lv15–16 art and Lv19 on Lv19–20 art', () => {
  const lv16 = render(
    <PixelPetSprite species={PIXEL_PET_BY_ID.celestial_stag} stage="ascended" level={16}
      size={120} clip="move" loopMovement homeStagPhase="walkToFlight"
      pace="walk" walking />,
  );
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props.source).toBe(CELESTIAL_STAG_LV1516_WALK_ATLAS);
  lv16.unmount();

  render(
    <PixelPetSprite species={PIXEL_PET_BY_ID.celestial_stag} stage="ascended" level={19}
      size={120} clip="move" loopMovement homeStagPhase="walkToFlight"
      pace="walk" walking />,
  );
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props.source).toBe(CELESTIAL_STAG_LV1920_WALK_ATLAS);
});

it.each([17, 18])('uses the Lv17–18 flight and sleep atlases at Lv%i', (level) => {
  for (const [phase, source, frameTrack] of [
    ['takeoff', CELESTIAL_STAG_LV1718_FLIGHT_ATLAS, [0, 1, 2, 3]],
    ['flap', CELESTIAL_STAG_LV1718_FLIGHT_ATLAS, [4, 5, 6, 7]],
    ['glide', CELESTIAL_STAG_LV1718_FLIGHT_ATLAS, [8, 9, 10, 11]],
    // Off-model authored landing frames 14–16 are never shown.
    ['landing', CELESTIAL_STAG_LV1718_FLIGHT_ATLAS, [12, 12, 12, 0]],
    ['settle', CELESTIAL_STAG_LV1718_SLEEP_ATLAS, Array.from({ length: 8 }, (_, i) => i)],
    ['sleep', CELESTIAL_STAG_LV1718_SLEEP_ATLAS, Array.from({ length: 8 }, (_, i) => i + 8)],
  ] as const) {
    const view = render(
      <PixelPetSprite species={PIXEL_PET_BY_ID.celestial_stag} stage="ascended" level={level}
        size={120} clip={phase === 'settle' || phase === 'sleep' ? 'move' : 'fly'}
        loopMovement homeStagPhase={phase}
        flightPhase={phase === 'settle' || phase === 'sleep' ? undefined : phase}
        walking={phase === 'settle' || phase === 'sleep'} sleeping={phase === 'sleep'} />,
    );
    expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({ source, frameTrack, columns: 4, rows: 4 });
    view.unmount();
  }
});

it.each([19, 20])('uses authored flight and sleep atlases at Lv%i', (level) => {
  const renderForPhase = (
    phase: 'takeoff' | 'flap' | 'glide' | 'landing' | 'settle' | 'sleep',
  ) => render(
    <PixelPetSprite species={PIXEL_PET_BY_ID.celestial_stag} stage="ascended" level={level}
      size={120} clip={phase === 'settle' || phase === 'sleep' ? 'move' : 'fly'}
      loopMovement homeStagPhase={phase}
      flightPhase={phase === 'settle' || phase === 'sleep' ? undefined : phase}
      walking={phase === 'settle' || phase === 'sleep'} sleeping={phase === 'sleep'} />,
  );
  for (const [phase, source, frameTrack, loop] of [
    ['takeoff', CELESTIAL_STAG_LV1920_FLIGHT_ATLAS, [0, 1, 2, 3], false],
    ['flap', CELESTIAL_STAG_LV1920_FLIGHT_ATLAS, [4, 5, 6, 7], true],
    ['glide', CELESTIAL_STAG_LV1920_FLIGHT_ATLAS, [8, 9, 10, 11], false],
    ['landing', CELESTIAL_STAG_LV1920_FLIGHT_ATLAS, [12, 13, 14, 15], false],
    ['settle', CELESTIAL_STAG_LV1920_SLEEP_ATLAS, Array.from({ length: 12 }, (_, i) => i), false],
    ['sleep', CELESTIAL_STAG_LV1920_SLEEP_ATLAS, [12, 13, 14, 15], true],
  ] as const) {
    const view = renderForPhase(phase);
    expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({
      source,
      frameTrack,
      loop,
    });
    view.unmount();
  }
});

it('uses the walk loop for run and authored sleep at levels 13–14', () => {
  const renderForPhase = (
    homeStagPhase: 'runA' | 'settle' | 'sleep',
    options: { pace?: 'walk' | 'run'; sleeping?: boolean } = {},
  ) => {
    const view = render(
      <PixelPetSprite
        species={PIXEL_PET_BY_ID.celestial_stag}
        stage="ascended"
        level={13}
        size={120}
      clip="move"
        loopMovement
        homeStagPhase={homeStagPhase}
        pace={options.pace ?? 'run'}
        walking
        sleeping={options.sleeping}
      />,
    );
    return { view, atlas: screen.UNSAFE_getByType(PixelPetAtlas).props };
  };

  let rendered = renderForPhase('runA');
  expect(rendered.atlas.source).toBe(CELESTIAL_STAG_LV1314_WALK_ATLAS);
  rendered.view.unmount();

  rendered = renderForPhase('settle', { pace: 'walk' });
  expect(rendered.atlas.source).toBe(CELESTIAL_STAG_LV1314_SLEEP_ATLAS);
  expect(rendered.atlas.frameTrack).toEqual(Array.from({ length: 12 }, (_, index) => index));
  rendered.view.unmount();

  rendered = renderForPhase('sleep', { pace: 'walk', sleeping: true });
  expect(rendered.atlas.source).toBe(CELESTIAL_STAG_LV1314_SLEEP_ATLAS);
  expect(rendered.atlas.frameTrack).toEqual([12, 13, 14, 15]);
  expect(rendered.atlas.loop).toBe(true);
  rendered.view.unmount();
});

it('selects the level 15–16 walk atlas for level 15', () => {
  render(
    <PixelPetSprite
      species={PIXEL_PET_BY_ID.celestial_stag}
      stage="ascended"
      level={15}
      size={120}
      clip="move"
      loopMovement
      homeStagPhase="walkToFlight"
      pace="walk"
      walking
    />,
  );
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props.source).toBe(
    CELESTIAL_STAG_LV1516_WALK_ATLAS,
  );
});

jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
jest.mock('react-native-worklets', () =>
  jest.requireActual('react-native-worklets/src/mock'),
);

it('renders a stage of a species from the shared rig', () => {
  render(
    <PixelPetSprite
      species={PIXEL_PET_BY_ID.phoenix}
      stage="ascended"
      size={96}
      clip="skill"
    />,
  );
  expect(screen.getByLabelText('Phượng Hoàng, thăng hoa')).toBeTruthy();
});

it('renders Bạch Hổ from its illustrated art', () => {
  render(
    <PixelPetSprite
      species={PIXEL_PET_BY_ID.white_tiger}
      stage="hatchling"
      size={96}
    />,
  );
  expect(screen.getByLabelText('Bạch Hổ, ấu thể')).toBeTruthy();
});

it('renders a species-authored Home atlas for a roaming phoenix', () => {
  render(
    <PixelPetSprite
      species={PIXEL_PET_BY_ID.phoenix}
      stage="juvenile"
      size={120}
      clip="move"
      loopMovement
      homeMotion
    />,
  );

  expect(screen.getByLabelText('Phượng Hoàng, đang chuyển động')).toBeTruthy();
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({
    source: PET_HOME_ATLASES.phoenix,
    frameTrack: [4, 5, 6, 7],
    loop: true,
  });
});

it('uses the 8-pose Qilin gait atlas only during Home movement', () => {
  render(
    <PixelPetSprite
      species={PIXEL_PET_BY_ID.qilin}
      stage="juvenile"
      size={120}
      clip="move"
      loopMovement
      homeMotion
    />,
  );

  expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({
    source: PET_HOME_MOVE_ATLASES.qilin,
    frameTrack: [0, 1, 2, 3, 4, 5, 6, 7],
    loop: true,
    blendFrames: false,
  });
});

it('keeps Qilin expression clips on its original Home atlas', () => {
  render(
    <PixelPetSprite
      species={PIXEL_PET_BY_ID.qilin}
      stage="juvenile"
      size={120}
      clip="happy"
      homeMotion
    />,
  );

  expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({
    source: PET_HOME_ATLASES.qilin,
    frameTrack: [8, 9, 10, 11],
  });
});

it.each(['happy', 'skill'] as const)(
  'delivers the %s Home motion completion to its owning screen',
  (clip) => {
    const onClipEnd = jest.fn();
    const playback = jest.spyOn(petPlayback, 'usePetPlayback');
    try {
      render(
        <PixelPetSprite
          species={PIXEL_PET_BY_ID.rune_wolf}
          stage="juvenile"
          size={120}
          clip={clip}
          homeMotion
          onClipEnd={onClipEnd}
        />,
      );
      expect(playback).toHaveBeenCalledWith(
        expect.objectContaining({
          clip,
          onClipEnd,
          playback: expect.objectContaining({ loop: false }),
        }),
      );
    } finally {
      playback.mockRestore();
    }
  },
);

it('loads the next Home species after the previous atlas failed', () => {
  const view = render(
    <PixelPetSprite
      species={PIXEL_PET_BY_ID.phoenix}
      stage="juvenile"
      size={120}
      clip="move"
      loopMovement
      homeMotion
    />,
  );
  fireEvent(screen.getByTestId('pixel-pet-atlas'), 'error');
  expect(screen.queryByTestId('pixel-pet-atlas')).toBeNull();

  view.rerender(
    <PixelPetSprite
      species={PIXEL_PET_BY_ID.rune_wolf}
      stage="juvenile"
      size={120}
      clip="move"
      loopMovement
      homeMotion
    />,
  );
  expect(screen.getByTestId('pixel-pet-atlas').props.source).toBe(
    PET_HOME_ATLASES.rune_wolf,
  );
});

it('uses the sleep pose instead of the Home movement atlas while resting', () => {
  render(
    <PixelPetSprite
      species={PIXEL_PET_BY_ID.garuda}
      stage="juvenile"
      size={120}
      clip="idle"
      homeMotion
      sleeping
    />,
  );

  expect(screen.getByLabelText('Garuda, đang nghỉ ngơi')).toBeTruthy();
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props.source).toEqual(
    PET_REST_ATLASES.garuda,
  );
});

it('uses the playful new Fox art for preview outside Home', () => {
  render(
    <PixelPetSprite
      species={PIXEL_PET_BY_ID.nine_tail_fox}
      stage="juvenile"
      size={224}
      clip="happy"
      homeMotion
    />,
  );

  expect(screen.getByLabelText('Cửu Vĩ Hồ, đang chuyển động')).toBeTruthy();
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({
    source: PET_HOME_ATLASES.nine_tail_fox,
    frameTrack: [8, 9, 10, 11],
    loop: false,
  });
});

it('renders the Celestial Stag puppet for every clip, including its extras', () => {
  for (const clip of [
    'idle',
    'move',
    'happy',
    'skill',
    'fly',
    'flap',
    'prance',
    'bow',
    'glow',
    'blaze',
    'spin',
  ] as const) {
    const view = render(
      <PixelPetSprite
        species={PIXEL_PET_BY_ID.celestial_stag}
        stage="ascended"
        size={224}
        clip={clip}
        loopMovement={clip === 'move'}
      />,
    );
    expect(screen.getByLabelText('Thiên Dực Linh Lộc, thăng hoa')).toBeTruthy();
    view.unmount();
  }
});

it('keeps atlas pets on the shared rig when handed a puppet-only clip', () => {
  render(
    <PixelPetSprite
      species={PIXEL_PET_BY_ID.phoenix}
      stage="juvenile"
      size={96}
      clip="fly"
    />,
  );
  expect(screen.getByLabelText('Phượng Hoàng, trưởng thành')).toBeTruthy();
});

it('has a dedicated drag atlas for every user pet and the admin Stag', () => {
  expect(Object.keys(PET_DRAG_ATLASES).sort()).toEqual(
    [
      ...PIXEL_PET_SPECIES.map((species) => species.id),
      'celestial_stag',
    ].sort(),
  );
  for (const species of PIXEL_PET_SPECIES) {
    expect(PET_DRAG_ATLAS_READY[species.id]).toBe(true);
    expect(PET_DRAG_ATLASES[species.id]).toBeDefined();
    for (const phase of [
      'lifted',
      'circle',
      'descend',
      'fall',
      'land',
    ] as const) {
      const hasReadyAtlas =
        PET_DRAG_ATLAS_READY[species.id] &&
        (species.id === 'celestial_stag' || !!PET_DRAG_ATLASES[species.id]) &&
        !!petDragFrameTrack(phase);
      const hasFallback = !!petDragFallbackClip(phase);
      expect(hasReadyAtlas || hasFallback).toBe(true);
    }
  }
  expect(PET_DRAG_ATLAS_READY.celestial_stag).toBe(true);
});

it('bundles a 4×4 transparent drag frame atlas for all 15 user pets', () => {
  const allSpecies = [
    ...PIXEL_PET_SPECIES.map((species) => species.id),
    'celestial_stag',
  ];
  for (const speciesId of allSpecies) {
    const file = join(
      __dirname,
      '../../../../assets/pixelPet/animations',
      `drag_${speciesId}.png`,
    );
    const bytes = readFileSync(file);
    expect(bytes.readUInt32BE(16)).toBe(1024);
    expect(bytes.readUInt32BE(20)).toBe(1024);
    expect(bytes[24]).toBe(8);
    expect([3, 6].includes(bytes[25])).toBe(true);
    expect(statSync(file).size).toBeLessThan(700_000);
  }
});

it('bundles a dedicated 4×4 Home motion atlas for all 15 user pets', () => {
  expect(Object.keys(PET_HOME_ATLASES).sort()).toEqual(
    PIXEL_PET_SPECIES.map((species) => species.id).sort(),
  );

  for (const species of PIXEL_PET_SPECIES) {
    const file = join(
      __dirname,
      '../../../../assets/pixelPet/animations',
      `home_${species.id}.png`,
    );
    const bytes = readFileSync(file);
    expect(bytes.readUInt32BE(16)).toBe(1024);
    expect(bytes.readUInt32BE(20)).toBe(1024);
    expect(bytes[24]).toBe(8);
    expect(bytes[25]).toBe(3);
    expect(statSync(file).size).toBeLessThan(500_000);
  }
});

it('bundles the authored 8-pose Qilin Home gait atlas', () => {
  const file = join(
    __dirname,
    '../../../../assets/pixelPet/animations/home_qilin_move.png',
  );
  const bytes = readFileSync(file);
  expect(bytes.readUInt32BE(16)).toBe(1024);
  expect(bytes.readUInt32BE(20)).toBe(1024);
  expect(bytes[24]).toBe(8);
  expect(bytes[25]).toBe(3);
  expect(statSync(file).size).toBeLessThan(700_000);
});

it('bundles the complete Lv19–20 motion atlases below the asset size limit', () => {
  for (const name of ['walk', 'run', 'flight', 'sleep']) {
    const file = join(
      __dirname,
      '../../../../assets/pixelPet/animations',
      `celestial_stag_lv1920_${name}.png`,
    );
    const bytes = readFileSync(file);
    expect(bytes.readUInt32BE(16)).toBe(1280);
    expect(bytes.readUInt32BE(20)).toBe(1280);
    expect(statSync(file).size).toBeLessThan(700_000);
  }
});

it('bundles the complete Lv17–18 walk, run, and sleep atlases below the asset size limit', () => {
  for (const name of ['walk', 'run', 'sleep']) {
    const file = join(
      __dirname,
      '../../../../assets/pixelPet/animations',
      `celestial_stag_lv1718_${name}.png`,
    );
    const bytes = readFileSync(file);
    expect(bytes.readUInt32BE(16)).toBe(1280);
    expect(bytes.readUInt32BE(20)).toBe(1280);
    expect(statSync(file).size).toBeLessThan(700_000);
  }
});

it('renders the existing rig for a drag phase before its atlas is ready', () => {
  render(
    <PixelPetSprite
      species={PIXEL_PET_BY_ID.phoenix}
      stage="juvenile"
      size={96}
      clip="move"
      dragPhase="lifted"
      fallStyle="wings"
    />,
  );
  expect(screen.getByLabelText('Phượng Hoàng, trưởng thành')).toBeTruthy();
});

it('uses Scylla’s dedicated sprite frames during its fall', () => {
  render(
    <PixelPetSprite
      species={PIXEL_PET_BY_ID.scylla}
      stage="juvenile"
      size={96}
      clip="move"
      dragPhase="fall"
      fallStyle="tentacle"
    />,
  );
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({
    source: PET_DRAG_ATLASES.scylla,
    frameTrack: petDragFrameTrack('fall'),
  });
});

it('holds the Stag landing contact pose through the short land phase', () => {
  render(
    <PixelPetSprite
      species={PIXEL_PET_BY_ID.celestial_stag}
      stage="juvenile"
      size={120}
      clip="move"
      loopMovement
      dragPhase="land"
      fallStyle="wings"
      flightPhase="landing"
    />,
  );
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({
    source: CELESTIAL_STAG_LANDING_ATLAS,
    staticFrame: CELESTIAL_STAG_LANDING_FRAMES.at(-1),
    animating: false,
  });
});

it('mounts the reviewed Stag drag atlas only for its authored descent phase', () => {
  render(
    <PixelPetSprite
      species={PIXEL_PET_BY_ID.celestial_stag}
      stage="juvenile"
      size={120}
      clip="move"
      loopMovement
      dragPhase="descend"
      fallStyle="wings"
      flightPhase="landing"
    />,
  );
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({
    source: PET_DRAG_ATLASES.celestial_stag,
    frameTrack: [4, 5, 6, 7],
    loop: false,
  });
});

it.each([
  [1, 'hatchling', CELESTIAL_STAG_LV12_HOP_ATLAS, [2, 4, 6, 4], [8, 9, 10, 11]],
  [3, 'hatchling', CELESTIAL_STAG_LV34_FLIGHT_ATLAS, [4, 5, 6, 7], [15]],
  [4, 'juvenile', CELESTIAL_STAG_LV34_FLIGHT_ATLAS, [4, 5, 6, 7], [15]],
  [7, 'juvenile', CELESTIAL_STAG_LV78_FLIGHT_ATLAS, [4, 5, 6, 7], [15]],
  [10, 'ascended', CELESTIAL_STAG_LV910_FLIGHT_ATLAS, [0, 1, 2, 3], [15]],
  [13, 'ascended', CELESTIAL_STAG_LV1314_FLIGHT_ATLAS, [4, 5, 6, 7], [15]],
  [16, 'ascended', CELESTIAL_STAG_LV1516_FLIGHT_ATLAS, [4, 5, 6, 7], [15]],
  [17, 'ascended', CELESTIAL_STAG_LV1718_FLIGHT_ATLAS, [4, 5, 6, 7], [0]],
  [20, 'ascended', CELESTIAL_STAG_LV1920_FLIGHT_ATLAS, [4, 5, 6, 7], [15]],
] as const)('keeps the Lv%i Stag on its own art while dragged', (level, stage, source, held, landed) => {
  const props = {
    species: PIXEL_PET_BY_ID.celestial_stag, stage, level, size: 120,
    loopMovement: true, fallStyle: 'wings' as const, homeStagPhase: 'runA' as const,
    motionCanvasScale: 7 / 6,
  };
  const lifted = render(<PixelPetSprite {...props} clip="move" dragPhase="lifted" />);
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({
    source, frameTrack: held, loop: true, size: 140,
  });
  lifted.unmount();
  render(<PixelPetSprite {...props} clip="move" dragPhase="land" flightPhase="landing" />);
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({
    source, frameTrack: landed, loop: false,
  });
});

it('uses the reviewed Alicorn flight frames while being lifted and descending', () => {
  render(
    <PixelPetSprite
      species={PIXEL_PET_BY_ID.alicorn}
      stage="juvenile"
      size={120}
      clip="move"
      dragPhase="descend"
      fallStyle="wings"
    />,
  );
  expect(screen.UNSAFE_getByType(PixelPetAtlas).props).toMatchObject({
    source: PET_DRAG_ATLASES.alicorn,
    frameTrack: [4, 5, 6, 7],
    loop: false,
  });
});

it('grows the Home Stag from its hooves and never flashes legacy art between levels', () => {
  render(
    <PixelPetSprite species={PIXEL_PET_BY_ID.celestial_stag} stage="juvenile" level={5}
      size={120} clip="move" loopMovement homeStagPhase="walkToFlight" pace="walk"
      walking motionCanvasScale={7 / 6} />,
  );
  const atlas = screen.UNSAFE_getByType(PixelPetAtlas);
  expect(atlas.props.fallbackWhileLoading).toBe(false);
  const scale = celestialStagLevelLookScale(5)!;
  const transform = JSON.stringify(screen.toJSON());
  // Packed hooves (0.4 of the 140px atlas below centre) land on the tab bar's
  // top edge, 0.31 of the 120px box below centre.
  expect(transform).toContain(`{"scale":${scale}}`);
  const shift = Number(/"translateY":(-?[\d.]+)\},\{"scale"/.exec(transform)![1]);
  expect(shift + 0.4 * 140 * scale).toBeCloseTo(0.31 * 120);
});

it('gives every Stag detail button a distinct motion, so duplicates can be hidden', () => {
  const clips = ['move', 'happy', 'skill', 'fly', 'blaze', 'spin'] as const;
  const keysAt = (level: number) => clips.map((clip) => celestialStagDetailMotionKey(level, clip));
  // Flight levels: Linh hỏa replays the wing-flap of Vỗ cánh; the skill plays the full flight like Xoay vòng.
  const lv13 = keysAt(13);
  expect(lv13[4]).toBe(lv13[0]);
  expect(lv13[5]).toBe(lv13[2]);
  expect(new Set(lv13).size).toBe(4);
  // Lv1–2 cannot fly: every wing button is the hop kick, every leap the full hop.
  expect(new Set(keysAt(1)).size).toBe(2);
  expect(celestialStagDetailMotionKey(undefined, 'blaze')).toBeUndefined();
});
