import { describe, expect, it } from 'vitest';
import { availableDays, rampFactor } from './calendar';
import { computeScenario, computeStructure, maxCashExposure, sliceOf } from './commercial';
import { capacityBasis, computePlan } from './compute';
import { analyse, applySensitivity, computeMetrics } from './metrics';
import { pounds, ratio, toMoney } from './money';
import { meridian } from './seed';
import type { Engagement } from './types';
import { validate } from './validate';

/**
 * The worked example from `specs/0001-modelling-engine-core.md`.
 *
 * One assignment. Senior Consultant, cost £450/day, charge £950/day, 0.6 FTE for four
 * weeks, five working days a week, one public holiday in week 3.
 */
function workedExample(overrides: Partial<Engagement['assignments'][number]> = {}): Engagement {
  return {
    id: 'e', name: 'Worked example', client: 'Test', startDate: '2026-01-05', weeks: 4,
    calendar: { workingDaysPerWeek: 5, publicHolidays: { 3: 1 } },
    grades: [{ id: 'g', name: 'Senior Consultant', order: 3, costRate: pounds(450), chargeRate: pounds(950) }],
    roles: [{ id: 'r', name: 'Data Engineer' }],
    people: [],
    phases: [{ id: 'ph', name: 'Build', order: 1, startWeek: 1, endWeek: 4 }],
    workstreams: [{ id: 'ws', name: 'Data Platform', phaseId: 'ph', startWeek: 1, endWeek: 4 }],
    milestones: [],
    assignments: [
      { id: 'a', workstreamId: 'ws', roleId: 'r', gradeId: 'g', startWeek: 1, endWeek: 4, allocation: 0.6, ...overrides },
    ],
    rateCards: [],
    scenarios: [{ id: 's', name: 'T&M', structure: { type: 'tm' } }],
    guardrails: [],
  };
}

describe('money', () => {
  it('rounds half-up to integer minor units', () => {
    expect(toMoney(1234.5)).toBe(1235);
    expect(toMoney(1234.4)).toBe(1234);
    expect(toMoney(-1234.5)).toBe(-1235);
  });

  it('never returns NaN or Infinity from a derived ratio', () => {
    expect(ratio(100, 0)).toBeNull();
    expect(ratio(0, 0)).toBeNull();
    expect(ratio(50, 100)).toBe(0.5);
  });
});

describe('availability', () => {
  it('subtracts public holidays and personal leave', () => {
    const calendar = { workingDaysPerWeek: 5, publicHolidays: { 3: 1 } };
    expect(availableDays(calendar, 1)).toBe(5);
    expect(availableDays(calendar, 3)).toBe(4);
    expect(availableDays(calendar, 3, { id: 'p', name: 'X', gradeId: 'g', roleId: 'r', leave: { 3: 2 } })).toBe(2);
  });

  it('never goes negative when leave exceeds the working week', () => {
    const calendar = { workingDaysPerWeek: 5, publicHolidays: { 1: 1 } };
    expect(availableDays(calendar, 1, { id: 'p', name: 'X', gradeId: 'g', roleId: 'r', leave: { 1: 9 } })).toBe(0);
  });

  it('ramps linearly to full productivity', () => {
    expect(rampFactor(1, 1, 2)).toBe(0.5);
    expect(rampFactor(2, 1, 2)).toBe(1);
    expect(rampFactor(3, 1, 2)).toBe(1);
    expect(rampFactor(1, 1, undefined)).toBe(1);
  });
});

