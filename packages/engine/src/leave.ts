import { activeWeeks, leaveEntitlement } from './calendar';
import { computePlan, type ComputedPlan } from './compute';
import type { Days, Engagement, Money, WeekIndex } from './types';

/**
 * Leave as a commercial lever — `specs/0007-leave-as-a-commercial-lever.md`.
 *
 * On a fixed price, revenue does not move when somebody takes an extra week off, so the
 * cost of their absent days falls straight to margin. That makes leave a real lever, and
 * one worth being able to flex deliberately rather than discover afterwards.
 *
 * It is also the lever most easily misread, so this module reports both sides of it: the
 * money leave saves, and the **delivery days it removes from the plan**. A fixed price
 * built on 100 delivery days that now plans 92 has not earned eight days of margin — it
 * has created eight days of delivery risk, and which of those it turns out to be is
 * decided after the deal is signed.
 *
 * ASSUMPTION (owner: Harry, REVIEW Q21): that a cost rate is an annual cost divided by
 * *billable* days rather than by working days. If it were the latter, leave would already
 * be unrecovered cost inside the rate and deducting absent days again would double-count
 * it — margin would not rise at all. Everything below depends on that answer.
 */

export interface LeaveLine {
  /** Person id, or a synthetic id for an unstaffed role. */
  holderId: string;
  personId?: string;
  name: string;
  staffed: boolean;
  gradeId: string;
  gradeName: string;
  /** Distinct weeks this person is on the engagement, across all their assignments. */
  weeksOnEngagement: number;
  /** The allowance in force — the person's own, or the engagement default. */
  annualLeaveDays: Days;
  /** What they are due over those weeks. The sourced figure, before any adjustment. */
  entitlementDays: Days;
  /** The commercial adjustment: days added to or taken off the entitlement. */
  adjustmentDays: Days;
  /** Days already in the diary, within those weeks. */
  bookedDays: Days;
  /** Entitlement not yet booked, spread across the weeks with nothing booked. */
  provisionDays: Days;
  /** booked + provision. What the plan is actually carrying for this person. */
  plannedLeaveDays: Days;
  /** plannedLeave − entitlement. Positive means taking more than they are due. */
  varianceDays: Days;
  /** Effort this person contributes after leave — what the plan can actually spend. */
  deliveryDays: Days;
  cost: Money;
  /** Delivery days leave has taken out of the plan. */
  daysLostToLeave: Days;
  /** What those days would have cost us. Under a fixed price this is margin. */
  costSaved: Money;
  /** What those days would have billed. Under T&M this is revenue we no longer earn. */
  revenueForgone: Money;
}

export interface LeaveView {
  lines: LeaveLine[];
  totals: {
    entitlementDays: Days;
    adjustmentDays: Days;
    bookedDays: Days;
    plannedLeaveDays: Days;
    varianceDays: Days;
    deliveryDays: Days;
    daysLostToLeave: Days;
    costSaved: Money;
    revenueForgone: Money;
  };
}

/**
 * What one person's leave is worth to the deal — which depends entirely on the structure.
 *
 * Under a fixed price revenue does not move, so every day of cost avoided is margin.
 * Under time and materials the day is not billed either, and since a charge rate exceeds
 * a cost rate the deal is *worse* off: leave under T&M loses money rather than making it.
 * Reporting one number for both would be the most expensive kind of wrong.
 */
export function marginEffectOfLeave(line: LeaveLine, revenueFollowsEffort: boolean): Money {
  return revenueFollowsEffort ? line.costSaved - line.revenueForgone : line.costSaved;
}

/** Distinct weeks each capacity holder is on the engagement, across all their rows. */
function weeksByHolder(engagement: Engagement): Map<string, Set<WeekIndex>> {
  const weeks = new Map<string, Set<WeekIndex>>();
  for (const assignment of engagement.assignments) {
    const holder = assignment.personId ?? `unstaffed:${assignment.id}`;
    const set = weeks.get(holder) ?? new Set<WeekIndex>();
    for (const week of activeWeeks(assignment.startWeek, assignment.endWeek, engagement.weeks)) {
      set.add(week);
    }
    weeks.set(holder, set);
  }
  return weeks;
}

function holderOf(assignmentId: string, personId?: string): string {
  return personId ?? `unstaffed:${assignmentId}`;
}

interface HolderTotals {
  days: Days;
  cost: Money;
  revenue: Money;
}

function totalsByHolder(plan: ComputedPlan): Map<string, HolderTotals> {
  const totals = new Map<string, HolderTotals>();
  for (const line of plan.lines) {
    const holder = holderOf(line.assignmentId, line.personId);
    const entry = totals.get(holder) ?? { days: 0, cost: 0, revenue: 0 };
    entry.days += line.effortDays;
    entry.cost += line.cost;
    entry.revenue += line.revenueAtRates;
    totals.set(holder, entry);
  }
  return totals;
}

/**
 * The same engagement with every form of leave switched off.
 *
 * Public holidays stay — they are not leave and nobody chooses them. The difference
 * between this plan and the real one is exactly what leave costs the delivery, which is
 * a number worth deriving rather than estimating.
 */
