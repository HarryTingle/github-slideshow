import { cashCurve, computeScenario, maxCashExposure, sliceOf, type ScenarioResult } from './commercial.js';
import { burnCurve, computePlan, gradeMix, type ComputedPlan } from './compute.js';
import { ratio } from './money.js';
import type { Engagement, Guardrail, Money, Scenario, WeekIndex } from './types.js';

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

/** The rate card a scenario bills at, if its structure names one. */
function rateCardOf(scenario: Scenario): string | undefined {
  const structures = [scenario.structure, ...Object.values(scenario.structureByPhase ?? {})];
  for (const structure of structures) {
    if ('rateCardId' in structure && structure.rateCardId) return structure.rateCardId;
  }
  return undefined;
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

  const plansByRateCard = new Map<string, ComputedPlan>();
  const planFor = (rateCardId?: string): ComputedPlan => {
    if (!rateCardId) return basePlan;
    let plan = plansByRateCard.get(rateCardId);
    if (!plan) {
      plan = computePlan(engagement, rateCardId);
      plansByRateCard.set(rateCardId, plan);
    }
    return plan;
  };

  const scenarios = engagement.scenarios.map((definition) => {
    const plan = planFor(rateCardOf(definition));
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
  if (slipWeeks === 0 && extraDiscountPct === 0) return engagement;

  return {
    ...engagement,
    weeks: engagement.weeks + Math.max(0, slipWeeks),
    grades: engagement.grades.map((grade) => ({
      ...grade,
      chargeRate: Math.round(grade.chargeRate * (1 - extraDiscountPct)),
    })),
    workstreams: engagement.workstreams.map((workstream) => ({
      ...workstream,
      endWeek: workstream.endWeek + slipWeeks,
    })),
    phases: engagement.phases.map((phase) => ({ ...phase, endWeek: phase.endWeek + slipWeeks })),
    assignments: engagement.assignments.map((assignment) => ({
      ...assignment,
      endWeek: assignment.endWeek + slipWeeks,
    })),
    rateCards: engagement.rateCards.map((card) => ({
      ...card,
      rates: Object.fromEntries(
        Object.entries(card.rates).map(([id, rate]) => [id, Math.round(rate * (1 - extraDiscountPct))]),
      ),
    })),
  };
}
