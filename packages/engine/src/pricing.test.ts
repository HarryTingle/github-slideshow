import { describe, expect, it } from 'vitest';
import { computePlan, billedRatesFor } from './compute';
import { applyRateMultiplier, clearScenarioRates, setScenarioRate } from './edit';
import { analyse } from './metrics';
import { pounds } from './money';
import { pricingView, solveForMargin } from './pricing';
import { meridian } from './seed';
import type { Engagement } from './types';

const viewFor = (engagement: Engagement, scenarioId: string) => {
  const analysis = analyse(engagement);
  const entry = analysis.scenarios.find((s) => s.scenario.scenarioId === scenarioId)!;
  const definition = engagement.scenarios.find((s) => s.id === scenarioId)!;
  const plan = computePlan(engagement, billedRatesFor(engagement, definition));
  return { entry, view: pricingView(engagement, definition, entry, plan), plan };
};

describe('what a deal actually bills', () => {
  it('layers the deal rate over the client card over the standard', () => {
    const base = billedRatesFor(meridian, meridian.scenarios[0]!);
    expect(base['g-senior-consultant']).toBe(pounds(840)); // Meridian framework card
    expect(base['g-director']).toBeUndefined(); // falls through to standard

    const priced = setScenarioRate(meridian, 'sc-tm', 'g-senior-consultant', pounds(875));
    const after = billedRatesFor(priced, priced.scenarios[0]!);
    expect(after['g-senior-consultant']).toBe(pounds(875));
  });

  it('moves revenue without touching the practice standard', () => {
    const before = analyse(meridian).scenarios[0]!.metrics.revenue;
    const priced = setScenarioRate(meridian, 'sc-tm', 'g-consultant', pounds(900));
    expect(analyse(priced).scenarios[0]!.metrics.revenue).toBeGreaterThan(before);
    expect(priced.grades.find((g) => g.id === 'g-consultant')!.chargeRate).toBe(pounds(800));
  });

  it('returns to the inherited card when cleared', () => {
    const priced = setScenarioRate(meridian, 'sc-tm', 'g-consultant', pounds(900));
    const cleared = clearScenarioRates(priced, 'sc-tm');
    expect(analyse(cleared).scenarios[0]!.metrics.revenue).toBe(
      analyse(meridian).scenarios[0]!.metrics.revenue,
    );
  });
});

describe('which lever is worth pulling', () => {
  it('under T&M, a rate rise moves margin in proportion to days at that grade', () => {
    const { view } = viewFor(meridian, 'sc-tm');
    expect(view.revenueFollowsEffort).toBe(true);
    const consultant = view.grades.find((g) => g.name === 'Consultant')!;
    const director = view.grades.find((g) => g.name === 'Director')!;
    // Consultant carries ~100 days, Director ~1.4. The lever follows the volume.
    expect(consultant.rateLeveragePp).toBeGreaterThan(director.rateLeveragePp);
    expect(consultant.rateLeveragePp).toBeGreaterThan(0);
  });

  it('under a fixed price, a rate rise does nothing at all', () => {
    const { view } = viewFor(meridian, 'sc-fixed');
    expect(view.revenueFollowsEffort).toBe(false);
    expect(view.grades.every((g) => g.rateLeveragePp === 0)).toBe(true);
  });

  it('under a fixed price, trading a week down the ladder is pure margin', () => {
    const { view } = viewFor(meridian, 'sc-fixed');
    // Revenue is fixed, so the whole cost saving lands on the bottom line.
    for (const grade of view.grades.filter((g) => g.tradeDownTo)) {
      expect(grade.tradeDownPp).toBeGreaterThan(0);
    }
    const senior = view.grades.find((g) => g.name === 'Associate Director')!;
    const consultant = view.grades.find((g) => g.name === 'Consultant')!;
    // The bigger the rung, the bigger the saving.
    expect(senior.tradeDownPp).toBeGreaterThan(consultant.tradeDownPp);
  });

  it('reports the build-up and what it is being discounted against', () => {
    const { view } = viewFor(meridian, 'sc-tm');
    expect(view.buildUpAtStandard).toBeGreaterThan(view.buildUp); // framework card is a discount
    expect(view.discountPct).toBeGreaterThan(0);
    expect(view.blendedRate).toBeLessThan(view.blendedStandardRate!);
  });
});

describe('solving for a target margin', () => {
  it('finds the uniform rate move that lands exactly on target, under T&M', () => {
    const { entry, view } = viewFor(meridian, 'sc-tm');
    const solution = solveForMargin(entry, view, 0.3);
    expect(solution.kind).toBe('rateMultiplier');
    if (solution.kind !== 'rateMultiplier') throw new Error('expected a rate solution');

    const applied = applyRateMultiplier(
      meridian,
      'sc-tm',
      solution.multiplier,
      billedRatesFor(meridian, meridian.scenarios[0]!),
    );
    const achieved = analyse(applied).scenarios[0]!.metrics.grossMarginPct!;
    expect(achieved).toBeCloseTo(0.3, 3);
  });

  it('finds the price that lands on target, under a fixed price', () => {
    const { entry, view } = viewFor(meridian, 'sc-fixed');
    const solution = solveForMargin(entry, view, 0.3);
    expect(solution.kind).toBe('price');
    if (solution.kind !== 'price') throw new Error('expected a price solution');
    expect(solution.price).toBeGreaterThan(view.price);
  });

  it('asks for less when the target is below where the deal already sits', () => {
    const { entry, view } = viewFor(meridian, 'sc-tm');
    const solution = solveForMargin(entry, view, 0.1);
    if (solution.kind !== 'rateMultiplier') throw new Error('expected a rate solution');
    expect(solution.multiplier).toBeLessThan(1);
  });

  it('refuses an impossible target rather than returning nonsense', () => {
    const { entry, view } = viewFor(meridian, 'sc-tm');
    expect(solveForMargin(entry, view, 1).reachable).toBe(false);
  });
});
