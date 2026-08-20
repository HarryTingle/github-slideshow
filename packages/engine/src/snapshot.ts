import type { ComputedPlan } from './compute';
import { computePlan } from './compute';
import { analyse } from './metrics';
import { formatDays, formatMoney, formatPct } from './money';
import type { Engagement, Money, WeekIndex } from './types';

/**
 * Output snapshots — `specs/0006-output-snapshots.md`.
 *
 * A snapshot freezes the model at the moment an output left the building, so that an
 * issued pack stops changing when the model keeps moving. Two things are stored:
 *
 *  - the **complete engagement document**, which is what makes a snapshot re-openable
 *    and diffable;
 *  - the **headline figures as issued**, which is what makes it provable.
 *
 * Recomputing the frozen document must reproduce the stored figures. If it does not,
 * the calculation changed underneath an issued pack — a fact the app states rather
 * than papers over by showing today's answer. That check is `verifySnapshot`.
 *
 * There is no second implementation of any number here. A snapshot is a frozen
 * *input* plus an assertion that it still produces the same *output*.
 */

export type Audience = 'resourcing' | 'client' | 'slt';

export const AUDIENCE_LABELS: Record<Audience, string> = {
  resourcing: 'Resourcing',
  client: 'Client',
  slt: 'SLT sign-off',
};

/** How a figure is written down, and therefore the precision at which a move is visible. */
export type FigureFormat = 'money' | 'pct' | 'days' | 'weeks' | 'fte' | 'number';

/** The numbers an issued pack commits to. */
export interface SnapshotFigures {
  revenue: Money;
  cost: Money;
  grossMargin: Money;
  grossMarginPct: number | null;
  downsideMarginPct: number | null;
  discountVsStandardPct: number | null;
  breakEvenOverrunPct: number | null;
  maxCashExposure: Money;
  totalEffortDays: number;
  unstaffedEffortDays: number;
  weeks: number;
  peakHeadcount: number;
}

export interface Snapshot {
  id: string;
  /** Increments per engagement. Never reused, even after a snapshot is deleted. */
  version: number;
  audience: Audience;
  /** ISO timestamp. */
  issuedAt: string;
  issuedBy: string;
  note?: string;
  scenarioId: string;
  /** Denormalised so the list reads without loading the frozen document. */
  scenarioName: string;
  engagementName: string;
  client: string;
  /** The document exactly as it stood. */
  engagement: Engagement;
  /** What the pack said, at the moment it said it. */
  figures: SnapshotFigures;
}

const FIGURE_SPECS: {
  key: keyof SnapshotFigures;
  label: string;
  format: FigureFormat;
  higherIsBetter: boolean;
}[] = [
  { key: 'revenue', label: 'Revenue', format: 'money', higherIsBetter: true },
  { key: 'cost', label: 'Delivery cost', format: 'money', higherIsBetter: false },
  { key: 'grossMargin', label: 'Gross margin', format: 'money', higherIsBetter: true },
  { key: 'grossMarginPct', label: 'Gross margin %', format: 'pct', higherIsBetter: true },
  { key: 'downsideMarginPct', label: 'Downside margin', format: 'pct', higherIsBetter: true },
  { key: 'discountVsStandardPct', label: 'Discount vs standard', format: 'pct', higherIsBetter: false },
  { key: 'breakEvenOverrunPct', label: 'Break-even overrun', format: 'pct', higherIsBetter: true },
  { key: 'maxCashExposure', label: 'Peak cash exposure', format: 'money', higherIsBetter: false },
  { key: 'totalEffortDays', label: 'Effort', format: 'days', higherIsBetter: false },
  { key: 'unstaffedEffortDays', label: 'Unstaffed effort', format: 'days', higherIsBetter: false },
  { key: 'weeks', label: 'Duration', format: 'weeks', higherIsBetter: false },
  { key: 'peakHeadcount', label: 'Peak headcount', format: 'fte', higherIsBetter: false },
];

