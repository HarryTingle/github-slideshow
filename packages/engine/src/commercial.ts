import type { ComputedPlan, EffortLine } from './compute';
import { applyPct, ratio, toMoney } from './money';
import type {
  CommercialStructure,
  Engagement,
  Milestone,
  Money,
  Scenario,
  WeekIndex,
} from './types';

/**
 * Commercial structures — `specs/0003-commercial-models-and-scenarios.md` and
 * `context/commercial-models.md` (the normative source for every formula here).
 *
 * The whole point of this module: the delivery plan is expensive to build, so
 * changing the commercial structure must be near-free. Nothing here mutates the plan.
 */

/** A slice of the plan — the whole engagement, or one phase of it. */
export interface PlanSlice {
  effortDays: number;
  directCost: Money;
  revenueAtRates: Money;
  /** Indexed 0..weeks-1. */
  costByWeek: Money[];
  revenueByWeek: Money[];
}

export function sliceOf(
  plan: ComputedPlan,
  weeks: number,
  filter?: (line: EffortLine) => boolean,
): PlanSlice {
  const costByWeek = new Array<Money>(weeks).fill(0);
  const revenueByWeek = new Array<Money>(weeks).fill(0);
  let effortDays = 0;
  let directCost = 0;
  let revenueAtRates = 0;

  for (const line of plan.lines) {
    if (filter && !filter(line)) continue;
    const i = line.week - 1;
    effortDays += line.effortDays;
    directCost += line.cost;
    revenueAtRates += line.revenueAtRates;
    if (i >= 0 && i < weeks) {
      costByWeek[i] = (costByWeek[i] ?? 0) + line.cost;
      revenueByWeek[i] = (revenueByWeek[i] ?? 0) + line.revenueAtRates;
    }
  }
  return { effortDays, directCost, revenueAtRates, costByWeek, revenueByWeek };
}

export interface CaseResult {
  label: string;
  revenue: Money;
  cost: Money;
  margin: Money;
  marginPct: number | null;
}

export interface StructureResult {
  label: string;
  /** Expected-case revenue. */
  revenue: Money;
  revenueByWeek: Money[];
  contingencyPct: number;
  costWithContingency: Money;
  downside: CaseResult;
  expected: CaseResult;
  /** null when the upside is genuinely unbounded — shown as such, never as a number. */
  upside: CaseResult | null;
  /** How much the plan can overrun before the deal loses money. null under T&M. */
  breakEvenOverrunPct: number | null;
  /** Room between planned revenue and the cap. Capped T&M only. */
  capHeadroomPct: number | null;
  notes: string[];
}

function caseOf(label: string, revenue: Money, cost: Money): CaseResult {
  const margin = revenue - cost;
  return { label, revenue, cost, margin, marginPct: ratio(margin, revenue) };
}

/** Spread a lump sum across weeks in proportion to where the effort actually lands. */
function spreadByEffort(total: Money, costByWeek: Money[]): Money[] {
  const totalCost = costByWeek.reduce((sum, value) => sum + value, 0);
  if (totalCost === 0) {
    const spread = new Array<Money>(costByWeek.length).fill(0);
    if (spread.length > 0) spread[spread.length - 1] = total;
    return spread;
  }
  const spread = costByWeek.map((cost) => toMoney((cost / totalCost) * total));
  // Put any rounding remainder on the last non-zero week so the spread sums to the total.
  const drift = total - spread.reduce((sum, value) => sum + value, 0);
  if (drift !== 0) {
    for (let i = spread.length - 1; i >= 0; i--) {
      if ((costByWeek[i] ?? 0) > 0) {
        spread[i] = (spread[i] ?? 0) + drift;
        break;
      }
    }
  }
  return spread;
}

