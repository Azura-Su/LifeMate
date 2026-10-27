import type {
  PixelPetMotif,
  PixelPetRigId,
  PixelPetSpeciesId,
} from '../../types/pixelPet';

/** Palette slots used by every pixel grid: 1 base, 2 shade, 3 accent, 4 ink. */
export type PixelPalette = readonly [string, string, string, string];

export type PixelPetSpecies = {
  id: PixelPetSpeciesId;
  name: string;
  rig: PixelPetRigId;
  palette: PixelPalette;
  skill: string;
  motif: PixelPetMotif;
  personality: string;
  /** 8×4 grid drawn above the shared rig head (ears, horns, crown…). */
  crest: readonly string[];
  /** 8×8 grid on the rig's feature anchor (tails, shell, wings…). */
  feature: readonly string[];
};

const EARS = ['.4....4.', '414..414', '4134.314', '.411114.'];
const HORNS = ['.3....3.', '.33..33.', '..3..3..', '.414414.'];
const CROWN = ['.3.33.3.', '.333333.', '.322223.', '.444444.'];
const FLAMES = ['.3..3.3.', '3.33.33.', '.323323.', '..2222..'];
const WINGS = [
  '...1111.',
  '..11112.',
  '.111122.',
  '1111222.',
  '111222..',
  '.1122...',
  '..12....',
  '........',
];

