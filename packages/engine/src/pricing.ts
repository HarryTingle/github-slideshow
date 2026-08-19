import { billedRatesFor, type ComputedPlan } from './compute';
import type { ScenarioAnalysis } from './metrics';
import { ratio, toMoney } from './money';
import type { Engagement, Money, Scenario } from './types';

/**
 * Pricing levers.
 *
 * A commercial lead pricing a bid is answering one question repeatedly: *what is the
 * cheapest way to get from where this deal is to where it needs to be?* Answering it by
 * nudging numbers and watching a total is slow, and it hides the thing that matters —
 * which lever is worth pulling. This module computes the leverage directly, so the
 * question is answered rather than searched for.
 *
 * Two facts drive everything here:
 *
 * 1. **Under a fixed price, a rate change does nothing.** Revenue is the price. Rates
 *    only set the reference the discount is measured against. The levers that remain
 *    are the price and the shape of the team.
 * 2. **On this rate card margin falls as seniority rises.** Trading a day down the
 *    ladder therefore *improves* margin — dramatically so under a fixed price, where the
 *    saving is pure cost and revenue does not follow.
 */

const NUDGE = 2500; // £25/day, the unit rate changes are actually made in
const TRADE_DAYS = 5; // one week of one person, the unit mix changes are made in

export interface GradeLine {
  gradeId: string;
  name: string;
  order: number;
  days: number;
  /** What this deal bills. The number a commercial lead actually moves. */
  billedRate: Money;
  /** The practice standard, for reference — what the discount is measured against. */
  standardRate: Money;
  costRate: Money;
  revenue: Money;
  cost: Money;
  marginPct: number | null;
  /** True when this deal sets its own rate for the grade rather than inheriting one. */
  overridden: boolean;
  /** Points of total margin gained by putting £25 a day on this grade. */
  rateLeveragePp: number;
  /** Points of total margin gained by moving a week of work down one grade. */
  tradeDownPp: number;
  tradeDownTo: string | null;
}

export interface PricingView {
  grades: GradeLine[];
  revenueFollowsEffort: boolean;
  /** Revenue the plan would earn at the billed rates — the T&M build-up. */
  buildUp: Money;
  /** The same at practice standard rates, which is what a discount is measured against. */
  buildUpAtStandard: Money;
  price: Money;
  discountPct: number | null;
  blendedRate: Money | null;
  blendedStandardRate: Money | null;
}

function marginAfter(revenue: Money, cost: Money, dRevenue: number, dCost: number): number | null {
  return ratio(revenue + dRevenue - cost - dCost, revenue + dRevenue);
}

