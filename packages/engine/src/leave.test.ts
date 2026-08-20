import { describe, expect, it } from 'vitest';
import { leaveEntitlement, WEEKS_PER_YEAR } from './calendar';
import { computePlan } from './compute';
import { setPersonLeave, setPersonLeaveAdjustment } from './edit';
import { leaveView, marginEffectOfLeave } from './leave';
import { analyse } from './metrics';
import { meridian } from './seed';

const bello = () => leaveView(meridian).lines.find((line) => line.personId === 'p-bello')!;

describe('the leave view', () => {
  it('shows what each person is due over the weeks they are actually here', () => {
    const line = bello();
    // S. Bello runs weeks 4–11 and 12–14: eleven distinct weeks of a 23-day allowance.
    expect(line.weeksOnEngagement).toBe(11);
    expect(line.annualLeaveDays).toBe(23);
    expect(line.entitlementDays).toBeCloseTo(23 * (11 / WEEKS_PER_YEAR), 6);
    expect(line.adjustmentDays).toBe(0);
  });

  it('carries exactly the entitlement when nothing is booked and nothing is adjusted', () => {
    const line = bello();
    expect(line.bookedDays).toBe(0);
    expect(line.plannedLeaveDays).toBeCloseTo(line.entitlementDays, 6);
    expect(line.varianceDays).toBeCloseTo(0, 6);
  });

  it('sets booked leave against the entitlement rather than adding to it', () => {
    const booked = leaveView(setPersonLeave(meridian, 'p-bello', 6, 2));
    const line = booked.lines.find((entry) => entry.personId === 'p-bello')!;
    expect(line.bookedDays).toBe(2);
    // Two days in the diary, the rest still provisioned — the total is unchanged.
    expect(line.plannedLeaveDays).toBeCloseTo(line.entitlementDays, 6);
    expect(line.varianceDays).toBeCloseTo(0, 6);
  });

  it('reports delivery days lost to leave, derived from a plan without it', () => {
    const line = bello();
    expect(line.daysLostToLeave).toBeGreaterThan(0);
    // Allocation is fractional, so days lost are a fraction of the leave carried.
    expect(line.daysLostToLeave).toBeLessThanOrEqual(line.plannedLeaveDays + 1e-9);
    expect(line.costSaved).toBeGreaterThan(0);
    expect(line.revenueForgone).toBeGreaterThan(line.costSaved);
  });

  it('leaves an unstaffed role its entitlement too, so naming somebody costs nothing new', () => {
    const view = leaveView(meridian);
    const gap = view.lines.find((line) => !line.staffed)!;
    expect(gap.name).toMatch(/^To be named/);
    expect(gap.entitlementDays).toBeGreaterThan(0);
    expect(gap.plannedLeaveDays).toBeCloseTo(gap.entitlementDays, 6);
  });

  it('totals the lines it shows', () => {
    const view = leaveView(meridian);
    const sum = view.lines.reduce((total, line) => total + line.daysLostToLeave, 0);
    expect(view.totals.daysLostToLeave).toBeCloseTo(sum, 6);
    expect(view.totals.deliveryDays).toBeCloseTo(computePlan(meridian).totalEffortDays, 6);
  });
});

