import { describe, expect, it } from 'vitest';
import { computePlan } from './compute';
import { allocationToDays, fillAllocationDays, setAllocationDays } from './edit';
import { meridian } from './seed';
import type { Engagement } from './types';

const rowOf = (engagement: Engagement, id: string) =>
  engagement.assignments.find((assignment) => assignment.id === id)!;

/** Days a week showing in each cell of a row, across the whole engagement. */
function daysAcross(engagement: Engagement, id: string): (number | null)[] {
  const row = rowOf(engagement, id);
  const out: (number | null)[] = [];
  for (let week = 1; week <= engagement.weeks; week++) {
    const inRange = week >= row.startWeek && week <= row.endWeek;
    const value = row.allocationByWeek?.[week] ?? (inRange ? row.allocation : undefined);
    out.push(
      value == null ? null : allocationToDays(value, engagement.calendar.workingDaysPerWeek),
    );
  }
  return out;
}

describe('filling a range', () => {
  it('is indistinguishable from typing the same cells one at a time', () => {
    const filled = fillAllocationDays(meridian, ['a5'], 4, 11, 3);

    let typed: Engagement = meridian;
    for (let week = 4; week <= 11; week++) typed = setAllocationDays(typed, 'a5', week, 3);

    expect(rowOf(filled, 'a5')).toEqual(rowOf(typed, 'a5'));
    expect(computePlan(filled).totalEffortDays).toBeCloseTo(computePlan(typed).totalEffortDays, 9);
  });

  it('sets every cell in the range and leaves the rest alone', () => {
    const before = daysAcross(meridian, 'a5');
    const after = daysAcross(fillAllocationDays(meridian, ['a5'], 5, 8, 2), 'a5');
    for (let week = 1; week <= meridian.weeks; week++) {
      const i = week - 1;
      if (week >= 5 && week <= 8) expect(after[i]).toBeCloseTo(2, 9);
      else expect(after[i]).toBe(before[i]);
    }
  });

  it('extends a row when the range runs past its dates, exactly as typing does', () => {
    const filled = fillAllocationDays(meridian, ['a1'], 1, 9, 4);
    const row = rowOf(filled, 'a1');
    expect(row.startWeek).toBe(1);
    expect(row.endWeek).toBe(9); // a1 ran to week 3
    for (let week = 1; week <= 9; week++) {
      expect(allocationToDays(row.allocationByWeek![week]!, 5)).toBeCloseTo(4, 9);
    }
  });

  it('clears a range without leaving a tail of zeros behind', () => {
    // Clearing an edge cell shortens the row, so the order the cells are cleared in
    // decides whether the row ends up trimmed or padded with zeros.
    const cleared = fillAllocationDays(meridian, ['a5'], 8, 11, null);
    const row = rowOf(cleared, 'a5');
    expect(row.endWeek).toBe(7);
    expect(Object.keys(row.allocationByWeek ?? {}).map(Number).every((w) => w <= 7)).toBe(true);
  });

  it('fills several rows at once, and nobody else', () => {
    const filled = fillAllocationDays(meridian, ['a5', 'a7'], 6, 9, 1);
    for (const id of ['a5', 'a7']) {
      const days = daysAcross(filled, id);
      for (let week = 6; week <= 9; week++) expect(days[week - 1]).toBeCloseTo(1, 9);
    }
    expect(rowOf(filled, 'a6')).toEqual(rowOf(meridian, 'a6'));
  });

  it('accepts the range in either direction — dragging right to left is the same drag', () => {
    expect(fillAllocationDays(meridian, ['a5'], 9, 5, 2)).toEqual(
      fillAllocationDays(meridian, ['a5'], 5, 9, 2),
    );
  });

  it('ignores rows that are not there rather than throwing', () => {
    const filled = fillAllocationDays(meridian, ['a5', 'nope'], 5, 6, 2);
    expect(daysAcross(filled, 'a5')[4]).toBeCloseTo(2, 9);
  });

  it('is one edit, so the engagement it returns is a single new document', () => {
    const filled = fillAllocationDays(meridian, ['a5'], 4, 11, 3);
    expect(filled).not.toBe(meridian);
    expect(meridian.assignments.find((a) => a.id === 'a5')!.allocationByWeek).toBeUndefined();
  });

  it('fills a wide range quickly enough to feel instant', () => {
    const wide: Engagement = { ...meridian, weeks: 52 };
    const ids = wide.assignments.map((assignment) => assignment.id);
    const started = Date.now();
    const filled = fillAllocationDays(wide, ids, 1, 52, 5);
    const elapsed = Date.now() - started;
    expect(filled.assignments).toHaveLength(wide.assignments.length);
    // 17 rows × 52 weeks. Generous, but it would catch an accidental quadratic.
    expect(elapsed).toBeLessThan(2000);
  });
});