describe('annual leave', () => {
  const WEEKS = 26;
  function withLeave(annualLeaveDays: number, personLeave?: Record<number, number>): Engagement {
    return {
      id: 'e', name: 'Leave', client: 'Test', startDate: '2026-01-05', weeks: WEEKS,
      annualLeaveDays,
      calendar: { workingDaysPerWeek: 5 },
      grades: [{ id: 'g', name: 'Consultant', order: 3, costRate: pounds(560), chargeRate: pounds(800) }],
      roles: [{ id: 'r', name: 'Platform Engineering' }],
      people: [{ id: 'p', name: 'A. Person', gradeId: 'g', roleId: 'r', leave: personLeave }],
      phases: [{ id: 'ph', name: 'Build', order: 1, startWeek: 1, endWeek: WEEKS }],
      workstreams: [{ id: 'ws', name: 'Platform', phaseId: 'ph', startWeek: 1, endWeek: WEEKS }],
      milestones: [],
      assignments: [
        { id: 'a', workstreamId: 'ws', roleId: 'r', gradeId: 'g', personId: 'p', startWeek: 1, endWeek: WEEKS, allocation: 1 },
      ],
      rateCards: [],
      scenarios: [{ id: 's', name: 'T&M', structure: { type: 'tm' } }],
      guardrails: [],
    };
  }

  it('pro-rates the allowance to the weeks actually worked', () => {
    // 26 weeks is half a year, so half of a 23-day allowance: 11.5 days.
    const full = computePlan(withLeave(0)).totalEffortDays;
    const withAl = computePlan(withLeave(23)).totalEffortDays;
    expect(full - withAl).toBeCloseTo(11.5, 6);
  });

  it('sets booked leave against the allowance rather than adding to it', () => {
    // 5 days booked in week 3, out of an 11.5-day pro-rata entitlement. The total
    // deduction should still be 11.5 — the provision covers only the remainder.
    const booked = computePlan(withLeave(23, { 3: 5 })).totalEffortDays;
    const unbooked = computePlan(withLeave(23)).totalEffortDays;
    expect(booked).toBeCloseTo(unbooked, 6);
  });

  it('does not claw back capacity when more leave is booked than the allowance', () => {
    const heavy = computePlan(withLeave(23, { 3: 5, 4: 5, 5: 5 })).totalEffortDays;
    const full = computePlan(withLeave(0)).totalEffortDays;
    expect(full - heavy).toBeCloseTo(15, 6);
  });

  it('is off when the allowance is zero', () => {
    const plan = computePlan(withLeave(0));
    expect(plan.lines.every((line) => line.leaveProvision === 0)).toBe(true);
    expect(plan.lines.every((line) => line.availableDays === 5)).toBe(true);
  });

  it('applies to an unstaffed role too, so a gap is not cheaper than the person filling it', () => {
    const staffed = withLeave(23);
    const unstaffed: Engagement = {
      ...staffed,
      assignments: staffed.assignments.map(({ personId, ...rest }) => rest),
    };
    expect(computePlan(unstaffed).totalEffortDays).toBeCloseTo(
      computePlan(staffed).totalEffortDays,
      6,
    );
  });

  it('lets one person carry a different allowance from the rest', () => {
    const standard = withLeave(23);
    const generous: Engagement = {
      ...standard,
      people: standard.people.map((person) => ({ ...person, annualLeaveDays: 46 })),
    };
    expect(computePlan(generous).totalEffortDays).toBeLessThan(
      computePlan(standard).totalEffortDays,
    );
  });
});

describe('capacity basis', () => {
  it('reconciles against an annual billable-day figure', () => {
    const basis = capacityBasis(meridian);
    // The source sheet quotes 253 billable days a year — 261 weekdays less 8 public
    // holidays — and 23 days of leave against it. Our calendar is expressed weekly, so
    // annualising it should land in the same neighbourhood, and the gap between the two
    // annualised figures should be the leave allowance.
    expect(basis.annualisedBeforeLeave - basis.annualisedAvailableDays).toBeCloseTo(23, 6);
    expect(basis.annualisedAvailableDays).toBeGreaterThan(220);
    expect(basis.annualisedAvailableDays).toBeLessThan(245);
  });

  it('accounts for every day between the working week and what is left', () => {
    const basis = capacityBasis(meridian);
    expect(basis.workingDays - basis.publicHolidayDays - basis.annualLeaveDays).toBeCloseTo(
      basis.availableDays,
      6,
    );
  });
});

