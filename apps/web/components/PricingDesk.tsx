'use client';

import {
  applyRateMultiplier,
  billedRatesFor,
  clearScenarioRates,
  computePlan,
  formatDays,
  formatMoney,
  formatPct,
  pounds,
  pricingView,
  setContractValue,
  setScenarioRate,
  solveForMargin,
  type Engagement,
} from '@scope/engine';
import { useMemo, useState } from 'react';
import { useModel } from '@/lib/store';

/**
 * The pricing desk.
 *
 * Pricing a bid is a loop: change a number, look at the margin, change another. It is
 * only fast if both halves are on screen at once, so the readout is sticky and the rates
 * sit directly beneath it — no scrolling between cause and effect.
 *
 * The columns that earn their place are the two on the right. They answer the question a
 * commercial lead is actually asking — *which lever is worth pulling?* — instead of
 * leaving it to be discovered by trial and error. They are also structure-aware, and the
 * difference is stark: under time and materials the leverage follows the volume of days,
 * so a rate change on the grade carrying a hundred days is worth eighty times the same
 * change on the grade carrying one. Once a price is fixed, rate changes do nothing at
 * all, and the only lever left is the shape of the team.
 */
export function PricingDesk() {
  const { stressed, analysis, update, selectedScenarioId, setSelectedScenarioId } = useModel();
  const [target, setTarget] = useState(25);

  const entry =
    analysis.scenarios.find((s) => s.scenario.scenarioId === selectedScenarioId) ??
    analysis.scenarios[0]!;
  const definition =
    stressed.scenarios.find((s) => s.id === entry.scenario.scenarioId) ?? stressed.scenarios[0]!;

  const { view, billed } = useMemo(() => {
    const billedRates = billedRatesFor(stressed, definition);
    const plan = computePlan(stressed, billedRates);
    return { view: pricingView(stressed, definition, entry, plan), billed: billedRates };
  }, [stressed, definition, entry]);

  const solution = solveForMargin(entry, view, target / 100);
  const margin = entry.metrics.grossMarginPct;
  // Compare at the precision shown. A solve lands a rounding hair under the target, and
  // reporting an exact hit as a miss would undermine the one number being steered by.
  const onTarget = margin != null && margin * 100 >= target - 0.05;
  const breaches = entry.guardrails.filter((g) => g.breached);

  const maxLever = Math.max(
    0.01,
    ...view.grades.map((g) => Math.abs(view.revenueFollowsEffort ? g.rateLeveragePp : g.tradeDownPp)),
  );

  const applySolution = () => {
    if (!solution.reachable) return;
    update(
      (draft: Engagement) =>
        solution.kind === 'price'
          ? setContractValue(draft, definition.id, solution.price)
          : applyRateMultiplier(draft, definition.id, solution.multiplier, billed),
      { label: `solving for ${target}%` },
    );
  };

  return (
    <>
      <div className="desk-bar">
        <div className="desk-metric">
          <span className="k">Deal</span>
          <select
            className="rh-select"
            style={{ fontSize: 14, color: 'var(--ink-900)', padding: 0, maxWidth: 210 }}
            aria-label="Scenario being priced"
            value={entry.scenario.scenarioId}
            onChange={(event) => setSelectedScenarioId(event.target.value)}
          >
            {analysis.scenarios.map((s) => (
              <option key={s.scenario.scenarioId} value={s.scenario.scenarioId}>
                {s.scenario.name}
              </option>
            ))}
          </select>
        </div>

        <div className="desk-sep" />

        <div className="desk-metric">
          <span className="k">Price</span>
          {view.revenueFollowsEffort ? (
            <>
              <span className="v">{formatMoney(view.price)}</span>
              <span className="sub">built up from rates</span>
            </>
          ) : (
            <>
              <input
                className="rate-input"
                style={{ width: 116, fontSize: 17 }}
                type="number"
                step={1000}
                aria-label="Contract value"
                value={Math.round(view.price / 100)}
                onChange={(event) =>
                  update(
                    (draft: Engagement) =>
                      setContractValue(draft, definition.id, pounds(Number.parseFloat(event.target.value) || 0)),
                    { label: 'the price', coalesce: `price:${definition.id}` },
                  )
                }
              />
              <span className="sub">against a build-up of {formatMoney(view.buildUp)}</span>
            </>
          )}
        </div>

        <div className="desk-metric">
          <span className="k">Margin</span>
          <span
            className="v"
            style={{ color: onTarget ? 'var(--status-good)' : 'var(--status-breach)' }}
          >
            {formatPct(margin)}
          </span>
          <span className="sub">{marginVsTarget(margin, target)}</span>
        </div>

        <div className="desk-metric">
          <span className="k">Discount</span>
          <span className="v sm">{formatPct(view.discountPct)}</span>
          <span className="sub">vs standard rates</span>
        </div>

        <div className="desk-metric">
          <span className="k">Blended</span>
          <span className="v sm">{formatMoney(view.blendedRate)}</span>
          <span className="sub">vs {formatMoney(view.blendedStandardRate)} standard</span>
        </div>

        <div className="desk-metric">
          <span className="k">Guardrails</span>
          {breaches.length === 0 ? (
            <span className="badge good" style={{ marginTop: 3 }}>
              <span className="dot" />
              Pass
            </span>
          ) : (
            <span className="badge breach" style={{ marginTop: 3 }} title={breaches[0]!.explanation}>
              <span className="dot" />
              {breaches[0]!.guardrail.label}
            </span>
          )}
        </div>

        <div className="desk-solve">
          <div className="field" style={{ gap: 3 }}>
            <label>Target</label>
            <input
              type="number"
              aria-label="Target margin percent"
              value={target}
              min={0}
              max={90}
              onChange={(event) => setTarget(Number.parseFloat(event.target.value) || 0)}
            />
          </div>
          <button className="primary" onClick={applySolution} disabled={!solution.reachable}>
            {solution.kind === 'price'
              ? `Price at ${formatMoney(solution.price)}`
              : solution.kind === 'rateMultiplier'
                ? `Move rates ${((solution.multiplier - 1) * 100).toFixed(1)}%`
                : 'Not reachable'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head">
          <h3>Rates and leverage</h3>
          <span className="card-note">
            {formatDays(entry.metrics.totalEffortDays)} days · build-up {formatMoney(view.buildUp)}{' '}
            vs {formatMoney(view.buildUpAtStandard)} at standard
          </span>
        </div>
        <div className="card-body">
          <div className="desk-note">
            {view.revenueFollowsEffort ? (
              <>
                Revenue follows the plan, so <strong>rates are the lever</strong> — and the leverage
                sits where the days are, not where the rate is highest.
              </>
            ) : (
              <>
                The price is fixed, so <strong>a rate change moves nothing</strong>. It only shifts
                the reference the discount is measured against. The levers left are the price above
                and the shape of the team — and on this rate card, moving work down the ladder gains
                margin fastest at the top.
              </>
            )}
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Grade</th>
                  <th className="num">Days</th>
                  <th className="num">Billed rate</th>
                  <th className="num">Cost rate</th>
                  <th className="num">Revenue</th>
                  <th className="num">Margin</th>
                  <th className="num">+£25/day</th>
                  <th className="num">Move a week down</th>
                </tr>
              </thead>
              <tbody>
                {view.grades.map((grade) => (
                  <tr key={grade.gradeId}>
                    <td style={{ color: 'var(--ink-900)' }}>{grade.name}</td>
                    <td className="num">{formatDays(grade.days)}</td>
                    <td className="num">
                      <span className="rate-cell">
                        <input
                          className={`rate-input${grade.overridden ? ' overridden' : ''}`}
                          type="number"
                          step={25}
                          aria-label={`Billed day rate for ${grade.name}`}
                          value={Math.round(grade.billedRate / 100)}
                          onChange={(event) => {
                            const raw = event.target.value.trim();
                            update(
                              (draft: Engagement) =>
                                setScenarioRate(
                                  draft,
                                  definition.id,
                                  grade.gradeId,
                                  raw === '' ? null : pounds(Number.parseFloat(raw) || 0),
                                ),
                              { label: `the ${grade.name} rate`, coalesce: `rate:${grade.gradeId}` },
                            );
                          }}
                        />
                        <span className="std">
                          {grade.billedRate === grade.standardRate
                            ? 'standard'
                            : formatMoney(grade.standardRate)}
                        </span>
                      </span>
                    </td>
                    <td className="num muted">{formatMoney(grade.costRate)}</td>
                    <td className="num">{formatMoney(grade.revenue)}</td>
                    <td className="num">{formatPct(grade.marginPct)}</td>
                    <td className="num">
                      <Lever value={grade.rateLeveragePp} max={maxLever} />
                    </td>
                    <td className="num">
                      <Lever
                        value={grade.tradeDownPp}
                        max={maxLever}
                        title={grade.tradeDownTo ? `to ${grade.tradeDownTo}` : undefined}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row gap-16 wrap mt-16" style={{ marginTop: 14 }}>
            <button
              className="ghost tiny"
              onClick={() =>
                update((draft: Engagement) => clearScenarioRates(draft, definition.id), {
                  label: 'resetting the rates',
                })
              }
            >
              Reset rates to the inherited card
            </button>
            <span className="tiny muted">
              Editing a rate here prices this deal only — the practice standard is untouched.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

function marginVsTarget(margin: number | null | undefined, target: number): string {
  if (margin == null) return '—';
  const deltaPp = margin * 100 - target;
  if (Math.abs(deltaPp) < 0.05) return 'on target';
  return `${deltaPp > 0 ? '+' : ''}${deltaPp.toFixed(1)}pp vs target`;
}

/** Points of total margin, with a bar so the biggest lever is findable at a glance. */
function Lever({ value, max, title }: { value: number; max: number; title?: string }) {
  const nil = Math.abs(value) < 0.005;
  const tone = nil ? 'nil' : value > 0 ? 'up' : 'down';
  const width = nil ? 0 : Math.max(3, (Math.abs(value) / max) * 46);
  return (
    <span className={`lever ${tone}`} title={title}>
      <span
        className="bar"
        style={{
          width,
          background: value > 0 ? 'var(--olive-500)' : 'var(--terracotta-600)',
        }}
      />
      <span className="n">
        {nil ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}pp`}
      </span>
    </span>
  );
}
