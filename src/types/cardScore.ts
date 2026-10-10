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
};
