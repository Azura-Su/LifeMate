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
    deadwoodPoints?: number;
    breakdown?: { kind: string; amount: number; otherUid: string }[];
  }[];
};
export type TienLenView = {
  rulesVersion: 'south-v1' | 'south-v2';
  southConfig?: import('./tienLen').SouthConfig;
  cutTwoFees?: import('./tienLen').CutTwoFee[];
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
export type TienLenNorthView = Omit<TienLenView, 'rulesVersion'> & {
  rulesVersion: 'north-v1' | 'north-v2';
};
export type SamView = Omit<TienLenView, 'rulesVersion'> & {
  rulesVersion: 'sam-v1' | 'sam-v2';
  step: 'report-sam' | 'play';
  reportOrder: string[];
  reported: string[];
  reportedSam: boolean;
  callUid: string | null;
  samOutcome: 'pending' | 'success' | 'failed' | 'aborted' | null;
};
export type TanView = {
  rulesVersion: 'tan-v1';
  status: 'playing' | 'finished' | 'cancelled';
  step: 'attack' | 'defend' | 'finished';
  hand: number[];
  players: {
    uid: string;
    name?: string;
    balance?: number;
    count: number;
    finished: boolean;
    forfeited: boolean;
  }[];
  stockCount: number;
  trumpCard: number | null;
  trumpSuit: number;
  attackerUid: string | null;
  defenderUid: string | null;
  turn: string | null;
  maxAttackCards: number;
  table: { attackCard: number; defenseCard: number | null; attackerUid: string }[];
  deadline: number | null;
  result: GameResult | null;
};
export type VariantGameConfig =
  | { pointsPerCard: number }
  | {
      rulesVersion: 'north-v2';
      pointsPerCard: number;
      remainingTwoPoints: number;
      cutTwoPoints: number;
    }
  | {
      rulesVersion: 'sam-v2';
      pointsPerCard: number;
      samCallPoints: number;
    };
export type SamAction =
  | { type: 'call-sam' | 'pass-report' | 'pass' }
  | { type: 'play'; cards: number[] };
export type TanAction =
  | { type: 'attack'; card: number }
  | { type: 'pass-attack' | 'take' }
  | { type: 'defend'; index: number; card: number };
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
  gameKind?: 'south' | 'phom' | 'north' | 'sam' | 'tan';
  nextSouthRules?: import('./tienLen').SouthRules;
  nextPhomConfig?: import('./phom').PhomConfig;
  variantConfig?: VariantGameConfig;
  nextVariantConfig?: VariantGameConfig;
  phomConfig?: import('./phom').PhomConfig;
  southConfig?: import('./tienLen').SouthConfig;
  members: GameMember[];
  game:
    | TienLenView
    | TienLenNorthView
    | SamView
    | TanView
    | import('./phom').PhomView
    | null;
};
export type GameSnapshot = {
  room: CardGameRoom | null;
  serverTime: number;
  refreshToken?: boolean;
  removal?: { id: string; roomId: string; reason: 'kicked' };
};
export type GameRoomStatus = {
  minClientVersion?: number;
  gameKind?: CardGameRoom['gameKind'];
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
  | {
      type: 'create';
      name: string;
      game: 'south';
      amountPerCard?: number;
      southConfig?: import('./tienLen').SouthConfig;
    }
  | {
      type: 'create';
      name: string;
      game: 'phom';
      phomConfig: import('./phom').PhomConfig;
    }
  | {
      type: 'create';
      name: string;
      game: 'north' | 'sam' | 'tan';
      variantConfig?: VariantGameConfig;
    }
  | { type: 'set-variant-rules'; variantConfig: VariantGameConfig }
  | { type: 'set-phom-rules'; phomConfig: import('./phom').PhomConfig }
  | ({ type: 'set-south-rules' } & import('./tienLen').SouthRules)
  | {
      type: 'join';
      name: string;
      code: string;
      /** Local negotiation hint; stripped before the join request is sent. */
      game?: 'north' | 'sam' | 'tan';
    }
  | { type: 'ready'; ready: boolean }
  | { type: 'transfer-owner'; targetUid: string }
  | { type: 'kick'; targetUid: string }
  | { type: 'start' | 'pass' | 'leave' }
  | {
      type: 'play';
      cards: number[];
      phomAction?: import('./phom').PhomAction;
      melds?: number[][];
      targetUid?: string;
      meldIndex?: number;
    }
  | { type: 'game-action'; gameAction: SamAction | TanAction }
  | { type: 'takeover' };
export type GameRequest = {
  // Local retry fence; removed before serializing the HTTP body.
  requiredClientVersion?: 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
  type: string;
  roomId?: string;
  sessionId: string;
  actionId?: string;
  expectedVersion?: number;
  matchId?: string | null;
  name?: string;
  game?: 'south' | 'phom' | 'north' | 'sam' | 'tan';
  gameAction?: SamAction | TanAction;
  phomConfig?: import('./phom').PhomConfig;
  southConfig?: import('./tienLen').SouthConfig;
  variantConfig?: VariantGameConfig;
  nextVariantConfig?: VariantGameConfig;
  phomAction?: import('./phom').PhomAction;
  melds?: number[][];
  meldIndex?: number;
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