/**
 * Half of the smallest movement that is visible once written down.
 *
 * A figure that has not moved at the precision we print it has not, for the reader,
 * moved at all — and listing "+0.0pp" as a change is worse than saying nothing.
 */
function visibleAt(format: FigureFormat): number {
  switch (format) {
    case 'money':
      return 50; // printed to the pound
    case 'pct':
      return 0.0005; // printed to 0.1pp
    case 'days':
    case 'fte':
      return 0.05; // printed to 0.1
    default:
      return 0.5; // whole numbers
  }
}

/** The figures a scenario of this engagement would commit to right now. */
export function figuresOf(engagement: Engagement, scenarioId: string): SnapshotFigures {
  const analysis = analyse(engagement);
  const entry =
    analysis.scenarios.find((candidate) => candidate.scenario.scenarioId === scenarioId) ??
    analysis.scenarios[0];
  if (!entry) {
    throw new Error(`No scenario to snapshot on engagement ${engagement.id}`);
  }
  const { metrics, scenario } = entry;
  return {
    revenue: metrics.revenue,
    cost: metrics.cost,
    grossMargin: metrics.grossMargin,
    grossMarginPct: metrics.grossMarginPct,
    downsideMarginPct: scenario.downside.marginPct,
    discountVsStandardPct: metrics.discountVsStandardPct,
    breakEvenOverrunPct: metrics.breakEvenOverrunPct,
    maxCashExposure: metrics.maxCashExposure,
    totalEffortDays: metrics.totalEffortDays,
    unstaffedEffortDays: metrics.unstaffedEffortDays,
    weeks: engagement.weeks,
    peakHeadcount: metrics.peakHeadcount,
  };
}

export interface IssueRequest {
  scenarioId: string;
  audience: Audience;
  issuedBy: string;
  note?: string;
  /** ISO timestamp. Passed in rather than read from the clock, so this stays pure. */
  at: string;
  /** Everything issued for this engagement so far, so the version can increment. */
  existing?: Snapshot[];
}

/** Freeze the model. The returned snapshot shares no structure with `engagement`. */
export function takeSnapshot(engagement: Engagement, request: IssueRequest): Snapshot {
  const { scenarioId, audience, issuedBy, note, at, existing = [] } = request;
  const scenario =
    engagement.scenarios.find((candidate) => candidate.id === scenarioId) ?? engagement.scenarios[0];
  if (!scenario) throw new Error(`No scenario to snapshot on engagement ${engagement.id}`);

  const version =
    existing
      .filter((snapshot) => snapshot.engagement.id === engagement.id)
      .reduce((highest, snapshot) => Math.max(highest, snapshot.version), 0) + 1;

  // A deep copy, or an edit to the live model would reach into the issued pack. Plain
  // data throughout, so a JSON round trip is both sufficient and exact.
  const frozen = JSON.parse(JSON.stringify(engagement)) as Engagement;

  return {
    id: `${engagement.id}-v${version}`,
    version,
    audience,
    issuedAt: at,
    issuedBy,
    ...(note ? { note } : {}),
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    engagementName: engagement.name,
    client: engagement.client,
    engagement: frozen,
    figures: figuresOf(engagement, scenario.id),
  };
}

export type ChangeKind = 'moved' | 'appeared' | 'disappeared';

export interface FigureChange {
  key: keyof SnapshotFigures;
  label: string;
  format: FigureFormat;
  kind: ChangeKind;
  from: number | null;
  to: number | null;
  /** `to − from`, in the figure's own unit. Percentages stay ratios; render as points. */
  delta: number | null;
  higherIsBetter: boolean;
  /** True when the movement is in the direction we would want. Null when it is neither. */
  favourable: boolean | null;
}