function withoutLeave(engagement: Engagement): Engagement {
  return {
    ...engagement,
    annualLeaveDays: 0,
    people: engagement.people.map(({ leave, annualLeaveDays, leaveAdjustmentDays, ...rest }) => ({
      ...rest,
      annualLeaveDays: 0,
      leaveAdjustmentDays: 0,
    })),
  };
}

export function leaveView(
  engagement: Engagement,
  plan: ComputedPlan = computePlan(engagement),
): LeaveView {
  const grades = new Map(engagement.grades.map((grade) => [grade.id, grade]));
  const roles = new Map(engagement.roles.map((role) => [role.id, role]));
  const people = new Map(engagement.people.map((person) => [person.id, person]));
  const assignments = new Map(engagement.assignments.map((a) => [a.id, a]));

  const weeks = weeksByHolder(engagement);
  const actual = totalsByHolder(plan);
  const noLeave = totalsByHolder(computePlan(withoutLeave(engagement)));

  const lines: LeaveLine[] = [];

  for (const [holderId, holderWeeks] of weeks) {
    const personId = holderId.startsWith('unstaffed:') ? undefined : holderId;
    const person = personId ? people.get(personId) : undefined;
    const assignment = personId
      ? engagement.assignments.find((a) => a.personId === personId)
      : assignments.get(holderId.slice('unstaffed:'.length));
    if (!assignment) continue;

    const allowance = person?.annualLeaveDays ?? engagement.annualLeaveDays ?? 0;
    const adjustmentDays = person?.leaveAdjustmentDays ?? 0;

    let bookedDays = 0;
    let weeksFree = 0;
    for (const week of holderWeeks) {
      const booked = person?.leave?.[week] ?? 0;
      bookedDays += booked;
      if (booked === 0) weeksFree += 1;
    }

    const entitlementDays = leaveEntitlement(allowance, holderWeeks.size);
    // Read the provision off the plan rather than recomputing it: the plan is what the
    // money was built from, so anything derived here has to come from the same place.
    const provisionPerWeek =
      plan.lines.find(
        (line) => holderOf(line.assignmentId, line.personId) === holderId && line.leaveProvision > 0,
      )?.leaveProvision ?? 0;
    const provisionDays = provisionPerWeek * weeksFree;
    const plannedLeaveDays = bookedDays + provisionDays;

    const mine = actual.get(holderId) ?? { days: 0, cost: 0, revenue: 0 };
    const free = noLeave.get(holderId) ?? { days: 0, cost: 0, revenue: 0 };

    const grade = grades.get(assignment.gradeId);
    lines.push({
      holderId,
      ...(personId ? { personId } : {}),
      name: person?.name ?? `To be named — ${roles.get(assignment.roleId)?.name ?? 'role'}`,
      staffed: person != null,
      gradeId: assignment.gradeId,
      gradeName: grade?.name ?? 'Unknown',
      weeksOnEngagement: holderWeeks.size,
      annualLeaveDays: allowance,
      entitlementDays,
      adjustmentDays,
      bookedDays,
      provisionDays,
      plannedLeaveDays,
      varianceDays: plannedLeaveDays - entitlementDays,
      deliveryDays: mine.days,
      cost: mine.cost,
      daysLostToLeave: free.days - mine.days,
      costSaved: free.cost - mine.cost,
      revenueForgone: free.revenue - mine.revenue,
    });
  }

  // Named people first, then by seniority — the expensive rows are the ones that move
  // the margin, and they are what a pricing conversation reaches for first.
  lines.sort((a, b) => {
    if (a.staffed !== b.staffed) return a.staffed ? -1 : 1;
    const orderA = grades.get(a.gradeId)?.order ?? 0;
    const orderB = grades.get(b.gradeId)?.order ?? 0;
    if (orderA !== orderB) return orderB - orderA;
    return a.name.localeCompare(b.name);
  });

  const totals = lines.reduce(
    (sum, line) => ({
      entitlementDays: sum.entitlementDays + line.entitlementDays,
      adjustmentDays: sum.adjustmentDays + line.adjustmentDays,
      bookedDays: sum.bookedDays + line.bookedDays,
      plannedLeaveDays: sum.plannedLeaveDays + line.plannedLeaveDays,
      varianceDays: sum.varianceDays + line.varianceDays,
      deliveryDays: sum.deliveryDays + line.deliveryDays,
      daysLostToLeave: sum.daysLostToLeave + line.daysLostToLeave,
      costSaved: sum.costSaved + line.costSaved,
      revenueForgone: sum.revenueForgone + line.revenueForgone,
    }),
    {
      entitlementDays: 0,
      adjustmentDays: 0,
      bookedDays: 0,
      plannedLeaveDays: 0,
      varianceDays: 0,
      deliveryDays: 0,
      daysLostToLeave: 0,
      costSaved: 0,
      revenueForgone: 0,
    },
  );

  return { lines, totals };
}
