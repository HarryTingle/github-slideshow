import { cashCurve, computeScenario, maxCashExposure, sliceOf, type ScenarioResult } from './commercial';
import { billedRatesFor, burnCurve, computePlan, gradeMix, type ComputedPlan } from './compute';
import { ratio, toMoney } from './money';
import type { Engagement, Guardrail, Money, WeekIndex } from './types';

/** The numbers a Head of Commercial actually looks at. `context/domain-model.md` §8. */
export interface Metrics {
  revenue: Money;
  cost: Money;
  grossMargin: Money;
  grossMarginPct: number | null;
  blendedDayRate: Money | null;
  blendedCostRate: Money | null;
  effectiveRate: Money | null;
  contribution: Money;
  /** Direct delivery cost, before non-billable effort and absorbed expenses. */
  directCost: Money;
  totalEffortDays: number;
  peakHeadcount: number;
  peakWeek: WeekIndex | null;
  unstaffedEffortDays: number;
  discountVsStandardPct: number | null;
  maxCashExposure: Money;
  breakEvenOverrunPct: number | null;
}

export interface GuardrailStatus {
  guardrail: Guardrail;
  actual: number | null;
  breached: boolean;
  /** Plain-English explanation, ready to put in front of an approver. */
  explanation: string;
}

export interface ScenarioAnalysis {
  scenario: ScenarioResult;
  metrics: Metrics;
  guardrails: GuardrailStatus[];
  cash: { week: WeekIndex; cost: Money; revenue: Money; position: Money }[];
}

export interface EngagementAnalysis {
  plan: ComputedPlan;
  burn: Money[];
  gradeMix: Map<string, number>;
  scenarios: ScenarioAnalysis[];
}

function formatThreshold(guardrail: Guardrail): string {
  const asPct = guardrail.metric !== 'maxCashExposure';
  return asPct
    ? `${(guardrail.threshold * 100).toFixed(0)}%`
    : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(
        guardrail.threshold / 100,
      );
}

function formatActual(guardrail: Guardrail, actual: number | null): string {
  if (actual == null) return '—';
  const asPct = guardrail.metric !== 'maxCashExposure';
  return asPct
    ? `${(actual * 100).toFixed(1)}%`
    : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(
        actual / 100,
      );
}

export function evaluateGuardrails(
  guardrails: Guardrail[],
  metrics: Metrics,
  scenario: ScenarioResult,
): GuardrailStatus[] {
  return guardrails.map((guardrail) => {
    const actual =
      guardrail.metric === 'grossMarginPct'
        ? metrics.grossMarginPct
        : guardrail.metric === 'downsideMarginPct'
          ? scenario.downside.marginPct
          : guardrail.metric === 'discountPct'
            ? metrics.discountVsStandardPct
            : metrics.maxCashExposure;

    const breached =
      actual == null
        ? false
        : guardrail.operator === 'gte'
          ? actual < guardrail.threshold
          : actual > guardrail.threshold;

    const comparator = guardrail.operator === 'gte' ? 'at least' : 'no more than';
    return {
      guardrail,
      actual,
      breached,
      explanation: breached
        ? `${guardrail.label} is ${formatActual(guardrail, actual)} against a threshold of ${comparator} ${formatThreshold(guardrail)}. ${guardrail.approver} must approve.`
        : `${guardrail.label} is ${formatActual(guardrail, actual)} against a threshold of ${comparator} ${formatThreshold(guardrail)}.`,
    };
  });
}

export function computeMetrics(
  engagement: Engagement,
  plan: ComputedPlan,
  scenario: ScenarioResult,
): Metrics {
  const expenses = engagement.expenses ?? { rechargeable: 0, absorbed: 0 };
  const cost = plan.directCost + (engagement.nonBillableCost ?? 0) + expenses.absorbed;
  const revenue = scenario.revenue + expenses.rechargeable;
  const grossMargin = revenue - cost;
  const slice = sliceOf(plan, engagement.weeks);

  return {
    revenue,
    cost,
    grossMargin,
    grossMarginPct: ratio(grossMargin, revenue),
    blendedDayRate: ratio(revenue, plan.totalEffortDays),
    blendedCostRate: ratio(cost, plan.totalEffortDays),
    effectiveRate: ratio(revenue, plan.totalEffortDays),
    contribution: revenue - plan.directCost,
    directCost: plan.directCost,
    totalEffortDays: plan.totalEffortDays,
    peakHeadcount: plan.peakHeadcount,
    peakWeek: plan.peakWeek,
    unstaffedEffortDays: plan.unstaffedEffortDays,
    discountVsStandardPct:
      plan.revenueAtStandardRates > 0
        ? 1 - (ratio(scenario.revenue, plan.revenueAtStandardRates) ?? 0)
        : null,
    maxCashExposure: maxCashExposure(
      slice.costByWeek,
      scenario.revenueByWeek,
      engagement.weeks,
      engagement.paymentTermsWeeks ?? 0,
    ),
    breakEvenOverrunPct: scenario.breakEvenOverrunPct,
  };
}

