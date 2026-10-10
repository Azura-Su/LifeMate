export type LunarDate = {
  day: number;
  month: number;
  year: number;
  leapMonth: boolean;
};

export type VietnamCalendarEvent = {
  title: string;
  kind: 'holiday' | 'festival';
};

// Astronomical conversion follows Hồ Ngọc Đức's Vietnamese calendar algorithm at UTC+7.
const TIME_ZONE = 7;
const SYNODIC_MONTH = 29.530588853;
const PI = Math.PI;
export const MIN_SOLAR_YEAR = 1800;
export const MAX_SOLAR_YEAR = 2200;

function julianDay(day: number, month: number, year: number) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  let jd =
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;
  if (jd < 2299161)
    jd =
      day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
  return jd;
}

function newMoonDay(k: number) {
  const t = k / 1236.85;
  const t2 = t * t;
  const t3 = t2 * t;
  const dr = PI / 180;
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * t2 - 0.000000155 * t3;
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * t - 0.009173 * t2) * dr);
  const m = 359.2242 + 29.10535608 * k - 0.0000333 * t2 - 0.00000347 * t3;
  const mPrime = 306.0253 + 385.81691806 * k + 0.0107306 * t2 + 0.00001236 * t3;
  const f = 21.2964 + 390.67050646 * k - 0.0016528 * t2 - 0.00000239 * t3;
  let correction =
    (0.1734 - 0.000393 * t) * Math.sin(m * dr) +
    0.0021 * Math.sin(2 * m * dr) -
    0.4068 * Math.sin(mPrime * dr) +
    0.0161 * Math.sin(2 * mPrime * dr) -
    0.0004 * Math.sin(3 * mPrime * dr) +
    0.0104 * Math.sin(2 * f * dr) -
    0.0051 * Math.sin((m + mPrime) * dr) -
    0.0074 * Math.sin((m - mPrime) * dr) +
    0.0004 * Math.sin((2 * f + m) * dr) -
    0.0004 * Math.sin((2 * f - m) * dr) -
    0.0006 * Math.sin((2 * f + mPrime) * dr) +
    0.001 * Math.sin((2 * f - mPrime) * dr) +
    0.0005 * Math.sin((2 * mPrime + m) * dr);
  const deltaT =
    t < -11
      ? 0.001 +
        0.000839 * t +
        0.0002261 * t2 -
        0.00000845 * t3 -
        0.000000081 * t2 * t2
      : -0.000278 + 0.000265 * t + 0.000262 * t2;
  const newMoon = jd1 + correction - deltaT;
  return Math.floor(newMoon + 0.5 + TIME_ZONE / 24);
}

function sunLongitudeSector(jdn: number) {
  const t = (jdn - 2451545.5 - TIME_ZONE / 24) / 36525;
  const t2 = t * t;
  const dr = PI / 180;
  const meanAnomaly =
    357.5291 + 35999.0503 * t - 0.0001559 * t2 - 0.00000048 * t2 * t;
  const meanLongitude = 280.46645 + 36000.76983 * t + 0.0003032 * t2;
  const equationOfCenter =
    (1.9146 - 0.004817 * t - 0.000014 * t2) * Math.sin(dr * meanAnomaly) +
    (0.019993 - 0.000101 * t) * Math.sin(2 * dr * meanAnomaly) +
    0.00029 * Math.sin(3 * dr * meanAnomaly);
  let longitude = (meanLongitude + equationOfCenter) * dr;
  longitude -= 2 * PI * Math.floor(longitude / (2 * PI));
  return Math.floor((longitude / PI) * 6);
}

// Both helpers below are pure and run dozens of new-moon calculations; the
// month grid asks for the same few years ~80 times per render, so cache them.
const monthElevenCache = new Map<number, number>();
const leapOffsetCache = new Map<number, number>();

