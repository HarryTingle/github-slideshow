import { billedRatesFor, capacityBasis, computePlan } from './compute';
import { allocationToDays } from './edit';
import { weekStartLabel } from './calendar';
import { pricingView } from './pricing';
import type { EngagementAnalysis } from './metrics';
import type { Engagement } from './types';

/**
 * The workbook.
 *
 * Pure data: rows, formulas and the values those formulas should produce. Turning it
 * into a file is the app's job; deciding what the numbers are is this layer's, which is
 * what makes the workbook testable without a spreadsheet in the loop.
 *
 * Excel is the incumbent, not the enemy — people will want the model in a workbook, and
 * some of them will want to check our arithmetic in it. So this exports **formulas, not
 * just values**, wherever a number is the product of two cells on the same sheet. A
 * workbook of frozen totals is a screenshot with extra steps; a workbook you can poke at
 * is the thing that earns trust.
 *
 * The Detail sheet is the spine: one row per assignment-week, carrying the availability,
 * the rates and the arithmetic. Every other sheet is a summary of it, and every summary
 * total is a SUM over cells the reader can see.
 */

/** Money is held in pence; a spreadsheet wants pounds. */
const gbp = (minor: number) => Math.round(minor) / 100;

type Cell = string | number | null;

/**
 * A formula and the value it should evaluate to.
 *
 * Both are written. Excel recalculates on open and will agree; anything that reads the
 * file without calculating still shows a number rather than a blank cell — and if the two
 * ever disagree, that is a bug in this app worth finding rather than hiding.
 */
interface Formula {
  formula: string;
  value: number;
}

interface Sheet {
  name: string;
  rows: Cell[][];
  /** Formulas by "R,C" (0-based, relative to the rows array). */
  formulas?: Record<string, Formula>;
  widths?: number[];
}

const A = (index: number): string => {
  let column = '';
  let n = index;
  while (n >= 0) {
    column = String.fromCharCode((n % 26) + 65) + column;
    n = Math.floor(n / 26) - 1;
  }
  return column;
};

/** Excel row number for a row in a sheet's `rows` array. */
const R = (row: number) => row + 1;

export interface WorkbookPlan {
  filename: string;
  sheets: Sheet[];
}

