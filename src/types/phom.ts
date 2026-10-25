import type { TienLenView } from './cardGame';
export type PhomOptions = { tai: boolean; send: boolean; uDen: boolean };
export type PhomRates = {
  second: number;
  third: number;
  last: number;
  eat: number;
  chot: number;
  mom: number;
  u: number;
  uTron: number;
  den: number;
  forfeit: number;
};
export type PhomConfig = PhomRates & { options?: PhomOptions };
export type PhomAction = 'draw' | 'eat' | 'discard' | 'lay' | 'send' | 'u';
export type PhomView = Omit<TienLenView, 'rulesVersion' | 'players'> & {
  rulesVersion: 'phom-v1';
  players: (TienLenView['players'][number] & {
    eaten: number[];
    melds: number[][];
    discards: number[];
    laid: boolean;
    turns: number;
    resultCards?: { discards: number[]; remaining: number[] };
  })[];
  step: 'draw' | 'lay' | 'discard';
  stockCount: number;
  lastDiscard: { uid: string; card: number; chot: boolean } | null;
  canEat: boolean;
  canU: boolean;
};
