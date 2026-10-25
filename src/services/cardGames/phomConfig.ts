import type { PhomConfig, PhomOptions, PhomRates } from '../../types/phom';
export const DEFAULT_PHOM_OPTIONS: PhomOptions = {
  tai: false,
  send: true,
  uDen: true,
};
export function phomOptions(config?: PhomConfig): PhomOptions {
  return config?.options ?? DEFAULT_PHOM_OPTIONS;
}
export const PHOM_THREE_FEED_RULE =
  'Đền cấp 3 cây luôn bắt buộc: cấp đủ 3 lá cho người ù thì phải đền, không phụ thuộc các tùy chọn.';
export const PHOM_OPTIONS: {
  key: keyof PhomOptions;
  label: string;
  hint: string;
}[] = [
  {
    key: 'tai',
    label: 'Tái',
    hint: 'Ăn ở vòng hạ sẽ dịch lượt; người đã hạ có thể đánh thêm.',
  },
  {
    key: 'send',
    label: 'Gửi bài',
    hint: 'Cho gửi bài rác vào phỏm đã hạ của người khác.',
  },
  {
    key: 'uDen',
    label: 'Ù đền do tái',
    hint: 'A ăn chốt của B khiến B được tái; nếu B ù trong chính lượt thêm đó thì A phải đền.',
  },
];
export function visiblePhomOptions(options: PhomOptions) {
  return PHOM_OPTIONS.filter(({ key }) => key !== 'uDen' || options.tai);
}
export const DEFAULT_PHOM_CONFIG: PhomConfig = {
  second: 1,
  third: 2,
  last: 3,
  eat: 1,
  chot: 4,
  mom: 4,
  u: 5,
  uTron: 10,
  den: 5,
  forfeit: 4,
};
export const PHOM_RATES: {
  key: keyof PhomRates;
  label: string;
  group: string;
}[] = [
  { key: 'second', label: 'Nhì', group: 'Thứ hạng' },
  { key: 'third', label: 'Ba', group: 'Thứ hạng' },
  { key: 'last', label: 'Bét (hạng 4)', group: 'Thứ hạng' },
  { key: 'mom', label: 'Móm', group: 'Thứ hạng' },
  { key: 'forfeit', label: 'Bỏ cuộc', group: 'Thứ hạng' },
  { key: 'eat', label: 'Ăn thường', group: 'Ăn bài' },
  { key: 'chot', label: 'Ăn chốt', group: 'Ăn bài' },
  { key: 'u', label: 'Ù', group: 'Ù và đền' },
  { key: 'uTron', label: 'Ù tròn', group: 'Ù và đền' },
  { key: 'den', label: 'Đền (mỗi người)', group: 'Ù và đền' },
];
export function isPhomConfig(value: unknown): value is PhomConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).length ===
      PHOM_RATES.length + ('options' in record ? 1 : 0) &&
    (!('options' in record) || isPhomOptions(record.options)) &&
    PHOM_RATES.every(
      ({ key }) =>
        typeof record[key] === 'number' &&
        Number.isSafeInteger(record[key]) &&
        (record[key] as number) >= 0 &&
        (record[key] as number) <= 1_000_000_000,
    )
  );
}
export function isPhomOptions(value: unknown): value is PhomOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).length === PHOM_OPTIONS.length &&
    PHOM_OPTIONS.every(({ key }) => typeof record[key] === 'boolean')
  );
}

export function phomRates(config: PhomConfig): Record<string, string> {
  return Object.fromEntries(
    PHOM_RATES.map(({ key }) => [key, String(config[key])]),
  );
}
export function parsePhomRates(
  rates: Record<string, string>,
  options?: PhomOptions,
): PhomConfig | null {
  const config = {
    ...Object.fromEntries(
      PHOM_RATES.map(({ key }) => [
        key,
        rates[key] === '' ? NaN : Number(rates[key]),
      ]),
    ),
    ...(options && { options: { ...options } }),
  };
  return isPhomConfig(config) ? config : null;
}
