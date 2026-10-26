import type { PetDNA, PetMotion } from '../../types/pet';

// Immutable chibi-v1 lookup tables. Change catalogVersion before changing these.
const SPEED = [0.85, 0.9, 0.96, 1, 1.04, 1.08, 1.12, 1.15];
const AMPLITUDE = [0.85, 0.9, 0.95, 1, 1.04, 1.08, 1.12, 1.15];
export function petVisualPhase(seed: string, domain: string) {
  let hash = 2166136261;
  for (const char of `${domain}:${seed}`)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 0x100000000;
}
export function resolvePetPlayback(dna: PetDNA) {
  const motion = (gene: PetMotion, idle: boolean) => ({
    clipId: gene.clipId,
    speed: SPEED[gene.variant],
    amplitude: AMPLITUDE[gene.variant],
    gapMs: (idle ? 2500 : 1000) + gene.variant * (idle ? 300 : 125),
  });
  return {
    idle: motion(dna.animation.idle, true),
    interaction: motion(dna.animation.interaction, false),
    blinkPhase: petVisualPhase(dna.seed, 'blink'),
    tailPhase: petVisualPhase(dna.seed, 'tail'),
    skill: {
      effectId: dna.skill.effectId,
      castClipId: 'cast',
      emitterSocket: 'Mouth',
      durationMs: 1600 + dna.skill.variant * 100,
      cooldownMs: 3500 + dna.skill.variant * 200,
      particlePhase: petVisualPhase(dna.seed, 'particles'),
    },
  };
}
