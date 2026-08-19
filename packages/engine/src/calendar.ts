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
): Days {
  const holidays = calendar.publicHolidays?.[week] ?? 0;
  const leave = person?.leave?.[week] ?? 0;
  return Math.max(0, calendar.workingDaysPerWeek - holidays - leave);
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
