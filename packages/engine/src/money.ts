import type { Money } from './types';

/**
 * Money handling.
 *
 * Every monetary value in the engine is an integer number of minor units (pence).
 * Rates are exact. Products of a rate and a fractional number of days are not, so
 * rounding has to happen somewhere — the question is only where, and whether it is
 * specified or accidental.
 *
 * ## Rounding policy
 *
 * Rounding happens **once per line**, where a line is a single (assignment × week)
 * atom, half-up. Totals are the sum of rounded lines.
 *
 * This is a deliberate change from the original wording of spec 0001, which called
 * for no intermediate rounding and a single rounding at presentation. That approach
 * produces a total that can differ by a penny or two from the sum of the lines a user
 * can actually see — and this product's core promise is that any figure can be
 * explained back to its inputs. A total that does not equal the visible detail is
 * indefensible in front of a client, which is a worse failure than a penny of drift.
 *
 * The line is the atom because it is the smallest thing a user can point at.
 * `sum(lines) === total` is asserted by test.
 */

/** Round half-up to an integer number of minor units. */
export function toMoney(value: number): Money {
  return Math.sign(value) * Math.round(Math.abs(value) + Number.EPSILON);
}

/** Multiply an exact rate by a fractional quantity, rounding the result to a Money line. */
export function multiplyRate(rate: Money, quantity: number): Money {
  return toMoney(rate * quantity);
}

/** Apply a percentage (0.15 = 15%) to a Money value. */
export function applyPct(value: Money, pct: number): Money {
  return toMoney(value * pct);
}

/** Pounds (or other major units) as a Money value. `pounds(950)` → 95000. */
export function pounds(major: number): Money {
  return toMoney(major * 100);
}

/**
 * Safe division for derived metrics. Returns null rather than NaN or Infinity, so a
 * model with zero effort or zero revenue shows "—" rather than a nonsense number.
 */
export function ratio(numerator: number, denominator: number): number | null {
  if (!denominator || !Number.isFinite(denominator)) return null;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}

export function formatMoney(
  value: Money | null | undefined,
  opts: { currency?: string; decimals?: boolean } = {},
): string {
  if (value == null) return '—';
  const { currency = 'GBP', decimals = false } = opts;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(value / 100);
}

export function formatPct(value: number | null | undefined, decimals = 1): string {
  if (value == null) return '—';
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatDays(value: number | null | undefined, decimals = 1): string {
  if (value == null) return '—';
  return value.toFixed(decimals);
}
