import { rangeAfterDrag } from '../AudioRangeSelector';

it('moves either boundary proportionally and keeps the selected range valid', () => {
  expect(
    rangeAfterDrag({
      boundary: 'start',
      startMs: 0,
      endMs: 5000,
      durationMs: 5000,
      deltaPx: 45,
      trackWidth: 225,
    }),
  ).toEqual({ startMs: 1000, endMs: 5000 });

  expect(
    rangeAfterDrag({
      boundary: 'end',
      startMs: 1000,
      endMs: 5000,
      durationMs: 5000,
      deltaPx: -500,
      trackWidth: 225,
    }),
  ).toEqual({ startMs: 1000, endMs: 1100 });
});
