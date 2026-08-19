import { WEEKS_PER_YEAR, activeWeeks, availableDays, leaveProvision, rampFactor } from './calendar';
import { multiplyRate, ratio } from './money';
import type {
  Assignment,
  Scenario,
  Days,
  Engagement,
  Grade,
  Money,
  Person,
  WeekIndex,
} from './types';

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
  /** Pro-rated annual leave deducted from this week. */
  leaveProvision: Days;
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
  billedRates?: Record<string, Money>,
): Money {
  const billed = billedRates?.[assignment.gradeId];
  if (billed != null) return billed;
  return grades.get(assignment.gradeId)?.chargeRate ?? 0;
}

/**
 * What we will bill, by grade: the scenario's own rates over the client card over the
 * practice standard. Resolving it in one place keeps "which rate is this?" answerable.
 */
export function billedRatesFor(engagement: Engagement, scenario: Scenario): Record<string, Money> {
  const structures = [scenario.structure, ...Object.values(scenario.structureByPhase ?? {})];
  const cardId = structures.find((s) => 'rateCardId' in s && s.rateCardId);
  const card =
    cardId && 'rateCardId' in cardId
      ? engagement.rateCards.find((candidate) => candidate.id === cardId.rateCardId)
      : undefined;
  return { ...(card?.rates ?? {}), ...(scenario.rateOverrides ?? {}) };
}

/**
 * Turn a delivery plan and resource model into effort, cost and T&M revenue.
 *
 * Pure: no I/O, no dates, no framework, no mutation of the input.
 */
export function computePlan(
  engagement: Engagement,
  billedRates?: Record<string, Money>,
): ComputedPlan {
  const grades = indexBy(engagement.grades);
  const people = indexBy(engagement.people);
  const workstreams = indexBy(engagement.workstreams);

  // Annual leave is granted per person-year, so it has to be pro-rated against the
  // weeks each capacity holder is actually on this engagement before any line is
  // costed. An unstaffed role gets the same treatment as a named person — otherwise a
  // role placeholder would look cheaper and more available than the person who ends up
  // filling it, and the plan would flatter itself right up until it was staffed.
  const weeksByHolder = new Map<string, Set<WeekIndex>>();
  for (const assignment of engagement.assignments) {
    const holder = assignment.personId ?? `unstaffed:${assignment.id}`;
    const weeks = weeksByHolder.get(holder) ?? new Set<WeekIndex>();
    for (const week of activeWeeks(assignment.startWeek, assignment.endWeek, engagement.weeks)) {
      weeks.add(week);
    }
    weeksByHolder.set(holder, weeks);
  }

  const provisionByHolder = new Map<string, Days>();
  for (const [holder, weeks] of weeksByHolder) {
    const person = people.get(holder);
    const allowance = person?.annualLeaveDays ?? engagement.annualLeaveDays ?? 0;
    let booked = 0;
    let weeksFree = 0;
    for (const week of weeks) {
      const bookedThisWeek = person?.leave?.[week] ?? 0;
      booked += bookedThisWeek;
      if (bookedThisWeek === 0) weeksFree += 1;
    }
    provisionByHolder.set(holder, leaveProvision(allowance, weeks.size, booked, weeksFree));
  }

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
    const chargeRate = chargeRateFor(assignment, grades, billedRates);
    const standardRate = grades.get(assignment.gradeId)?.chargeRate ?? 0;

    const holderProvision = provisionByHolder.get(assignment.personId ?? `unstaffed:${assignment.id}`) ?? 0;

    for (const week of activeWeeks(assignment.startWeek, assignment.endWeek, engagement.weeks)) {
      // No provision in a week already carrying booked leave — see `leaveProvision`.
      const provision = (person?.leave?.[week] ?? 0) > 0 ? 0 : holderProvision;
      const available = availableDays(engagement.calendar, week, person, provision);
      const ramp = rampFactor(week, assignment.startWeek, assignment.rampWeeks);
      const allocation = assignment.allocationByWeek?.[week] ?? assignment.allocation;
      const effortDays = allocation * available * ramp;
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
        leaveProvision: provision,
        rampFactor: ramp,
        allocation,
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
      fteByWeek.set(week, (fteByWeek.get(week) ?? 0) + allocation);
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

/**
 * How many days a full-time person actually supplies, and where the rest went.
 *
 * Exists so the model can be reconciled against a resourcing spreadsheet line by line —
 * "you say 253 billable days a year, we say this" — rather than argued about. The
 * annualised figure scales the engagement's own calendar to a 52-week year, so it is
 * directly comparable with an annual capacity figure.
 */
export interface CapacityBasis {
  weeks: number;
  workingDays: number;
  publicHolidayDays: number;
  annualLeaveDays: Days;
  availableDays: Days;
  /** The same calendar expressed over a full year, for comparison with an annual figure. */
  annualisedAvailableDays: Days;
  annualisedBeforeLeave: Days;
}

export function capacityBasis(engagement: Engagement): CapacityBasis {
  const weeks = Math.max(1, engagement.weeks);
  const workingDays = engagement.calendar.workingDaysPerWeek * weeks;

  let publicHolidayDays = 0;
  for (let week = 1; week <= weeks; week++) {
    publicHolidayDays += engagement.calendar.publicHolidays?.[week] ?? 0;
  }

  const allowance = engagement.annualLeaveDays ?? 0;
  const annualLeaveDays = allowance * (weeks / WEEKS_PER_YEAR);
  const availableDays = Math.max(0, workingDays - publicHolidayDays - annualLeaveDays);
  const yearScale = WEEKS_PER_YEAR / weeks;

  return {
    weeks,
    workingDays,
    publicHolidayDays,
    annualLeaveDays,
    availableDays,
    annualisedAvailableDays: availableDays * yearScale,
    annualisedBeforeLeave: (workingDays - publicHolidayDays) * yearScale,
  };
}
