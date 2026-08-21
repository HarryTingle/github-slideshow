'use client';

import { formatDays, formatMoney, formatPct, weekStartLabel } from '@scope/engine';
import { CashChart, CumulativeChart, RankBars } from '@/components/charts';
import { MarginTone, Stat } from '@/components/bits';
import { ScenarioComparison } from '@/components/ScenarioComparison';
import { useModel, useSelectedScenario } from '@/lib/store';

export default function OverviewPage() {
  // Read-only by design. Overview reports the model; it never changes it, so every
  // number here can be trusted to be a consequence of a decision taken somewhere else.
  const { stressed, analysis } = useModel();
  const selected = useSelectedScenario();
  const { metrics, scenario, cash } = selected;

  const weekLabel = (week: number) =>
    `Week ${week} · ${weekStartLabel(stressed.startDate, week)}`;

  const cumulativeCost: number[] = [];
  const cumulativeRevenue: number[] = [];
  let runningCost = 0;
  let runningRevenue = 0;
  for (let i = 0; i < stressed.weeks; i++) {
    runningCost += analysis.plan.costByWeek.get(i + 1) ?? 0;
    runningRevenue += scenario.revenueByWeek[i] ?? 0;
    cumulativeCost.push(runningCost);
    cumulativeRevenue.push(runningRevenue);
  }

  const gradeRows = [...stressed.grades]
    .sort((a, b) => b.order - a.order)
    .map((grade) => ({
      id: grade.id,
      label: grade.name,
      sublabel: `${formatMoney(grade.chargeRate)}/day`,
      value: analysis.plan.effortByGrade.get(grade.id) ?? 0,
      fraction: analysis.gradeMix.get(grade.id) ?? 0,
    }))
    .filter((row) => row.value > 0);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">
            {stressed.client} · {selected.scenario.name}
          </div>
          <h1>{stressed.name}</h1>
          <p className="lede">
            {stressed.weeks} weeks from {weekStartLabel(stressed.startDate, 1)} ·{' '}
            {stressed.workstreams.length} workstreams · {formatDays(metrics.totalEffortDays)} effort
            days · peak {analysis.plan.peakHeadcount.toFixed(1)} FTE
          </p>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <Stat label="Revenue" value={formatMoney(metrics.revenue)} foot={scenario.parts[0]?.structure.label} />
        <Stat
          label="Cost of delivery"
          value={formatMoney(metrics.cost)}
          foot="At the practice's real cost rates"
        />
        <Stat
          label="Gross margin"
          value={formatPct(metrics.grossMarginPct)}
          tone={MarginTone(metrics.grossMarginPct)}
          foot={`${formatMoney(metrics.grossMargin)} absolute`}
        />
        <Stat
          label="Downside margin"
          value={formatPct(scenario.downside.marginPct)}
          tone={MarginTone(scenario.downside.marginPct, 0.35)}
          foot={
            metrics.breakEvenOverrunPct == null
              ? 'Same as plan — the client carries the overrun'
              : 'Worst realistic case'
          }
        />
      </div>

      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <Stat label="Effective day rate" value={formatMoney(metrics.effectiveRate)} small foot="Revenue ÷ effort days" />
        <Stat
          label="Discount vs standard"
          value={formatPct(metrics.discountVsStandardPct)}
          small
          foot="What we actually gave away"
        />
        <Stat
          label="Max cash exposure"
          value={formatMoney(metrics.maxCashExposure)}
          small
          foot={`${stressed.paymentTermsWeeks ?? 0}-week payment terms`}
        />
        <Stat
          label="Break-even overrun"
          value={metrics.breakEvenOverrunPct == null ? 'n/a' : formatPct(metrics.breakEvenOverrunPct, 0)}
          small
          foot="Overrun we can absorb before losing money"
        />
      </div>

      <ScenarioComparison />

      <div className="grid cols-2" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="card-head">
            <h3>Cost and revenue, cumulative</h3>
            <span className="card-note">{scenario.name}</span>
          </div>
          <div className="card-body">
            <CumulativeChart
              weeks={stressed.weeks}
              weekLabel={weekLabel}
              series={[
                { id: 'revenue', label: 'Revenue billed', colour: 'var(--series-1)', values: cumulativeRevenue },
                { id: 'cost', label: 'Cost incurred', colour: 'var(--series-3)', values: cumulativeCost },
              ]}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Cash position</h3>
            <span className="card-note">
              Worst point {formatMoney(metrics.maxCashExposure)} out of pocket
            </span>
          </div>
          <div className="card-body">
            <CashChart values={cash.map((point) => point.position)} weekLabel={weekLabel} />
            <p className="tiny muted mt-8" style={{ margin: '8px 0 0' }}>
              {stressed.paymentTermsWeeks ?? 0}-week payment terms; the horizon runs past go-live.
            </p>
          </div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-head">
            <h3>Team shape</h3>
            <span className="card-note">Derived from the plan, not entered</span>
          </div>
          <div className="card-body">
            <RankBars rows={gradeRows} formatValue={(value) => `${formatDays(value)} days`} />
          </div>
        </div>

      </div>
    </>
  );
}