export function computeStructure(
  slice: PlanSlice,
  structure: CommercialStructure,
  weeks: number,
  milestones: Milestone[] = [],
): StructureResult {
  const cost = slice.directCost;
  const notes: string[] = [];
  const empty = () => new Array<Money>(weeks).fill(0);

  switch (structure.type) {
    case 'tm': {
      const revenue = slice.revenueAtRates;
      return {
        label: 'Time & materials',
        revenue,
        revenueByWeek: slice.revenueByWeek.slice(0, weeks),
        contingencyPct: 0,
        costWithContingency: cost,
        downside: caseOf('At plan', revenue, cost),
        expected: caseOf('At plan', revenue, cost),
        upside: null,
        breakEvenOverrunPct: null,
        capHeadroomPct: null,
        notes: ['Revenue flexes with actual delivery. Overrun risk sits with the client.'],
      };
    }

    case 'cappedTm': {
      const planned = slice.revenueAtRates;
      const revenue = Math.min(planned, structure.cap);
      const headroom = ratio(structure.cap - planned, planned);
      if (structure.cap <= planned) {
        notes.push('The cap is at or below planned revenue — this behaves as a fixed price.');
      }
      // Bill T&M week by week until the cap binds.
      const revenueByWeek = empty();
      let running = 0;
      for (let i = 0; i < weeks; i++) {
        const billable = Math.min(slice.revenueByWeek[i] ?? 0, Math.max(0, structure.cap - running));
        revenueByWeek[i] = billable;
        running += billable;
      }
      return {
        label: 'Capped T&M',
        revenue,
        revenueByWeek,
        contingencyPct: 0,
        costWithContingency: cost,
        downside: caseOf('At cap', structure.cap, cost),
        expected: caseOf('At plan', revenue, cost),
        upside: null,
        breakEvenOverrunPct: ratio(structure.cap - cost, cost),
        capHeadroomPct: headroom,
        notes: [
          ...notes,
          'Asymmetric: we take the downside above the cap, the client takes the benefit below it.',
        ],
      };
    }

    case 'fixedPrice': {
      const revenue = structure.contractValue;
      const costWithContingency = cost + applyPct(cost, structure.contingencyPct);
      notes.push('Billed in proportion to delivered effort. Overrun risk sits with us.');
      return {
        label: 'Fixed price',
        revenue,
        revenueByWeek: spreadByEffort(revenue, slice.costByWeek),
        contingencyPct: structure.contingencyPct,
        costWithContingency,
        downside: caseOf('With contingency', revenue, costWithContingency),
        expected: caseOf('At plan', revenue, cost),
        upside: null,
        breakEvenOverrunPct: ratio(revenue - cost, cost),
        capHeadroomPct: null,
        notes,
      };
    }

    case 'milestone': {
      const revenue = structure.contractValue;
      const costWithContingency = cost + applyPct(cost, structure.contingencyPct);
      const revenueByWeek = empty();
      const byId = new Map(milestones.map((milestone) => [milestone.id, milestone]));
      let allocated = 0;
      for (const payment of structure.payments) {
        const milestone = byId.get(payment.milestoneId);
        if (!milestone) continue;
        const i = Math.min(weeks - 1, Math.max(0, milestone.week - 1));
        revenueByWeek[i] = (revenueByWeek[i] ?? 0) + payment.value;
        allocated += payment.value;
      }
      if (allocated !== revenue) {
        notes.push(
          `Milestone payments total ${allocated / 100} against a contract value of ${revenue / 100}. They must agree before sign-off.`,
        );
      }
      notes.push('Cashflow is lumpy — check maximum cash exposure, not only margin.');
      return {
        label: 'Milestone-based',
        revenue,
        revenueByWeek,
        contingencyPct: structure.contingencyPct,
        costWithContingency,
        downside: caseOf('With contingency', revenue, costWithContingency),
        expected: caseOf('At plan', revenue, cost),
        upside: null,
        breakEvenOverrunPct: ratio(revenue - cost, cost),
        capHeadroomPct: null,
        notes,
      };
    }

    case 'retainer': {
      const revenue = structure.monthlyValue * structure.months;
      const revenueByWeek = empty();
      const weeksPerMonth = weeks / Math.max(1, structure.months);
      for (let month = 0; month < structure.months; month++) {
        const i = Math.min(weeks - 1, Math.round((month + 1) * weeksPerMonth) - 1);
        revenueByWeek[i] = (revenueByWeek[i] ?? 0) + structure.monthlyValue;
      }
      return {
        label: 'Retainer / pod',
        revenue,
        revenueByWeek,
        contingencyPct: 0,
        costWithContingency: cost,
        downside: caseOf('At plan', revenue, cost),
        expected: caseOf('At plan', revenue, cost),
        upside: null,
        breakEvenOverrunPct: ratio(revenue - cost, cost),
        capHeadroomPct: null,
        notes: ['Utilisation risk: under-used capacity still costs us; over-demand creeps scope.'],
      };
    }

    case 'outcomeShare': {
      const costWithContingency = cost + applyPct(cost, structure.contingencyPct);
      const measured =
        structure.shape === 'gainShare'
          ? Math.max(0, structure.expectedBenefit - (structure.baseline ?? 0))
          : structure.expectedBenefit;
      const contingent = applyPct(measured, structure.sharePercent);
      const expectedRevenue = structure.cap
        ? Math.min(structure.cap, structure.baseFee + contingent)
        : structure.baseFee + contingent;

      const revenueByWeek = spreadByEffort(structure.baseFee, slice.costByWeek);
      // The contingent element is only measurable after delivery — bill it at the end.
      const last = weeks - 1;
      if (last >= 0) revenueByWeek[last] = (revenueByWeek[last] ?? 0) + (expectedRevenue - structure.baseFee);

      if (!structure.cap) {
        notes.push('Uncapped: the upside is unbounded and cannot be shown as a figure.');
      }
      notes.push(
        'The downside is base fee only. A downside below cost is a decision to take consciously, not one to discover later.',
      );

      return {
        label: 'Outcome share',
        revenue: expectedRevenue,
        revenueByWeek,
        contingencyPct: structure.contingencyPct,
        costWithContingency,
        downside: caseOf('Base fee only', structure.baseFee, costWithContingency),
        expected: caseOf('Expected benefit', expectedRevenue, costWithContingency),
        upside: structure.cap ? caseOf('At cap', structure.cap, costWithContingency) : null,
        // Calculated on the base fee: the contingent element cannot be relied on to
        // absorb an overrun.
        breakEvenOverrunPct: ratio(structure.baseFee - cost, cost),
        capHeadroomPct: null,
        notes,
      };
    }
  }
}