describe('spec 0001 worked example', () => {
  const engagement = workedExample();
  const plan = computePlan(engagement);

  it('produces the effort in the spec, week by week', () => {
    expect(plan.lines.map((line) => line.effortDays)).toEqual([3, 3, 2.4, 3]);
    expect(plan.totalEffortDays).toBeCloseTo(11.4, 10);
  });

  it('produces the cost and revenue in the spec', () => {
    expect(plan.directCost).toBe(513000);
    expect(plan.revenueAtRates).toBe(1083000);
  });

  it('produces the derived metrics in the spec', () => {
    const scenario = computeScenario(engagement, plan, engagement.scenarios[0]!);
    const metrics = computeMetrics(engagement, plan, scenario);
    expect(metrics.grossMargin).toBe(570000);
    expect(metrics.grossMarginPct).toBeCloseTo(0.5263, 4);
    expect(metrics.blendedDayRate).toBeCloseTo(95000, 6);
  });

  it('applies a two-week ramp exactly as the spec says', () => {
    const ramped = workedExample({ rampWeeks: 2 });
    const rampedPlan = computePlan(ramped);
    expect(rampedPlan.lines.map((line) => line.effortDays)).toEqual([1.5, 3, 2.4, 3]);
    expect(rampedPlan.totalEffortDays).toBeCloseTo(9.9, 10);
    expect(rampedPlan.directCost).toBe(445500);
    expect(rampedPlan.revenueAtRates).toBe(940500);
  });
});

