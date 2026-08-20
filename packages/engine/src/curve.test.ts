import { describe, expect, it } from 'vitest';
import { computeScenario, sliceOf } from './commercial';
import { billedRatesFor, computePlan } from './compute';
import { pounds } from './money';
import { meridian } from './seed';
import type { CommercialStructure, Engagement, Scenario } from './types';

/**
 * One invariant, applied to every commercial structure: the weekly revenue curve must
 * sum to the revenue the deal reports.
 *
 * Everything downstream depends on it — cash exposure, the payment-lag curve, the SLT
 * pack's cumulative chart. A structure whose curve disagrees with its own headline puts
 * a number in front of an approver that the chart beside it contradicts.
 */
function structures(engagement: Engagement): { name: string; structure: CommercialStructure }[] {
  const milestones = engagement.milestones;
  return [
    { name: 'T&M', structure: { type: 'tm', rateCardId: 'rc-meridian' } },
    { name: 'capped T&M, cap binding', structure: { type: 'cappedTm', cap: pounds(180000) } },
    { name: 'capped T&M, cap loose', structure: { type: 'cappedTm', cap: pounds(400000) } },
    {
      name: 'fixed price',
      structure: { type: 'fixedPrice', contractValue: pounds(250000), contingencyPct: 0.15 },
    },
    {
      name: 'milestone, schedule agrees',
      structure: {
        type: 'milestone',
        contractValue: pounds(150000),
        contingencyPct: 0.1,
        payments: milestones.slice(0, 3).map((m) => ({ milestoneId: m.id, value: pounds(50000) })),
      },
    },
    {
      name: 'milestone, schedule short of the contract',
      structure: {
        type: 'milestone',
        contractValue: pounds(250000),
        contingencyPct: 0.1,
        payments: milestones.slice(0, 2).map((m) => ({ milestoneId: m.id, value: pounds(50000) })),
      },
    },
    {
      name: 'milestone, no schedule at all',
      structure: {
        type: 'milestone',
        contractValue: pounds(250000),
        contingencyPct: 0.1,
        payments: [],
      },
    },
    { name: 'retainer', structure: { type: 'retainer', monthlyValue: pounds(60000), months: 3 } },
    {
      name: 'outcome share',
      structure: {
        type: 'outcomeShare',
        baseFee: pounds(200000),
        shape: 'benefitPct',
        sharePercent: 0.1,
        expectedBenefit: pounds(580000),
        cap: pounds(295000),
        contingencyPct: 0.15,
      },
    },
  ];
}

describe('every structure’s weekly curve sums to its own revenue', () => {
  for (const { name, structure } of structures(meridian)) {
    it(name, () => {
      const definition: Scenario = { id: 'sc-under-test', name, structure };
      const engagement = { ...meridian, scenarios: [definition] };
      const plan = computePlan(engagement, billedRatesFor(engagement, definition));
      const result = computeScenario(engagement, plan, definition);

      const weekly = result.revenueByWeek.reduce((total, value) => total + value, 0);
      expect(weekly).toBe(result.revenue);
      expect(result.revenueByWeek).toHaveLength(engagement.weeks);
      expect(result.revenueByWeek.every((value) => Number.isFinite(value))).toBe(true);
    });
  }

  it('holds for a hybrid, where each phase carries its own structure', () => {
    const definition: Scenario = {
      id: 'sc-hybrid-test',
      name: 'Hybrid',
      structure: { type: 'tm', rateCardId: 'rc-meridian' },
      structureByPhase: {
        'ph-discovery': { type: 'fixedPrice', contractValue: pounds(40000), contingencyPct: 0.1 },
        'ph-deploy': {
          type: 'milestone',
          contractValue: pounds(30000),
          contingencyPct: 0.1,
          payments: [],
        },
      },
    };
    const engagement = { ...meridian, scenarios: [definition] };
    const plan = computePlan(engagement, billedRatesFor(engagement, definition));
    const result = computeScenario(engagement, plan, definition);
    expect(result.revenueByWeek.reduce((total, value) => total + value, 0)).toBe(result.revenue);
  });
});

