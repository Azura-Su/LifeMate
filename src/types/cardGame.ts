export type GameMember = {
  uid: string;
  name: string;
  ready: boolean;
  wins: number;
  balance?: number;
  avatarUrl?: string | null;
};
export type GameResult = {
  reason: string;
  ranking: {
    uid: string;
    rank: number;
    labels: string[];
    name?: string;
    remainingCards?: number;
    moneyDelta?: number;
  }[];
};
export type TienLenView = {
  rulesVersion: 'south-v1';
  status: 'playing' | 'finished' | 'cancelled';
  hand: number[];
  players: {
    uid: string;
    name?: string;
    balance?: number;
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
  ownerUid?: string | null;
  controller: boolean;
  topic: string;
  amountPerCard?: number;
  members: GameMember[];
  game: TienLenView | null;
};
export type GameSnapshot = {
  room: CardGameRoom | null;
  serverTime: number;
  refreshToken?: boolean;
  removal?: { id: string; roomId: string; reason: 'kicked' };
};
export type GameRoomStatus = {
  roomId: string;
  exists: boolean;
  owner: boolean;
  canRejoin: boolean;
  canReopen: boolean;
  canDelete: boolean;
  expired: boolean;
  phase: CardGameRoom['phase'] | null;
  version: number | null;
  matchId: string | null;
};
export type GameIntent =
  | { type: 'create'; name: string; game: 'south'; amountPerCard?: number }
  | { type: 'join'; name: string; code: string }
  | { type: 'ready'; ready: boolean }
  | { type: 'transfer-owner'; targetUid: string }
  | { type: 'kick'; targetUid: string }
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
  amountPerCard?: number;
  targetUid?: string;
  code?: string;
  ready?: boolean;
  cards?: number[];
  tableId?: string;
  before?: number | null;
  operation?: 'save' | 'patch' | 'delete';
  document?:
    | import('./cardScore').CardScoreDocument
    | import('./cardScore').CardScorePatch
    | null;
};
