export type CardScorePlayer = {
  id: string;
  name: string;
};

export type CardScoreRound = {
  id: string;
  createdAt: number;
  scores: Record<string, number>;
};

export type CardScoreMatch = {
  id: string;
  title: string;
  players: CardScorePlayer[];
  seatOrder: string[];
  dealerPlayerId: string;
  rounds: CardScoreRound[];
  status: 'active' | 'finished';
  createdAt: number;
  updatedAt: number;
  onlineRoomId?: string;
  onlineRoomCode?: string;
  amountPerCard?: number;
  ignoredOnlineRoundIds?: string[];
  ignoredOnlinePlayerIds?: string[];
  lastSyncedOnlineMatchId?: string;
  sharedVersion?: number;
  localScoreEditable?: boolean;
  /** This account archived the online board on this device; never sent to server. */
  localFinished?: boolean;
  /** Local archive timestamp; never sent to or trusted from the server. */
  localFinishedAt?: number;
  deletedAt?: number;
  audit?: CardScoreAuditEntry[];
};

export type CardScoreDocument = Pick<
  CardScoreMatch,
  'title' | 'players' | 'seatOrder' | 'dealerPlayerId' | 'rounds' | 'status'
>;
export type CardScoreAuditChange =
  | {
      kind: 'round-add' | 'round-edit' | 'round-delete';
      roundNumber: number;
      players: CardScorePlayer[];
      before?: CardScoreRound | null;
      after?: CardScoreRound | null;
    }
  | {
      kind: 'settings';
      before: Partial<CardScoreDocument>;
      after: Partial<CardScoreDocument>;
    }
  | { kind: 'table-delete' }
  | { kind: 'table-restore' };
export type CardScoreAuditEntry = {
  id: string;
  at: number;
  actorUid: string | null;
  actorName: string;
  changes: CardScoreAuditChange[];
};
export type SharedCardScore = { match: CardScoreMatch; canEdit: boolean };
export type SharedCardScoreList = { tables: SharedCardScore[] };
export type CardScoreHistory = {
  events: CardScoreAuditEntry[];
  nextBefore: number | null;
};

export type CardScorePatch = {
  settings: Omit<CardScoreDocument, 'rounds'>;
  upsertRounds: CardScoreRound[];
  deleteRoundIds: string[];
};
