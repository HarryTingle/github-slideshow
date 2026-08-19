import { describe, expect, it } from 'vitest';
import { headerSpans, quarterLabel, sprintNumber, weekStartLabel } from './calendar';
import { computePlan } from './compute';
import {
  addAssignment,
  normalise,
  removeAssignment,
  setAllocation,
  setAssignmentGrade,
  setAssignmentRange,
  setPersonName,
  setPhase,
  setSprintWeeks,
  setStartDate,
  setWeeks,
  setWorkstream,
} from './edit';
import { meridian } from './seed';
import { validate } from './validate';

const effort = (engagement = meridian) => computePlan(engagement).totalEffortDays;

describe('containment invariant', () => {
  it('grows a workstream to hold an assignment pushed past its end', () => {
    const next = setAssignmentRange(meridian, 'a5', 4, 20);
    const workstream = next.workstreams.find((w) => w.id === 'ws-platform')!;
    expect(workstream.endWeek).toBe(20);
  });

  it('grows the phase and the engagement to match', () => {
    const next = setAssignmentRange(meridian, 'a5', 4, 20);
    expect(next.phases.find((p) => p.id === 'ph-build')!.endWeek).toBe(20);
    expect(next.weeks).toBeGreaterThanOrEqual(20);
  });

  it('leaves no containment warnings behind after any range edit', () => {
    const next = setAssignmentRange(meridian, 'a5', 2, 19);
    const findings = validate(next, computePlan(next));
    expect(findings.filter((f) => f.id.startsWith('a-outside-ws'))).toEqual([]);
    expect(findings.filter((f) => f.id.startsWith('ws-outside-phase'))).toEqual([]);
  });

  it('never shrinks below the work already planned', () => {
    const next = setWeeks(meridian, 2);
    expect(next.weeks).toBe(14);
  });

  it('refuses an end week before its start', () => {
    const next = setAssignmentRange(meridian, 'a5', 9, 4);
    const assignment = next.assignments.find((a) => a.id === 'a5')!;
    expect(assignment.endWeek).toBe(9);
  });

  it('is idempotent', () => {
    expect(JSON.stringify(normalise(normalise(meridian)))).toBe(JSON.stringify(normalise(meridian)));
  });
});

describe('editing a cell outside the current range', () => {
  it('extends the assignment to reach the week', () => {
    const next = setAllocation(meridian, 'a5', 14, 0.5);
    const assignment = next.assignments.find((a) => a.id === 'a5')!;
    expect(assignment.endWeek).toBe(14);
    expect(assignment.allocationByWeek?.[14]).toBe(0.5);
  });

  it('zero-fills the weeks it passes over, so no effort appears uninvited', () => {
    const next = setAllocation(meridian, 'a5', 14, 0.5);
    const assignment = next.assignments.find((a) => a.id === 'a5')!;
    // a5 ran 4–11 at 1.0 FTE. Weeks 12 and 13 were skipped over, not staffed.
    expect(assignment.allocationByWeek?.[12]).toBe(0);
    expect(assignment.allocationByWeek?.[13]).toBe(0);
  });

  it('adds exactly the effort the user typed and no more', () => {
    const before = effort();
    const next = setAllocation(meridian, 'a5', 14, 0.5);
    // Week 14 has 5 working days and no holiday: 0.5 × 5 = 2.5 days.
    expect(effort(next) - before).toBeCloseTo(2.5, 6);
  });

  it('clamps a wild value rather than accepting it', () => {
    const next = setAllocation(meridian, 'a5', 5, 99);
    expect(next.assignments.find((a) => a.id === 'a5')!.allocationByWeek?.[5]).toBe(2);
    const negative = setAllocation(meridian, 'a5', 5, -3);
    expect(negative.assignments.find((a) => a.id === 'a5')!.allocationByWeek?.[5]).toBe(0);
  });

  it('shortens the row when the last cell is cleared', () => {
    const next = setAllocation(meridian, 'a5', 11, null);
    const assignment = next.assignments.find((a) => a.id === 'a5')!;
    expect(assignment.startWeek).toBe(4);
    expect(assignment.endWeek).toBe(10);
  });

  it('shortens from the front when the first cell is cleared', () => {
    const next = setAllocation(meridian, 'a5', 4, null);
    expect(next.assignments.find((a) => a.id === 'a5')!.startWeek).toBe(5);
  });

  it('leaves no trailing zeros behind when an extension is undone', () => {
    const extended = setAllocation(meridian, 'a5', 14, 0.5);
    const undone = setAllocation(extended, 'a5', 14, null);
    const assignment = undone.assignments.find((a) => a.id === 'a5')!;
    // a5 ran 4–11. Extending to 14 zero-filled 12 and 13; clearing 14 should collapse
    // straight back past them rather than leaving the row open at zero effort.
    expect(assignment.endWeek).toBe(11);
    expect(assignment.allocationByWeek?.[12]).toBeUndefined();
    expect(assignment.allocationByWeek?.[13]).toBeUndefined();
    expect(effort(undone)).toBeCloseTo(effort(), 6);
  });

  it('keeps a deliberate zero inside the row', () => {
    const zeroed = setAllocation(meridian, 'a5', 7, 0);
    expect(zeroed.assignments.find((a) => a.id === 'a5')!.allocationByWeek?.[7]).toBe(0);
    expect(zeroed.assignments.find((a) => a.id === 'a5')!.endWeek).toBe(11);
  });

  it('walks a row back one week at a time', () => {
    let next = meridian;
    for (const week of [11, 10, 9]) next = setAllocation(next, 'a5', week, null);
    expect(next.assignments.find((a) => a.id === 'a5')!.endWeek).toBe(8);
  });

  it('never shrinks a row out of existence', () => {
    const single = setAssignmentRange(meridian, 'a5', 6, 6);
    const cleared = setAllocation(single, 'a5', 6, null);
    const assignment = cleared.assignments.find((a) => a.id === 'a5')!;
    expect(assignment.startWeek).toBe(6);
    expect(assignment.endWeek).toBe(6);
  });

  it('returns a week to its default when cleared in the middle of the row', () => {
    const set = setAllocation(meridian, 'a5', 5, 0.25);
    const cleared = setAllocation(set, 'a5', 5, null);
    const assignment = cleared.assignments.find((a) => a.id === 'a5')!;
    expect(assignment.allocationByWeek?.[5]).toBeUndefined();
    expect(assignment.startWeek).toBe(4);
    expect(assignment.endWeek).toBe(11);
    expect(effort(cleared)).toBeCloseTo(effort(), 6);
  });
});