export function formatFigure(value: number | null | undefined, format: FigureFormat): string {
  if (value == null) return '—';
  switch (format) {
    case 'money':
      return formatMoney(value);
    case 'pct':
      return formatPct(value);
    case 'days':
      return `${formatDays(value)} days`;
    case 'weeks':
      return `${value} weeks`;
    case 'fte':
      return `${value.toFixed(1)} FTE`;
    default:
      return String(value);
  }
}

/** A movement, written the way a reader expects it — margins in points, never in per cent. */
export function formatDelta(change: FigureChange): string {
  if (change.kind === 'appeared') return `now ${formatFigure(change.to, change.format)}`;
  if (change.kind === 'disappeared') return 'no longer applies';
  const delta = change.delta ?? 0;
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  const size = Math.abs(delta);
  switch (change.format) {
    case 'money':
      return `${sign}${formatMoney(size)}`;
    case 'pct':
      return `${sign}${(size * 100).toFixed(1)}pp`;
    case 'days':
      return `${sign}${formatDays(size)} days`;
    case 'weeks':
      return `${sign}${size} weeks`;
    case 'fte':
      return `${sign}${size.toFixed(1)} FTE`;
    default:
      return `${sign}${size}`;
  }
}

/**
 * Figures that moved, in reading order.
 *
 * A figure that is a number on one side and absent on the other has appeared or
 * disappeared — a T&M deal has no break-even overrun at all, and calling that a
 * movement from zero would be a fiction.
 */
export function diffFigures(from: SnapshotFigures, to: SnapshotFigures): FigureChange[] {
  const changes: FigureChange[] = [];
  for (const spec of FIGURE_SPECS) {
    const before = from[spec.key];
    const after = to[spec.key];
    if (before == null && after == null) continue;

    if (before == null || after == null) {
      changes.push({
        key: spec.key,
        label: spec.label,
        format: spec.format,
        kind: before == null ? 'appeared' : 'disappeared',
        from: before,
        to: after,
        delta: null,
        higherIsBetter: spec.higherIsBetter,
        favourable: null,
      });
      continue;
    }

    const delta = after - before;
    if (Math.abs(delta) < visibleAt(spec.format)) continue;
    changes.push({
      key: spec.key,
      label: spec.label,
      format: spec.format,
      kind: 'moved',
      from: before,
      to: after,
      delta,
      higherIsBetter: spec.higherIsBetter,
      favourable: delta > 0 === spec.higherIsBetter,
    });
  }
  return changes;
}

export type StructuralEntity =
  | 'engagement'
  | 'phase'
  | 'workstream'
  | 'person'
  | 'assignment'
  | 'milestone'
  | 'rate'
  | 'scenario'
  | 'guardrail';

export interface StructuralChange {
  entity: StructuralEntity;
  kind: 'added' | 'removed' | 'changed';
  /** What moved, named the way it is named in the plan. */
  label: string;
  /** How it moved, in a sentence fragment a reviewer can read aloud. */
  detail: string;
}

interface Named {
  id: string;
}

function byId<T extends Named>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function totalDays(leave: Record<WeekIndex, number> | undefined): number {
  return Object.values(leave ?? {}).reduce((sum, days) => sum + days, 0);
}

function daysByAssignment(plan: ComputedPlan): Map<string, number> {
  const days = new Map<string, number>();
  for (const line of plan.lines) {
    days.set(line.assignmentId, (days.get(line.assignmentId) ?? 0) + line.effortDays);
  }
  return days;
}

/** "week 4 to week 9" — the engine speaks in week indices, and so does the grid. */
function span(startWeek: WeekIndex, endWeek: WeekIndex): string {
  return `weeks ${startWeek}–${endWeek}`;
}

function structureLabel(engagement: Engagement, scenarioId: string): string {
  const scenario = engagement.scenarios.find((candidate) => candidate.id === scenarioId);
  return scenario?.structure.type ?? 'unknown';
}

/**
 * What changed between two versions of the model, described in the language of the plan.
 *
 * This is the half a reviewer actually needs. "Revenue is up £24,300" is a fact;
 * "Discovery now runs two weeks longer" is the reason, and the reason is what gets
 * argued about in the room.
 */
