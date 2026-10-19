export type GameMember = {
  uid: string;
  name: string;
  ready: boolean;
  wins: number;
};
export type GameResult = {
  reason: string;
  ranking: { uid: string; rank: number; labels: string[] }[];
};
export type TienLenView = {
  rulesVersion: 'south-v1';
  status: 'playing' | 'finished' | 'cancelled';
  hand: number[];
  players: {
    uid: string;
    count: number;
    finished: boolean;
    forfeited: boolean;
  }[];
  turn: string | null;
  table: { uid: string; cards: number[] } | null;
  passed: string[];
  openingCard: number | null;
  deadline: number | null;
  result: GameResult | null;
};
export type CardGameRoom = {
  id: string;
  code: string;
  version: number;
  epoch: string;
  matchId: string | null;
  phase: 'lobby' | 'playing' | 'finished' | 'closed';
  host: string | null;
  controller: boolean;
  topic: string;
  members: GameMember[];
  game: TienLenView | null;
};
export type GameSnapshot = {
  room: CardGameRoom | null;
  serverTime: number;
  refreshToken?: boolean;
};
export type GameIntent =
  | { type: 'create'; name: string; game: 'south' }
  | { type: 'join'; name: string; code: string }
  | { type: 'ready'; ready: boolean }
  | { type: 'start' | 'pass' | 'leave' }
  | { type: 'play'; cards: number[] }
  | { type: 'takeover' };
export type GameRequest = {
  type: string;
  roomId?: string;
  sessionId: string;
  actionId?: string;
  expectedVersion?: number;
  matchId?: string | null;
  name?: string;
  game?: 'south';
  code?: string;
  ready?: boolean;
  cards?: number[];
};
