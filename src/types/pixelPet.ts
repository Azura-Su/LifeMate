export type PixelPetSpeciesId =
  | 'nine_tail_fox'
  | 'qilin'
  | 'alicorn'
  | 'rune_wolf'
  | 'black_tortoise'
  | 'sphinx'
  | 'centaur'
  | 'white_tiger'
  | 'azure_dragon'
  | 'koi_dragon'
  | 'scylla'
  | 'lac_bird'
  | 'phoenix'
  | 'anubis'
  | 'garuda'
  | 'celestial_stag';
export type PixelPetRigId = 'quadruped' | 'serpentine' | 'avian' | 'biped';
export type PixelPetStage = 'hatchling' | 'juvenile' | 'ascended';
export type PixelPetClipId =
  | 'idle'
  | 'eat'
  | 'move'
  | 'heal'
  | 'happy'
  | 'skill';
/** Extra clips only the admin Celestial Stag atlas can play. */
export type PixelPetExtraClipId =
  | 'fly'
  | 'flap'
  | 'prance'
  | 'bow'
  | 'glow'
  | 'blaze'
  | 'spin';
export type PixelPetAnyClipId = PixelPetClipId | PixelPetExtraClipId;
export type PixelPetMotif = 'flame' | 'water' | 'wind' | 'light' | 'earth' | 'arcane';
export type DragPhase =
  | 'roam'
  | 'lifted'
  | 'circle'
  | 'descend'
  | 'fall'
  | 'land';
export type DragFallStyle =
  | 'fall'
  | 'coil'
  | 'flop'
  | 'tentacle'
  | 'shell'
  | 'wings';
/** Care effects derived server-side from finance records (capped per day). */
export type PixelPetEffect = 'eat' | 'wardrobe' | 'move' | 'heal' | 'mood' | 'neutral';

/** Server-authoritative state returned by the pet-access Edge Function. */
export type PixelPetState = {
  status: 'none' | 'reserved' | 'owned';
  rollsLeft: number;
  restoresLeft: number;
  reservation: { id: string; speciesId: PixelPetSpeciesId; expiresAt: number } | null;
  pet: {
    speciesId: PixelPetSpeciesId;
    adoptionId: string;
    nickname?: string | null;
    adoptedAt: number;
    totalExp: number;
    caredToday: boolean;
    level: number;
    stage: PixelPetStage;
    skillTier: number;
    levelFloorExp: number;
    nextLevelExp: number | null;
  } | null;
  availability: { total: number; owned: number; reserved: number };
  now: number;
  todayEffects?: Partial<Record<PixelPetEffect, number>>;
};
