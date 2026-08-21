'use client';

import {
  billedRatesFor,
  breakEvenView,
  computePlan,
  formatDays,
  formatMoney,
  formatPct,
} from '@scope/engine';
import { useMemo } from 'react';
import { useModel } from '@/lib/store';

/**
 * How low this deal can go.
 *
 * The pricing desk above answers *which lever is worth pulling*. This answers the
 * question asked immediately before a negotiation, and the one a bid team most often
 * guesses at: **what is the floor?**
 *
 * The headline is the deepest discount that still clears each bar — and it is stated as
 * a share of the price, not in points of margin, because that is the confusion this card
 * exists to end. A deal at 22% margin can give away 22% of its price. Not 22 points.
 */
export function FloorCard() {
  const { stressed, analysis, selectedScenarioId, targetMarginPct } = useModel();

  const entry =
    analysis.scenarios.find((s) => s.scenario.scenarioId === selectedScenarioId) ??
    analysis.scenarios[0]!;
  const definition =
    stressed.scenarios.find((s) => s.id === entry.scenario.scenarioId) ?? stressed.scenarios[0]!;

  const view = useMemo(() => {
    const billed = billedRatesFor(stressed, definition);
    return breakEvenView(stressed, entry, computePlan(stressed, billed), targetMarginPct, billed);
  }, [stressed, definition, entry, targetMarginPct]);

  const targetPct = formatPct(view.targetMarginPct, 0);

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="card-head">
        <h3>The floor</h3>
        <span className="card-note">How far this price can fall before it stops working</span>
      </div>

      <div className="card-body">
        <div className="leave-summary">
          <div className="desk-metric">
            <span className="k">Billing</span>
            <span className="v">{formatMoney(view.blendedRate)}</span>
            <span className="sub">blended, over {formatDays(view.effortDays)} days</span>
          </div>
          <div className="desk-sep" />
          <div className="desk-metric">
            <span className="k">Break-even</span>
            <span className="v">{formatMoney(view.breakEvenRate)}</span>
            <span className="sub">
              {formatMoney(view.blendedDirectCostRate)} delivery + overhead
            </span>
          </div>
          <div className="desk-sep" />
          <div className="desk-metric">
            <span className="k">Needed for {targetPct}</span>
            <span
              className="v"
              style={{ color: view.belowTarget ? 'var(--status-breach)' : undefined }}
            >
              {formatMoney(view.targetRate)}
            </span>
            <span className="sub">
              {view.belowTarget
                ? `${formatMoney(-view.roomToTarget)} short`
                : `${formatMoney(view.roomToTarget)} of room`}
            </span>
          </div>
        </div>

        <div className={`floor-headline${view.belowTarget ? ' tight' : ''}`}>
          {view.belowBreakEven ? (
            <>
              This deal is <strong>below break-even</strong>. It bills{' '}
              {formatMoney(view.blendedRate)} a day against a cost of{' '}
              {formatMoney(view.breakEvenRate)}, losing{' '}
              <strong>{formatMoney(-view.roomToBreakEven)}</strong> over the engagement. There is
              no discount to give.
            </>
          ) : view.belowTarget ? (
            <>
              Already <strong>below the {targetPct} bar</strong> by{' '}
              <strong>{formatMoney(-view.roomToTarget)}</strong>. There is still{' '}
              <strong>{formatPct(view.discountToBreakEven)}</strong> of the price between here and
              break-even, but every point of it is margin the practice said it would not give.
            </>
          ) : (
            <>
              You can give away <strong>{formatPct(view.discountToTarget)}</strong> of the price
              and still clear {targetPct} — <strong>{formatMoney(view.roomToTarget)}</strong>.
              Beyond that, <strong>{formatPct(view.discountToBreakEven)}</strong> takes it to
              break-even. A discount is a share of the price, not points of margin: those two
              are not the same number and confusing them is what gives a deal away.
            </>
          )}
        </div>

        <div className="table-scroll">
          <table className="leave-table">
            <thead>
              <tr>
                <th>Grade</th>
                <th className="num">Days</th>
                <th className="num">Share</th>
                <th className="num">Billed</th>
                <th className="num">Cost</th>
                <th className="num">Margin</th>
                <th className="num">Of the blended rate</th>
              </tr>
            </thead>
            <tbody>
              {view.grades.map((line) => {
                const under = (line.marginPct ?? 0) < view.targetMarginPct;
                return (
                  <tr key={line.gradeId}>
                    <td>{line.name}</td>
                    <td className="num muted">{formatDays(line.days)}</td>
                    <td className="num muted">{formatPct(line.shareOfDays, 0)}</td>
                    <td className="num">{formatMoney(line.chargeRate)}</td>
                    <td className="num muted">{formatMoney(line.costRate)}</td>
                    <td
                      className="num"
                      style={{ color: under ? 'var(--status-breach)' : 'var(--status-good)' }}
                      title={
                        under
                          ? `A day of ${line.name} earns less than the ${targetPct} bar`
                          : undefined
                      }
                    >
                      {formatPct(line.marginPct)}
                    </td>
                    <td className="num muted">{formatMoney(line.contributionToBlended)}</td>
                  </tr>
                );
              })}
              <tr className="total">
                <td>Blended</td>
                <td className="num">{formatDays(view.effortDays)}</td>
                <td className="num">100%</td>
                <td className="num">{formatMoney(view.blendedRate)}</td>
                <td className="num">{formatMoney(view.blendedCostRate)}</td>
                <td className="num">{formatPct(view.marginPct)}</td>
                <td className="num">{formatMoney(view.blendedRate)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {view.richest && view.leanest && view.richest.gradeId !== view.leanest.gradeId && (
          <p className="tiny muted" style={{ margin: '12px 0 0' }}>
            A day of <strong>{view.richest.name}</strong> earns{' '}
            {formatPct(view.richest.marginPct)}; a day of <strong>{view.leanest.name}</strong>{' '}
            earns {formatPct(view.leanest.marginPct)}. The blended rate is an output of the team
            you put on the job, so the floor moves when the mix moves — the cost column is per
            delivered day and excludes overhead, which the blended cost rate above carries.
          </p>
        )}
      </div>
    </div>
  );
}
