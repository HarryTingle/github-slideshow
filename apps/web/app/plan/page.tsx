'use client';

import { formatDays, formatMoney, sprintNumber, weekStartLabel } from '@scope/engine';
import { AllocationGrid } from '@/components/AllocationGrid';
import { EngagementHeader } from '@/components/EngagementHeader';
import { Findings, Stat } from '@/components/bits';
import { Timeline } from '@/components/Timeline';
import { useModel } from '@/lib/store';

export default function PlanPage() {
  const { stressed, analysis, findings, reconciliation, dismissReconciliation } = useModel();

  const gaps = stressed.assignments.filter((assignment) => !assignment.personId);
  // Only what needs acting on. An unstaffed role is already orange in the grid and
  // counted in the stat above it, so repeating it here in a third place said nothing new
  // and buried the findings that do matter under a list of things that are fine.
  const problems = findings.filter((finding) => finding.severity !== 'info');

  return (
    <>
      <EngagementHeader />

      {reconciliation.length > 0 && (
        <div className="card" style={{ marginBottom: 18, borderColor: 'var(--terracotta-200)' }}>
          <div className="card-body">
            <div className="row gap-10" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <strong style={{ color: 'var(--ink-900)' }}>
                  This model was saved against an earlier rate card.
                </strong>
                <p className="small" style={{ margin: '4px 0 8px', color: 'var(--ink-500)' }}>
                  The plan is yours; the grade ladder, capabilities and rates belong to the
                  practice, so they have been brought up to date.
                </p>
                <ul className="small" style={{ margin: 0, paddingLeft: 18, color: 'var(--ink-700)' }}>
                  {reconciliation.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
              <button className="ghost tiny" onClick={dismissReconciliation}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <Stat label="Total effort" value={`${formatDays(analysis.plan.totalEffortDays)} days`} small />
        <Stat
          label="Peak demand"
          value={`${analysis.plan.peakHeadcount.toFixed(1)} FTE`}
          small
          foot={
            analysis.plan.peakWeek
              ? `Week ${analysis.plan.peakWeek} · ${weekStartLabel(stressed.startDate, analysis.plan.peakWeek)}`
              : undefined
          }
        />
        <Stat
          label="Unstaffed effort"
          value={`${formatDays(analysis.plan.unstaffedEffortDays)} days`}
          small
          tone={analysis.plan.unstaffedEffortDays > 0 ? 'warn' : 'good'}
          foot={`${gaps.length} role${gaps.length === 1 ? '' : 's'} still to fill`}
        />
        <Stat
          label="Cost of delivery"
          value={formatMoney(analysis.plan.directCost)}
          small
          foot="Direct delivery cost"
        />
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head">
          <h3>Timeline</h3>
          <span className="card-note">
            {stressed.weeks} weeks from {weekStartLabel(stressed.startDate, 1)} ·{' '}
            {sprintNumber(stressed.weeks, stressed.sprintWeeks ?? 2)} sprints · edit the dates in
            the grid below
          </span>
        </div>
        <div className="card-body">
          <Timeline engagement={stressed} />
        </div>
      </div>

      {problems.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-head">
            <h3>Worth a look</h3>
            <span className="card-note">
              {problems.length} thing{problems.length === 1 ? '' : 's'} the model is unhappy about
            </span>
          </div>
          <div className="card-body" style={{ paddingTop: 4 }}>
            <Findings findings={problems} />
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h3>Allocation</h3>
          <span className="card-note">
            Every box is editable · dates here drive the timeline above
          </span>
        </div>
        <div className="card-body">
          <AllocationGrid />
        </div>
      </div>
    </>
  );
}