/**
 * One call, everything the app needs. The app never does arithmetic itself.
 *
 * Effort and cost are identical across scenarios by construction — the delivery plan is
 * untouched. Only revenue moves, so only the rate card varies between plans.
 */
export function analyse(engagement: Engagement): EngagementAnalysis {
  const basePlan = computePlan(engagement);
  const lag = engagement.paymentTermsWeeks ?? 0;

  // Effort and cost are identical across scenarios by construction — the delivery plan
  // is untouched. Only the rates being billed vary, so plans are cached by those.
  const plansByRates = new Map<string, ComputedPlan>();
  const planFor = (billedRates: Record<string, Money>): ComputedPlan => {
    const key = JSON.stringify(Object.entries(billedRates).sort());
    if (key === '[]') return basePlan;
    let plan = plansByRates.get(key);
    if (!plan) {
      plan = computePlan(engagement, billedRates);
      plansByRates.set(key, plan);
    }
    return plan;
  };

  const scenarios = engagement.scenarios.map((definition) => {
    const plan = planFor(billedRatesFor(engagement, definition));
    const scenario = computeScenario(engagement, plan, definition);
    const metrics = computeMetrics(engagement, plan, scenario);
    return {
      scenario,
      metrics,
      guardrails: evaluateGuardrails(engagement.guardrails, metrics, scenario),
      cash: cashCurve(
        sliceOf(plan, engagement.weeks).costByWeek,
        scenario.revenueByWeek,
        engagement.weeks,
        lag,
      ),
    };
  });

  return {
    plan: basePlan,
    burn: burnCurve(basePlan, engagement.weeks),
    gradeMix: gradeMix(basePlan),
    scenarios,
  };
}

/**
 * Sensitivity: what happens if the plan slips, the mix shifts, or the discount deepens.
 *
 * Applied to a copy of the engagement — the original is never touched.
 */
export interface Sensitivity {
  /** Extend every assignment by n weeks. */
  slipWeeks: number;
  /** Additional discount on charge rates, 0.05 = 5%. */
  extraDiscountPct: number;
}

export function applySensitivity(engagement: Engagement, sensitivity: Sensitivity): Engagement {
  const { slipWeeks, extraDiscountPct } = sensitivity;
  if (slipWeeks <= 0 && extraDiscountPct === 0) return engagement;

  return discounted(slipped(engagement, Math.max(0, Math.round(slipWeeks))), extraDiscountPct);
}

/**
 * A deeper discount on what we actually bill.
 *
 * Applied to each scenario's billed rates — the client card and any per-grade pricing
 * laid over it — and written back as overrides, so the concession lands exactly once on
 * the rates that produce revenue.
 *
 * The practice's **standard card is deliberately untouched**. It is the reference point
 * the deal is measured against, not a thing a sensitivity gets to move. Discounting it
 * alongside everything else made `discountVsStandardPct` report a *negative* discount
 * on a fixed-price deal — the app claiming we were charging above our card at the moment
 * we cut the price by a tenth.
 */
function discounted(engagement: Engagement, extraDiscountPct: number): Engagement {
  if (extraDiscountPct === 0) return engagement;
  const cut = (rate: Money) => Math.max(0, toMoney(rate * (1 - extraDiscountPct)));

  return {
    ...engagement,
    scenarios: engagement.scenarios.map((scenario) => {
      // Start from what this scenario would bill today, so a scenario already carrying
      // per-grade overrides is discounted too. It previously was not: any deal touched
      // by the pricing desk ignored this slider completely, and the stress test on the
      // most carefully priced scenarios was the one doing nothing.
      const billed = billedRatesFor(engagement, scenario);
      const rates: Record<string, Money> = {};
      for (const grade of engagement.grades) {
        rates[grade.id] = cut(billed[grade.id] ?? grade.chargeRate);
      }
      return { ...scenario, rateOverrides: rates };
    }),
  };
}

/**
 * The plan overruns.
 *
 * A slip means the work takes longer, not that every phase of it grows. Only the
 * assignments still running at the original end date carry on — the tail team held for
 * longer, which is what an overrun actually costs. Phases and workstreams live at the
 * end stretch with them.
 *
 * The previous version extended the end of *every* phase, workstream and assignment,
 * which resurrected Discovery for four weeks after it had finished and put the entire
 * team back on at peak. On the seeded plan a four-week slip added 190 effort days to a
 * 260-day engagement and *improved* T&M margin — a stress test that made the deal look
 * better the worse it went.
 */
function slipped(engagement: Engagement, slipWeeks: number): Engagement {
  if (slipWeeks === 0) return engagement;
  const lastWeek = engagement.weeks;
  const stretch = <T extends { startWeek: WeekIndex; endWeek: WeekIndex }>(item: T): T =>
    item.endWeek >= lastWeek ? { ...item, endWeek: item.endWeek + slipWeeks } : item;

  return {
    ...engagement,
    weeks: engagement.weeks + slipWeeks,
    phases: engagement.phases.map(stretch),
    workstreams: engagement.workstreams.map(stretch),
    assignments: engagement.assignments.map(stretch),
  };
}