describe('a milestone schedule that does not add up', () => {
  const scheduleOf = (contractValue: number, payments: { milestoneId: string; value: number }[]) => {
    const definition: Scenario = {
      id: 'sc-ms',
      name: 'Milestones',
      structure: { type: 'milestone', contractValue, contingencyPct: 0.1, payments },
    };
    const engagement = { ...meridian, scenarios: [definition] };
    const plan = computePlan(engagement, billedRatesFor(engagement, definition));
    return computeScenario(engagement, plan, definition);
  };

  it('bills the unscheduled balance on completion rather than losing it', () => {
    // Regression: revenue reported the whole contract while the weekly curve carried
    // only the scheduled payments, so the SLT pack's chart ended £150,000 below the
    // recommendation printed above it.
    const result = scheduleOf(
      pounds(250000),
      meridian.milestones.slice(0, 2).map((m) => ({ milestoneId: m.id, value: pounds(50000) })),
    );
    expect(result.revenue).toBe(pounds(250000));
    expect(result.revenueByWeek[meridian.weeks - 1]).toBe(pounds(150000));
    expect(result.notes.some((note) => note.includes('billed on completion'))).toBe(true);
  });

  it('says so, in money, when the schedule exceeds the contract', () => {
    const result = scheduleOf(
      pounds(80000),
      meridian.milestones.slice(0, 2).map((m) => ({ milestoneId: m.id, value: pounds(50000) })),
    );
    expect(result.revenue).toBe(pounds(80000));
    expect(result.notes.some((note) => note.includes('£20,000 more than'))).toBe(true);
  });

  it('says nothing when the schedule agrees', () => {
    const result = scheduleOf(
      pounds(150000),
      meridian.milestones.slice(0, 3).map((m) => ({ milestoneId: m.id, value: pounds(50000) })),
    );
    expect(result.notes.some((note) => note.includes('contract value'))).toBe(false);
  });
});

describe('what a capped T&M deal reports about its cap', () => {
  const cappedAt = (cap: number) => {
    const definition: Scenario = {
      id: 'sc-cap',
      name: 'Capped',
      structure: { type: 'cappedTm', rateCardId: 'rc-meridian', cap },
    };
    const engagement = { ...meridian, scenarios: [definition] };
    const plan = computePlan(engagement, billedRatesFor(engagement, definition));
    return computeScenario(engagement, plan, definition).parts[0]!.structure;
  };

  it('reports the cap and what the plan would have billed without it', () => {
    // Previously only a percentage came back, and nothing on screen used it — a binding
    // cap clipped revenue in silence.
    const tight = cappedAt(pounds(180000));
    expect(tight.cap).toBe(pounds(180000));
    expect(tight.revenueBeforeCap).toBeGreaterThan(pounds(180000));
    expect(tight.revenue).toBe(pounds(180000));
    expect(tight.capHeadroomPct!).toBeLessThan(0);
    expect(tight.notes.some((note) => note.includes('goes unpaid'))).toBe(true);
  });

  it('leaves headroom, and says nothing alarming, when the cap is above the plan', () => {
    const loose = cappedAt(pounds(400000));
    expect(loose.revenue).toBe(loose.revenueBeforeCap);
    expect(loose.capHeadroomPct!).toBeGreaterThan(0);
    expect(loose.notes.some((note) => note.includes('goes unpaid'))).toBe(false);
  });

  it('is null on every structure that has no cap', () => {
    for (const { structure } of structures(meridian)) {
      if (structure.type === 'cappedTm') continue;
      const definition: Scenario = { id: 'sc-x', name: 'x', structure };
      const engagement = { ...meridian, scenarios: [definition] };
      const plan = computePlan(engagement, billedRatesFor(engagement, definition));
      const result = computeScenario(engagement, plan, definition).parts[0]!.structure;
      expect(result.cap).toBeNull();
      expect(result.revenueBeforeCap).toBeNull();
    }
  });
});
