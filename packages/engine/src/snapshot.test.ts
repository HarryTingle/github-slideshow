import { describe, expect, it } from 'vitest';
import {
  addPhase,
  applyRateMultiplier,
  setAssignmentRange,
  setContractValue,
  setPersonLeave,
  setPersonName,
  setPhase,
  setScenarioRate,
  setWeeks,
} from './edit';
import { pounds } from './money';
import { meridian } from './seed';
import {
  billedRatesFor,
  diffFigures,
  diffSnapshot,
  diffStructure,
  figuresOf,
  formatDelta,
  takeSnapshot,
  verifySnapshot,
  type Engagement,
  type Snapshot,
} from './index';

const AT = '2026-08-20T09:00:00.000Z';

function issue(engagement: Engagement, existing: Snapshot[] = [], at = AT): Snapshot {
  return takeSnapshot(engagement, {
    scenarioId: 'sc-fixed',
    audience: 'slt',
    issuedBy: 'H. Tingle',
    note: 'sent to the SLT',
    at,
    existing,
  });
}

describe('taking a snapshot', () => {
  it('records what was issued, to whom, by whom and when', () => {
    const snapshot = issue(meridian);
    expect(snapshot.version).toBe(1);
    expect(snapshot.audience).toBe('slt');
    expect(snapshot.issuedBy).toBe('H. Tingle');
    expect(snapshot.issuedAt).toBe(AT);
    expect(snapshot.note).toBe('sent to the SLT');
    expect(snapshot.scenarioId).toBe('sc-fixed');
    expect(snapshot.scenarioName).toBe('Fixed price');
    expect(snapshot.client).toBe(meridian.client);
  });

  it('stores the figures the pack committed to', () => {
    const snapshot = issue(meridian);
    expect(snapshot.figures).toEqual(figuresOf(meridian, 'sc-fixed'));
    expect(snapshot.figures.revenue).toBeGreaterThan(0);
    expect(snapshot.figures.weeks).toBe(meridian.weeks);
  });

  it('increments the version per engagement and never reuses a number', () => {
    const first = issue(meridian);
    const second = issue(meridian, [first]);
    const third = issue(meridian, [second]); // first deleted from the list
    expect([first.version, second.version, third.version]).toEqual([1, 2, 3]);
    expect(new Set([first.id, second.id, third.id]).size).toBe(3);
  });

  it('freezes the document — later edits to the model do not reach it', () => {
    const snapshot = issue(meridian);
    const revenueAsIssued = snapshot.figures.revenue;

    const moved = setContractValue(setWeeks(meridian, 20), 'sc-fixed', pounds(310000));
    expect(moved.weeks).toBe(20);

    expect(snapshot.engagement.weeks).toBe(meridian.weeks);
    expect(snapshot.figures.revenue).toBe(revenueAsIssued);
    // No shared structure at all — mutating the frozen copy cannot touch the original.
    snapshot.engagement.phases[0]!.name = 'Tampered';
    expect(meridian.phases[0]!.name).not.toBe('Tampered');
  });
});

describe('verifying a snapshot', () => {
  it('recomputing the frozen document reproduces the issued figures', () => {
    const snapshot = issue(meridian);
    const verification = verifySnapshot(snapshot);
    expect(verification.agrees).toBe(true);
    expect(verification.differences).toEqual([]);
  });

  it('reports a disagreement rather than showing the new answer', () => {
    // Stand in for the engine changing under an issued pack: the stored figure and the
    // frozen document no longer agree, and that must surface.
    const snapshot = issue(meridian);
    const tampered: Snapshot = {
      ...snapshot,
      figures: { ...snapshot.figures, revenue: snapshot.figures.revenue + pounds(5000) },
    };
    const verification = verifySnapshot(tampered);
    expect(verification.agrees).toBe(false);
    expect(verification.differences[0]?.key).toBe('revenue');
    expect(verification.differences[0]?.delta).toBe(-pounds(5000));
  });
});

