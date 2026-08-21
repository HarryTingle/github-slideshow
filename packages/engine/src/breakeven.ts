import type { ComputedPlan } from './compute';
import type { ScenarioAnalysis } from './metrics';
import { ratio, toMoney } from './money';
import type { Engagement, Money } from './types';

/**
 * The floor — `specs/0008-break-even-and-the-blended-floor.md`.
 *
 * The pricing desk answers *which lever is worth pulling*. This answers the question
 * asked immediately before walking into a negotiation: **how low can I actually go?**
 *
 * Two numbers matter, and neither is a rate you can set. A blended day rate is an
 * *output* of the team you put on the job, so the floor moves when the mix moves —
 * which is exactly why it has to be computed against the plan rather than looked up.
 *
 *  - **Break-even blended rate** — the blended day rate at which the deal makes nothing.
 *  - **Target blended rate** — the blended day rate that hits the margin you need.
 *
 * The most useful identity here is worth stating plainly, because bid teams routinely
 * get it wrong: **the deepest discount you can give is your current margin.** A deal at
 * 22% margin can give away 22% of its price and no more. Not 22 points of margin — 22%
 * of revenue. The two are confused constantly, and the confusion costs deals money.
 */

export interface BreakEvenGradeLine {
  gradeId: string;
  name: string;
  order: number;
  days: number;
  /** This grade's share of the days in the plan. */
  shareOfDays: number;
  chargeRate: Money;
  costRate: Money;
  /** What a day of this grade earns before overhead. */
  marginPerDay: Money;
  marginPct: number | null;
  /** What this grade contributes to the blended rate: its rate weighted by its share. */
  contributionToBlended: Money;
}

export interface BreakEvenView {
  effortDays: number;
  revenue: Money;
  /** Fully loaded: delivery, non-billable overhead and absorbed expenses. */
  cost: Money;
  /** Delivery only — the difference from `cost` is the overhead the mix must also carry. */
  directCost: Money;
  marginPct: number | null;

  /** What the deal bills per day today, and what a day costs. */
  blendedRate: Money | null;
  blendedCostRate: Money | null;
  /** Delivery cost per day, before overhead. */
  blendedDirectCostRate: Money | null;

  /** The blended day rate at which this deal makes nothing. */
  breakEvenRate: Money | null;
  /** The blended day rate that hits the target margin. */
  targetRate: Money | null;
  targetMarginPct: number;

  /** Revenue between here and each floor. Negative once the floor is already breached. */
  roomToBreakEven: Money;
  roomToTarget: Money;
  /**
   * The deepest discount off today's price that still clears each floor, as a fraction
   * of revenue. `discountToBreakEven` is identically the current margin — see the note
   * on this module. Null when there is no revenue to discount.
   */
  discountToBreakEven: number | null;
  discountToTarget: number | null;
  /** True when the deal is already under the target and the room is negative. */
  belowTarget: boolean;
  /** True when the deal already loses money. */
  belowBreakEven: boolean;

  grades: BreakEvenGradeLine[];
  /** Best and worst margin per day. The mix is what moves the floor. */
  richest: BreakEvenGradeLine | null;
  leanest: BreakEvenGradeLine | null;
}

/**
 * The floor for one scenario, against the plan as it stands.
 *
 * `targetMarginPct` is the practice's own bar, passed in rather than assumed — the
 * engine holds no view on what margin is acceptable.
 */
export function breakEvenView(
  engagement: Engagement,
  entry: ScenarioAnalysis,
  plan: ComputedPlan,
  targetMarginPct: number,
  billedRates: Record<string, Money> = {},
): BreakEvenView {
  const { metrics } = entry;
  const days = metrics.totalEffortDays;
  const revenue = metrics.revenue;
  const cost = metrics.cost;

  // Revenue that clears each floor. Break-even is cost; target solves
  // (revenue − cost) / revenue = target for revenue, which is cost / (1 − target).
  const target = Math.min(0.999, Math.max(0, targetMarginPct));
  const revenueAtTarget = target >= 0.999 ? null : toMoney(cost / (1 - target));

  const grades = [...engagement.grades]
    .map((grade) => {
      const gradeDays = plan.effortByGrade.get(grade.id) ?? 0;
      const chargeRate = billedRates[grade.id] ?? grade.chargeRate;
      const share = days > 0 ? gradeDays / days : 0;
      return {
        gradeId: grade.id,
        name: grade.name,
        order: grade.order,
        days: gradeDays,
        shareOfDays: share,
        chargeRate,
        costRate: grade.costRate,
        marginPerDay: chargeRate - grade.costRate,
        marginPct: ratio(chargeRate - grade.costRate, chargeRate),
        contributionToBlended: toMoney(chargeRate * share),
      };
    })
    .filter((line) => line.days > 0)
    .sort((a, b) => b.order - a.order);

  // Best and worst *earning* day, which is not the same as cheapest or most senior.
  const byMargin = [...grades].sort((a, b) => (b.marginPct ?? 0) - (a.marginPct ?? 0));

  return {
    effortDays: days,
    revenue,
    cost,
    directCost: metrics.directCost,
    marginPct: metrics.grossMarginPct,

    blendedRate: ratio(revenue, days) == null ? null : toMoney(revenue / days),
    blendedCostRate: ratio(cost, days) == null ? null : toMoney(cost / days),
    blendedDirectCostRate:
      ratio(metrics.directCost, days) == null ? null : toMoney(metrics.directCost / days),

    breakEvenRate: ratio(cost, days) == null ? null : toMoney(cost / days),
    targetRate:
      revenueAtTarget == null || days <= 0 ? null : toMoney(revenueAtTarget / days),
    targetMarginPct: target,

    roomToBreakEven: revenue - cost,
    roomToTarget: revenueAtTarget == null ? 0 : revenue - revenueAtTarget,
    discountToBreakEven: ratio(revenue - cost, revenue),
    discountToTarget:
      revenueAtTarget == null ? null : ratio(revenue - revenueAtTarget, revenue),
    belowTarget: revenueAtTarget != null && revenue < revenueAtTarget,
    belowBreakEven: revenue < cost,

    grades,
    richest: byMargin[0] ?? null,
    leanest: byMargin[byMargin.length - 1] ?? null,
  };
}