export function pricingView(
  engagement: Engagement,
  definition: Scenario,
  entry: ScenarioAnalysis,
  plan: ComputedPlan,
): PricingView {
  const { metrics, scenario } = entry;
  const billed = billedRatesFor(engagement, definition);
  const overrides = definition.rateOverrides ?? {};
  const ladder = [...engagement.grades].sort((a, b) => a.order - b.order);

  const revenue = metrics.revenue;
  const cost = metrics.cost;
  const marginNow = metrics.grossMarginPct ?? 0;

  let buildUp = 0;
  let buildUpAtStandard = 0;
  const revenueByGrade = new Map<string, Money>();
  const costByGrade = new Map<string, Money>();
  for (const line of plan.lines) {
    revenueByGrade.set(line.gradeId, (revenueByGrade.get(line.gradeId) ?? 0) + line.revenueAtRates);
    costByGrade.set(line.gradeId, (costByGrade.get(line.gradeId) ?? 0) + line.cost);
    buildUp += line.revenueAtRates;
  }
  buildUpAtStandard = plan.revenueAtStandardRates;

  const grades: GradeLine[] = [];
  for (const [index, grade] of ladder.entries()) {
    const days = plan.effortByGrade.get(grade.id) ?? 0;
    if (days === 0) continue;

    const billedRate = billed[grade.id] ?? grade.chargeRate;
    const below = ladder[index - 1];

    // Rates only move revenue where revenue follows effort.
    const rateDelta = scenario.revenueFollowsEffort ? days * NUDGE : 0;
    const rateLever = marginAfter(revenue, cost, rateDelta, 0);

    let tradeDownPp = 0;
    if (below) {
      const belowBilled = billed[below.id] ?? below.chargeRate;
      const dCost = TRADE_DAYS * (below.costRate - grade.costRate);
      const dRevenue = scenario.revenueFollowsEffort
        ? TRADE_DAYS * (belowBilled - billedRate)
        : 0;
      const traded = marginAfter(revenue, cost, dRevenue, dCost);
      tradeDownPp = traded == null ? 0 : (traded - marginNow) * 100;
    }

    grades.push({
      gradeId: grade.id,
      name: grade.name,
      order: grade.order,
      days,
      billedRate,
      standardRate: grade.chargeRate,
      costRate: grade.costRate,
      revenue: revenueByGrade.get(grade.id) ?? 0,
      cost: costByGrade.get(grade.id) ?? 0,
      marginPct: ratio(
        (revenueByGrade.get(grade.id) ?? 0) - (costByGrade.get(grade.id) ?? 0),
        revenueByGrade.get(grade.id) ?? 0,
      ),
      overridden: overrides[grade.id] != null,
      rateLeveragePp: rateLever == null ? 0 : (rateLever - marginNow) * 100,
      tradeDownPp,
      tradeDownTo: below?.name ?? null,
    });
  }

  return {
    grades: grades.reverse(), // most senior first — where the money and the risk sit
    revenueFollowsEffort: scenario.revenueFollowsEffort,
    buildUp,
    buildUpAtStandard,
    price: scenario.revenue,
    discountPct:
      buildUpAtStandard > 0 ? 1 - (ratio(scenario.revenue, buildUpAtStandard) ?? 0) : null,
    blendedRate: ratio(scenario.revenue, metrics.totalEffortDays),
    blendedStandardRate: ratio(buildUpAtStandard, metrics.totalEffortDays),
  };
}

export type Solution =
  | { kind: 'rateMultiplier'; multiplier: number; resultingPrice: Money; reachable: true }
  | { kind: 'price'; price: Money; reachable: true }
  | { kind: 'unreachable'; reason: string; reachable: false };

/**
 * What would it take to hit a target margin?
 *
 * Closed form rather than a search: margin is `(R − C) / R`, so the revenue that hits a
 * target `t` is `C / (1 − t)`. Under T&M that is expressed as a uniform move on the
 * rates; under a fixed price it is simply the price.
 */
export function solveForMargin(entry: ScenarioAnalysis, view: PricingView, target: number): Solution {
  const { metrics, scenario } = entry;
  if (target >= 1) return { kind: 'unreachable', reason: 'A margin of 100% or more is not a target.', reachable: false };

  const rechargeable = metrics.revenue - scenario.revenue;
  const requiredRevenue = metrics.cost / (1 - target);

  if (!view.revenueFollowsEffort) {
    const price = toMoney(requiredRevenue - rechargeable);
    if (price <= 0) return { kind: 'unreachable', reason: 'No price reaches that margin on this plan.', reachable: false };
    return { kind: 'price', price, reachable: true };
  }

  if (view.buildUp <= 0) {
    return { kind: 'unreachable', reason: 'Nothing is staffed, so there is nothing to price.', reachable: false };
  }
  const multiplier = (requiredRevenue - rechargeable) / view.buildUp;
  if (multiplier <= 0) return { kind: 'unreachable', reason: 'No set of rates reaches that margin.', reachable: false };
  return {
    kind: 'rateMultiplier',
    multiplier,
    resultingPrice: toMoney(view.buildUp * multiplier),
    reachable: true,
  };
}