export function buildWorkbookPlan(
  engagement: Engagement,
  analysis: EngagementAnalysis,
  scenarioId: string,
): WorkbookPlan {
  const entry =
    analysis.scenarios.find((s) => s.scenario.scenarioId === scenarioId) ?? analysis.scenarios[0]!;
  const definition =
    engagement.scenarios.find((s) => s.id === entry.scenario.scenarioId) ?? engagement.scenarios[0]!;
  const billed = billedRatesFor(engagement, definition);
  const plan = computePlan(engagement, billed);
  const view = pricingView(engagement, definition, entry, plan);
  const basis = capacityBasis(engagement);

  const weeks = Array.from({ length: engagement.weeks }, (_, i) => i + 1);
  const grades = new Map(engagement.grades.map((g) => [g.id, g]));
  const roles = new Map(engagement.roles.map((r) => [r.id, r]));
  const people = new Map(engagement.people.map((p) => [p.id, p]));
  const workstreams = new Map(engagement.workstreams.map((w) => [w.id, w]));
  const phases = new Map(engagement.phases.map((p) => [p.id, p]));

  // ---- Detail: one row per assignment-week. Everything else sums this. ----
  const detailFormulas: Record<string, Formula> = {};
  const detailRows: Cell[][] = [
    ['Phase', 'Workstream', 'Person', 'Capability', 'Level', 'Week', 'Week starting',
     'Available days', 'Leave provision', 'Booked (days/wk)', 'Ramp', 'Effort days',
     'Cost rate', 'Cost', 'Charge rate', 'Revenue'],
  ];
  plan.lines.forEach((line, index) => {
    const row = index + 1;
    const workstream = workstreams.get(line.workstreamId);
    detailRows.push([
      phases.get(line.phaseId)?.name ?? '',
      workstream?.name ?? '',
      line.personId ? (people.get(line.personId)?.name ?? '') : 'To be named',
      roles.get(line.roleId)?.name ?? '',
      grades.get(line.gradeId)?.name ?? '',
      line.week,
      weekStartLabel(engagement.startDate, line.week),
      line.availableDays,
      Number(line.leaveProvision.toFixed(4)),
      Number(allocationToDays(line.allocation, engagement.calendar.workingDaysPerWeek).toFixed(3)),
      Number(line.rampFactor.toFixed(3)),
      null, // effort — formula
      gbp(line.costRate),
      null, // cost — formula
      gbp(line.chargeRate),
      null, // revenue — formula
    ]);
    // Effort = booked days ÷ working week × available × ramp. Written out so the reader
    // can see why a five-day booking in a holiday week delivers four.
    detailFormulas[`${row},11`] = {
      formula: `J${R(row)}/${engagement.calendar.workingDaysPerWeek}*H${R(row)}*K${R(row)}`,
      value: Number(line.effortDays.toFixed(6)),
    };
    detailFormulas[`${row},13`] = { formula: `ROUND(L${R(row)}*M${R(row)},2)`, value: gbp(line.cost) };
    detailFormulas[`${row},15`] = { formula: `ROUND(L${R(row)}*O${R(row)},2)`, value: gbp(line.revenueAtRates) };
  });
  const lastDetail = R(plan.lines.length);
  detailRows.push([
    'Total', '', '', '', '', '', '', null, null, null, null, null, '', null, '', null,
  ]);
  const totalRow = detailRows.length - 1;
  detailFormulas[`${totalRow},11`] = {
    formula: `SUM(L2:L${lastDetail})`,
    value: Number(plan.totalEffortDays.toFixed(6)),
  };
  detailFormulas[`${totalRow},13`] = { formula: `SUM(N2:N${lastDetail})`, value: gbp(plan.directCost) };
  detailFormulas[`${totalRow},15`] = { formula: `SUM(P2:P${lastDetail})`, value: gbp(plan.revenueAtRates) };

  // ---- Rates: a summary of Detail, not a restatement of it ----
  //
  // Revenue per grade is a SUMIF over the Detail sheet rather than days x rate. Those
  // two disagree: revenue is a sum of per-line figures each rounded to the penny, and
  // multiplying a rounded day count by a rate does not reproduce it. On the seeded plan
  // that gap is £6.74 on one grade — small, and exactly the sort of thing that turns
  // into "your model does not add up" when a client recalculates the file.
  const rateFormulas: Record<string, Formula> = {};
  const level = `Detail!$E$2:$E$${lastDetail}`;
  const rateRows: Cell[][] = [
    ['Level', 'Effort days', 'Billed rate', 'Standard rate', 'Cost rate', 'Revenue', 'Cost', 'Margin', 'Margin %'],
  ];
  view.grades.forEach((grade, index) => {
    const row = index + 1;
    rateRows.push([
      grade.name,
      null, // days — summed from Detail
      gbp(grade.billedRate),
      gbp(grade.standardRate),
      gbp(grade.costRate),
      null, null, null, null,
    ]);
    rateFormulas[`${row},1`] = {
      formula: `SUMIF(${level},A${R(row)},Detail!$L$2:$L$${lastDetail})`,
      value: Number(grade.days.toFixed(6)),
    };
    rateFormulas[`${row},5`] = {
      formula: `SUMIF(${level},A${R(row)},Detail!$P$2:$P$${lastDetail})`,
      value: gbp(grade.revenue),
    };
    rateFormulas[`${row},6`] = {
      formula: `SUMIF(${level},A${R(row)},Detail!$N$2:$N$${lastDetail})`,
      value: gbp(grade.cost),
    };
    rateFormulas[`${row},7`] = {
      formula: `F${R(row)}-G${R(row)}`,
      value: gbp(grade.revenue - grade.cost),
    };
    rateFormulas[`${row},8`] = {
      formula: `IF(F${R(row)}=0,"",H${R(row)}/F${R(row)})`,
      value: Number((grade.marginPct ?? 0).toFixed(6)),
    };
  });
  const lastRate = R(view.grades.length);
  rateRows.push(['Total', null, '', '', '', null, null, null, null]);
  const rateTotal = rateRows.length - 1;
  const gradeRevenue = view.grades.reduce((total, grade) => total + grade.revenue, 0);
  const gradeCost = view.grades.reduce((total, grade) => total + grade.cost, 0);
  const gradeDays = view.grades.reduce((total, grade) => total + grade.days, 0);
  rateFormulas[`${rateTotal},1`] = { formula: `SUM(B2:B${lastRate})`, value: Number(gradeDays.toFixed(6)) };
  rateFormulas[`${rateTotal},5`] = { formula: `SUM(F2:F${lastRate})`, value: gbp(gradeRevenue) };
  rateFormulas[`${rateTotal},6`] = { formula: `SUM(G2:G${lastRate})`, value: gbp(gradeCost) };
  rateFormulas[`${rateTotal},7`] = {
    formula: `F${R(rateTotal)}-G${R(rateTotal)}`,
    value: gbp(gradeRevenue - gradeCost),
  };
  rateFormulas[`${rateTotal},8`] = {
    formula: `IF(F${R(rateTotal)}=0,"",H${R(rateTotal)}/F${R(rateTotal)})`,
    value: gradeRevenue === 0 ? 0 : Number(((gradeRevenue - gradeCost) / gradeRevenue).toFixed(6)),
  };

  // ---- Allocation: the grid, in days a week ----
  const allocFormulas: Record<string, Formula> = {};
  const allocRows: Cell[][] = [
    ['Phase', 'Workstream', 'Person', 'Level', ...weeks.map((w) => `W${w}`), 'Total days'],
  ];
  const orderedAssignments = [...engagement.phases]
    .sort((a, b) => a.order - b.order)
    .flatMap((phase) =>
      engagement.workstreams
        .filter((ws) => ws.phaseId === phase.id)
        .flatMap((ws) => engagement.assignments.filter((a) => a.workstreamId === ws.id)),
    );
  orderedAssignments.forEach((assignment, index) => {
    const row = index + 1;
    const workstream = workstreams.get(assignment.workstreamId);
    const booked = weeks.map((week) => {
      if (week < assignment.startWeek || week > assignment.endWeek) return 0;
      const allocation = assignment.allocationByWeek?.[week] ?? assignment.allocation;
      return Number(allocationToDays(allocation, engagement.calendar.workingDaysPerWeek).toFixed(2));
    });
    const cells: Cell[] = weeks.map((week, i) =>
      week < assignment.startWeek || week > assignment.endWeek ? null : booked[i]!,
    );
    allocRows.push([
      phases.get(workstream?.phaseId ?? '')?.name ?? '',
      workstream?.name ?? '',
      assignment.personId ? (people.get(assignment.personId)?.name ?? '') : 'To be named',
      grades.get(assignment.gradeId)?.name ?? '',
      ...cells,
      null,
    ]);
    allocFormulas[`${row},${4 + weeks.length}`] = {
      // Days *booked*, which is what the cells hold. Effort delivered is on Detail, and
      // is lower wherever a week carries a holiday or leave.
      formula: `SUM(E${R(row)}:${A(3 + weeks.length)}${R(row)})`,
      value: Number(booked.reduce((total, cell) => total + cell, 0).toFixed(2)),
    };
  });

  // ---- Resourcing ----
  const resourcingRows: Cell[][] = [
    ['Person', 'Capability', 'Level', 'Workstream', 'From', 'To', 'Days a week', 'Effort days'],
  ];
  for (const assignment of orderedAssignments) {
    const days = plan.lines
      .filter((line) => line.assignmentId === assignment.id)
      .reduce((total, line) => total + line.effortDays, 0);
    resourcingRows.push([
      assignment.personId ? (people.get(assignment.personId)?.name ?? '') : 'To be named',
      roles.get(assignment.roleId)?.name ?? '',
      grades.get(assignment.gradeId)?.name ?? '',
      workstreams.get(assignment.workstreamId)?.name ?? '',
      weekStartLabel(engagement.startDate, assignment.startWeek),
      weekStartLabel(engagement.startDate, assignment.endWeek),
      Number(allocationToDays(assignment.allocation, engagement.calendar.workingDaysPerWeek).toFixed(2)),
      Number(days.toFixed(2)),
    ]);
  }

  // ---- Scenarios ----
  const scenarioRows: Cell[][] = [
    ['Scenario', 'Structure', 'Revenue', 'Cost', 'Gross margin', 'Gross margin %',
     'Effective day rate', 'Discount vs standard', 'Max cash exposure', 'Downside margin %', 'Guardrails'],
  ];
  for (const option of analysis.scenarios) {
    const breaches = option.guardrails.filter((g) => g.breached);
    scenarioRows.push([
      option.scenario.name,
      option.scenario.isHybrid ? 'Hybrid' : (option.scenario.parts[0]?.structure.label ?? ''),
      gbp(option.metrics.revenue),
      gbp(option.metrics.cost),
      gbp(option.metrics.grossMargin),
      option.metrics.grossMarginPct ?? 0,
      option.metrics.effectiveRate == null ? null : gbp(option.metrics.effectiveRate),
      option.metrics.discountVsStandardPct ?? 0,
      gbp(option.metrics.maxCashExposure),
      option.scenario.downside.marginPct ?? 0,
      breaches.length === 0 ? 'Pass' : breaches.map((b) => b.guardrail.label).join('; '),
    ]);
  }

  // ---- Summary ----
  const summaryRows: Cell[][] = [
    ['Engagement', engagement.name],
    ['Client', engagement.client],
    ['Starts', weekStartLabel(engagement.startDate, 1)],
    ['Weeks', engagement.weeks],
    ['Scenario', entry.scenario.name],
    [],
    ['Effort days', Number(entry.metrics.totalEffortDays.toFixed(2))],
    ['Revenue', gbp(entry.metrics.revenue)],
    ['Cost of delivery', gbp(entry.metrics.cost)],
    ['Gross margin', gbp(entry.metrics.grossMargin)],
    ['Gross margin %', entry.metrics.grossMarginPct ?? 0],
    ['Effective day rate', entry.metrics.effectiveRate == null ? null : gbp(entry.metrics.effectiveRate)],
    ['Discount vs standard', entry.metrics.discountVsStandardPct ?? 0],
    ['Max cash exposure', gbp(entry.metrics.maxCashExposure)],
    ['Peak demand (FTE)', Number(analysis.plan.peakHeadcount.toFixed(2))],
    ['Unstaffed effort days', Number(analysis.plan.unstaffedEffortDays.toFixed(2))],
    [],
    ['Capacity basis'],
    ['Working days per week', engagement.calendar.workingDaysPerWeek],
    ['Public holidays over the plan', Number(basis.publicHolidayDays.toFixed(1))],
    ['Annual leave allowance (days/year)', engagement.annualLeaveDays ?? 0],
    ['Leave over the plan', Number(basis.annualLeaveDays.toFixed(1))],
    ['Available days per full-time person', Number(basis.availableDays.toFixed(1))],
    ['Annualised, before leave', Number(basis.annualisedBeforeLeave.toFixed(0))],
    ['Annualised, after leave', Number(basis.annualisedAvailableDays.toFixed(0))],
    [],
    ['Effort days (from Detail)', null],
    ['Revenue (from Detail)', null],
    ['Cost (from Detail)', null],
    [],
    ['Grade and capability names, and both rate cards, are the practice’s own.'],
    ['This engagement is fictional — no figure in it may be quoted.'],
  ];
  const summaryFormulas: Record<string, Formula> = {};
  const crossCheck = summaryRows.findIndex((row) => row[0] === 'Effort days (from Detail)');
  summaryFormulas[`${crossCheck},1`] = {
    formula: `Detail!L${R(totalRow)}`,
    value: Number(plan.totalEffortDays.toFixed(6)),
  };
  summaryFormulas[`${crossCheck + 1},1`] = {
    formula: `Detail!P${R(totalRow)}`,
    value: gbp(plan.revenueAtRates),
  };
  summaryFormulas[`${crossCheck + 2},1`] = {
    formula: `Detail!N${R(totalRow)}`,
    value: gbp(plan.directCost),
  };

  return {
    filename: `${engagement.client} — ${engagement.name} — ${entry.scenario.name}.xlsx`
      .replace(/[\\/:*?"<>|]/g, '-'),
    sheets: [
      { name: 'Summary', rows: summaryRows, formulas: summaryFormulas, widths: [38, 26] },
      { name: 'Scenarios', rows: scenarioRows, widths: [30, 22, 14, 14, 14, 14, 16, 18, 18, 16, 26] },
      { name: 'Rates', rows: rateRows, formulas: rateFormulas, widths: [22, 12, 12, 14, 12, 14, 14, 14, 11] },
      { name: 'Allocation', rows: allocRows, formulas: allocFormulas, widths: [18, 22, 20, 20, ...weeks.map(() => 7), 12] },
      { name: 'Resourcing', rows: resourcingRows, widths: [18, 28, 20, 22, 12, 12, 13, 12] },
      { name: 'Detail', rows: detailRows, formulas: detailFormulas, widths: [18, 22, 18, 28, 20, 7, 14, 14, 14, 16, 8, 12, 11, 12, 12, 12] },
    ],
  };
}

/** A one-line summary of what the workbook contains, for the export control. */
export function describeWorkbook(plan: WorkbookPlan): string {
  return plan.sheets.map((sheet) => `${sheet.name} (${sheet.rows.length - 1} rows)`).join(' · ');
}
