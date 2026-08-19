'use client';

import {
  capacityBasis,
  formatDays,
  formatMoney,
  setSprintWeeks,
  setStartDate,
  setWeeks,
  sprintNumber,
  weekStartLabel,
} from '@scope/engine';
import { AllocationGrid } from '@/components/AllocationGrid';
import { DemandBars } from '@/components/charts';
import { Findings, Stat } from '@/components/bits';
import { Timeline } from '@/components/Timeline';
import { useModel } from '@/lib/store';

export default function PlanPage() {
  const { stressed, analysis, findings, update, reconciliation, dismissReconciliation } = useModel();

  const fte = Array.from({ length: stressed.weeks }, (_, i) => analysis.plan.fteByWeek.get(i + 1) ?? 0);
  const basis = capacityBasis(stressed);
  const gaps = stressed.assignments.filter((assignment) => !assignment.personId);

  return (
    <>
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
            {sprintNumber(stressed.weeks, stressed.sprintWeeks ?? 2)} sprints
          </span>
        </div>
        <div className="card-body">
          <div className="row gap-24 wrap" style={{ marginBottom: 22 }}>
            <div className="field" style={{ maxWidth: 170 }}>
              <label>Start date</label>
              <input
                type="date"
                aria-label="Start date"
                value={stressed.startDate}
                onChange={(event) =>
                  update((draft) => setStartDate(draft, event.target.value), {
                    label: 'the start date',
                    coalesce: 'start-date',
                  })
                }
              />
            </div>
            <div className="field" style={{ maxWidth: 110 }}>
              <label>Duration</label>
              <input
                type="number"
                min={1}
                aria-label="Duration in weeks"
                value={stressed.weeks}
                onChange={(event) =>
                  update((draft) => setWeeks(draft, Number.parseInt(event.target.value, 10) || 1), {
                    label: 'the duration',
                    coalesce: 'weeks',
                  })
                }
              />
            </div>
            <div className="field" style={{ maxWidth: 130 }}>
              <label>Annual leave</label>
              <input
                type="number"
                min={0}
                max={60}
                aria-label="Annual leave days per person-year"
                value={stressed.annualLeaveDays ?? 0}
                onChange={(event) =>
                  update(
                    (draft) => ({
                      ...draft,
                      annualLeaveDays: Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                    }),
                    { label: 'the leave allowance', coalesce: 'leave' },
                  )
                }
              />
            </div>
            <div className="field" style={{ maxWidth: 110 }}>
              <label>Sprint length</label>
              <input
                type="number"
                min={1}
                max={12}
                aria-label="Sprint length in weeks"
                value={stressed.sprintWeeks ?? 2}
                onChange={(event) =>
                  update((draft) => setSprintWeeks(draft, Number.parseInt(event.target.value, 10) || 1), {
                    label: 'the sprint length',
                    coalesce: 'sprint',
                  })
                }
              />
            </div>
          </div>
          <p className="tiny muted" style={{ margin: '0 0 20px' }}>
            Full-time capacity: {formatDays(basis.availableDays)} days across {basis.weeks}{' '}
            weeks ({formatDays(basis.workingDays, 0)} working, less{' '}
            {formatDays(basis.publicHolidayDays, 0)} holiday and {formatDays(basis.annualLeaveDays)}{' '}
            leave) · annualised {formatDays(basis.annualisedAvailableDays, 0)} days,{' '}
            {formatDays(basis.annualisedBeforeLeave, 0)} before leave
          </p>
          <Timeline engagement={stressed} />
        </div>
      </div>

      <div className="grid cols-2" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="card-head">
            <h3>Demand by week</h3>
            <span className="card-note">FTE across the whole team</span>
          </div>
          <div className="card-body">
            <DemandBars
              values={fte}
              capacityHint={5}
              weekLabel={(week) => `Week ${week} · ${weekStartLabel(stressed.startDate, week)}`}
            />
            <p className="tiny muted" style={{ margin: '10px 0 0' }}>
              Dashed line: a 5 FTE resourcing constraint. Peak demand is{' '}
              {analysis.plan.peakHeadcount.toFixed(1)} FTE.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Model checks</h3>
            <span className="card-note">{findings.length} findings</span>
          </div>
          <div className="card-body" style={{ paddingTop: 4 }}>
            <Findings findings={findings} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Allocation</h3>
          <span className="card-note">
            Every box is editable · phase and workstream dates feed the timeline above
          </span>
        </div>
        <div className="card-body">
          <AllocationGrid />
        </div>
      </div>
    </>
  );
}