export function diffStructure(from: Engagement, to: Engagement): StructuralChange[] {
  const changes: StructuralChange[] = [];
  const add = (
    entity: StructuralEntity,
    kind: StructuralChange['kind'],
    label: string,
    detail: string,
  ) => changes.push({ entity, kind, label, detail });

  // Engagement-level facts.
  if (from.name !== to.name) add('engagement', 'changed', 'Engagement name', `“${from.name}” → “${to.name}”`);
  if (from.client !== to.client) add('engagement', 'changed', 'Client', `${from.client} → ${to.client}`);
  if (from.startDate !== to.startDate)
    add('engagement', 'changed', 'Start date', `${from.startDate} → ${to.startDate}`);
  if (from.weeks !== to.weeks)
    add('engagement', 'changed', 'Duration', `${from.weeks} weeks → ${to.weeks} weeks`);
  if ((from.annualLeaveDays ?? 0) !== (to.annualLeaveDays ?? 0))
    add(
      'engagement',
      'changed',
      'Annual leave allowance',
      `${from.annualLeaveDays ?? 0} days → ${to.annualLeaveDays ?? 0} days`,
    );
  if ((from.paymentTermsWeeks ?? 0) !== (to.paymentTermsWeeks ?? 0))
    add(
      'engagement',
      'changed',
      'Payment terms',
      `${from.paymentTermsWeeks ?? 0} weeks → ${to.paymentTermsWeeks ?? 0} weeks`,
    );
  if ((from.nonBillableCost ?? 0) !== (to.nonBillableCost ?? 0))
    add(
      'engagement',
      'changed',
      'Non-billable cost',
      `${formatMoney(from.nonBillableCost ?? 0)} → ${formatMoney(to.nonBillableCost ?? 0)}`,
    );

  // Phases.
  const fromPhases = byId(from.phases);
  const toPhases = byId(to.phases);
  for (const phase of to.phases) {
    const before = fromPhases.get(phase.id);
    if (!before) {
      add('phase', 'added', phase.name, `added, ${span(phase.startWeek, phase.endWeek)}`);
      continue;
    }
    if (before.name !== phase.name) add('phase', 'changed', phase.name, `renamed from “${before.name}”`);
    if (before.startWeek !== phase.startWeek || before.endWeek !== phase.endWeek)
      add(
        'phase',
        'changed',
        phase.name,
        `${span(before.startWeek, before.endWeek)} → ${span(phase.startWeek, phase.endWeek)}`,
      );
  }
  for (const phase of from.phases) {
    if (!toPhases.has(phase.id)) add('phase', 'removed', phase.name, 'removed from the plan');
  }

  // Workstreams.
  const fromWorkstreams = byId(from.workstreams);
  const toWorkstreams = byId(to.workstreams);
  for (const workstream of to.workstreams) {
    const before = fromWorkstreams.get(workstream.id);
    if (!before) {
      add(
        'workstream',
        'added',
        workstream.name,
        `added to ${toPhases.get(workstream.phaseId)?.name ?? 'the plan'}, ${span(workstream.startWeek, workstream.endWeek)}`,
      );
      continue;
    }
    if (before.name !== workstream.name)
      add('workstream', 'changed', workstream.name, `renamed from “${before.name}”`);
    if (before.phaseId !== workstream.phaseId)
      add(
        'workstream',
        'changed',
        workstream.name,
        `moved from ${fromPhases.get(before.phaseId)?.name ?? 'unknown'} to ${toPhases.get(workstream.phaseId)?.name ?? 'unknown'}`,
      );
    if (before.startWeek !== workstream.startWeek || before.endWeek !== workstream.endWeek)
      add(
        'workstream',
        'changed',
        workstream.name,
        `${span(before.startWeek, before.endWeek)} → ${span(workstream.startWeek, workstream.endWeek)}`,
      );
  }
  for (const workstream of from.workstreams) {
    if (!toWorkstreams.has(workstream.id))
      add('workstream', 'removed', workstream.name, 'removed from the plan');
  }

  // People.
  const fromGrades = byId(from.grades);
  const toGrades = byId(to.grades);
  const fromRoles = byId(from.roles);
  const toRoles = byId(to.roles);
  const fromPeople = byId(from.people);
  const toPeople = byId(to.people);
  for (const person of to.people) {
    const before = fromPeople.get(person.id);
    if (!before) {
      add(
        'person',
        'added',
        person.name,
        `joined the team as ${toGrades.get(person.gradeId)?.name ?? 'unknown grade'}`,
      );
      continue;
    }
    if (before.name !== person.name) add('person', 'changed', person.name, `renamed from “${before.name}”`);
    if (before.gradeId !== person.gradeId)
      add(
        'person',
        'changed',
        person.name,
        `${fromGrades.get(before.gradeId)?.name ?? 'unknown'} → ${toGrades.get(person.gradeId)?.name ?? 'unknown'}`,
      );
    if (before.roleId !== person.roleId)
      add(
        'person',
        'changed',
        person.name,
        `${fromRoles.get(before.roleId)?.name ?? 'unknown'} → ${toRoles.get(person.roleId)?.name ?? 'unknown'}`,
      );
    const leaveBefore = totalDays(before.leave);
    const leaveAfter = totalDays(person.leave);
    if (Math.abs(leaveBefore - leaveAfter) >= 0.05)
      add(
        'person',
        'changed',
        person.name,
        `booked leave ${formatDays(leaveBefore)} days → ${formatDays(leaveAfter)} days`,
      );
    if ((before.annualLeaveDays ?? null) !== (person.annualLeaveDays ?? null))
      add(
        'person',
        'changed',
        person.name,
        `leave allowance ${before.annualLeaveDays ?? 'engagement default'} → ${person.annualLeaveDays ?? 'engagement default'}`,
      );
  }
  for (const person of from.people) {
    if (!toPeople.has(person.id)) add('person', 'removed', person.name, 'left the team');
  }

  // Assignments — described by who, where, and how much.
  const fromDays = daysByAssignment(computePlan(from));
  const toDays = daysByAssignment(computePlan(to));
  const fromAssignments = byId(from.assignments);
  const toAssignments = byId(to.assignments);
  const who = (personId: string | undefined, people: Map<string, { name: string }>) =>
    personId ? (people.get(personId)?.name ?? 'Unknown') : 'To be named';
  for (const assignment of to.assignments) {
    const where = toWorkstreams.get(assignment.workstreamId)?.name ?? 'the plan';
    const label = `${who(assignment.personId, toPeople)} on ${where}`;
    const before = fromAssignments.get(assignment.id);
    if (!before) {
      add(
        'assignment',
        'added',
        label,
        `added, ${formatDays(toDays.get(assignment.id) ?? 0)} days at ${toGrades.get(assignment.gradeId)?.name ?? 'unknown grade'}`,
      );
      continue;
    }
    if (before.personId !== assignment.personId)
      add(
        'assignment',
        'changed',
        label,
        `${who(before.personId, fromPeople)} → ${who(assignment.personId, toPeople)}`,
      );
    if (before.gradeId !== assignment.gradeId)
      add(
        'assignment',
        'changed',
        label,
        `${fromGrades.get(before.gradeId)?.name ?? 'unknown'} → ${toGrades.get(assignment.gradeId)?.name ?? 'unknown'}`,
      );
    if (before.workstreamId !== assignment.workstreamId)
      add(
        'assignment',
        'changed',
        label,
        `moved from ${fromWorkstreams.get(before.workstreamId)?.name ?? 'unknown'}`,
      );
    const daysBefore = fromDays.get(assignment.id) ?? 0;
    const daysAfter = toDays.get(assignment.id) ?? 0;
    if (Math.abs(daysBefore - daysAfter) >= 0.05)
      add(
        'assignment',
        'changed',
        label,
        `${formatDays(daysBefore)} days → ${formatDays(daysAfter)} days`,
      );
  }
  for (const assignment of from.assignments) {
    if (toAssignments.has(assignment.id)) continue;
    const where = fromWorkstreams.get(assignment.workstreamId)?.name ?? 'the plan';
    add(
      'assignment',
      'removed',
      `${who(assignment.personId, fromPeople)} on ${where}`,
      `removed, ${formatDays(fromDays.get(assignment.id) ?? 0)} days out of the plan`,
    );
  }

  // Milestones.
  const fromMilestones = byId(from.milestones);
  const toMilestones = byId(to.milestones);
  for (const milestone of to.milestones) {
    const before = fromMilestones.get(milestone.id);
    if (!before) {
      add('milestone', 'added', milestone.name, `added at week ${milestone.week}`);
      continue;
    }
    if (before.name !== milestone.name)
      add('milestone', 'changed', milestone.name, `renamed from “${before.name}”`);
    if (before.week !== milestone.week)
      add('milestone', 'changed', milestone.name, `week ${before.week} → week ${milestone.week}`);
    if ((before.paymentValue ?? 0) !== (milestone.paymentValue ?? 0))
      add(
        'milestone',
        'changed',
        milestone.name,
        `payment ${formatMoney(before.paymentValue ?? 0)} → ${formatMoney(milestone.paymentValue ?? 0)}`,
      );
  }
  for (const milestone of from.milestones) {
    if (!toMilestones.has(milestone.id)) add('milestone', 'removed', milestone.name, 'removed from the plan');
  }

  // Rates — the practice's standard card, and what each scenario actually bills.
  for (const grade of to.grades) {
    const before = fromGrades.get(grade.id);
    if (!before) continue;
    if (before.chargeRate !== grade.chargeRate)
      add(
        'rate',
        'changed',
        `${grade.name} charge rate`,
        `${formatMoney(before.chargeRate)} → ${formatMoney(grade.chargeRate)}`,
      );
    if (before.costRate !== grade.costRate)
      add(
        'rate',
        'changed',
        `${grade.name} cost rate`,
        `${formatMoney(before.costRate)} → ${formatMoney(grade.costRate)}`,
      );
  }

  // Scenarios.
  const fromScenarios = byId(from.scenarios);
  const toScenarios = byId(to.scenarios);
  for (const scenario of to.scenarios) {
    const before = fromScenarios.get(scenario.id);
    if (!before) {
      add('scenario', 'added', scenario.name, `added as ${structureLabel(to, scenario.id)}`);
      continue;
    }
    if (before.name !== scenario.name)
      add('scenario', 'changed', scenario.name, `renamed from “${before.name}”`);
    if (before.structure.type !== scenario.structure.type)
      add('scenario', 'changed', scenario.name, `${before.structure.type} → ${scenario.structure.type}`);
    else if (JSON.stringify(before.structure) !== JSON.stringify(scenario.structure))
      add('scenario', 'changed', scenario.name, 'commercial terms changed');
    if (JSON.stringify(before.structureByPhase ?? {}) !== JSON.stringify(scenario.structureByPhase ?? {}))
      add('scenario', 'changed', scenario.name, 'per-phase structure changed');

    const beforeRates = before.rateOverrides ?? {};
    const afterRates = scenario.rateOverrides ?? {};
    for (const gradeId of new Set([...Object.keys(beforeRates), ...Object.keys(afterRates)])) {
      const rateBefore = beforeRates[gradeId];
      const rateAfter = afterRates[gradeId];
      if (rateBefore === rateAfter) continue;
      const gradeName = toGrades.get(gradeId)?.name ?? fromGrades.get(gradeId)?.name ?? gradeId;
      add(
        'rate',
        'changed',
        `${gradeName} on ${scenario.name}`,
        `${rateBefore == null ? 'standard' : formatMoney(rateBefore)} → ${rateAfter == null ? 'standard' : formatMoney(rateAfter)}`,
      );
    }
  }
  for (const scenario of from.scenarios) {
    if (!toScenarios.has(scenario.id)) add('scenario', 'removed', scenario.name, 'removed');
  }

  // Guardrails.
  const fromGuardrails = byId(from.guardrails);
  const toGuardrails = byId(to.guardrails);
  for (const guardrail of to.guardrails) {
    const before = fromGuardrails.get(guardrail.id);
    if (!before) {
      add('guardrail', 'added', guardrail.label, 'added');
      continue;
    }
    if (before.threshold !== guardrail.threshold)
      add(
        'guardrail',
        'changed',
        guardrail.label,
        guardrail.metric === 'maxCashExposure'
          ? `${formatMoney(before.threshold)} → ${formatMoney(guardrail.threshold)}`
          : `${formatPct(before.threshold, 0)} → ${formatPct(guardrail.threshold, 0)}`,
      );
    if (before.approver !== guardrail.approver)
      add('guardrail', 'changed', guardrail.label, `approver ${before.approver} → ${guardrail.approver}`);
  }
  for (const guardrail of from.guardrails) {
    if (!toGuardrails.has(guardrail.id)) add('guardrail', 'removed', guardrail.label, 'removed');
  }

  return changes;
}

