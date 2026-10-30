import type { PixelPetSpeciesId, PixelPetStage } from '../../types/pixelPet';

/**
 * Display copy of the backend EXP policy
 * (supabase/functions/pet-access/expConfig.mjs). The server still decides
 * every grant; a test keeps these numbers in step with that file.
 */
export const CARE_TASKS = [
  {
    id: 'record_day',
    title: 'Ghi sổ thu chi trong ngày',
    detail: 'Ghi ít nhất một khoản thu hoặc chi. Tối đa 1 lần mỗi ngày.',
    exp: 10,
  },
  {
    id: 'care_day',
    title: 'Vuốt ve, chăm sóc',
    detail: 'Bấm chăm sóc trên màn Linh thú. Mỗi ngày 1 lần.',
    exp: 5,
  },
  {
    id: 'streak_3',
    title: 'Chuỗi 3 ngày ghi sổ',
    detail: 'Ghi sổ 3 ngày liên tiếp. Nhận 1 lần mỗi chuỗi.',
    exp: 15,
  },
  {
    id: 'streak_7',
    title: 'Chuỗi 7 ngày ghi sổ',
    detail: 'Ghi sổ 7 ngày liên tiếp. Nhận 1 lần mỗi chuỗi.',
    exp: 30,
  },
  {
    id: 'weekly_record',
    title: 'Tuần chăm chỉ',
    detail: 'Có ít nhất 4 ngày ghi sổ trong một tuần.',
    exp: 20,
  },
] as const;

/** Cumulative EXP needed to reach level index + 1 (mirrors expConfig.mjs). */
export const LEVEL_THRESHOLDS = [0, 30, 80, 150, 240, 350, 480, 630, 800, 1000];

export type PetUnlock = {
  level: number;
  kind: 'stage' | 'skill' | 'skin' | 'scene';
  name: string;
};

type SpeciesUnlocks = {
  /** Second skill tier, unlocked at Lv 8 alongside Thăng hoa. */
  skill2: string;
  /** Outfits at Lv 3, 6 and 10. */
  skins: readonly [string, string, string];
};

/** Each species has its own advanced skill and outfit line. */
const SPECIES_UNLOCKS: Record<PixelPetSpeciesId, SpeciesUnlocks> = {
  nine_tail_fox: {
    skill2: 'Cửu Vĩ Huyễn Hỏa',
    skins: ['Khăn lụa đỏ', 'Đèn lồng hồ ly', 'Áo choàng trăng rằm'],
  },
  qilin: {
    skill2: 'Lân Hỏa Thiên Hành',
    skins: ['Chuông ngọc bích', 'Vảy kim tuyến', 'Giáp lửa thần'],
  },
  alicorn: {
    skill2: 'Ngân Hà Dực Quang',
    skins: ['Vòng hoa tinh tú', 'Bờm cầu vồng', 'Giáp sao băng'],
  },
  rune_wolf: {
    skill2: 'Phù Văn Huyết Nguyệt',
    skins: ['Vòng cổ phù văn', 'Áo choàng sương bạc', 'Giáp băng nguyệt'],
  },
  black_tortoise: {
    skill2: 'Huyền Thủy Trận',
    skins: ['Rêu ngọc', 'Mai khắc cổ văn', 'Giáp hắc thủy'],
  },
  sphinx: {
    skill2: 'Thiên Cơ Sa Mạc',
    skins: ['Khăn vàng pharaoh', 'Vòng cổ thần Ra', 'Cánh hoàng kim'],
  },
  centaur: {
    skill2: 'Vạn Mộc Tiễn Vũ',
    skins: ['Vòng nguyệt quế', 'Cung gỗ cổ thụ', 'Giáp lá rừng thiêng'],
  },
  white_tiger: {
    skill2: 'Bạch Hổ Lôi Phong',
    skins: ['Vòng cổ vàng', 'Cánh bạch ngọc', 'Giáp tây phương'],
  },
  azure_dragon: {
    skill2: 'Thanh Long Hải Triều',
    skins: ['Ngọc châu xanh', 'Mây lành quấn thân', 'Giáp đông phương'],
  },
  koi_dragon: {
    skill2: 'Hóa Long Thăng Thiên',
    skins: ['Vây lụa đỏ', 'Vảy hoàng kim', 'Long giác sơ sinh'],
  },
  scylla: {
    skill2: 'Lục Khuyển Liệt Hỏa',
    skins: ['Vòng xương cá', 'Tóc san hô', 'Giáp sóng dữ'],
  },
  lac_bird: {
    skill2: 'Đồng Cổ Lạc Hồng',
    skins: ['Lông vũ trống đồng', 'Mũ lông chim Lạc', 'Áo hoa văn Đông Sơn'],
  },
  phoenix: {
    skill2: 'Phượng Hoàng Tái Sinh',
    skins: ['Lông đuôi ngũ sắc', 'Vương miện lửa', 'Cánh niết bàn'],
  },
  anubis: {
    skill2: 'Phán Xét Âm Giới',
    skins: ['Vòng cổ lam ngọc', 'Quyền trượng Ankh', 'Giáp thần chết vàng'],
  },
  garuda: {
    skill2: 'Kim Sí Điểu Vương',
    skins: ['Vòng tay vàng', 'Mão kim sí', 'Cánh thần điểu'],
  },
  celestial_stag: {
    skill2: 'Ngũ Sắc Thiên Hà',
    skins: ['Sừng kết hoa', 'Cánh lưu ly', 'Hào quang thiên lộc'],
  },
};

/** Home sleep backdrops, shown from level 2 (HomePetRoamer). */
const SLEEP_SCENES: Partial<Record<PixelPetSpeciesId, string>> = {
  nine_tail_fox: 'Đền hồ ly hoa đào',
  garuda: 'Chùa núi mây',
  rune_wolf: 'Cổ thụ đêm trăng',
  celestial_stag: 'Vườn hoa thiên lộc',
};

/** Body stage shown at a level (mirrors the Lv 4 / Lv 8 stage unlocks). */
export function stageForLevel(level: number): PixelPetStage {
  return level >= 8 ? 'ascended' : level >= 4 ? 'juvenile' : 'hatchling';
}

/** Every unlock for a species, in level order. */
export function petUnlocks(id: PixelPetSpeciesId, skill: string): PetUnlock[] {
  const { skill2, skins } = SPECIES_UNLOCKS[id];
  const scene = SLEEP_SCENES[id];
  return [
    ...(scene ? [{ level: 2, kind: 'scene' as const, name: scene }] : []),
    { level: 3, kind: 'skin', name: skins[0] },
    { level: 4, kind: 'stage', name: 'Trưởng thành' },
    { level: 5, kind: 'skill', name: skill },
    { level: 6, kind: 'skin', name: skins[1] },
    { level: 8, kind: 'stage', name: 'Thăng hoa' },
    { level: 8, kind: 'skill', name: skill2 },
    { level: 10, kind: 'skin', name: skins[2] },
  ];
}