function lunarMonthEleven(year: number) {
  const cached = monthElevenCache.get(year);
  if (cached !== undefined) return cached;
  const offset = julianDay(31, 12, year) - 2415021;
  const k = Math.floor(offset / SYNODIC_MONTH);
  let monthStart = newMoonDay(k);
  if (sunLongitudeSector(monthStart) >= 9) monthStart = newMoonDay(k - 1);
  monthElevenCache.set(year, monthStart);
  return monthStart;
}

function leapMonthOffset(monthEleven: number) {
  const cached = leapOffsetCache.get(monthEleven);
  if (cached !== undefined) return cached;
  const k = Math.floor((monthEleven - 2415021.076998695) / SYNODIC_MONTH + 0.5);
  let lastSector = 0;
  let i = 1;
  let sector = sunLongitudeSector(newMoonDay(k + i));
  do {
    lastSector = sector;
    i += 1;
    sector = sunLongitudeSector(newMoonDay(k + i));
  } while (sector !== lastSector && i < 14);
  leapOffsetCache.set(monthEleven, i - 1);
  return i - 1;
}

function validateDate(day: number, month: number, year: number) {
  if (!Number.isInteger(year) || year < MIN_SOLAR_YEAR || year > MAX_SOLAR_YEAR)
    return false;
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  if (!Number.isInteger(day) || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isSolarDateSupported(date: Date) {
  return validateDate(date.getDate(), date.getMonth() + 1, date.getFullYear());
}

/** Converts a Gregorian date to the Vietnamese lunar calendar (UTC+7). */
export function solarToLunar(
  day: number,
  month: number,
  year: number,
): LunarDate {
  if (!validateDate(day, month, year))
    throw new RangeError('Ngày dương lịch không hợp lệ.');
  const dayNumber = julianDay(day, month, year);
  const k = Math.floor((dayNumber - 2415021.076998695) / SYNODIC_MONTH);
  let monthStart = newMoonDay(k + 1);
  if (monthStart > dayNumber) monthStart = newMoonDay(k);

  let monthEleven = lunarMonthEleven(year);
  let nextMonthEleven = monthEleven;
  let lunarYear: number;
  if (monthEleven >= monthStart) {
    lunarYear = year;
    monthEleven = lunarMonthEleven(year - 1);
  } else {
    lunarYear = year + 1;
    nextMonthEleven = lunarMonthEleven(year + 1);
  }

  const lunarDay = dayNumber - monthStart + 1;
  const monthDifference = Math.floor((monthStart - monthEleven) / 29);
  let lunarMonth = monthDifference + 11;
  let leapMonth = false;
  if (nextMonthEleven - monthEleven > 365) {
    const leapOffset = leapMonthOffset(monthEleven);
    if (monthDifference >= leapOffset) {
      lunarMonth = monthDifference + 10;
      leapMonth = monthDifference === leapOffset;
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && monthDifference < 4) lunarYear -= 1;
  return { day: lunarDay, month: lunarMonth, year: lunarYear, leapMonth };
}

/** Converts a Vietnamese lunar date (UTC+7) to its Gregorian date. */
export function lunarToSolar(
  day: number,
  month: number,
  year: number,
  leapMonth = false,
): { day: number; month: number; year: number } {
  if (
    !Number.isInteger(day) ||
    day < 1 ||
    day > 30 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(year) ||
    year < 1800 ||
    year > 2200
  )
    throw new RangeError('Ngày âm lịch không hợp lệ.');

  let monthEleven: number;
  let nextMonthEleven: number;
  if (month < 11) {
    monthEleven = lunarMonthEleven(year - 1);
    nextMonthEleven = lunarMonthEleven(year);
  } else {
    monthEleven = lunarMonthEleven(year);
    nextMonthEleven = lunarMonthEleven(year + 1);
  }
  const k = Math.floor((monthEleven - 2415021.076998695) / SYNODIC_MONTH + 0.5);
  let offset = month - 11;
  if (offset < 0) offset += 12;
  if (nextMonthEleven - monthEleven > 365) {
    const leapOffset = leapMonthOffset(monthEleven);
    let leapMonthNumber = leapOffset - 2;
    if (leapMonthNumber < 0) leapMonthNumber += 12;
    if (leapMonth && month !== leapMonthNumber)
      throw new RangeError('Tháng nhuận không hợp lệ trong năm âm lịch này.');
    if (leapMonth || offset >= leapOffset) offset += 1;
  } else if (leapMonth) {
    throw new RangeError('Năm âm lịch này không có tháng nhuận.');
  }

  const monthStart = newMoonDay(k + offset);
  const result = new Date((monthStart + day - 1 - 2440588) * 86400000);
  const solar = {
    day: result.getUTCDate(),
    month: result.getUTCMonth() + 1,
    year: result.getUTCFullYear(),
  };
  if (!validateDate(solar.day, solar.month, solar.year))
    throw new RangeError('Ngày âm lịch không tồn tại trong năm này.');
  const roundTrip = solarToLunar(solar.day, solar.month, solar.year);
  if (
    roundTrip.day !== day ||
    roundTrip.month !== month ||
    roundTrip.year !== year ||
    roundTrip.leapMonth !== leapMonth
  )
    throw new RangeError('Ngày âm lịch không tồn tại trong năm này.');
  return solar;
}

export function formatLunarDate(value: LunarDate) {
  return `${value.day}/${value.month}${value.leapMonth ? ' nhuận' : ''}`;
}

export function isSameDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

export function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  return validateDate(day, month, year) ? new Date(year, month - 1, day) : null;
}

export function getMonthGrid(year: number, monthIndex: number) {
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();
  const sundayOffset = firstWeekday;
  const cellCount = Math.max(35, Math.ceil((sundayOffset + dayCount) / 7) * 7);
  const firstDate = new Date(year, monthIndex, 1 - sundayOffset);
  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(firstDate);
    date.setDate(firstDate.getDate() + index);
    return date;
  });
}

