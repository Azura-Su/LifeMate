const digitWords = [
  'không',
  'một',
  'hai',
  'ba',
  'bốn',
  'năm',
  'sáu',
  'bảy',
  'tám',
  'chín',
];
const groupWords = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

function readThreeDigits(value: number, hasHigherGroup: boolean) {
  const hundreds = Math.floor(value / 100);
  const tens = Math.floor((value % 100) / 10);
  const units = value % 10;
  const words: string[] = [];
  if (hundreds) words.push(digitWords[hundreds], 'trăm');
  else if (hasHigherGroup) words.push('không trăm');
  if (tens > 1) words.push(digitWords[tens], 'mươi');
  else if (tens === 1) words.push('mười');
  else if (units && (hundreds || hasHigherGroup)) words.push('lẻ');
  if (units)
    words.push(
      tens > 1 && units === 1
        ? 'mốt'
        : tens > 1 && units === 4
          ? 'tư'
          : tens > 0 && units === 5
            ? 'lăm'
            : digitWords[units],
    );
  return words.join(' ');
}

export function formatFinanceAmountWords(value: string) {
  const digits = value.replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return null;
  if (!Number.isSafeInteger(Number(digits))) return null;
  const groups: number[] = [];
  for (let end = digits.length; end > 0; end -= 3)
    groups.push(Number(digits.slice(Math.max(0, end - 3), end)));
  if (groups.length > groupWords.length) return null;
  const words: string[] = [];
  for (let index = groups.length - 1; index >= 0; index--) {
    if (groups[index] === 0) continue;
    words.push(readThreeDigits(groups[index], words.length > 0));
    if (groupWords[index]) words.push(groupWords[index]);
  }
  const reading = words.join(' ');
  return `${reading[0].toLocaleUpperCase('vi-VN')}${reading.slice(1)} đồng`;
}
