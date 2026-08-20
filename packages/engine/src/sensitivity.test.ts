import { describe, expect, it } from 'vitest';
import { billedRatesFor } from './compute';
import { applyRateMultiplier } from './edit';
import { applySensitivity, analyse } from './metrics';
import { meridian } from './seed';
import type { Engagement } from './types';

const NONE = { slipWeeks: 0, extraDiscountPct: 0 };
const pick = (engagement: Engagement, id: string) =>
  analyse(engagement).scenarios.find((entry) => entry.scenario.scenarioId === id)!;

/** The same scenario, repriced through the pricing desk — which stores rate overrides. */
function throughThePricingDesk(engagement: Engagement, scenarioId: string): Engagement {
  const scenario = engagement.scenarios.find((entry) => entry.id === scenarioId)!;
  return applyRateMultiplier(engagement, scenarioId, 1, billedRatesFor(engagement, scenario));
}

describe('the extra-discount sensitivity', () => {
  it('cuts rate-driven revenue on a T&M deal, and leaves recharged expenses alone', () => {
    const before = pick(applySensitivity(meridian, NONE), 'sc-tm');
    const after = pick(applySensitivity(meridian, { slipWeeks: 0, extraDiscountPct: 0.1 }), 'sc-tm');

    // `scenario.revenue` is the part rates drive. `metrics.revenue` adds rechargeable
    // expenses, which are passed through at cost and are not ours to discount.
    expect(after.scenario.revenue / before.scenario.revenue).toBeCloseTo(0.9, 4);
    expect(after.metrics.revenue - after.scenario.revenue).toBe(
      before.metrics.revenue - before.scenario.revenue,
    );
  });

  it('still bites once the scenario carries rate overrides', () => {
    // Regression: any scenario touched by the pricing desk stores per-grade overrides,
    // and overrides win over the rate card. The sensitivity used to discount only the
    // card, so the stress test silently did nothing on exactly the scenarios that had
    // been priced most carefully.
    const desked = throughThePricingDesk(meridian, 'sc-tm');
    const before = pick(applySensitivity(desked, NONE), 'sc-tm');
    const after = pick(applySensitivity(desked, { slipWeeks: 0, extraDiscountPct: 0.1 }), 'sc-tm');

    expect(before.metrics.revenue).toBe(pick(meridian, 'sc-tm').metrics.revenue);
    expect(after.scenario.revenue).toBeLessThan(before.scenario.revenue);
    expect(after.scenario.revenue / before.scenario.revenue).toBeCloseTo(0.9, 4);
  });

  it('leaves the practice standard card alone, so the discount reads as a discount', () => {
    // Regression: discounting our own card alongside the billed rates made a fixed-price
    // deal report a *negative* discount — the app claiming we charged above our card at
    // the moment we cut the price by a tenth.
    const before = pick(applySensitivity(meridian, NONE), 'sc-fixed');
    const after = pick(applySensitivity(meridian, { slipWeeks: 0, extraDiscountPct: 0.1 }), 'sc-fixed');
    expect(after.metrics.discountVsStandardPct).toBeGreaterThan(0);
    // A fixed price does not follow rates, so its discount against standard cannot move.
    expect(after.metrics.discountVsStandardPct).toBeCloseTo(before.metrics.discountVsStandardPct!, 6);

    const tm = pick(applySensitivity(meridian, { slipWeeks: 0, extraDiscountPct: 0.1 }), 'sc-tm');
    expect(tm.metrics.discountVsStandardPct!).toBeGreaterThan(
      pick(meridian, 'sc-tm').metrics.discountVsStandardPct!,
    );
  });

  it('never bills a negative rate', () => {
    const wild = applySensitivity(meridian, { slipWeeks: 0, extraDiscountPct: 2 });
    for (const scenario of wild.scenarios) {
      for (const rate of Object.values(scenario.rateOverrides ?? {})) {
        expect(rate).toBeGreaterThanOrEqual(0);
      }
    }
    // Every rate floors at zero, so nothing is billed for time. Recharged expenses are
    // not a rate and survive — they are the client's own costs passed through.
    expect(pick(wild, 'sc-tm').scenario.revenue).toBe(0);
    expect(pick(wild, 'sc-tm').metrics.revenue).toBe(meridian.expenses!.rechargeable);
  });
});

describe('the slip sensitivity', () => {
  it('extends only the work still running at the end', () => {
    // Regression: every phase used to grow, which restarted Discovery for four weeks
    // after it had finished and put the whole team back on at peak. A four-week slip
    // added 190 days to a 260-day plan and *improved* T&M margin.
    const slipped = applySensitivity(meridian, { slipWeeks: 4, extraDiscountPct: 0 });

    const discovery = slipped.phases.find((phase) => phase.id === 'ph-discovery')!;
    expect(discovery.endWeek).toBe(3); // finished in week 3; a late slip cannot reach it

    const deploy = slipped.phases.find((phase) => phase.id === 'ph-deploy')!;
    expect(deploy.endWeek).toBe(18); // ran to the end, so it carries the overrun

    expect(slipped.weeks).toBe(meridian.weeks + 4);
  });

  it('adds the tail team’s effort, not the whole team’s', () => {
    const before = pick(meridian, 'sc-tm');
    const after = pick(applySensitivity(meridian, { slipWeeks: 4, extraDiscountPct: 0 }), 'sc-tm');
    const added = after.metrics.totalEffortDays - before.metrics.totalEffortDays;

    // Four rows run to the end at 0.5–0.6 FTE: about 2.2 FTE over four five-day weeks.
    expect(added).toBeGreaterThan(30);
    expect(added).toBeLessThan(50);
  });

  it('hurts a fixed price, because the client does not pay for the overrun', () => {
    const before = pick(meridian, 'sc-fixed');
    const after = pick(applySensitivity(meridian, { slipWeeks: 4, extraDiscountPct: 0 }), 'sc-fixed');
    expect(after.metrics.revenue).toBe(before.metrics.revenue);
    expect(after.metrics.cost).toBeGreaterThan(before.metrics.cost);
    expect(after.metrics.grossMarginPct!).toBeLessThan(before.metrics.grossMarginPct! - 0.1);
  });

  it('is a no-op at zero, and never shortens the plan', () => {
    expect(applySensitivity(meridian, NONE)).toBe(meridian);
    expect(applySensitivity(meridian, { slipWeeks: -3, extraDiscountPct: 0 })).toBe(meridian);
  });
});
