'use client';

import { formatDays, formatMoney, formatPct, weekStartLabel } from '@scope/engine';
import { useState } from 'react';
import { CumulativeChart, RankBars } from '@/components/charts';
import { GuardrailRow, MarginTone } from '@/components/bits';
import { useModel, useSelectedScenario } from '@/lib/store';

type View = 'resourcing' | 'client' | 'slt';

const VIEWS: { id: View; label: string }[] = [
  { id: 'resourcing', label: 'Resourcing' },
  { id: 'client', label: 'Client' },
  { id: 'slt', label: 'SLT sign-off' },
];

export default function OutputsPage() {
  const [view, setView] = useState<View>('resourcing');
  const { stressed, analysis } = useModel();
  const selected = useSelectedScenario();

  return (
    <>
      <div className="row gap-16 wrap" style={{ marginBottom: 18 }}>
        <div className="segmented">
          {VIEWS.map((entry) => (
            <button key={entry.id} aria-pressed={view === entry.id} onClick={() => setView(entry.id)}>
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'resourcing' && <ResourcingView />}
      {view === 'client' && <ClientView />}
      {view === 'slt' && <SltView />}

      <p className="tiny muted mt-24" style={{ marginTop: 24 }}>
        {stressed.name} · {analysis.plan.totalEffortDays.toFixed(1)} effort days · “
        {selected.scenario.name}”
      </p>
    </>
  );
}

function ResourcingView() {
  const { stressed, analysis } = useModel();
  const roles = new Map(stressed.roles.map((role) => [role.id, role]));
  const grades = new Map(stressed.grades.map((grade) => [grade.id, grade]));
  const people = new Map(stressed.people.map((person) => [person.id, person]));
  const workstreams = new Map(stressed.workstreams.map((ws) => [ws.id, ws]));

  const rows = stressed.assignments.map((assignment) => {
    const days = analysis.plan.lines
      .filter((line) => line.assignmentId === assignment.id)
      .reduce((total, line) => total + line.effortDays, 0);
    return { assignment, days };
  });

  const gaps = rows.filter((row) => !row.assignment.personId);

  return (
    <div className="grid cols-1" style={{ gap: 18 }}>
      {gaps.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h3>Gaps to fill</h3>
            <span className="card-note">
              {formatDays(analysis.plan.unstaffedEffortDays)} days across {gaps.length} roles
            </span>
          </div>
          <div className="card-body flush">
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Grade</th>
                  <th>Workstream</th>
                  <th className="num">Weeks</th>
                  <th className="num">FTE</th>
                  <th className="num">Effort</th>
                </tr>
              </thead>
              <tbody>
                {gaps.map(({ assignment, days }) => (
                  <tr key={assignment.id}>
                    <td style={{ color: 'var(--terracotta-700)' }}>{roles.get(assignment.roleId)?.name}</td>
                    <td>{grades.get(assignment.gradeId)?.name}</td>
                    <td className="muted">{workstreams.get(assignment.workstreamId)?.name}</td>
                    <td className="num">
                      {assignment.startWeek}–{assignment.endWeek}
                    </td>
                    <td className="num">{assignment.allocation.toFixed(2)}</td>
                    <td className="num">{formatDays(days)} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h3>Full resource requirement</h3>
          <span className="card-note">
            Peak {analysis.plan.peakHeadcount.toFixed(1)} FTE in week {analysis.plan.peakWeek}
          </span>
        </div>
        <div className="card-body flush">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Role</th>
                  <th>Grade</th>
                  <th>Workstream</th>
                  <th className="num">From</th>
                  <th className="num">To</th>
                  <th className="num">FTE</th>
                  <th className="num">Effort days</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ assignment, days }) => (
                  <tr key={assignment.id}>
                    <td>
                      {assignment.personId ? (
                        people.get(assignment.personId)?.name
                      ) : (
                        <span style={{ color: 'var(--terracotta-700)' }}>To be named</span>
                      )}
                    </td>
                    <td>{roles.get(assignment.roleId)?.name}</td>
                    <td className="muted">{grades.get(assignment.gradeId)?.name}</td>
                    <td className="muted">{workstreams.get(assignment.workstreamId)?.name}</td>
                    <td className="num">{weekStartLabel(stressed.startDate, assignment.startWeek)}</td>
                    <td className="num">{weekStartLabel(stressed.startDate, assignment.endWeek)}</td>
                    <td className="num">{assignment.allocation.toFixed(2)}</td>
                    <td className="num">{formatDays(days)}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td colSpan={7}>Total</td>
                  <td className="num">{formatDays(analysis.plan.totalEffortDays)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The client view.
 *
 * This component never reads cost, margin, rate or scenario-comparison data — the
 * omission is structural rather than a matter of styling something out of sight.
 */
function ClientView() {
  const { stressed, analysis } = useModel();
  const selected = useSelectedScenario();
  const phases = [...stressed.phases].sort((a, b) => a.order - b.order);
  const grades = new Map(stressed.grades.map((grade) => [grade.id, grade]));

  const capability = [...analysis.gradeMix.entries()]
    .map(([gradeId, fraction]) => ({
      id: gradeId,
      label: seniorityBand(grades.get(gradeId)?.order ?? 1),
      value: analysis.plan.effortByGrade.get(gradeId) ?? 0,
      fraction,
    }))
    .sort((a, b) => b.fraction - a.fraction);

  return (
    <div className="card">
      <div className="card-body" style={{ padding: '34px 40px 40px' }}>
        <div className="eyebrow tiny muted" style={{ letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Prepared for {stressed.client}
        </div>
        <h2 style={{ fontSize: 26, margin: '8px 0 6px' }}>{stressed.name}</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          A {stressed.weeks}-week engagement beginning {weekStartLabel(stressed.startDate, 1)},
          delivered across {stressed.workstreams.length} workstreams.
        </p>

        <div className="sep" />

        <h3 style={{ marginBottom: 10 }}>Our approach</h3>
        <table>
          <thead>
            <tr>
              <th>Phase</th>
              <th>Weeks</th>
              <th>What we do</th>
            </tr>
          </thead>
          <tbody>
            {phases.map((phase) => (
              <tr key={phase.id}>
                <td style={{ fontWeight: 500, color: 'var(--ink-900)' }}>{phase.name}</td>
                <td className="muted">
                  {weekStartLabel(stressed.startDate, phase.startWeek)} –{' '}
                  {weekStartLabel(stressed.startDate, phase.endWeek)}
                </td>
                <td className="muted">
                  {stressed.workstreams
                    .filter((ws) => ws.phaseId === phase.id)
                    .map((ws) => ws.name)
                    .join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="sep" />

        <h3 style={{ marginBottom: 10 }}>Key dates</h3>
        <div className="row gap-24 wrap">
          {stressed.milestones.map((milestone) => (
            <div key={milestone.id}>
              <div className="small" style={{ color: 'var(--ink-900)', fontWeight: 500 }}>
                {milestone.name}
              </div>
              <div className="tiny muted">{weekStartLabel(stressed.startDate, milestone.week)}</div>
            </div>
          ))}
        </div>

        <div className="sep" />

        <h3 style={{ marginBottom: 12 }}>The team</h3>
        <RankBars rows={capability} formatValue={(value) => `${formatDays(value)} days`} />

        <div className="sep" />

        <h3 style={{ marginBottom: 10 }}>Commercials</h3>
        <p className="small" style={{ marginTop: 0 }}>
          {commercialSummary(selected.scenario.parts[0]?.structure.label ?? '', selected.scenario.isHybrid)}
        </p>
        <div className="row gap-24 wrap mt-8">
          <div>
            <div className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '0.09em' }}>
              Total investment
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink-900)' }}>
              {formatMoney(selected.scenario.revenue)}
            </div>
          </div>
          <div>
            <div className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '0.09em' }}>
              Structure
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink-900)' }}>
              {selected.scenario.isHybrid ? 'Phased' : selected.scenario.parts[0]?.structure.label}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Internal grades collapsed into bands a client can read.
 *
 * The client is buying capability and seniority, not our ladder — and our ladder is
 * exactly the sort of internal detail the client view exists not to expose.
 */
function seniorityBand(order: number): string {
  if (order >= 7) return 'Director-level oversight';
  if (order >= 5) return 'Engagement leadership';
  if (order >= 4) return 'Senior practitioners';
  if (order >= 3) return 'Practitioners';
  return 'Associates';
}

function commercialSummary(label: string, hybrid: boolean): string {
  if (hybrid) return 'Priced by phase: fixed where the scope is defined, time and materials where it is still being shaped.';
  switch (label) {
    case 'Fixed price':
      return 'A single fixed price for the scope described above. We carry the delivery risk.';
    case 'Outcome share':
      return 'A reduced base fee, with the balance tied to the benefit the work actually delivers.';
    case 'Capped T&M':
      return 'Billed for time actually delivered, with a ceiling you will not be billed beyond.';
    case 'Retainer / pod':
      return 'A standing team, available to you for the term, at a fixed monthly cost.';
    default:
      return 'Billed for time actually delivered, at the agreed rates.';
  }
}

function SltView() {
  const { stressed, analysis } = useModel();
  const selected = useSelectedScenario();
  const recommended = selected.scenario.scenarioId;

  const cumulativeCost: number[] = [];
  const cumulativeRevenue: number[] = [];
  let cost = 0;
  let revenue = 0;
  for (let i = 0; i < stressed.weeks; i++) {
    cost += analysis.plan.costByWeek.get(i + 1) ?? 0;
    revenue += selected.scenario.revenueByWeek[i] ?? 0;
    cumulativeCost.push(cost);
    cumulativeRevenue.push(revenue);
  }

  const breaches = selected.guardrails.filter((status) => status.breached);

  return (
    <div className="stack gap-16">
      <div className="card">
        <div className="card-head">
          <h3>Recommendation</h3>
          <span className="card-note">{stressed.client}</span>
        </div>
        <div className="card-body">
          <p style={{ marginTop: 0 }}>
            We recommend <strong>{selected.scenario.name}</strong> at{' '}
            {formatMoney(selected.metrics.revenue)}, a gross margin of{' '}
            {formatPct(selected.metrics.grossMarginPct)} against a delivery cost of{' '}
            {formatMoney(selected.metrics.cost)}.
            {breaches.length > 0 ? (
              <>
                {' '}
                This scenario <strong>breaches {breaches.length} guardrail</strong>
                {breaches.length === 1 ? '' : 's'} and requires explicit approval.
              </>
            ) : (
              ' It sits within every commercial guardrail.'
            )}
          </p>
          <div className="mt-8">
            {selected.guardrails.map((status) => (
              <GuardrailRow key={status.guardrail.id} status={status} />
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>All scenarios considered</h3>
          <span className="card-note">Including the ones not recommended</span>
        </div>
        <div className="card-body flush">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th>Structure</th>
                  <th className="num">Revenue</th>
                  <th className="num">Margin</th>
                  <th className="num">Downside</th>
                  <th className="num">Cash exposure</th>
                  <th className="num">Break-even overrun</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {analysis.scenarios.map((entry) => {
                  const entryBreaches = entry.guardrails.filter((status) => status.breached);
                  const tone = MarginTone(entry.metrics.grossMarginPct);
                  return (
                    <tr key={entry.scenario.scenarioId}>
                      <td style={{ fontWeight: entry.scenario.scenarioId === recommended ? 600 : 400 }}>
                        {entry.scenario.name}
                        {entry.scenario.scenarioId === recommended && (
                          <span className="badge neutral" style={{ marginLeft: 8 }}>
                            Recommended
                          </span>
                        )}
                      </td>
                      <td className="muted">
                        {entry.scenario.isHybrid ? 'Hybrid' : entry.scenario.parts[0]?.structure.label}
                      </td>
                      <td className="num">{formatMoney(entry.metrics.revenue)}</td>
                      <td
                        className="num"
                        style={{
                          color: tone === 'breach' ? 'var(--status-breach)' : tone === 'warn' ? 'var(--status-warn)' : undefined,
                        }}
                      >
                        {formatPct(entry.metrics.grossMarginPct)}
                      </td>
                      <td className="num">{formatPct(entry.scenario.downside.marginPct)}</td>
                      <td className="num">{formatMoney(entry.metrics.maxCashExposure)}</td>
                      <td className="num">
                        {entry.metrics.breakEvenOverrunPct == null
                          ? 'n/a'
                          : formatPct(entry.metrics.breakEvenOverrunPct, 0)}
                      </td>
                      <td>
                        {entryBreaches.length === 0 ? (
                          <span className="badge good">
                            <span className="dot" />
                            Within guardrails
                          </span>
                        ) : (
                          <span className="badge breach">
                            <span className="dot" />
                            {entryBreaches[0]?.guardrail.label}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-head">
            <h3>Cost and revenue</h3>
            <span className="card-note">{selected.scenario.name}</span>
          </div>
          <div className="card-body">
            <CumulativeChart
              weeks={stressed.weeks}
              series={[
                { id: 'r', label: 'Revenue billed', colour: 'var(--series-1)', values: cumulativeRevenue },
                { id: 'c', label: 'Cost incurred', colour: 'var(--series-3)', values: cumulativeCost },
              ]}
            />
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <h3>Risk</h3>
            <span className="card-note">What we are carrying</span>
          </div>
          <div className="card-body">
            <table>
              <tbody>
                <tr>
                  <td>Contingency held</td>
                  <td className="num">
                    {formatMoney(selected.scenario.costWithContingency - selected.scenario.cost)}
                  </td>
                </tr>
                <tr>
                  <td>Overrun we can absorb</td>
                  <td className="num">
                    {selected.metrics.breakEvenOverrunPct == null
                      ? 'n/a — client carries overrun'
                      : formatPct(selected.metrics.breakEvenOverrunPct, 0)}
                  </td>
                </tr>
                <tr>
                  <td>Worst cash position</td>
                  <td className="num">{formatMoney(selected.metrics.maxCashExposure)} out of pocket</td>
                </tr>
                <tr>
                  <td>Unstaffed effort at sign-off</td>
                  <td className="num">{formatDays(analysis.plan.unstaffedEffortDays)} days</td>
                </tr>
              </tbody>
            </table>
            {selected.scenario.notes.length > 0 && (
              <ul className="small muted" style={{ marginTop: 14, paddingLeft: 18 }}>
                {selected.scenario.notes.map((note) => (
                  <li key={note} style={{ marginBottom: 4 }}>
                    {note}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