describe('diffing figures', () => {
  it('is empty when nothing has moved', () => {
    const figures = figuresOf(meridian, 'sc-fixed');
    expect(diffFigures(figures, figures)).toEqual([]);
  });

  it('states a margin movement in percentage points, not per cent', () => {
    const from = figuresOf(meridian, 'sc-fixed');
    const to = { ...from, grossMarginPct: (from.grossMarginPct ?? 0) - 0.05 };
    const change = diffFigures(from, to).find((entry) => entry.key === 'grossMarginPct')!;
    expect(change.delta).toBeCloseTo(-0.05, 10);
    expect(formatDelta(change)).toBe('−5.0pp');
    expect(change.favourable).toBe(false);
  });

  it('calls a cost rise unfavourable and a revenue rise favourable', () => {
    const from = figuresOf(meridian, 'sc-fixed');
    const to = { ...from, cost: from.cost + pounds(10000), revenue: from.revenue + pounds(10000) };
    const changes = diffFigures(from, to);
    expect(changes.find((entry) => entry.key === 'cost')?.favourable).toBe(false);
    expect(changes.find((entry) => entry.key === 'revenue')?.favourable).toBe(true);
  });

  it('ignores a movement too small to be visible at the precision we print', () => {
    const from = figuresOf(meridian, 'sc-fixed');
    // 30p on a figure printed to the pound, and 0.02pp on one printed to 0.1pp.
    const to = {
      ...from,
      revenue: from.revenue + 30,
      grossMarginPct: (from.grossMarginPct ?? 0) + 0.0002,
    };
    expect(diffFigures(from, to)).toEqual([]);
  });

  it('treats a figure that only exists on one side as appearing, not moving from zero', () => {
    const tm = figuresOf(meridian, 'sc-tm');
    const fixed = figuresOf(meridian, 'sc-fixed');
    expect(tm.breakEvenOverrunPct).toBeNull();
    expect(fixed.breakEvenOverrunPct).not.toBeNull();

    const change = diffFigures(tm, fixed).find((entry) => entry.key === 'breakEvenOverrunPct')!;
    expect(change.kind).toBe('appeared');
    expect(change.delta).toBeNull();
    expect(formatDelta(change)).toMatch(/^now /);

    const reverse = diffFigures(fixed, tm).find((entry) => entry.key === 'breakEvenOverrunPct')!;
    expect(reverse.kind).toBe('disappeared');
    expect(formatDelta(reverse)).toBe('no longer applies');
  });
});

describe('diffing structure', () => {
  it('is empty against itself', () => {
    expect(diffStructure(meridian, meridian)).toEqual([]);
  });

  it('names a phase that moved, in weeks', () => {
    const moved = setPhase(meridian, 'ph-discovery', { endWeek: 5 });
    const change = diffStructure(meridian, moved).find((entry) => entry.entity === 'phase')!;
    expect(change.label).toBe('Discovery');
    expect(change.detail).toBe('weeks 1–3 → weeks 1–5');
  });

  it('names a person who was renamed, and one whose leave changed', () => {
    // a7 is S. Bello's row on Data Platform; naming is done from the row, as in the grid.
    const renamed = setPersonName(meridian, 'a7', 'S. Bello-Adeyemi');
    const [rename] = diffStructure(meridian, renamed).filter((entry) => entry.entity === 'person');
    expect(rename?.detail).toBe('renamed from “S. Bello”');

    const onLeave = setPersonLeave(meridian, 'p-bello', 6, 3);
    const [leave] = diffStructure(meridian, onLeave).filter((entry) => entry.entity === 'person');
    expect(leave?.label).toBe('S. Bello');
    expect(leave?.detail).toBe('booked leave 0.0 days → 3.0 days');
  });

  it('reports a phase added to the plan', () => {
    const added = addPhase(meridian, 'Hypercare');
    const change = diffStructure(meridian, added).find((entry) => entry.kind === 'added')!;
    expect(change.entity).toBe('phase');
    expect(change.label).toBe('Hypercare');
  });

  it('reports a phase removed from the plan', () => {
    const without = { ...meridian, phases: meridian.phases.filter((phase) => phase.id !== 'ph-deploy') };
    const change = diffStructure(meridian, without).find((entry) => entry.entity === 'phase')!;
    expect(change.kind).toBe('removed');
    expect(change.label).toBe('Deploy & Handover');
  });

  it('reports a rate moved on one scenario without touching the standard card', () => {
    const repriced = setScenarioRate(meridian, 'sc-tm', 'g-consultant', pounds(750));
    const change = diffStructure(meridian, repriced).find((entry) => entry.entity === 'rate')!;
    expect(change.label).toContain('Consultant');
    expect(change.label).toContain('T&M');
    expect(change.detail).toContain('£750');
  });

  it('reports a change of commercial terms on a scenario', () => {
    const repriced = setContractValue(meridian, 'sc-fixed', pounds(260000));
    const change = diffStructure(meridian, repriced).find((entry) => entry.entity === 'scenario')!;
    expect(change.label).toBe('Fixed price');
    expect(change.detail).toBe('commercial terms changed');
  });

  it('describes an assignment by who is on it and how much of them', () => {
    const stretched = setAssignmentRange(meridian, 'a5', 4, 13);
    const changes = diffStructure(meridian, stretched).filter((entry) => entry.entity === 'assignment');
    expect(changes).toHaveLength(1);
    expect(changes[0]!.label).toBe('J. Moreau on Data Platform');
    // 8 weeks at 1.0 FTE is 35.5 days once holidays and the leave provision come off,
    // not 40 — the detail quotes the effort the engine actually plans, not the headline.
    expect(changes[0]!.detail).toBe('35.5 days → 43.6 days');
  });

  it('grows the workstream and phase around an assignment that outran them', () => {
    const stretched = setAssignmentRange(meridian, 'a5', 4, 13);
    const changes = diffStructure(meridian, stretched);
    expect(changes.find((entry) => entry.entity === 'workstream')?.detail).toBe(
      'weeks 4–11 → weeks 4–13',
    );
    expect(changes.find((entry) => entry.entity === 'phase')?.detail).toBe('weeks 4–11 → weeks 4–13');
  });
});

