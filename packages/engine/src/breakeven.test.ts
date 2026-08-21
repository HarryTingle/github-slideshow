import { describe, expect, it } from 'vitest';
import { breakEvenView } from './breakeven';
import { billedRatesFor, computePlan } from './compute';
import { analyse } from './metrics';
import { pounds } from './money';
import { meridian } from './seed';
import type { Engagement } from './types';

function viewOf(engagement: Engagement, scenarioId: string, target = 0.2) {
  const analysis = analyse(engagement);
  const entry = analysis.scenarios.find((s) => s.scenario.scenarioId === scenarioId)!;
  const definition = engagement.scenarios.find((s) => s.id === scenarioId)!;
  const billed = billedRatesFor(engagement, definition);
  return breakEvenView(engagement, entry, computePlan(engagement, billed), target, billed);
}

describe('the floor', () => {
  it('breaks even where the blended rate meets the blended cost rate', () => {
    const view = viewOf(meridian, 'sc-fixed');
    expect(view.breakEvenRate).toBe(view.blendedCostRate);
    expect(view.blendedRate!).toBeGreaterThan(view.breakEvenRate!);
    expect(view.belowBreakEven).toBe(false);
  });

  it('needs a higher blended rate for a higher target', () => {
    const low = viewOf(meridian, 'sc-fixed', 0.1);
    const high = viewOf(meridian, 'sc-fixed', 0.4);
    expect(high.targetRate!).toBeGreaterThan(low.targetRate!);
    expect(low.targetRate!).toBeGreaterThan(low.breakEvenRate!);
  });

  it('prices the target so the margin comes out at the target', () => {
    const view = viewOf(meridian, 'sc-fixed', 0.3);
    const revenueAtTarget = view.targetRate! * view.effortDays;
    expect((revenueAtTarget - view.cost) / revenueAtTarget).toBeCloseTo(0.3, 4);
  });

  it('carries overhead in the floor but not in the per-grade margins', () => {
    const view = viewOf(meridian, 'sc-fixed');
    // The gap between the two is the non-billable effort and absorbed expenses the mix
    // also has to cover — a real part of the floor and invisible in a rate card.
    expect(view.blendedCostRate!).toBeGreaterThan(view.blendedDirectCostRate!);
    expect(view.cost).toBeGreaterThan(view.directCost);
  });
});

describe('the deepest discount you can give', () => {
  it('is identically the current margin', () => {
    // The identity bid teams get wrong: a deal at 22% margin can give away 22% of its
    // price, not 22 points of margin.
    const view = viewOf(meridian, 'sc-fixed');
    expect(view.discountToBreakEven).toBeCloseTo(view.marginPct!, 9);
  });

  it('is smaller when a target has to be cleared as well', () => {
    const view = viewOf(meridian, 'sc-fixed', 0.15);
    expect(view.discountToTarget!).toBeLessThan(view.discountToBreakEven!);
    expect(view.discountToTarget!).toBeGreaterThan(0);
  });

  it('goes negative once the deal is already under the target', () => {
    const view = viewOf(meridian, 'sc-fixed', 0.45);
    expect(view.belowTarget).toBe(true);
    expect(view.roomToTarget).toBeLessThan(0);
    expect(view.discountToTarget!).toBeLessThan(0);
  });

  it('reports a deal that already loses money as below break-even', () => {
    const cheap = {
      ...meridian,
      scenarios: [
        {
          id: 'sc-cheap',
          name: 'Cheap',
          structure: { type: 'fixedPrice' as const, contractValue: pounds(80000), contingencyPct: 0 },
        },
      ],
    };
    const view = viewOf(cheap, 'sc-cheap');
    expect(view.belowBreakEven).toBe(true);
    expect(view.roomToBreakEven).toBeLessThan(0);
    expect(view.discountToBreakEven!).toBeLessThan(0);
  });
});

describe('the mix behind the floor', () => {
  it('lists only grades actually on the plan, senior first', () => {
    const view = viewOf(meridian, 'sc-fixed');
    expect(view.grades.length).toBeGreaterThan(0);
    expect(view.grades.every((line) => line.days > 0)).toBe(true);
    for (let i = 1; i < view.grades.length; i++) {
      expect(view.grades[i - 1]!.order).toBeGreaterThan(view.grades[i]!.order);
    }
  });

  it('shares of days sum to one, and contributions sum to the blended rate', () => {
    const view = viewOf(meridian, 'sc-tm');
    const share = view.grades.reduce((total, line) => total + line.shareOfDays, 0);
    expect(share).toBeCloseTo(1, 6);

    // The blended rate is the mix, weighted. Within a pound of the reported figure —
    // reported revenue also carries recharged expenses, which are not a day rate.
    const built = view.grades.reduce((total, line) => total + line.chargeRate * line.shareOfDays, 0);
    const fromRates = (view.blendedRate! * view.effortDays - meridian.expenses!.rechargeable) / view.effortDays;
    expect(built).toBeCloseTo(fromRates, 0);
  });

  it('finds the richest and leanest day on this rate card', () => {
    const view = viewOf(meridian, 'sc-fixed');
    // Established earlier and asserted here: margin falls as seniority rises on this
    // card, so the leanest day is the most senior grade on the plan.
    expect(view.richest!.marginPct!).toBeGreaterThan(view.leanest!.marginPct!);
    expect(view.leanest!.order).toBeGreaterThan(view.richest!.order);
  });

  it('uses the rates this scenario bills, not the standard card', () => {
    const repriced: Engagement = {
      ...meridian,
      scenarios: meridian.scenarios.map((scenario) =>
        scenario.id === 'sc-tm'
          ? { ...scenario, rateOverrides: { 'g-consultant': pounds(400) } }
          : scenario,
      ),
    };
    const line = viewOf(repriced, 'sc-tm').grades.find((g) => g.gradeId === 'g-consultant')!;
    expect(line.chargeRate).toBe(pounds(400));
    expect(line.marginPct!).toBeLessThan(
      viewOf(meridian, 'sc-tm').grades.find((g) => g.gradeId === 'g-consultant')!.marginPct!,
    );
  });
});

describe('degenerate models', () => {
  it('returns nulls rather than dividing by zero on an empty plan', () => {
    const empty: Engagement = { ...meridian, assignments: [], people: [] };
    const view = viewOf(empty, 'sc-tm');
    expect(view.effortDays).toBe(0);
    expect(view.blendedRate).toBeNull();
    expect(view.breakEvenRate).toBeNull();
    expect(view.targetRate).toBeNull();
    expect(view.grades).toEqual([]);
    expect(view.richest).toBeNull();
  });

  it('handles an impossible target without producing infinity', () => {
    const view = viewOf(meridian, 'sc-fixed', 1);
    expect(view.targetRate).toBeNull();
    expect(view.discountToTarget).toBeNull();
    expect(Number.isFinite(view.roomToTarget)).toBe(true);
  });
});
