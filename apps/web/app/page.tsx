'use client';

import { formatDays, formatMoney, formatPct, weekStartLabel } from '@scope/engine';
import { CashChart, CumulativeChart, RankBars } from '@/components/charts';
import { Findings, GuardrailRow, MarginTone, Stat } from '@/components/bits';
import { useModel, useSelectedScenario } from '@/lib/store';

export default function OverviewPage() {
  const { stressed, analysis, findings, selectedScenarioId, setSelectedScenarioId } = useModel();
  const selected = useSelectedScenario();
  const { metrics, scenario, guardrails, cash } = selected;

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

  const breaches = guardrails.filter((status) => status.breached);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{stressed.client}</div>
          <h1>{stressed.name}</h1>
          <p className="lede">
            {stressed.weeks} weeks from {weekStartLabel(stressed.startDate, 1)} ·{' '}
            {stressed.workstreams.length} workstreams · {formatDays(metrics.totalEffortDays)} effort
            days · peak {analysis.plan.peakHeadcount.toFixed(1)} FTE
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-body row wrap gap-16" style={{ justifyContent: 'space-between' }}>
          <div className="row gap-16 wrap">
            <span className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '0.09em' }}>
              Commercial scenario
            </span>
            <div className="segmented">
              {analysis.scenarios.map((entry) => (
                <button
                  key={entry.scenario.scenarioId}
                  aria-pressed={entry.scenario.scenarioId === selectedScenarioId}
                  onClick={() => setSelectedScenarioId(entry.scenario.scenarioId)}
                >
                  {entry.scenario.name}
                </button>
              ))}
            </div>
          </div>
          {breaches.length > 0 ? (
            <span className="badge breach">
              <span className="dot" />
              {breaches.length} guardrail {breaches.length === 1 ? 'breach' : 'breaches'}
            </span>
          ) : (
            <span className="badge good">
              <span className="dot" />
              Within all guardrails
            </span>
          )}
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

        <div className="stack gap-16">
          <div className="card">
            <div className="card-head">
              <h3>Guardrails</h3>
              <span className="card-note">{scenario.name}</span>
            </div>
            <div className="card-body" style={{ paddingTop: 6, paddingBottom: 10 }}>
              {guardrails.map((status) => (
                <GuardrailRow key={status.guardrail.id} status={status} />
              ))}
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
      </div>
    </>
  );
}
