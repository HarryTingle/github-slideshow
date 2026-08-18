import { activeWeeks, availableDays, rampFactor } from './calendar.js';
import { multiplyRate, ratio } from './money.js';
import type {
  Assignment,
  Days,
  Engagement,
  Grade,
  Money,
  Person,
  RateCard,
  WeekIndex,
} from './types.js';

/**
 * One (assignment × week) atom. This is the smallest thing a user can point at, and
 * therefore the unit of traceability: every total in the app is a sum of these, and
 * every figure can be drilled back down to them.
 */
export interface EffortLine {
  assignmentId: string;
  workstreamId: string;
  phaseId: string;
  roleId: string;
  gradeId: string;
  personId?: string;
  week: WeekIndex;
  /** Working days less holidays and leave, before allocation. */
  availableDays: Days;
  rampFactor: number;
  allocation: number;
  effortDays: Days;
  costRate: Money;
  chargeRate: Money;
  cost: Money;
  /** Revenue at the applicable rate card. The T&M base case. */
  revenueAtRates: Money;
}

export interface ComputedPlan {
  lines: EffortLine[];
  totalEffortDays: Days;
  /** Direct delivery cost only. Non-billable cost and expenses are added in metrics. */
  directCost: Money;
  /** Revenue at the scenario's rate card — the T&M base case, before any structure. */
  revenueAtRates: Money;
  /** Revenue at our standard rate card, ignoring client-specific rates. */
  revenueAtStandardRates: Money;
  effortByWeek: Map<WeekIndex, Days>;
  costByWeek: Map<WeekIndex, Money>;
  effortByGrade: Map<string, Days>;
  effortByPhase: Map<string, Days>;
  effortByWorkstream: Map<string, Days>;
  fteByWeek: Map<WeekIndex, number>;
  peakHeadcount: number;
  peakWeek: WeekIndex | null;
  /** Effort on assignments with no named person — the resourcing gap. */
  unstaffedEffortDays: Days;
}

function indexBy<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

export function costRateFor(
  assignment: Assignment,
  grades: Map<string, Grade>,
  people: Map<string, Person>,
): Money {
  const person = assignment.personId ? people.get(assignment.personId) : undefined;
  // A named person's own cost rate wins. Charge rate is never overridden this way.
  if (person?.costRate != null) return person.costRate;
  return grades.get(assignment.gradeId)?.costRate ?? 0;
}

export function chargeRateFor(
  assignment: Assignment,
  grades: Map<string, Grade>,
  rateCard?: RateCard,
): Money {
  const override = rateCard?.rates[assignment.gradeId];
  if (override != null) return override;
  return grades.get(assignment.gradeId)?.chargeRate ?? 0;
}

/**
 * Turn a delivery plan and resource model into effort, cost and T&M revenue.
 *
 * Pure: no I/O, no dates, no framework, no mutation of the input.
 */
export function computePlan(engagement: Engagement, rateCardId?: string): ComputedPlan {
  const grades = indexBy(engagement.grades);
  const people = indexBy(engagement.people);
  const workstreams = indexBy(engagement.workstreams);
  const rateCard = rateCardId
    ? engagement.rateCards.find((card) => card.id === rateCardId)
    : undefined;

  const lines: EffortLine[] = [];
  const effortByWeek = new Map<WeekIndex, Days>();
  const costByWeek = new Map<WeekIndex, Money>();
  const effortByGrade = new Map<string, Days>();
  const effortByPhase = new Map<string, Days>();
  const effortByWorkstream = new Map<string, Days>();
  const fteByWeek = new Map<WeekIndex, number>();

  let totalEffortDays = 0;
  let directCost = 0;
  let revenueAtRates = 0;
  let revenueAtStandardRates = 0;
  let unstaffedEffortDays = 0;

  for (const assignment of engagement.assignments) {
    const workstream = workstreams.get(assignment.workstreamId);
    if (!workstream) continue;

    const person = assignment.personId ? people.get(assignment.personId) : undefined;
    const costRate = costRateFor(assignment, grades, people);
    const chargeRate = chargeRateFor(assignment, grades, rateCard);
    const standardRate = grades.get(assignment.gradeId)?.chargeRate ?? 0;

    for (const week of activeWeeks(assignment.startWeek, assignment.endWeek, engagement.weeks)) {
      const available = availableDays(engagement.calendar, week, person);
      const ramp = rampFactor(week, assignment.startWeek, assignment.rampWeeks);
      const effortDays = assignment.allocation * available * ramp;
      if (effortDays === 0 && available === 0) {
        // A fully-holidayed week is zero effort, not an error. Recorded so the
        // allocation grid can show why the week is empty.
      }

      const cost = multiplyRate(costRate, effortDays);
      const revenue = multiplyRate(chargeRate, effortDays);

      lines.push({
        assignmentId: assignment.id,
        workstreamId: assignment.workstreamId,
        phaseId: workstream.phaseId,
        roleId: assignment.roleId,
        gradeId: assignment.gradeId,
        personId: assignment.personId,
        week,
        availableDays: available,
        rampFactor: ramp,
        allocation: assignment.allocation,
        effortDays,
        costRate,
        chargeRate,
        cost,
        revenueAtRates: revenue,
      });

      totalEffortDays += effortDays;
      directCost += cost;
      revenueAtRates += revenue;
      revenueAtStandardRates += multiplyRate(standardRate, effortDays);
      if (!assignment.personId) unstaffedEffortDays += effortDays;

      effortByWeek.set(week, (effortByWeek.get(week) ?? 0) + effortDays);
      costByWeek.set(week, (costByWeek.get(week) ?? 0) + cost);
      effortByGrade.set(assignment.gradeId, (effortByGrade.get(assignment.gradeId) ?? 0) + effortDays);
      effortByPhase.set(workstream.phaseId, (effortByPhase.get(workstream.phaseId) ?? 0) + effortDays);
      effortByWorkstream.set(
        assignment.workstreamId,
        (effortByWorkstream.get(assignment.workstreamId) ?? 0) + effortDays,
      );
      fteByWeek.set(week, (fteByWeek.get(week) ?? 0) + assignment.allocation);
    }
  }

  let peakHeadcount = 0;
  let peakWeek: WeekIndex | null = null;
  for (const [week, fte] of fteByWeek) {
    if (fte > peakHeadcount) {
      peakHeadcount = fte;
      peakWeek = week;
    }
  }

  return {
    lines,
    totalEffortDays,
    directCost,
    revenueAtRates,
    revenueAtStandardRates,
    effortByWeek,
    costByWeek,
    effortByGrade,
    effortByPhase,
    effortByWorkstream,
    fteByWeek,
    peakHeadcount,
    peakWeek,
    unstaffedEffortDays,
  };
}

/** Grade mix — the distribution of effort across grades. Derived, never entered. */
export function gradeMix(plan: ComputedPlan): Map<string, number> {
  const mix = new Map<string, number>();
  for (const [gradeId, days] of plan.effortByGrade) {
    mix.set(gradeId, ratio(days, plan.totalEffortDays) ?? 0);
  }
  return mix;
}

/** Cumulative cost by week — the burn curve. */
export function burnCurve(plan: ComputedPlan, weeks: number): Money[] {
  const curve: Money[] = [];
  let cumulative = 0;
  for (let week = 1; week <= weeks; week++) {
    cumulative += plan.costByWeek.get(week) ?? 0;
    curve.push(cumulative);
  }
  return curve;
}