describe('moving a workstream', () => {
  it('takes its team with it', () => {
    const next = setWorkstream(meridian, 'ws-platform', { startWeek: 6 });
    const assignment = next.assignments.find((a) => a.id === 'a5')!;
    expect(assignment.startWeek).toBe(6);
    expect(assignment.endWeek).toBe(13);
  });

  it('carries per-week overrides along with the shift', () => {
    const withOverride = setAllocation(meridian, 'a5', 5, 0.25);
    const moved = setWorkstream(withOverride, 'ws-platform', { startWeek: 6 });
    const assignment = moved.assignments.find((a) => a.id === 'a5')!;
    expect(assignment.allocationByWeek?.[7]).toBe(0.25);
    expect(assignment.allocationByWeek?.[5]).toBeUndefined();
  });

  it('renames without moving anything', () => {
    const next = setWorkstream(meridian, 'ws-platform', { name: 'Lakehouse' });
    expect(next.workstreams.find((w) => w.id === 'ws-platform')!.name).toBe('Lakehouse');
    expect(effort(next)).toBeCloseTo(effort(), 6);
  });
});

describe('phases', () => {
  it('renames and re-dates', () => {
    const next = setPhase(meridian, 'ph-discovery', { name: 'Mobilisation', endWeek: 5 });
    const phase = next.phases.find((p) => p.id === 'ph-discovery')!;
    expect(phase.name).toBe('Mobilisation');
    expect(phase.endWeek).toBe(5);
  });

  it('cannot be shrunk inside the work it contains', () => {
    const next = setPhase(meridian, 'ph-build', { endWeek: 5 });
    // The Build workstreams still run to week 11, so the phase must still cover them.
    expect(next.phases.find((p) => p.id === 'ph-build')!.endWeek).toBe(11);
  });
});

