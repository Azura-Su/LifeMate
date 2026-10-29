import {
  garudaSleepLandingLift,
  garudaSleepSceneTimelineAt,
} from '../garudaSleepSceneTimeline';

describe('Garuda sleep-scene timeline', () => {
  it('completes the cloud merge before starting the stone platform', () => {
    const cloudsJoined = garudaSleepSceneTimelineAt(1500 / 7400);

    expect(cloudsJoined.cloudProgress).toBe(1);
    expect(cloudsJoined.platformProgress).toBe(0);
    expect(cloudsJoined.shrineProgress).toBe(0);
  });

  it('finishes assembling the platform before the mountain shrine appears', () => {
    const platformFinished = garudaSleepSceneTimelineAt(2900 / 7400);

    expect(platformFinished.cloudProgress).toBe(1);
    expect(platformFinished.platformProgress).toBe(1);
    expect(platformFinished.shrineProgress).toBe(0);
  });

  it('reveals the mountain shrine only in the final phase', () => {
    const shrineRising = garudaSleepSceneTimelineAt(0.7);

    expect(shrineRising.cloudProgress).toBe(1);
    expect(shrineRising.platformProgress).toBe(1);
    expect(shrineRising.shrineProgress).toBeGreaterThan(0);
    expect(garudaSleepSceneTimelineAt(1).shrineProgress).toBe(1);
  });

  it('lifts Garuda until its feet meet the dais at both scene sizes', () => {
    expect(garudaSleepLandingLift(340)).toBe(37);
    expect(garudaSleepLandingLift(230)).toBe(41);
  });
});