export interface SnapshotDiff {
  snapshotId: string;
  version: number;
  unchanged: boolean;
  figures: FigureChange[];
  structural: StructuralChange[];
  /** One line for the list, so the state of a pack is readable without opening it. */
  headline: string;
}

/**
 * How an issued pack stands against the model as it is now.
 *
 * The scenario compared is the one the pack recommended. If that scenario has since
 * been deleted, the comparison falls back to the first — and the structural diff says
 * the scenario was removed, so the reader is not left guessing.
 */
export function diffSnapshot(snapshot: Snapshot, live: Engagement): SnapshotDiff {
  const scenarioId = live.scenarios.some((scenario) => scenario.id === snapshot.scenarioId)
    ? snapshot.scenarioId
    : (live.scenarios[0]?.id ?? snapshot.scenarioId);

  const figures = diffFigures(snapshot.figures, figuresOf(live, scenarioId));
  const structural = diffStructure(snapshot.engagement, live);
  const unchanged = figures.length === 0 && structural.length === 0;

  return {
    snapshotId: snapshot.id,
    version: snapshot.version,
    unchanged,
    figures,
    structural,
    headline: headlineFor(figures, structural),
  };
}

function headlineFor(figures: FigureChange[], structural: StructuralChange[]): string {
  if (figures.length === 0 && structural.length === 0) return 'Matches the live model';
  if (figures.length === 0) {
    return `${structural.length} change${structural.length === 1 ? '' : 's'} to the plan, no effect on the numbers`;
  }
  const leading = figures
    .slice(0, 2)
    .map((change) => `${change.label.toLowerCase()} ${formatDelta(change)}`)
    .join(', ');
  const rest = figures.length - 2 + structural.length;
  return rest > 0 ? `${leading}, and ${rest} other change${rest === 1 ? '' : 's'}` : leading;
}

export interface SnapshotVerification {
  agrees: boolean;
  differences: FigureChange[];
}

/**
 * Recompute the frozen document and check it still says what the pack said.
 *
 * A mismatch means the engine changed under an already-issued pack. That is a real
 * event with commercial consequences, and the honest response is to show it — not to
 * quietly replace the issued figure with today's.
 */
export function verifySnapshot(snapshot: Snapshot): SnapshotVerification {
  const recomputed = figuresOf(snapshot.engagement, snapshot.scenarioId);
  const differences = diffFigures(snapshot.figures, recomputed);
  return { agrees: differences.length === 0, differences };
}