describe('diffing a snapshot against the live model', () => {
  it('is unchanged when nothing has been edited since it was issued', () => {
    const snapshot = issue(meridian);
    const diff = diffSnapshot(snapshot, meridian);
    expect(diff.unchanged).toBe(true);
    expect(diff.figures).toEqual([]);
    expect(diff.structural).toEqual([]);
    expect(diff.headline).toBe('Matches the live model');
  });

  it('reports both what moved and why', () => {
    const snapshot = issue(meridian);
    // Two more weeks of J. Moreau: more effort, more cost, and a fixed price that does
    // not follow either of them.
    const live = setAssignmentRange(meridian, 'a5', 4, 13);
    const diff = diffSnapshot(snapshot, live);

    expect(diff.unchanged).toBe(false);
    const cost = diff.figures.find((entry) => entry.key === 'cost')!;
    expect(cost.delta).toBeGreaterThan(0);
    expect(cost.favourable).toBe(false);

    // Fixed price: revenue is unmoved, so the margin has to fall.
    expect(diff.figures.find((entry) => entry.key === 'revenue')).toBeUndefined();
    expect(diff.figures.find((entry) => entry.key === 'grossMarginPct')!.delta).toBeLessThan(0);

    expect(
      diff.structural.some((entry) => entry.entity === 'phase' && entry.label === 'Build'),
    ).toBe(true);
    expect(diff.headline).toMatch(/other change/);
  });

  it('says so when the plan moved but the numbers did not', () => {
    const snapshot = issue(meridian);
    const live = {
      ...meridian,
      milestones: meridian.milestones.map((milestone) =>
        milestone.id === meridian.milestones[0]!.id ? { ...milestone, name: 'Kick-off' } : milestone,
      ),
    };
    const diff = diffSnapshot(snapshot, live);
    expect(diff.figures).toEqual([]);
    expect(diff.structural).toHaveLength(1);
    expect(diff.headline).toBe('1 change to the plan, no effect on the numbers');
  });

  it('compares the scenario the pack recommended, not whichever is selected now', () => {
    const snapshot = issue(meridian);
    // Move the T&M rates hard. The pack was issued on fixed price, so nothing should move.
    const tm = meridian.scenarios.find((scenario) => scenario.id === 'sc-tm')!;
    const live = applyRateMultiplier(meridian, 'sc-tm', 1.3, billedRatesFor(meridian, tm));
    const diff = diffSnapshot(snapshot, live);
    expect(diff.figures).toEqual([]);
    expect(diff.structural.every((entry) => entry.entity === 'rate')).toBe(true);
  });

  it('falls back to the first scenario when the one it recommended has been deleted', () => {
    const snapshot = issue(meridian);
    const live = { ...meridian, scenarios: meridian.scenarios.filter((s) => s.id !== 'sc-fixed') };
    const diff = diffSnapshot(snapshot, live);
    expect(diff.unchanged).toBe(false);
    expect(
      diff.structural.some((entry) => entry.entity === 'scenario' && entry.kind === 'removed'),
    ).toBe(true);
  });
});
