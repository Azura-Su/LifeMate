import type {
  DragFallStyle,
  DragPhase,
  PixelPetSpeciesId,
} from '../../types/pixelPet';

export type { DragFallStyle, DragPhase } from '../../types/pixelPet';

export type DragPosition = { x: number; y: number };
export type DragBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

const FALL_STYLE_BY_SPECIES: Record<PixelPetSpeciesId, DragFallStyle> = {
  nine_tail_fox: 'fall',
  qilin: 'fall',
  alicorn: 'wings',
  rune_wolf: 'fall',
  black_tortoise: 'shell',
  sphinx: 'wings',
  centaur: 'fall',
  white_tiger: 'fall',
  azure_dragon: 'coil',
  koi_dragon: 'flop',
  scylla: 'tentacle',
  lac_bird: 'wings',
  phoenix: 'wings',
  anubis: 'fall',
  garuda: 'wings',
  celestial_stag: 'wings',
};

export function petFallStyle(speciesId: string): DragFallStyle {
  return FALL_STYLE_BY_SPECIES[speciesId as PixelPetSpeciesId] ?? 'fall';
}

export function clampDragPosition(
  position: DragPosition,
  bounds: DragBounds,
): DragPosition {
  const minX = Math.min(bounds.minX, bounds.maxX);
  const maxX = Math.max(bounds.minX, bounds.maxX);
  const minY = Math.min(bounds.minY, bounds.maxY);
  const maxY = Math.max(bounds.minY, bounds.maxY);
  return {
    x: Math.max(minX, Math.min(maxX, position.x)),
    y: Math.max(minY, Math.min(maxY, position.y)),
  };
}

export type DragAction = 'lift' | 'release' | 'advance' | 'cancel';

export function nextDragPhase(
  phase: DragPhase,
  action: DragAction,
  options: {
    fallStyle: DragFallStyle;
    airborne: boolean;
    reducedMotion: boolean;
  },
): DragPhase {
  if (action === 'cancel') return 'roam';
  if (action === 'lift') return phase === 'roam' ? 'lifted' : phase;
  if (action === 'release') {
    if (phase !== 'lifted') return phase;
    if (options.reducedMotion || !options.airborne) return 'land';
    return options.fallStyle === 'wings' ? 'circle' : 'fall';
  }
  if (phase === 'circle') return 'descend';
  if (phase === 'fall' || phase === 'descend') return 'land';
  if (phase === 'land') return 'roam';
  return phase;
}