export interface ScenarioResult {
  scenarioId: string;
  name: string;
  /** One entry per phase when the deal is a hybrid, otherwise a single entry. */
  parts: { label: string; structure: StructureResult }[];
  revenue: Money;
  revenueByWeek: Money[];
  cost: Money;
  costWithContingency: Money;
  margin: Money;
  marginPct: number | null;
  downside: CaseResult;
  expected: CaseResult;
  upside: CaseResult | null;
  breakEvenOverrunPct: number | null;
  isHybrid: boolean;
  notes: string[];
}

/**
 * Evaluate one scenario over an unchanged plan.
 *
 * Hybrid deals — fixed-price discovery, T&M build, retained hypercare — are handled by
 * evaluating each phase against its own structure and summing. This is the normal case
 * in real deals, and the thing a single-sheet spreadsheet handles worst.
 */
export function computeScenario(
  engagement: Engagement,
  plan: ComputedPlan,
  scenario: Scenario,
): ScenarioResult {
  const weeks = engagement.weeks;
  // Engagement-level adjustments. Every case below is stated on the same basis as the
  // headline metrics — fully loaded cost against fully loaded revenue. Cases computed
  // on direct cost alone produce a downside margin *better* than the expected margin,
  // which is nonsense a reader will rightly refuse to believe.
  const overhead = (engagement.nonBillableCost ?? 0) + (engagement.expenses?.absorbed ?? 0);
  const rechargeable = engagement.expenses?.rechargeable ?? 0;
  const overrides = scenario.structureByPhase ?? {};
  const phaseIds = engagement.phases.map((phase) => phase.id);
  const isHybrid = phaseIds.some((id) => overrides[id]);

  const parts: { label: string; structure: StructureResult }[] = [];

  if (!isHybrid) {
    const slice = sliceOf(plan, weeks);
    parts.push({
      label: 'Whole engagement',
      structure: computeStructure(slice, scenario.structure, weeks, engagement.milestones),
    });
  } else {
    for (const phase of [...engagement.phases].sort((a, b) => a.order - b.order)) {
      const slice = sliceOf(plan, weeks, (line) => line.phaseId === phase.id);
      if (slice.effortDays === 0) continue;
      const structure = overrides[phase.id] ?? scenario.structure;
      const milestones = engagement.milestones.filter(
        (milestone) => milestone.week >= phase.startWeek && milestone.week <= phase.endWeek,
      );
      parts.push({
        label: phase.name,
        structure: computeStructure(slice, structure, weeks, milestones),
      });
    }
  }

  const sum = (pick: (result: StructureResult) => number) =>
    parts.reduce((total, part) => total + pick(part.structure), 0);

  const revenueByWeek = new Array<Money>(weeks).fill(0);
  for (const part of parts) {
    part.structure.revenueByWeek.forEach((value, i) => {
      revenueByWeek[i] = (revenueByWeek[i] ?? 0) + value;
    });
  }

  const revenue = sum((result) => result.revenue);
  const cost = plan.directCost + overhead;
  const costWithContingency = sum((result) => result.costWithContingency) + overhead;
  const margin = revenue + rechargeable - cost;

  const downsideRevenue = sum((result) => result.downside.revenue);
  const downsideCost = sum((result) => result.downside.cost) + overhead;
  const upsideParts = parts.filter((part) => part.structure.upside);
  const anyUncapped = parts.some(
    (part) => part.structure.notes.some((note) => note.startsWith('Uncapped')),
  );

  return {
    scenarioId: scenario.id,
    name: scenario.name,
    parts,
    revenue,
    revenueByWeek,
    cost,
    costWithContingency,
    margin,
    marginPct: ratio(margin, revenue + rechargeable),
    downside: caseOf('Downside', downsideRevenue + rechargeable, downsideCost),
    expected: caseOf('Expected', revenue + rechargeable, costWithContingency),
    upside:
      upsideParts.length > 0 && !anyUncapped
        ? caseOf(
            'Upside',
            sum((result) => result.upside?.revenue ?? result.revenue) + rechargeable,
            costWithContingency,
          )
        : null,
    // Under pure T&M the client carries the overrun, so there is no break-even to
    // report. Only structures that put the risk on us produce a figure here.
    breakEvenOverrunPct: parts.every((part) => part.structure.breakEvenOverrunPct == null)
      ? null
      : ratio(downsideRevenue + rechargeable - cost, cost),
    isHybrid,
    notes: parts.flatMap((part) =>
      part.structure.notes.map((note) => (parts.length > 1 ? `${part.label}: ${note}` : note)),
    ),
  };
}

