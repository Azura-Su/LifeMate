import { readFileSync } from 'fs';
import { join } from 'path';
import {
  isExtraClip,
  PUPPET_CLIPS,
  PUPPET_EXTRA_CLIPS,
  puppetPlayback,
  puppetTrackKey,
} from '../celestialStagPuppet';
import {
  PIXEL_PET_BY_ID,
  PIXEL_PET_EXCLUSIVE,
  PIXEL_PET_SPECIES,
  pixelPetSpecies,
} from '../pixelPetCatalog';
import { PIXEL_CLIPS, sampleTrack } from '../pixelPetRig';
import { petFacesLeft, petMovementKind } from '../pixelPetFrames';

const TRACKS = [
  'root',
  'body',
  'head',
  'wingL',
  'wingR',
  'tail',
  'fx',
  'blink',
] as const;

describe('Celestial Stag puppet', () => {
  it('is the admin-only 16th species, outside the random 15', () => {
    expect(PIXEL_PET_EXCLUSIVE.map((p) => p.id)).toEqual(['celestial_stag']);
    expect(PIXEL_PET_SPECIES.some((p) => p.id === 'celestial_stag')).toBe(
      false,
    );
    expect(pixelPetSpecies('celestial_stag')).toBe(
      PIXEL_PET_BY_ID.celestial_stag,
    );
    const sql = readFileSync(
      join(
        __dirname,
        '../../../../supabase/migrations/20261028075042_pet_exclusive_celestial_stag.sql',
      ),
      'utf8',
    );
    expect(sql).toContain(
      "values('celestial_stag',16,'CQmmT9iJvKPP79UZqYbvmZ3gXZQ2')",
    );
  });

  it('plays every shared clip plus seven extras of its own', () => {
    for (const shared of Object.keys(PIXEL_CLIPS))
      expect(PUPPET_CLIPS).toHaveProperty(shared);
    expect(PUPPET_EXTRA_CLIPS.map((e) => e.clip)).toEqual([
      'fly',
      'flap',
      'prance',
      'bow',
      'glow',
      'blaze',
      'spin',
    ]);
    expect(Object.keys(PUPPET_CLIPS).length).toBeGreaterThanOrEqual(13);
    for (const { clip } of PUPPET_EXTRA_CLIPS) {
      expect(isExtraClip(clip)).toBe(true);
      expect(PUPPET_CLIPS).toHaveProperty(clip);
    }
    expect(isExtraClip('idle')).toBe(false);
  });

  it('has well-formed, finite tracks for every clip', () => {
    for (const [name, clip] of Object.entries(PUPPET_CLIPS)) {
      expect(clip.durationMs).toBeGreaterThan(0);
      for (const key of TRACKS) {
        const track = clip[key];
        expect(track.length).toBeGreaterThanOrEqual(2);
        expect(`${name}.${key}:${track[0][0]}`).toBe(`${name}.${key}:0`);
        expect(`${name}.${key}:${track.at(-1)![0]}`).toBe(`${name}.${key}:1`);
        track.forEach((frame, i) => {
          if (i) expect(frame[0]).toBeGreaterThan(track[i - 1][0]);
          frame.forEach((value) => expect(Number.isFinite(value)).toBe(true));
        });
        for (let t = 0; t <= 1; t += 0.05)
          sampleTrack(track, t).forEach((v) =>
            expect(Number.isFinite(v)).toBe(true),
          );
      }
    }
  });

  it('loops its idle, flying and prancing clips seamlessly', () => {
    for (const name of ['idle', 'roam', 'fly', 'prance'] as const) {
      const clip = PUPPET_CLIPS[name];
      expect(clip.loop).toBe(true);
      for (const key of TRACKS) {
        const first = clip[key][0];
        const last = clip[key].at(-1)!;
        // Index 0 is the time stamp (0 vs 1); the pose itself must match.
        first.slice(1).forEach((v, i) => expect(last[i + 1]).toBeCloseTo(v, 5));
      }
    }
  });

  it('flaps its wings farther in flight than at rest, mirrored left/right', () => {
    const swing = (name: 'idle' | 'fly') => {
      const angles = PUPPET_CLIPS[name].wingL.map((k) => k[3]);
      return Math.max(...angles) - Math.min(...angles);
    };
    expect(swing('fly')).toBeGreaterThan(swing('idle') * 4);
    PUPPET_CLIPS.fly.wingL.forEach((k, i) =>
      expect(PUPPET_CLIPS.fly.wingR[i][3]).toBeCloseTo(-k[3], 5),
    );
  });

  it('uses the looping flap-glide only for Home roaming', () => {
    expect(puppetTrackKey('move', true)).toBe('roam');
    expect(puppetTrackKey('move', false)).toBe('move');
    expect(puppetPlayback('move', true)).toEqual({
      durationMs: 900,
      loop: true,
    });
    expect(puppetPlayback('fly')).toEqual({ durationMs: 1000, loop: true });
    expect(puppetPlayback('bow').loop).toBe(false);
  });

  it('flies and faces left on the Home pass', () => {
    const stag = PIXEL_PET_BY_ID.celestial_stag;
    expect(petMovementKind(stag)).toBe('wings');
    expect(petFacesLeft(stag)).toBe(true);
  });
});