describe('the Solutions standard rate card', () => {
  // These are the practice's real charge rates. A change here is a change to a sourced
  // figure and should never happen by accident.
  const CARD: [string, number, number][] = [
    // grade, charge, cost
    ['Associate', 525, 342],
    ['Senior Associate', 650, 447],
    ['Consultant', 800, 560],
    ['Senior Consultant', 900, 677],
    ['Manager', 1100, 785],
    ['Senior Manager', 1350, 893],
    ['Associate Director', 2000, 1460],
    ['Director', 2500, 1988],
  ];

  it('is loaded exactly as given, on both sides', () => {
    for (const [name, charge, cost] of CARD) {
      const grade = meridian.grades.find((candidate) => candidate.name === name);
      expect(grade, `missing grade ${name}`).toBeDefined();
      expect(grade!.chargeRate, `${name} charge`).toBe(pounds(charge));
      expect(grade!.costRate, `${name} cost`).toBe(pounds(cost));
    }
  });

  it('covers the whole ladder, in order, with nothing extra', () => {
    expect(meridian.grades.map((grade) => grade.name)).toEqual(CARD.map(([name]) => name));
    expect(meridian.grades.map((grade) => grade.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('gets weaker on margin as seniority rises — the opposite of the usual intuition', () => {
    const marginOf = (name: string) => {
      const grade = meridian.grades.find((candidate) => candidate.name === name)!;
      return (grade.chargeRate - grade.costRate) / grade.chargeRate;
    };
    // Not a stylistic assertion: this is the shape that makes grade mix a live
    // commercial lever, and it drives the advice the comparison view gives. If a future
    // rate card inverts it, the guidance in the seed and in /context is wrong and needs
    // rewriting, so failing here is the correct outcome.
    expect(marginOf('Director')).toBeLessThan(marginOf('Associate'));
    expect(marginOf('Director')).toBeLessThan(marginOf('Senior Manager'));
    expect(marginOf('Associate')).toBeGreaterThan(0.3);
    expect(marginOf('Director')).toBeLessThan(0.25);
  });
});

describe('rounding policy', () => {
  it('makes every total equal the sum of the lines a user can see', () => {
    const analysis = analyse(meridian);
    const summedCost = analysis.plan.lines.reduce((total, line) => total + line.cost, 0);
    const summedRevenue = analysis.plan.lines.reduce((total, line) => total + line.revenueAtRates, 0);
    expect(analysis.plan.directCost).toBe(summedCost);
    expect(analysis.plan.revenueAtRates).toBe(summedRevenue);
  });

  it('keeps every money value an integer number of minor units', () => {
    const analysis = analyse(meridian);
    for (const line of analysis.plan.lines) {
      expect(Number.isInteger(line.cost)).toBe(true);
      expect(Number.isInteger(line.revenueAtRates)).toBe(true);
    }
    for (const { metrics } of analysis.scenarios) {
      expect(Number.isInteger(metrics.revenue)).toBe(true);
      expect(Number.isInteger(metrics.cost)).toBe(true);
      expect(Number.isInteger(metrics.grossMargin)).toBe(true);
    }
  });

  it('does not drift on rates that do not divide cleanly', () => {
    const engagement = workedExample({ allocation: 1 / 3 });
    engagement.grades[0]!.costRate = 33333;
    const plan = computePlan(engagement);
    expect(plan.directCost).toBe(plan.lines.reduce((total, line) => total + line.cost, 0));
  });
});

describe('per-week allocation overrides', () => {
  it('uses the override for that week and the default everywhere else', () => {
    const engagement = workedExample({ allocationByWeek: { 2: 0.2 } });
    const plan = computePlan(engagement);
    expect(plan.lines.map((line) => line.effortDays)).toEqual([3, 1, 2.4, 3]);
  });

  it('counts overrides towards a person being over capacity', () => {
    const engagement = workedExample({ personId: 'p', allocationByWeek: { 1: 1.4 } });
    engagement.people = [{ id: 'p', name: 'X', gradeId: 'g', roleId: 'r' }];
    expect(validate(engagement, computePlan(engagement)).some((f) => f.id === 'person-over-p')).toBe(true);
  });
});

describe('rate resolution', () => {
  it('lets a named person’s cost rate override the grade, but never the charge rate', () => {
    const engagement = workedExample({ personId: 'p' });
    engagement.people = [
      { id: 'p', name: 'J. Moreau', gradeId: 'g', roleId: 'r', costRate: pounds(500) },
    ];
    const plan = computePlan(engagement);
    expect(plan.directCost).toBe(toMoney(pounds(500) * 11.4));
    expect(plan.revenueAtRates).toBe(1083000); // unchanged
  });

  it('lets a client rate card override the charge rate, but never the cost rate', () => {
    const engagement = workedExample();
    engagement.rateCards = [{ id: 'rc', name: 'Client', rates: { g: pounds(880) } }];
    const plan = computePlan(engagement, { g: pounds(880) });
    expect(plan.revenueAtRates).toBe(toMoney(pounds(880) * 11.4));
    expect(plan.directCost).toBe(513000);
  });

  it('costs a model with no named people at all', () => {
    const engagement = workedExample();
    expect(engagement.people).toEqual([]);
    const plan = computePlan(engagement);
    expect(plan.directCost).toBeGreaterThan(0);
    expect(plan.unstaffedEffortDays).toBeCloseTo(11.4, 10);
  });
});

describe('edge cases', () => {
  it('treats a fully-holidayed week as zero effort, not an error', () => {
    const engagement = workedExample();
    engagement.calendar.publicHolidays = { 2: 5 };
    const plan = computePlan(engagement);
    expect(plan.lines[1]!.effortDays).toBe(0);
    expect(plan.lines[1]!.cost).toBe(0);
  });

  it('returns null rather than NaN when there is no effort', () => {
    const engagement = workedExample();
    engagement.assignments = [];
    const plan = computePlan(engagement);
    const scenario = computeScenario(engagement, plan, engagement.scenarios[0]!);
    const metrics = computeMetrics(engagement, plan, scenario);
    expect(metrics.blendedDayRate).toBeNull();
    expect(metrics.effectiveRate).toBeNull();
  });

  it('clips an assignment that runs past the end of the engagement', () => {
    const engagement = workedExample({ endWeek: 40 });
    const plan = computePlan(engagement);
    expect(plan.lines).toHaveLength(4);
  });
});

describe('commercial structures', () => {
  // The worked example from specs/0003: 220 effort days, cost £86,400,
  // revenue at standard T&M rates £198,000.
  const slice = {
    effortDays: 220,
    directCost: pounds(86400),
    revenueAtRates: pounds(198000),
    revenueAtStandardRates: pounds(198000),
    costByWeek: new Array(10).fill(pounds(8640)),
    revenueByWeek: new Array(10).fill(pounds(19800)),
  };

  it('T&M matches the spec', () => {
    const result = computeStructure(slice, { type: 'tm' }, 10);
    expect(result.revenue).toBe(pounds(198000));
    expect(result.expected.marginPct).toBeCloseTo(0.564, 3);
  });

  it('fixed price matches the spec, including break-even overrun', () => {
    const result = computeStructure(slice, { type: 'fixedPrice', contractValue: pounds(180000), contingencyPct: 0.15 }, 10);
    expect(result.revenue).toBe(pounds(180000));
    expect(result.costWithContingency).toBe(pounds(99360));
    expect(result.downside.marginPct).toBeCloseTo(0.448, 3);
    expect(result.breakEvenOverrunPct).toBeCloseTo(1.083, 3);
  });

  it('outcome share shows downside, expected and upside separately', () => {
    const result = computeStructure(
      slice,
      { type: 'outcomeShare', baseFee: pounds(150000), shape: 'benefitPct', sharePercent: 0.1, expectedBenefit: pounds(400000), cap: pounds(220000), contingencyPct: 0.15 },
      10,
    );
    expect(result.expected.revenue).toBe(pounds(190000));
    expect(result.expected.marginPct).toBeCloseTo(0.477, 3);
    expect(result.downside.revenue).toBe(pounds(150000));
    expect(result.downside.marginPct).toBeCloseTo(0.338, 3);
    // Break-even is on the base fee: the contingent element cannot absorb an overrun.
    expect(result.breakEvenOverrunPct).toBeCloseTo(0.736, 3);
    expect(result.upside?.revenue).toBe(pounds(220000));
  });

  it('reports an uncapped upside as unbounded rather than as a number', () => {
    const result = computeStructure(
      slice,
      { type: 'outcomeShare', baseFee: pounds(150000), shape: 'benefitPct', sharePercent: 0.1, expectedBenefit: pounds(400000), contingencyPct: 0.15 },
      10,
    );
    expect(result.upside).toBeNull();
    expect(result.notes.some((note) => note.startsWith('Uncapped'))).toBe(true);
  });

  it('gain-share measures against the baseline', () => {
    const result = computeStructure(
      slice,
      { type: 'outcomeShare', baseFee: pounds(150000), shape: 'gainShare', sharePercent: 0.2, expectedBenefit: pounds(500000), baseline: pounds(300000), contingencyPct: 0 },
      10,
    );
    expect(result.expected.revenue).toBe(pounds(190000)); // 150k + 20% of 200k gain
  });

  it('says so when a cap sits at or below planned revenue', () => {
    const result = computeStructure(slice, { type: 'cappedTm', cap: pounds(190000) }, 10);
    expect(result.revenue).toBe(pounds(190000));
    expect(result.notes.some((note) => note.includes('behaves as a fixed price'))).toBe(true);
  });

  it('leaves headroom visible when the cap is above plan', () => {
    const result = computeStructure(slice, { type: 'cappedTm', cap: pounds(220000) }, 10);
    expect(result.revenue).toBe(pounds(198000));
    expect(result.capHeadroomPct).toBeCloseTo(0.111, 3);
  });

  it('flags milestone payments that do not sum to the contract value, and bills the balance on completion', () => {
    const result = computeStructure(
      slice,
      { type: 'milestone', contractValue: pounds(180000), contingencyPct: 0, payments: [{ milestoneId: 'm1', value: pounds(90000) }] },
      10,
      [{ id: 'm1', name: 'Phase 1', week: 5 }],
    );
    expect(result.notes.some((note) => note.includes('£90,000') && note.includes('£180,000'))).toBe(true);
    // The balance lands on completion rather than disappearing from the weekly curve.
    expect(result.revenueByWeek[4]).toBe(pounds(90000));
    expect(result.revenueByWeek[9]).toBe(pounds(90000));
    expect(result.revenueByWeek.reduce((total, value) => total + value, 0)).toBe(result.revenue);
  });
});

describe('cash exposure', () => {
  it('finds the worst working-capital position, not the final one', () => {
    const cost = [pounds(10000), pounds(10000), pounds(10000)];
    const revenue = [0, 0, pounds(30000)];
    expect(maxCashExposure(cost, revenue, 3)).toBe(pounds(20000));
  });

  it('grows when payment terms delay the cash', () => {
    const cost = [pounds(10000), pounds(10000), pounds(10000)];
    const revenue = [pounds(10000), pounds(10000), pounds(10000)];
    expect(maxCashExposure(cost, revenue, 3, 0)).toBe(0);
    expect(maxCashExposure(cost, revenue, 3, 2)).toBe(pounds(20000));
  });

  it('is zero when billing leads delivery', () => {
    expect(maxCashExposure([pounds(1000)], [pounds(5000)], 1)).toBe(0);
  });
});

describe('hybrid deals', () => {
  it('applies a different structure per phase and sums them', () => {
    const analysis = analyse(meridian);
    const hybrid = analysis.scenarios.find((s) => s.scenario.scenarioId === 'sc-hybrid')!;
    expect(hybrid.scenario.isHybrid).toBe(true);
    expect(hybrid.scenario.parts).toHaveLength(3);
    expect(hybrid.scenario.parts.map((part) => part.structure.label)).toEqual([
      'Fixed price', 'Time & materials', 'Fixed price',
    ]);
    const summed = hybrid.scenario.parts.reduce((total, part) => total + part.structure.revenue, 0);
    expect(hybrid.scenario.revenue).toBe(summed);
  });
});

describe('scenarios never touch the plan', () => {
  it('produces identical effort and cost across every scenario', () => {
    const analysis = analyse(meridian);
    const costs = new Set(analysis.scenarios.map(({ scenario }) => scenario.cost));
    expect(costs.size).toBe(1);
    expect(analysis.scenarios.every(({ metrics }) => metrics.totalEffortDays === analysis.plan.totalEffortDays)).toBe(true);
  });
});

describe('cases are stated on one basis', () => {
  it('never reports a downside margin better than the expected margin', () => {
    for (const { scenario } of analyse(meridian).scenarios) {
      expect(scenario.downside.marginPct!).toBeLessThanOrEqual(scenario.expected.marginPct! + 1e-9);
    }
  });

  it('states the expected case on the same basis as the headline gross margin', () => {
    for (const { scenario, metrics } of analyse(meridian).scenarios) {
      // They differ only by contingency, which is held against the downside, never
      // against the reported margin.
      if (scenario.costWithContingency === scenario.cost) {
        expect(metrics.grossMarginPct).toBeCloseTo(scenario.expected.marginPct!, 6);
      }
      expect(metrics.cost).toBe(scenario.cost);
    }
  });

  it('reports no break-even overrun under pure T&M, where the client carries it', () => {
    const analysis = analyse(meridian);
    const tm = analysis.scenarios.find((entry) => entry.scenario.scenarioId === 'sc-tm')!;
    const fixed = analysis.scenarios.find((entry) => entry.scenario.scenarioId === 'sc-fixed')!;
    expect(tm.metrics.breakEvenOverrunPct).toBeNull();
    expect(fixed.metrics.breakEvenOverrunPct).toBeGreaterThan(0);
  });
});

describe('guardrails', () => {
  it('explains a breach in terms an approver can act on', () => {
    const analysis = analyse(meridian);
    const breaches = analysis.scenarios.flatMap(({ guardrails }) => guardrails.filter((g) => g.breached));
    expect(breaches.length).toBeGreaterThan(0);
    for (const breach of breaches) {
      expect(breach.explanation).toContain('must approve');
      expect(breach.explanation).toMatch(/threshold/);
    }
  });
});

describe('sensitivity', () => {
  it('leaves the original engagement untouched', () => {
    const before = JSON.stringify(meridian);
    applySensitivity(meridian, { slipWeeks: 2, extraDiscountPct: 0.05 });
    expect(JSON.stringify(meridian)).toBe(before);
  });

  it('costs more and earns less when the plan slips and the discount deepens', () => {
    const base = analyse(meridian);
    const stressed = analyse(applySensitivity(meridian, { slipWeeks: 2, extraDiscountPct: 0.05 }));
    expect(stressed.plan.directCost).toBeGreaterThan(base.plan.directCost);
    const baseTm = base.scenarios[0]!.metrics.grossMarginPct!;
    const stressedTm = stressed.scenarios[0]!.metrics.grossMarginPct!;
    expect(stressedTm).toBeLessThan(baseTm);
  });
});

describe('validation', () => {
  it('reports resourcing gaps as information, not errors', () => {
    const plan = computePlan(meridian);
    const findings = validate(meridian, plan);
    const gaps = findings.filter((finding) => finding.id.startsWith('a-unstaffed'));
    expect(gaps.length).toBe(3);
    expect(gaps.every((gap) => gap.severity === 'info')).toBe(true);
  });

  it('catches a fixed price below the cost of delivery', () => {
    const engagement: Engagement = {
      ...meridian,
      scenarios: [{ id: 'bad', name: 'Too cheap', structure: { type: 'fixedPrice', contractValue: pounds(1000), contingencyPct: 0 } }],
    };
    const plan = computePlan(engagement);
    expect(validate(engagement, plan).some((f) => f.id.startsWith('fp-below-cost'))).toBe(true);
  });

  it('catches a person allocated beyond capacity', () => {
    const engagement: Engagement = {
      ...meridian,
      assignments: [
        ...meridian.assignments,
        { id: 'extra', workstreamId: 'ws-platform', roleId: 'r-de', gradeId: 'g-senior', personId: 'p-moreau', startWeek: 4, endWeek: 6, allocation: 0.8 },
      ],
    };
    const plan = computePlan(engagement);
    expect(validate(engagement, plan).some((f) => f.id === 'person-over-p-moreau')).toBe(true);
  });

  it('catches a milestone outside the plan', () => {
    const engagement: Engagement = {
      ...meridian,
      milestones: [...meridian.milestones, { id: 'late', name: 'Too late', week: 99 }],
    };
    expect(validate(engagement, computePlan(engagement)).some((f) => f.id === 'ms-outside-late')).toBe(true);
  });

  it('finds nothing fatal in the seed engagement', () => {
    const findings = validate(meridian, computePlan(meridian));
    expect(findings.filter((finding) => finding.severity === 'error')).toEqual([]);
  });
});

describe('traceability', () => {
  it('can explain any total by drilling to the lines behind it', () => {
    const analysis = analyse(meridian);
    const platformLines = analysis.plan.lines.filter((line) => line.workstreamId === 'ws-platform');
    const platformCost = platformLines.reduce((total, line) => total + line.cost, 0);
    const slice = sliceOf(analysis.plan, meridian.weeks, (line) => line.workstreamId === 'ws-platform');
    expect(slice.directCost).toBe(platformCost);
    // Every line carries the rate and the availability it was derived from.
    for (const line of platformLines) {
      expect(line.costRate).toBeGreaterThan(0);
      expect(line.cost).toBe(toMoney(line.costRate * line.effortDays));
    }
  });
});
