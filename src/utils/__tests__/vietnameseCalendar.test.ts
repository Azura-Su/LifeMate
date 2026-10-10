import {
  formatLunarDate,
  getMonthGrid,
  getVietnamCalendarEvents,
  lunarToSolar,
  parseDateKey,
  solarToLunar,
  toDateKey,
} from '../vietnameseCalendar';

it('converts known Vietnamese lunar calendar dates with UTC+7', () => {
  expect(solarToLunar(17, 2, 2026)).toEqual({
    day: 1,
    month: 1,
    year: 2026,
    leapMonth: false,
  });
  expect(solarToLunar(26, 4, 2026)).toEqual({
    day: 10,
    month: 3,
    year: 2026,
    leapMonth: false,
  });
  expect(solarToLunar(21, 3, 2004)).toEqual({
    day: 1,
    month: 2,
    year: 2004,
    leapMonth: true,
  });
});

it('round trips dates within a leap month and rejects an invalid leap month', () => {
  expect(lunarToSolar(1, 2, 2004, true)).toEqual({
    day: 21,
    month: 3,
    year: 2004,
  });
  expect(() => lunarToSolar(1, 2, 2005, true)).toThrow(
    'Năm âm lịch này không có tháng nhuận.',
  );
});

it('round trips every date in a lunar leap year and a common year', () => {
  for (const year of [2004, 2026]) {
    const daysInYear = new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
    for (let offset = 0; offset < daysInYear; offset += 1) {
      const date = new Date(year, 0, 1 + offset);
      const lunar = solarToLunar(
        date.getDate(),
        date.getMonth() + 1,
        date.getFullYear(),
      );
      expect(
        lunarToSolar(lunar.day, lunar.month, lunar.year, lunar.leapMonth),
      ).toEqual({
        day: date.getDate(),
        month: date.getMonth() + 1,
        year: date.getFullYear(),
      });
    }
  }
});

it('formats lunar dates and creates a Sunday-first month grid', () => {
  expect(
    formatLunarDate({ day: 1, month: 2, year: 2004, leapMonth: true }),
  ).toBe('1/2 nhuận');
  const dates = getMonthGrid(2026, 1);
  expect(dates).toHaveLength(35);
  expect(toDateKey(dates[0])).toBe('2026-02-01');
  expect(dates[0].getDay()).toBe(0);
  expect(toDateKey(dates[dates.length - 1])).toBe('2026-03-07');
});

it('keeps date keys local and rejects malformed or impossible dates', () => {
  expect(parseDateKey('2026-10-09')).toBeInstanceOf(Date);
  expect(parseDateKey('2026-02-30')).toBeNull();
  expect(parseDateKey('2026-1-09')).toBeNull();
});

it('labels statutory holidays separately from traditional festivals', () => {
  expect(getVietnamCalendarEvents(new Date(2026, 3, 26))).toContainEqual({
    title: 'Giỗ Tổ Hùng Vương',
    kind: 'holiday',
  });
  expect(getVietnamCalendarEvents(new Date(2026, 8, 25))).toContainEqual({
    title: 'Tết Trung thu',
    kind: 'festival',
  });
  expect(getVietnamCalendarEvents(new Date(2026, 3, 30))).toContainEqual({
    title: 'Ngày Giải phóng miền Nam',
    kind: 'holiday',
  });
});
