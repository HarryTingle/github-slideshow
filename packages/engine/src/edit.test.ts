import { describe, expect, it } from 'vitest';
import { headerSpans, quarterLabel, sprintNumber, weekStartLabel } from './calendar';
import { computePlan } from './compute';
import {
  addAssignment,
  setPersonAnnualLeave,
  setPersonLeave,
  addPhase,
  addWorkstream,
  allocationToDays,
  contentsOf,
  daysToAllocation,
  removePhase,
  removeWorkstream,
  setAllocationDays,
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
import type { Engagement } from './types';
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
    // Leave off, so the arithmetic is checkable by hand: week 14 has 5 working days and
    // no public holiday, so 0.5 FTE buys 0.5 × 5 = 2.5 days.
    const noLeave = { ...meridian, annualLeaveDays: 0 };
    const before = effort(noLeave);
    expect(effort(setAllocation(noLeave, 'a5', 14, 0.5)) - before).toBeCloseTo(2.5, 6);
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

  it('empties a week when cleared in the middle of the row, without shortening it', () => {
    // Changed deliberately: clearing used to delete the override, which handed the week
    // back to the row's default — so emptying a box in the middle of a booking put the
    // number straight back, and a single week could not be zeroed at all.
    const set = setAllocation(meridian, 'a5', 5, 0.25);
    const cleared = setAllocation(set, 'a5', 5, null);
    const assignment = cleared.assignments.find((a) => a.id === 'a5')!;
    expect(assignment.allocationByWeek?.[5]).toBe(0);
    expect(assignment.startWeek).toBe(4);
    expect(assignment.endWeek).toBe(11);
    // The week now carries no effort, so the total falls by what that week held.
    expect(effort(cleared)).toBeLessThan(effort());
  });

  it('still shortens the row when the cleared week is at either end', () => {
    const fromEnd = setAllocation(meridian, 'a5', 11, null);
    expect(fromEnd.assignments.find((a) => a.id === 'a5')!.endWeek).toBe(10);
    const fromStart = setAllocation(meridian, 'a5', 4, null);
    expect(fromStart.assignments.find((a) => a.id === 'a5')!.startWeek).toBe(5);
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

  it('keeps the space between a first name and a surname', () => {
    // The field is controlled: what it shows is whatever was last stored. So this types
    // one character at a time, feeding the stored value back in each round, exactly as
    // the input does. Trimming on the way in strips the space the instant it is pressed
    // and the surname can never be typed — the whole name arrives as "IanPayne".
    let engagement = meridian;
    const stored = () => {
      const assignment = engagement.assignments.find((a) => a.id === 'a6')!;
      if (!assignment.personId) return '';
      return engagement.people.find((person) => person.id === assignment.personId)!.name;
    };
    for (const character of 'Ian Payne') {
      engagement = setPersonName(engagement, 'a6', stored() + character);
    }
    expect(stored()).toBe('Ian Payne');
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
    const next = setAssignmentGrade(meridian, 'a6', 'g-associate-director');
    const after = computePlan(next);
    expect(after.directCost).toBeGreaterThan(before.directCost);
    expect(after.revenueAtStandardRates).toBeGreaterThan(before.revenueAtStandardRates);
    expect(after.totalEffortDays).toBeCloseTo(before.totalEffortDays, 6);
  });

  it('leaves a named person on their own cost rate', () => {
    // Someone paid above their band costs what they cost, whatever grade they are
    // booked at. The charge rate follows the grade; the cost does not.
    const withPersonalRate: Engagement = {
      ...meridian,
      people: meridian.people.map((person) =>
        person.id === 'p-moreau' ? { ...person, costRate: 74000 } : person,
      ),
    };
    const next = setAssignmentGrade(withPersonalRate, 'a5', 'g-associate');
    const line = computePlan(next).lines.find((l) => l.assignmentId === 'a5')!;
    expect(line.costRate).toBe(74000);
    expect(line.chargeRate).toBe(52500); // Associate standard day rate, £525
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


describe('cells in days a week', () => {
  it('reads a full week as the working week, not as 1', () => {
    expect(allocationToDays(1, 5)).toBe(5);
    expect(allocationToDays(0.6, 5)).toBeCloseTo(3, 6);
    expect(daysToAllocation(5, 5)).toBe(1);
    expect(daysToAllocation(4, 5)).toBeCloseTo(0.8, 6);
  });

  it('round-trips whatever the working week is', () => {
    for (const workingDays of [4, 4.5, 5, 6]) {
      for (const days of [0, 1, 2.5, 4, 5]) {
        expect(allocationToDays(daysToAllocation(days, workingDays), workingDays)).toBeCloseTo(days, 9);
      }
    }
  });

  it('does not divide by a zero-day week', () => {
    expect(daysToAllocation(5, 0)).toBe(0);
  });

  it('books five days as full time', () => {
    const noLeave = { ...meridian, annualLeaveDays: 0 };
    const next = setAllocationDays(noLeave, 'a7', 5, 5);
    expect(next.assignments.find((a) => a.id === 'a7')!.allocationByWeek?.[5]).toBeCloseTo(1, 9);
  });

  it('books time, which is not the same as delivering it', () => {
    // Week 8 carries a public holiday. Five days booked still delivers four.
    const noLeave = { ...meridian, annualLeaveDays: 0 };
    const next = setAllocationDays(noLeave, 'a7', 8, 5);
    const line = computePlan(next).lines.find((l) => l.assignmentId === 'a7' && l.week === 8)!;
    expect(line.allocation).toBeCloseTo(1, 9);
    expect(line.availableDays).toBe(4);
    expect(line.effortDays).toBeCloseTo(4, 9);
  });

  it('empties a cell when given null, rather than restoring the row default', () => {
    const set = setAllocationDays(meridian, 'a7', 6, 2);
    const cleared = setAllocationDays(set, 'a7', 6, null);
    expect(cleared.assignments.find((a) => a.id === 'a7')!.allocationByWeek?.[6]).toBe(0);
  });
});

describe('phases and workstreams', () => {
  it('adds a phase after the last one, with somewhere to put people', () => {
    const next = addPhase(meridian, 'Hypercare');
    const phase = next.phases.find((p) => p.name === 'Hypercare')!;
    expect(phase.startWeek).toBe(15);
    expect(next.workstreams.filter((ws) => ws.phaseId === phase.id)).toHaveLength(1);
    expect(next.weeks).toBeGreaterThanOrEqual(phase.endWeek);
  });

  it('removes a phase and everything staffed on it', () => {
    const before = computePlan(meridian).totalEffortDays;
    const next = removePhase(meridian, 'ph-build');
    expect(next.phases.find((p) => p.id === 'ph-build')).toBeUndefined();
    expect(next.workstreams.some((ws) => ws.phaseId === 'ph-build')).toBe(false);
    expect(computePlan(next).totalEffortDays).toBeLessThan(before);
  });

  it('leaves no orphaned workstream or assignment behind', () => {
    const next = removePhase(meridian, 'ph-build');
    const phaseIds = new Set(next.phases.map((p) => p.id));
    const workstreamIds = new Set(next.workstreams.map((ws) => ws.id));
    expect(next.workstreams.every((ws) => phaseIds.has(ws.phaseId))).toBe(true);
    expect(next.assignments.every((a) => workstreamIds.has(a.workstreamId))).toBe(true);
  });

  it('reports what a delete would take with it', () => {
    expect(contentsOf(meridian, 'ph-build')).toEqual({ workstreams: 3, roles: 9 });
    expect(contentsOf(meridian, 'ph-discovery').roles).toBe(4);
  });

  it('allows the plan to be emptied and rebuilt', () => {
    let next = meridian;
    for (const phase of [...meridian.phases]) next = removePhase(next, phase.id);
    expect(next.phases).toHaveLength(0);
    expect(next.assignments).toHaveLength(0);
    expect(computePlan(next).totalEffortDays).toBe(0);

    next = addPhase(next, 'Discovery');
    expect(next.phases).toHaveLength(1);
    expect(next.workstreams).toHaveLength(1);
    next = addAssignment(next, next.workstreams[0]!.id);
    expect(computePlan(next).totalEffortDays).toBeGreaterThan(0);
  });

  it('adds a workstream spanning its phase, and removes it with its roles', () => {
    const added = addWorkstream(meridian, 'ph-build', 'Data Quality');
    const workstream = added.workstreams.find((ws) => ws.name === 'Data Quality')!;
    expect(workstream.startWeek).toBe(4);
    expect(workstream.endWeek).toBe(11);

    const withRole = addAssignment(added, workstream.id);
    const removed = removeWorkstream(withRole, workstream.id);
    expect(removed.workstreams.find((ws) => ws.id === workstream.id)).toBeUndefined();
    expect(removed.assignments.some((a) => a.workstreamId === workstream.id)).toBe(false);
  });
});


describe('leave, per person', () => {
  const leaveOf = (e: Engagement, id: string) => e.people.find((p) => p.id === id)!.leave ?? {};

  it('books leave in a week', () => {
    const next = setPersonLeave(meridian, 'p-moreau', 6, 3);
    expect(leaveOf(next, 'p-moreau')[6]).toBe(3);
  });

  it('clears a booking when set to nothing', () => {
    const booked = setPersonLeave(meridian, 'p-moreau', 6, 3);
    expect(leaveOf(setPersonLeave(booked, 'p-moreau', 6, null), 'p-moreau')[6]).toBeUndefined();
    expect(leaveOf(setPersonLeave(booked, 'p-moreau', 6, 0), 'p-moreau')[6]).toBeUndefined();
  });

  it('cannot book more leave in a week than the week has days', () => {
    expect(leaveOf(setPersonLeave(meridian, 'p-moreau', 6, 9), 'p-moreau')[6]).toBe(5);
  });

  it('changes when leave is taken, not how much of it there is', () => {
    // The allowance is already provided for across the weeks worked, so a booking is set
    // against that provision rather than added to it. On a person whose allocation is the
    // same every week, the total is therefore untouched.
    const WEEKS = 12;
    const flat: Engagement = {
      ...meridian,
      annualLeaveDays: 23,
      weeks: WEEKS,
      calendar: { workingDaysPerWeek: 5 },
      phases: [{ id: 'ph', name: 'Build', order: 1, startWeek: 1, endWeek: WEEKS }],
      workstreams: [{ id: 'ws', name: 'Platform', phaseId: 'ph', startWeek: 1, endWeek: WEEKS }],
      milestones: [],
      people: [{ id: 'p1', name: 'A. Person', gradeId: 'g-consultant', roleId: 'c-platform' }],
      assignments: [
        { id: 'a', workstreamId: 'ws', roleId: 'c-platform', gradeId: 'g-consultant', personId: 'p1', startWeek: 1, endWeek: WEEKS, allocation: 1 },
      ],
    };
    const before = computePlan(flat).totalEffortDays;
    const booked = setPersonLeave(flat, 'p1', 5, 3);
    expect(computePlan(booked).totalEffortDays).toBeCloseTo(before, 6);

    const week5 = (e: Engagement) =>
      computePlan(e).lines.find((l) => l.week === 5)!.effortDays;
    expect(week5(booked)).toBeLessThan(week5(flat));
  });

  it('costs more effort when leave lands in a week somebody is on full time', () => {
    // J. Moreau is full time on the build and 0.6 on handover. A day off during the build
    // costs a full day; the same day provided for across a mixed allocation costs less.
    // Not a rounding artefact — it is the reason *when* leave falls is worth modelling.
    const before = computePlan(meridian).totalEffortDays;
    const inBuild = computePlan(setPersonLeave(meridian, 'p-moreau', 6, 2)).totalEffortDays;
    const inHandover = computePlan(setPersonLeave(meridian, 'p-moreau', 13, 2)).totalEffortDays;
    expect(inBuild).toBeLessThan(before);
    expect(inHandover).toBeGreaterThan(inBuild);
  });

  it('does reduce the total once bookings exceed the allowance', () => {
    let next = meridian;
    for (const week of [4, 5, 6, 7, 8]) next = setPersonLeave(next, 'p-moreau', week, 5);
    expect(computePlan(next).totalEffortDays).toBeLessThan(computePlan(meridian).totalEffortDays);
  });

  it('gives one person a different allowance from everyone else', () => {
    const next = setPersonAnnualLeave(meridian, 'p-moreau', 40);
    expect(next.people.find((p) => p.id === 'p-moreau')!.annualLeaveDays).toBe(40);
    expect(computePlan(next).totalEffortDays).toBeLessThan(computePlan(meridian).totalEffortDays);
  });

  it('restores the practice default when the override is cleared', () => {
    const generous = setPersonAnnualLeave(meridian, 'p-moreau', 40);
    const restored = setPersonAnnualLeave(generous, 'p-moreau', null);
    expect(restored.people.find((p) => p.id === 'p-moreau')!.annualLeaveDays).toBeUndefined();
    expect(computePlan(restored).totalEffortDays).toBeCloseTo(computePlan(meridian).totalEffortDays, 6);
  });

  it('clamps a nonsense allowance rather than accepting it', () => {
    expect(setPersonAnnualLeave(meridian, 'p-moreau', -5).people.find((p) => p.id === 'p-moreau')!.annualLeaveDays).toBe(0);
    expect(setPersonAnnualLeave(meridian, 'p-moreau', 900).people.find((p) => p.id === 'p-moreau')!.annualLeaveDays).toBe(60);
  });
});
