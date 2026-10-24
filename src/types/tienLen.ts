export type SouthConfig = {
  finishMode: 'continue' | 'first-winner';
  cutTwoAmount: number;
};
export type CutTwoFee = {
  from: string;
  to: string;
  count: number;
  amount: number;
};

export type SouthRules = { amountPerCard: number; southConfig: SouthConfig };