export function getVietnamCalendarEvents(date: Date): VietnamCalendarEvent[] {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const events: VietnamCalendarEvent[] = [];
  if (month === 1 && day === 1)
    events.push({ title: 'Tết Dương lịch', kind: 'holiday' });
  if (month === 4 && day === 30)
    events.push({ title: 'Ngày Giải phóng miền Nam', kind: 'holiday' });
  if (month === 5 && day === 1)
    events.push({ title: 'Quốc tế Lao động', kind: 'holiday' });
  if (month === 9 && day === 2)
    events.push({ title: 'Quốc khánh', kind: 'holiday' });

  const lunar = solarToLunar(day, month, date.getFullYear());
  if (lunar.month === 1 && lunar.day <= 3 && !lunar.leapMonth)
    events.push({
      title: ['Tết Nguyên Đán', 'Mùng 2 Tết', 'Mùng 3 Tết'][lunar.day - 1],
      kind: 'holiday',
    });
  if (lunar.month === 3 && lunar.day === 10 && !lunar.leapMonth)
    events.push({ title: 'Giỗ Tổ Hùng Vương', kind: 'holiday' });
  if (lunar.month === 1 && lunar.day === 15 && !lunar.leapMonth)
    events.push({ title: 'Tết Nguyên Tiêu', kind: 'festival' });
  if (lunar.month === 3 && lunar.day === 3 && !lunar.leapMonth)
    events.push({ title: 'Tết Hàn Thực', kind: 'festival' });
  if (lunar.month === 5 && lunar.day === 5 && !lunar.leapMonth)
    events.push({ title: 'Tết Đoan Ngọ', kind: 'festival' });
  if (lunar.month === 7 && lunar.day === 15 && !lunar.leapMonth)
    events.push({ title: 'Lễ Vu Lan', kind: 'festival' });
  if (lunar.month === 8 && lunar.day === 15 && !lunar.leapMonth)
    events.push({ title: 'Tết Trung thu', kind: 'festival' });
  if (lunar.month === 12 && lunar.day === 23 && !lunar.leapMonth)
    events.push({ title: 'Ông Táo chầu trời', kind: 'festival' });
  return events;
}
