import type { Calendar, Days, Person, WeekIndex } from './types';

/**
 * Availability before utilisation.
 *
 * NOTE: target utilisation is deliberately absent from this engine. Applying it to
 * capacity, to cost, or to both is the single most consequential modelling error
 * available, and doing all three inconsistently is what makes bespoke spreadsheets
 * wrong. It goes in once the real models have been read — REVIEW Q3.
 */
export function availableDays(
  calendar: Calendar,
  week: WeekIndex,
  person?: Person,
  /** Pro-rated annual leave for this week — see `leaveProvision`. */
  leaveProvision = 0,
): Days {
  const holidays = calendar.publicHolidays?.[week] ?? 0;
  const booked = person?.leave?.[week] ?? 0;
  return Math.max(0, calendar.workingDaysPerWeek - holidays - booked - leaveProvision);
}

/** Weeks in a year, for pro-rating an annual allowance onto an engagement. */
export const WEEKS_PER_YEAR = 52;

/**
 * Spread an annual leave allowance across the weeks somebody is actually on the job.
 *
 * Leave is granted annually but taken unpredictably, so a plan that counts only booked
 * leave overstates capacity by roughly the whole allowance. The allowance is pro-rated
 * to the weeks worked, whatever is already booked in those weeks is set against it, and
 * the remainder is spread across the weeks that have no leave booked — a provision for
 * the leave not yet in the diary, not a prediction of when it will be taken.
 *
 * The remainder deliberately avoids weeks that already carry booked leave. Adding a
 * provision on top of a week somebody is already off would push availability below zero
 * and be clamped away, quietly losing part of the allowance.
 *
 * Returns days to deduct from each week that has no booked leave.
 */
export function leaveProvision(
  annualLeaveDays: Days,
  weeksOnEngagement: number,
  bookedDaysInThoseWeeks: number,
  weeksWithNoBookedLeave: number,
  /** Days added to or taken off what this person is due — see `Person.leaveAdjustmentDays`. */
  adjustmentDays = 0,
): Days {
  if (weeksOnEngagement <= 0 || weeksWithNoBookedLeave <= 0) return 0;
  const expected = leaveEntitlement(annualLeaveDays, weeksOnEngagement) + adjustmentDays;
  if (expected <= 0) return 0;
  return Math.max(0, expected - bookedDaysInThoseWeeks) / weeksWithNoBookedLeave;
}

/**
 * What somebody is due over the weeks they are on this engagement.
 *
 * The annual allowance pro-rated by weeks worked. This is the sourced figure — 23 days
 * a year, per `context/domain-model.md` §3 — and the number the commercial view shows
 * as "should take" before any adjustment.
 */
export function leaveEntitlement(annualLeaveDays: Days, weeksOnEngagement: number): Days {
  if (annualLeaveDays <= 0 || weeksOnEngagement <= 0) return 0;
  return annualLeaveDays * (weeksOnEngagement / WEEKS_PER_YEAR);
}

/** Linear ramp to full productivity over `rampWeeks`. 1 when no ramp is set. */
export function rampFactor(
  week: WeekIndex,
  startWeek: WeekIndex,
  rampWeeks?: number,
): number {
  if (!rampWeeks || rampWeeks <= 0) return 1;
  const weeksIn = week - startWeek;
  return Math.min(1, (weeksIn + 1) / rampWeeks);
}

/** Inclusive range of week indices an assignment is active for, clipped to the engagement. */
export function activeWeeks(
  startWeek: WeekIndex,
  endWeek: WeekIndex,
  totalWeeks: number,
): WeekIndex[] {
  const from = Math.max(1, startWeek);
  const to = Math.min(totalWeeks, endWeek);
  const weeks: WeekIndex[] = [];
  for (let w = from; w <= to; w++) weeks.push(w);
  return weeks;
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** "2026-W34" for display. The engine never calculates on this. */
export function isoWeekLabel(startDate: string, week: WeekIndex): string {
  const date = new Date(`${startDate}T00:00:00Z`);
  date.setTime(date.getTime() + (week - 1) * MS_PER_WEEK);
  const target = new Date(date.getTime());
  const day = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  const isoWeek = 1 + Math.round((target.getTime() - firstThursday.getTime()) / MS_PER_WEEK);
  return `${target.getUTCFullYear()}-W${String(isoWeek).padStart(2, '0')}`;
}

/** "12 Oct" for display on a timeline. */
export function weekStartLabel(startDate: string, week: WeekIndex): string {
  const date = new Date(`${startDate}T00:00:00Z`);
  date.setTime(date.getTime() + (week - 1) * MS_PER_WEEK);
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
}

/** The Monday of a given week. Display only — the engine never calculates on dates. */
export function weekDate(startDate: string, week: WeekIndex): Date {
  const date = new Date(`${startDate}T00:00:00Z`);
  date.setTime(date.getTime() + (week - 1) * MS_PER_WEEK);
  return date;
}

/** Sprint number, counting from week 1 of the engagement. */
export function sprintNumber(week: WeekIndex, sprintWeeks = 2): number {
  const length = Math.max(1, Math.round(sprintWeeks));
  return Math.floor((week - 1) / length) + 1;
}

/** Calendar quarter the week falls in — "Q3 2026". */
export function quarterLabel(startDate: string, week: WeekIndex): string {
  const date = weekDate(startDate, week);
  return `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`;
}

/**
 * Collapse a run of weeks into header spans — one entry per contiguous run sharing a
 * label. Used for the quarter and sprint rulers above the allocation grid.
 */
export function headerSpans(
  weeks: number,
  labelOf: (week: WeekIndex) => string,
): { label: string; from: WeekIndex; span: number }[] {
  const spans: { label: string; from: WeekIndex; span: number }[] = [];
  for (let week = 1; week <= weeks; week++) {
    const label = labelOf(week);
    const last = spans[spans.length - 1];
    if (last && last.label === label) last.span += 1;
    else spans.push({ label, from: week, span: 1 });
  }
  return spans;
}
