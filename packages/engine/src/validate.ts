import type { ComputedPlan } from './compute.js';
import type { Engagement } from './types.js';

/**
 * Validation rules — `context/domain-model.md` §9.
 *
 * Each of these is a real failure mode observed in bespoke spreadsheet models. The
 * engine's job is to make them visible rather than let them ride into a signed deal.
 */
export type Severity = 'error' | 'warning' | 'info';

export interface Finding {
  id: string;
  severity: Severity;
  message: string;
  /** Where in the app the user should go to fix it. */
  where?: { kind: 'assignment' | 'workstream' | 'milestone' | 'scenario' | 'grade'; id: string };
}

export function validate(engagement: Engagement, plan: ComputedPlan): Finding[] {
  const findings: Finding[] = [];
  const phases = new Map(engagement.phases.map((phase) => [phase.id, phase]));
  const workstreams = new Map(engagement.workstreams.map((ws) => [ws.id, ws]));
  const grades = new Map(engagement.grades.map((grade) => [grade.id, grade]));
  const people = new Map(engagement.people.map((person) => [person.id, person]));

  for (const workstream of engagement.workstreams) {
    const phase = phases.get(workstream.phaseId);
    if (phase && (workstream.startWeek < phase.startWeek || workstream.endWeek > phase.endWeek)) {
      findings.push({
        id: `ws-outside-phase-${workstream.id}`,
        severity: 'warning',
        message: `Workstream “${workstream.name}” runs outside its phase “${phase.name}”.`,
        where: { kind: 'workstream', id: workstream.id },
      });
    }
    const staffed = engagement.assignments.some((a) => a.workstreamId === workstream.id);
    if (!staffed) {
      findings.push({
        id: `ws-unstaffed-${workstream.id}`,
        severity: 'warning',
        message: `Workstream “${workstream.name}” is planned but has nobody on it.`,
        where: { kind: 'workstream', id: workstream.id },
      });
    }
  }

  for (const assignment of engagement.assignments) {
    const workstream = workstreams.get(assignment.workstreamId);
    if (!workstream) continue;
    if (assignment.startWeek < workstream.startWeek || assignment.endWeek > workstream.endWeek) {
      findings.push({
        id: `a-outside-ws-${assignment.id}`,
        severity: 'warning',
        message: `An assignment on “${workstream.name}” extends beyond the workstream's dates.`,
        where: { kind: 'assignment', id: assignment.id },
      });
    }
    const grade = grades.get(assignment.gradeId);
    if (!grade) {
      findings.push({
        id: `a-no-grade-${assignment.id}`,
        severity: 'error',
        message: 'An assignment uses a grade that does not exist.',
        where: { kind: 'assignment', id: assignment.id },
      });
    } else if (!grade.chargeRate) {
      findings.push({
        id: `grade-no-charge-${grade.id}`,
        severity: 'error',
        message: `Grade “${grade.name}” has no charge rate but is being used.`,
        where: { kind: 'grade', id: grade.id },
      });
    }
    if (!assignment.personId) {
      findings.push({
        id: `a-unstaffed-${assignment.id}`,
        severity: 'info',
        message: `${grade?.name ?? 'A role'} on “${workstream.name}” has no named person — a resourcing gap, not an error.`,
        where: { kind: 'assignment', id: assignment.id },
      });
    }
  }

  // A person over-allocated in any week, across the whole engagement.
  const byPersonWeek = new Map<string, Map<number, number>>();
  for (const assignment of engagement.assignments) {
    if (!assignment.personId) continue;
    const weeks = byPersonWeek.get(assignment.personId) ?? new Map<number, number>();
    for (let w = assignment.startWeek; w <= Math.min(assignment.endWeek, engagement.weeks); w++) {
      weeks.set(w, (weeks.get(w) ?? 0) + assignment.allocation);
    }
    byPersonWeek.set(assignment.personId, weeks);
  }
  for (const [personId, weeks] of byPersonWeek) {
    const over = [...weeks.entries()].filter(([, fte]) => fte > 1.0001);
    if (over.length > 0) {
      const person = people.get(personId);
      const worst = over.reduce((a, b) => (b[1] > a[1] ? b : a));
      findings.push({
        id: `person-over-${personId}`,
        severity: 'warning',
        message: `${person?.name ?? 'Someone'} is allocated ${worst[1].toFixed(2)} FTE in week ${worst[0]} — over capacity in ${over.length} week${over.length === 1 ? '' : 's'}.`,
      });
    }
  }

  for (const milestone of engagement.milestones) {
    if (milestone.week < 1 || milestone.week > engagement.weeks) {
      findings.push({
        id: `ms-outside-${milestone.id}`,
        severity: 'error',
        message: `Milestone “${milestone.name}” falls outside the plan's dates.`,
        where: { kind: 'milestone', id: milestone.id },
      });
    }
  }

  // Cost per phase, so a phase-level fixed price is checked against the cost of that
  // phase — not against the whole engagement, which would flag every hybrid deal.
  const costByPhase = new Map<string, number>();
  for (const line of plan.lines) {
    costByPhase.set(line.phaseId, (costByPhase.get(line.phaseId) ?? 0) + line.cost);
  }

  for (const scenario of engagement.scenarios) {
    const overrides = scenario.structureByPhase ?? {};
    const isHybrid = engagement.phases.some((phase) => overrides[phase.id]);
    const parts = isHybrid
      ? engagement.phases.map((phase) => ({
          key: phase.id,
          label: phase.name,
          structure: overrides[phase.id] ?? scenario.structure,
          cost: costByPhase.get(phase.id) ?? 0,
        }))
      : [{ key: 'all', label: '', structure: scenario.structure, cost: plan.directCost }];

    for (const part of parts) {
      const scope = part.label ? ` (${part.label})` : '';
      if (part.structure.type === 'milestone') {
        const total = part.structure.payments.reduce((sum, payment) => sum + payment.value, 0);
        if (total !== part.structure.contractValue) {
          findings.push({
            id: `ms-sum-${scenario.id}-${part.key}`,
            severity: 'error',
            message: `“${scenario.name}”${scope}: milestone payments do not sum to the contract value.`,
            where: { kind: 'scenario', id: scenario.id },
          });
        }
      }
      if (
        part.structure.type === 'fixedPrice' &&
        part.cost > 0 &&
        part.structure.contractValue < part.cost
      ) {
        findings.push({
          id: `fp-below-cost-${scenario.id}-${part.key}`,
          severity: 'error',
          message: `“${scenario.name}”${scope}: the fixed price is below the cost of delivery.`,
          where: { kind: 'scenario', id: scenario.id },
        });
      }
    }
  }

  if (plan.totalEffortDays === 0) {
    findings.push({
      id: 'no-effort',
      severity: 'warning',
      message: 'Nothing is staffed yet, so there is nothing to cost.',
    });
  }

  return findings;
}