export const PIXEL_PET_SPECIES: readonly PixelPetSpecies[] = [
  {
    id: 'nine_tail_fox',
    name: 'Cửu Vĩ Hồ',
    rig: 'quadruped',
    palette: ['#E9772F', '#B9501E', '#FFF2E2', '#4A2414'],
    skill: 'Hồ Hỏa Mê Ảnh',
    motif: 'flame',
    personality: 'Tinh nghịch',
    crest: EARS,
    feature: [
      '3..3..3.',
      '13.13.13',
      '1131131.',
      '.111111.',
      '3.1111.3',
      '13.11.31',
      '.111111.',
      '..1111..',
    ],
  },
  {
    id: 'qilin',
    name: 'Kỳ Lân Hỏa',
    rig: 'quadruped',
    palette: ['#2F9E6E', '#1E6B4C', '#F28B2C', '#2B2118'],
    skill: 'Lân Hỏa Bộ',
    motif: 'flame',
    personality: 'Nhiệt huyết',
    crest: HORNS,
    feature: [
      '..3..3..',
      '.3333.3.',
      '.332233.',
      '..3223..',
      '...22...',
      '...11...',
      '........',
      '........',
    ],
  },
  {
    id: 'alicorn',
    name: 'Thiên Mã Kỳ Lân',
    rig: 'quadruped',
    palette: ['#F7F2FB', '#C9BEDD', '#E9C35A', '#5A4E6E'],
    skill: 'Tinh Vân Dực',
    motif: 'light',
    personality: 'Mơ mộng',
    crest: ['...3....', '...33...', '.4.33.4.', '.414414.'],
    feature: WINGS,
  },
  {
    id: 'rune_wolf',
    name: 'Lang Linh',
    rig: 'quadruped',
    palette: ['#6E7378', '#454A50', '#9FF3E4', '#1F2226'],
    skill: 'Phù Văn Hú',
    motif: 'arcane',
    personality: 'Trung thành',
    crest: ['.2....2.', '4224422.', '4114.114', '.411114.'],
    feature: [
      '......1.',
      '.....11.',
      '....113.',
      '...1131.',
      '..11111.',
      '.1111...',
      '........',
      '........',
    ],
  },
  {
    id: 'black_tortoise',
    name: 'Huyền Vũ',
    rig: 'quadruped',
    palette: ['#5FA36A', '#2F6B48', '#D9B45A', '#1D2E22'],
    skill: 'Quy Giáp Thủ',
    motif: 'earth',
    personality: 'Điềm tĩnh',
    crest: ['........', '........', '........', '..1111..'],
    feature: [
      '..4444..',
      '.423324.',
      '42322324',
      '42233224',
      '42322324',
      '.433334.',
      '..4444..',
      '........',
    ],
  },
  {
    id: 'sphinx',
    name: 'Nhân Sư',
    rig: 'quadruped',
    palette: ['#D9A35F', '#A8733A', '#3F8FA6', '#3A2414'],
    skill: 'Câu Đố Sa Mạc',
    motif: 'earth',
    personality: 'Thông thái',
    crest: ['..3333..', '.323323.', '3233332.', '32.33.23'],
    feature: WINGS,
  },
  {
    id: 'centaur',
    name: 'Nhân Mã',
    rig: 'quadruped',
    palette: ['#C99766', '#8F6440', '#5E9B4E', '#3B2617'],
    skill: 'Lục Mộc Tiễn',
    motif: 'wind',
    personality: 'Phóng khoáng',
    crest: ['.3.33.3.', '.222222.', '22222222', '2.2..2.2'],
    feature: [
      '........',
      '.....4..',
      '....4.4.',
      '...4...4',
      '..43333.',
      '...4...4',
      '....4.4.',
      '.....4..',
    ],
  },
  {
    id: 'white_tiger',
    name: 'Bạch Hổ',
    rig: 'quadruped',
    palette: ['#F4F1EA', '#C9C2B5', '#3C3A44', '#24222A'],
    skill: 'Hổ Khiếu Phong',
    motif: 'wind',
    personality: 'Dũng cảm',
    crest: ['4......4', '414..414', '.43333..', '.414414.'],
    feature: [
      '.......1',
      '......13',
      '.....13.',
      '....131.',
      '...131..',
      '..113...',
      '........',
      '........',
    ],
  },
  {
    id: 'azure_dragon',
    name: 'Thanh Long',
    rig: 'serpentine',
    palette: ['#3E8E5A', '#25603C', '#F2E6C4', '#17301F'],
    skill: 'Long Châu Vũ',
    motif: 'water',
    personality: 'Cao quý',
    crest: ['.2....2.', '.22..22.', '..2..2..', '.414414.'],
    feature: [
      '........',
      '..3333..',
      '.333333.',
      '.33ww33.',
      '.333333.',
      '..3333..',
      '........',
      '........',
    ],
  },
  {
    id: 'koi_dragon',
    name: 'Lý Ngư Hóa Long',
    rig: 'serpentine',
    palette: ['#F2B233', '#C97F1C', '#FFF1C9', '#5A3510'],
    skill: 'Vượt Vũ Môn',
    motif: 'water',
    personality: 'Kiên trì',
    crest: ['.2....2.', '.2....2.', '..2..2..', '.414414.'],
    feature: [
      '1......1',
      '11....11',
      '.11..11.',
      '..1221..',
      '...22...',
      '........',
      '........',
      '........',
    ],
  },
  {
    id: 'scylla',
    name: 'Scylla',
    rig: 'serpentine',
    palette: ['#3F8C8A', '#28605F', '#F29A3A', '#16302F'],
    skill: 'Lục Khuyển Hỏa',
    motif: 'flame',
    personality: 'Nóng nảy',
    crest: ['.2222...', '222222..', '2222222.', '22....2.'],
    feature: [
      '.22..22.',
      '2112211.',
      '2w12w12.',
      '.11..11.',
      '.3....3.',
      '.22..22.',
      '2112211.',
      '2w12w12.',
    ],
  },
  {
    id: 'lac_bird',
    name: 'Chim Lạc',
    rig: 'avian',
    palette: ['#3F8F5B', '#276340', '#E2B13C', '#18301F'],
    skill: 'Đồng Cổ Vũ',
    motif: 'earth',
    personality: 'Hiền hoà',
    crest: ['..3.3...', '.3.3.3..', '..333...', '...1....'],
    feature: [
      '3.......',
      '13......',
      '.13.....',
      '..133...',
      '...1133.',
      '....1113',
      '......11',
      '........',
    ],
  },
  {
    id: 'phoenix',
    name: 'Phượng Hoàng',
    rig: 'avian',
    palette: ['#F39A2E', '#D9541E', '#FFE16A', '#5A1E0E'],
    skill: 'Niết Bàn Hỏa',
    motif: 'flame',
    personality: 'Lạc quan',
    crest: FLAMES,
    feature: [
      '3.......',
      '23......',
      '.233....',
      '..2233..',
      '...22233',
      '....2223',
      '......22',
      '........',
    ],
  },
  {
    id: 'anubis',
    name: 'Anubis',
    rig: 'biped',
    palette: ['#A5774D', '#74512F', '#2F9C8E', '#2E1D10'],
    skill: 'Cán Cân Linh Hồn',
    motif: 'arcane',
    personality: 'Nghiêm túc',
    crest: ['.4....4.', '.14..41.', '.114411.', '.333333.'],
    feature: [
      '...33...',
      '..3..3..',
      '..3..3..',
      '...33...',
      '...33...',
      '.333333.',
      '...33...',
      '...33...',
    ],
  },
  {
    id: 'garuda',
    name: 'Garuda',
    rig: 'biped',
    palette: ['#F2B84A', '#C98A22', '#C8432E', '#4A2A0E'],
    skill: 'Kim Sí Phong',
    motif: 'wind',
    personality: 'Chính trực',
    crest: CROWN,
    feature: WINGS,
  },
];

export const PIXEL_PET_BY_ID = Object.fromEntries(
  PIXEL_PET_SPECIES.map((species) => [species.id, species]),
) as Record<PixelPetSpeciesId, PixelPetSpecies>;

export function pixelPetSpecies(id: string): PixelPetSpecies | null {
  return Object.prototype.hasOwnProperty.call(PIXEL_PET_BY_ID, id)
    ? PIXEL_PET_BY_ID[id as PixelPetSpeciesId]
    : null;
}
