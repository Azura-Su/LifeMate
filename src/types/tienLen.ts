export type SouthConfig = {
  finishMode: 'continue' | 'first-winner';
  cutTwoAmount: number;
  /** Missing on rooms created before the instant-win penalty was introduced. */
  instantWinAmount?: number;
};
export type CutTwoFee = {
  from: string;
  to: string;
  count: number;
  amount: number;
};

export type SouthRules = { amountPerCard: number; southConfig: SouthConfig };
