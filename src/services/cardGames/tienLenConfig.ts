import type { SouthConfig, SouthRules } from '../../types/tienLen';

export const DEFAULT_SOUTH_CONFIG: SouthConfig = {
  finishMode: 'continue',
  cutTwoAmount: 0,
  instantWinAmount: 0,
};
export const SOUTH_FINISH_MODES = [
  { value: 'continue', label: 'Đánh tiếp đến hết ván' },
  { value: 'first-winner', label: 'Có người về nhất thì dừng ngay' },
] as const;
export function isSouthConfig(value: unknown): value is SouthConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const config = value as Record<string, unknown>;
  return (
    (Object.keys(config).length === 2 ||
      (Object.keys(config).length === 3 &&
        Number.isSafeInteger(config.instantWinAmount) &&
        (config.instantWinAmount as number) >= 0 &&
        (config.instantWinAmount as number) <= 1_000_000_000)) &&
    ['continue', 'first-winner'].includes(config.finishMode as string) &&
    Number.isSafeInteger(config.cutTwoAmount) &&
    (config.cutTwoAmount as number) >= 0 &&
    (config.cutTwoAmount as number) <= 1_000_000_000
  );
}
export function configuredSouth(config?: SouthConfig) {
  return (
    !!config &&
    (config.finishMode !== 'continue' ||
      config.cutTwoAmount !== 0 ||
      (config.instantWinAmount ?? 0) !== 0)
  );
}

export function isSouthRules(value: unknown): value is SouthRules {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const rules = value as Record<string, unknown>;
  return (
    Object.keys(rules).length === 2 &&
    Number.isSafeInteger(rules.amountPerCard) &&
    (rules.amountPerCard as number) >= 1 &&
    (rules.amountPerCard as number) <= 1_000_000_000 &&
    isSouthConfig(rules.southConfig)
  );
}
