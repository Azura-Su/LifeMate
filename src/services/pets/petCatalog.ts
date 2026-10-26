import type { PetEffect, PetPartSlot, PetSpecies } from '../../types/pet';

export const PET_SPECIES: {
  id: PetSpecies;
  name: string;
  icon: string;
  description: string;
  palettes: [string, string, string][];
}[] = [
  {
    id: 'cat',
    name: 'Mèo',
    icon: '🐱',
    description: 'Tai nhỏ · Mắt tinh nghịch',
    palettes: [
      ['#D5AB83', '#FFF1DA', '#72523F'],
      ['#747B87', '#F3F0E8', '#454A54'],
      ['#E7D4BA', '#FFFAEB', '#AD8D70'],
    ],
  },
  {
    id: 'dog',
    name: 'Chó',
    icon: '🐶',
    description: 'Tai rủ · Mõm tròn',
    palettes: [
      ['#BE8D62', '#FFF0D8', '#684A35'],
      ['#AA7B59', '#F6E1C4', '#57402F'],
      ['#DCC4A4', '#FFF6E9', '#9D795C'],
    ],
  },
  {
    id: 'rabbit',
    name: 'Thỏ',
    icon: '🐰',
    description: 'Tai dài · Đuôi bông',
    palettes: [
      ['#F2DFD7', '#FFF9F1', '#C3948D'],
      ['#C8BDC8', '#FFF4EC', '#8C7685'],
      ['#E6CBB9', '#FFF4E8', '#B18C79'],
    ],
  },
  {
    id: 'fox',
    name: 'Cáo',
    icon: '🦊',
    description: 'Đuôi xù · Tai nhọn',
    palettes: [
      ['#D58E51', '#FFF0D2', '#6D4E39'],
      ['#C37D4F', '#FFE4C5', '#75513C'],
      ['#DEC6AB', '#FFF5E3', '#927558'],
    ],
  },
  {
    id: 'bear',
    name: 'Gấu',
    icon: '🐻',
    description: 'Thân tròn · Bàn chân mềm',
    palettes: [
      ['#B48C70', '#F2DAC0', '#624638'],
      ['#B99B80', '#FAE9CE', '#79604C'],
      ['#8F796A', '#E4D6C0', '#504238'],
    ],
  },
  {
    id: 'owl',
    name: 'Cú',
    icon: '🦉',
    description: 'Cánh lông · Mặt trái tim',
    palettes: [
      ['#AD9278', '#FBEDD4', '#6C5543'],
      ['#BAADA0', '#FFF5E6', '#786F69'],
      ['#907C73', '#EEDFD0', '#584B48'],
    ],
  },
  {
    id: 'panda',
    name: 'Gấu trúc',
    icon: '🐼',
    description: 'Mắt đeo kính · Tai tròn',
    palettes: [
      ['#EFE9DC', '#FFF9EF', '#454443'],
      ['#E3DCD0', '#FFF6E9', '#57514D'],
      ['#F1E7D5', '#FFF9ED', '#655A50'],
    ],
  },
  {
    id: 'hamster',
    name: 'Hamster',
    icon: '🐹',
    description: 'Má phúng phính · Tai bé',
    palettes: [
      ['#D6A36F', '#FFF0DA', '#946741'],
      ['#D2B5A1', '#FFF5E7', '#8B6A55'],
      ['#AAA3A0', '#F9F2E8', '#66605D'],
    ],
  },
  {
    id: 'penguin',
    name: 'Chim cánh cụt',
    icon: '🐧',
    description: 'Cánh nhỏ · Mỏ xinh',
    palettes: [
      ['#526271', '#F9F2E5', '#DCA057'],
      ['#667882', '#FFF7E9', '#DDA66E'],
      ['#566568', '#F3EEE3', '#C98D5E'],
    ],
  },
  {
    id: 'deer',
    name: 'Hươu',
    icon: '🦌',
    description: 'Gạc nhỏ · Đốm lưng',
    palettes: [
      ['#C7986D', '#FFF1DA', '#856044'],
      ['#B78D70', '#F6E7D6', '#77543E'],
      ['#D4B296', '#FFF6E7', '#9D7758'],
    ],
  },
  {
    id: 'tiger',
    name: 'Hổ',
    icon: '🐯',
    description: 'Vằn mềm · Tai tròn',
    palettes: [
      ['#DCA063', '#FFF1D8', '#74523B'],
      ['#D0A06F', '#FFF4DF', '#6B5140'],
      ['#D7C2A6', '#FFF8E9', '#877057'],
    ],
  },
  {
    id: 'pig',
    name: 'Heo',
    icon: '🐷',
    description: 'Mũi hồng · Đuôi xoắn',
    palettes: [
      ['#E7BDB1', '#FFF1E6', '#B27D76'],
      ['#E3BCB8', '#FFF4ED', '#AF8280'],
      ['#DDB9A7', '#FFF1E1', '#A77D68'],
    ],
  },
];
// Frozen V1 allowlist/order. New species must never change an old seed result.
export const PET_SPECIES_V1: readonly PetSpecies[] = [
  'cat',
  'dog',
  'rabbit',
  'fox',
  'bear',
  'owl',
];
export const PET_BIRDS: readonly PetSpecies[] = ['owl', 'penguin'];
export const PET_EFFECTS: {
  id: PetEffect;
  name: string;
  icon: string;
  color: string;
}[] = [
  { id: 'fire', name: 'Lửa ấm', icon: '🔥', color: '#F2AA57' },
  { id: 'water', name: 'Giọt nước', icon: '💧', color: '#72B9DB' },
  { id: 'wind', name: 'Lốc nhỏ', icon: '🌪️', color: '#A4C9BF' },
  { id: 'lightning', name: 'Tia sét', icon: '⚡', color: '#F1D07B' },
  { id: 'ice', name: 'Băng tuyết', icon: '❄️', color: '#A4D8E9' },
  { id: 'light', name: 'Ánh sáng', icon: '✨', color: '#F1DC9F' },
  { id: 'bubbles', name: 'Bong bóng', icon: '🫧', color: '#A9CECD' },
  { id: 'leaves', name: 'Lá bay', icon: '🍃', color: '#9FB879' },
];
export const PET_SLOTS: PetPartSlot[] = [
  'head',
  'ears',
  'muzzle',
  'body',
  'feet',
  'tail',
  'wings',
];
export const PET_IDLE_CLIPS = ['breathe', 'curious', 'sway'] as const;
export const PET_REACTION_CLIPS = ['greet', 'bounce', 'happy'] as const;
export const speciesInfo = (id: PetSpecies) =>
  PET_SPECIES.find((s) => s.id === id)!;
export const effectInfo = (id: PetEffect) =>
  PET_EFFECTS.find((e) => e.id === id)!;
export const PART_VARIANTS = 3;
