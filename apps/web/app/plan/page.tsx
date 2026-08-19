'use client';

import {
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
import { FictionPill, Findings, Stat } from '@/components/bits';
import { Timeline } from '@/components/Timeline';
import { useModel } from '@/lib/store';

export default function PlanPage() {
  const { stressed, analysis, findings, update } = useModel();

  const fte = Array.from({ length: stressed.weeks }, (_, i) => analysis.plan.fteByWeek.get(i + 1) ?? 0);
  const gaps = stressed.assignments.filter((assignment) => !assignment.personId);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Delivery plan &amp; resourcing</div>
          <h1>How the work runs, and who runs it</h1>
          <p className="lede">
            Phases, workstreams and milestones, then the team laid over the top. The plan is
            valid and fully costed with nobody named — roles first, people later.
          </p>
        </div>
        <div className="head-actions">
          <FictionPill />
        </div>
      </div>

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
        <Stat label="Cost of delivery" value={formatMoney(analysis.plan.directCost)} small foot="Direct delivery cost" />
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
                onChange={(event) => update((draft) => setStartDate(draft, event.target.value))}
              />
              <span className="hint">Every week label follows it. The plan itself does not move.</span>
            </div>
            <div className="field" style={{ maxWidth: 110 }}>
              <label>Duration</label>
              <input
                type="number"
                min={1}
                aria-label="Duration in weeks"
                value={stressed.weeks}
                onChange={(event) =>
                  update((draft) => setWeeks(draft, Number.parseInt(event.target.value, 10) || 1))
                }
              />
              <span className="hint">Weeks. Will not shrink below the work planned.</span>
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
                  update((draft) => setSprintWeeks(draft, Number.parseInt(event.target.value, 10) || 1))
                }
              />
              <span className="hint">Weeks per sprint.</span>
            </div>
          </div>
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
              The dashed line is a stated resourcing constraint of 5 FTE. Peak demand of{' '}
              {analysis.plan.peakHeadcount.toFixed(1)} FTE sits above it — a feasibility question
              for resourcing, not a modelling error.
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