describe('the adjustment lever', () => {
  it('adds days on top of the entitlement, and takes delivery days out of the plan', () => {
    const before = bello();
    const after = leaveView(setPersonLeaveAdjustment(meridian, 'p-bello', 5)).lines.find(
      (line) => line.personId === 'p-bello',
    )!;

    expect(after.adjustmentDays).toBe(5);
    expect(after.plannedLeaveDays).toBeCloseTo(before.plannedLeaveDays + 5, 6);
    expect(after.varianceDays).toBeCloseTo(5, 6);
    expect(after.deliveryDays).toBeLessThan(before.deliveryDays);
    expect(after.daysLostToLeave).toBeGreaterThan(before.daysLostToLeave);
  });

  it('gives days back when the adjustment is negative', () => {
    const before = bello();
    const after = leaveView(setPersonLeaveAdjustment(meridian, 'p-bello', -3)).lines.find(
      (line) => line.personId === 'p-bello',
    )!;
    expect(after.plannedLeaveDays).toBeCloseTo(before.plannedLeaveDays - 3, 6);
    expect(after.deliveryDays).toBeGreaterThan(before.deliveryDays);
  });

  it('cannot un-book leave already in the diary', () => {
    // Two days booked, then fifteen days taken off the entitlement. The provision floors
    // at zero; the booked fortnight stands, because it is a fact rather than a forecast.
    const booked = setPersonLeave(meridian, 'p-bello', 6, 2);
    const stripped = setPersonLeaveAdjustment(booked, 'p-bello', -15);
    const line = leaveView(stripped).lines.find((entry) => entry.personId === 'p-bello')!;
    expect(line.provisionDays).toBe(0);
    expect(line.bookedDays).toBe(2);
    expect(line.plannedLeaveDays).toBe(2);
  });

  it('touches only the person adjusted', () => {
    const after = leaveView(setPersonLeaveAdjustment(meridian, 'p-bello', 5));
    const before = leaveView(meridian);
    for (const line of after.lines) {
      if (line.personId === 'p-bello') continue;
      const was = before.lines.find((entry) => entry.holderId === line.holderId)!;
      expect(line.deliveryDays).toBeCloseTo(was.deliveryDays, 6);
    }
  });
});

describe('what the lever does to the commercials', () => {
  it('raises margin under a fixed price, because revenue does not follow', () => {
    const base = analyse(meridian).scenarios.find((s) => s.scenario.scenarioId === 'sc-fixed')!;
    const flexed = analyse(setPersonLeaveAdjustment(meridian, 'p-bello', 10)).scenarios.find(
      (s) => s.scenario.scenarioId === 'sc-fixed',
    )!;

    expect(flexed.metrics.revenue).toBe(base.metrics.revenue);
    expect(flexed.metrics.cost).toBeLessThan(base.metrics.cost);
    expect(flexed.metrics.grossMarginPct!).toBeGreaterThan(base.metrics.grossMarginPct!);
  });

  it('barely moves margin under T&M, because revenue falls with the days', () => {
    const base = analyse(meridian).scenarios.find((s) => s.scenario.scenarioId === 'sc-tm')!;
    const flexed = analyse(setPersonLeaveAdjustment(meridian, 'p-bello', 10)).scenarios.find(
      (s) => s.scenario.scenarioId === 'sc-tm',
    )!;

    expect(flexed.metrics.revenue).toBeLessThan(base.metrics.revenue);
    expect(flexed.metrics.cost).toBeLessThan(base.metrics.cost);
    // Revenue falls at the charge rate and cost at the cost rate, so the margin
    // *percentage* barely moves even though both totals do. This is the point: leave is
    // a lever under fixed price and almost none at all under time and materials.
    const move = Math.abs(flexed.metrics.grossMarginPct! - base.metrics.grossMarginPct!);
    expect(move).toBeLessThan(0.01);
  });

  it('states the delivery days the margin came out of', () => {
    const view = leaveView(setPersonLeaveAdjustment(meridian, 'p-bello', 10));
    const line = view.lines.find((entry) => entry.personId === 'p-bello')!;
    // The margin gain and the delivery risk are the same ten days seen from two sides.
    expect(line.daysLostToLeave).toBeGreaterThan(0);
    expect(line.costSaved).toBeGreaterThan(0);
  });
});

describe('leaveEntitlement', () => {
  it('pro-rates by weeks worked', () => {
    expect(leaveEntitlement(23, 52)).toBeCloseTo(23, 9);
    expect(leaveEntitlement(23, 26)).toBeCloseTo(11.5, 9);
    expect(leaveEntitlement(23, 0)).toBe(0);
    expect(leaveEntitlement(0, 26)).toBe(0);
  });
});

describe('marginEffectOfLeave', () => {
  it('is the cost avoided under a fixed price, and a loss under T&M', () => {
    const line = leaveView(meridian).lines.find((entry) => entry.personId === 'p-bello')!;
    expect(marginEffectOfLeave(line, false)).toBe(line.costSaved);
    expect(marginEffectOfLeave(line, false)).toBeGreaterThan(0);
    // A charge rate exceeds a cost rate, so an unbilled day costs more than it saves.
    expect(marginEffectOfLeave(line, true)).toBeLessThan(0);
  });
});