/**
 * Cash lands after it is billed. Without a lag every structure looks cash-neutral,
 * which is never true — cost is incurred as payroll, weekly, whatever the contract says.
 */
function shiftForPaymentTerms(revenueByWeek: Money[], lagWeeks: number, horizon: number): Money[] {
  const shifted = new Array<Money>(horizon).fill(0);
  revenueByWeek.forEach((value, i) => {
    const landing = i + lagWeeks;
    if (landing < horizon) shifted[landing] = (shifted[landing] ?? 0) + value;
  });
  return shifted;
}

/**
 * Cash position week by week.
 *
 * The horizon runs past the end of delivery so that money billed at go-live is shown
 * arriving — otherwise a back-loaded deal looks permanently underwater.
 */
export function cashCurve(
  costByWeek: Money[],
  revenueByWeek: Money[],
  weeks: number,
  lagWeeks = 0,
): { week: WeekIndex; cost: Money; revenue: Money; position: Money }[] {
  const horizon = weeks + lagWeeks;
  const received = shiftForPaymentTerms(revenueByWeek, lagWeeks, horizon);
  const curve = [];
  let cumulativeCost = 0;
  let cumulativeRevenue = 0;
  for (let i = 0; i < horizon; i++) {
    cumulativeCost += costByWeek[i] ?? 0;
    cumulativeRevenue += received[i] ?? 0;
    curve.push({
      week: i + 1,
      cost: cumulativeCost,
      revenue: cumulativeRevenue,
      position: cumulativeRevenue - cumulativeCost,
    });
  }
  return curve;
}

/** The worst working-capital position across the engagement, not the closing one. */
export function maxCashExposure(
  costByWeek: Money[],
  revenueByWeek: Money[],
  weeks: number,
  lagWeeks = 0,
): Money {
  return cashCurve(costByWeek, revenueByWeek, weeks, lagWeeks).reduce(
    (worst, point) => Math.max(worst, -point.position),
    0,
  );
}
