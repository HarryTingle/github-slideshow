'use client';

import { billedRatesFor, breakEvenView, computePlan, formatDays, formatMoney, formatPct } from '@scope/engine';
import { useMemo } from 'react';
import { useModel } from '@/lib/store';

/**
 * How low this deal can go.
 *
 * Three numbers and a sentence, and deliberately nothing else. It used to carry its own
 * table of grades — days, rate, cost, margin — directly beneath the pricing desk's table
 * of grades with days, rate, cost and margin. Two tables of the same seven rows on one
 * screen is not thoroughness, it is a reader having to work out which one to trust. The
 * mix now lives once, in the rates table above, with the share and the blended line
 * folded into it.
 *
 * What is left is the part that exists nowhere else: the deepest discount that still
 * clears each bar, stated as a share of the price rather than in points of margin,
 * because that is the confusion this card exists to end. A deal at 22% margin can give
 * away 22% of its price. Not 22 points.
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
        <span className="card-note">
          How far this price can fall before it stops working · the mix behind it is in the
          table above
        </span>
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

      </div>
    </div>
  );
}