describe('naming people', () => {
  it('staffs a gap by naming it', () => {
    const before = computePlan(meridian).unstaffedEffortDays;
    const next = setPersonName(meridian, 'a6', 'K. Adeyemi');
    const assignment = next.assignments.find((a) => a.id === 'a6')!;
    expect(assignment.personId).toBeDefined();
    expect(next.people.find((p) => p.id === assignment.personId)!.name).toBe('K. Adeyemi');
    expect(computePlan(next).unstaffedEffortDays).toBeLessThan(before);
  });

  it('reopens the gap when the name is cleared', () => {
    const staffed = setPersonName(meridian, 'a6', 'K. Adeyemi');
    const cleared = setPersonName(staffed, 'a6', '   ');
    expect(cleared.assignments.find((a) => a.id === 'a6')!.personId).toBeUndefined();
  });

  it('renames the same person on every row they appear on', () => {
    // T. Osei is on a3, a13 and a14.
    const next = setPersonName(meridian, 'a3', 'T. Osei-Bonsu');
    const rows = next.assignments.filter((a) => a.personId === 'p-osei');
    expect(rows).toHaveLength(3);
    expect(next.people.find((p) => p.id === 'p-osei')!.name).toBe('T. Osei-Bonsu');
  });

  it('does not change the cost of a row just by naming it', () => {
    // The new person has no personal cost rate, so the grade rate still applies.
    const before = computePlan(meridian).directCost;
    const next = setPersonName(meridian, 'a6', 'K. Adeyemi');
    expect(computePlan(next).directCost).toBe(before);
  });
});

describe('changing a level', () => {
  it('moves cost and revenue together', () => {
    const before = computePlan(meridian);
    const next = setAssignmentGrade(meridian, 'a6', 'g-principal');
    const after = computePlan(next);
    expect(after.directCost).toBeGreaterThan(before.directCost);
    expect(after.revenueAtStandardRates).toBeGreaterThan(before.revenueAtStandardRates);
    expect(after.totalEffortDays).toBeCloseTo(before.totalEffortDays, 6);
  });

  it('leaves a named person on their own cost rate', () => {
    // J. Moreau costs £470/day whatever grade he is booked at — his salary is his salary.
    const next = setAssignmentGrade(meridian, 'a5', 'g-analyst');
    const line = computePlan(next).lines.find((l) => l.assignmentId === 'a5')!;
    expect(line.costRate).toBe(47000);
    expect(line.chargeRate).toBe(54000);
  });
});

describe('adding and removing rows', () => {
  it('adds a row spanning its workstream', () => {
    const next = addAssignment(meridian, 'ws-platform');
    const added = next.assignments[next.assignments.length - 1]!;
    expect(added.workstreamId).toBe('ws-platform');
    expect(added.startWeek).toBe(4);
    expect(added.endWeek).toBe(11);
    expect(effort(next)).toBeGreaterThan(effort());
  });

  it('removes a row and its effort', () => {
    const next = removeAssignment(meridian, 'a5');
    expect(next.assignments.find((a) => a.id === 'a5')).toBeUndefined();
    expect(effort(next)).toBeLessThan(effort());
  });
});

describe('moving the engagement in time', () => {
  it('renames the weeks without touching the plan', () => {
    const next = setStartDate(meridian, '2027-01-04');
    expect(effort(next)).toBeCloseTo(effort(), 6);
    expect(next.assignments).toEqual(meridian.assignments);
    expect(weekStartLabel(next.startDate, 1)).toBe('4 Jan');
  });

  it('ignores a malformed date rather than corrupting the model', () => {
    expect(setStartDate(meridian, 'not-a-date')).toBe(meridian);
  });
});

describe('sprint and quarter rulers', () => {
  it('numbers sprints from week 1', () => {
    expect(sprintNumber(1, 2)).toBe(1);
    expect(sprintNumber(2, 2)).toBe(1);
    expect(sprintNumber(3, 2)).toBe(2);
    expect(sprintNumber(7, 3)).toBe(3);
  });

  it('reads quarters off the real calendar', () => {
    expect(quarterLabel('2026-09-07', 1)).toBe('Q3 2026');
    expect(quarterLabel('2026-09-07', 5)).toBe('Q4 2026');
  });

  it('collapses contiguous weeks into spans that cover every week exactly once', () => {
    const spans = headerSpans(14, (week) => `S${sprintNumber(week, 2)}`);
    expect(spans).toHaveLength(7);
    expect(spans.every((span) => span.span === 2)).toBe(true);
    expect(spans.reduce((total, span) => total + span.span, 0)).toBe(14);
  });

  it('handles a sprint length that does not divide the engagement evenly', () => {
    const spans = headerSpans(14, (week) => `S${sprintNumber(week, 3)}`);
    expect(spans.reduce((total, span) => total + span.span, 0)).toBe(14);
    expect(spans[spans.length - 1]!.span).toBe(2);
  });

  it('clamps a nonsense sprint length', () => {
    expect(setSprintWeeks(meridian, 0).sprintWeeks).toBe(1);
    expect(setSprintWeeks(meridian, 99).sprintWeeks).toBe(12);
  });
});
