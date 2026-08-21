'use client';

import { formatMoney, formatPct } from '@scope/engine';
import { MarginTone } from '@/components/bits';
import { scenarioColour, useModel } from '@/lib/store';

/**
 * Every scenario, side by side.
 *
 * It lives on the report rather than on the commercials workbench. Comparing is a
 * *reviewing* act — you do it once the options exist, to choose between them — and
 * sitting it in the middle of the page where you build one deal put a wall of four
 * columns between the levers and the result of pulling them.
 *
 * There is no edit control here on purpose. The overview is a recipient of decisions
 * taken elsewhere, and a button that jumps you back to the workbench mid-review is an
 * invitation to change the thing you came here to judge.
 */
export function ScenarioComparison() {
  const { stressed, analysis, selectedScenarioId } = useModel();
  const selected =
    analysis.scenarios.find((entry) => entry.scenario.scenarioId === selectedScenarioId) ??
    analysis.scenarios[0]!;

    return (
  <div className="card" style={{ marginBottom: 18 }}>
      <div className="card-head">
        <h3>Comparison</h3>
        <span className="card-note">
          {analysis.plan.totalEffortDays.toFixed(1)} effort days ·{' '}
          {formatMoney(selected.metrics.cost)} cost, unchanged throughout
        </span>
      </div>
      <div className="card-body flush">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Measure</th>
                {analysis.scenarios.map((entry) => (
                  <th className="num" key={entry.scenario.scenarioId}>
                    <span className="row gap-6" style={{ justifyContent: 'flex-end' }}>
                      <span
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: 2,
                          background: scenarioColour(stressed, entry.scenario.scenarioId),
                          display: 'inline-block',
                        }}
                      />
                      {entry.scenario.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row
                label="Structure"
                cells={analysis.scenarios.map((entry) =>
                  entry.scenario.isHybrid
                    ? `Hybrid · ${entry.scenario.parts.length} phases`
                    : (entry.scenario.parts[0]?.structure.label ?? '—'),
                )}
              />
              <Row
                label="Revenue"
                cells={analysis.scenarios.map((entry) => formatMoney(entry.metrics.revenue))}
              />
              <Row
                label="Cost"
                cells={analysis.scenarios.map((entry) => formatMoney(entry.metrics.cost))}
              />
              <Row
                label="Gross margin"
                strong
                cells={analysis.scenarios.map((entry) => formatPct(entry.metrics.grossMarginPct))}
                tones={analysis.scenarios.map((entry) => MarginTone(entry.metrics.grossMarginPct))}
              />
              <Row
                label="Effective day rate"
                cells={analysis.scenarios.map((entry) => formatMoney(entry.metrics.effectiveRate))}
              />
              <Row
                label="Discount vs standard"
                cells={analysis.scenarios.map((entry) => formatPct(entry.metrics.discountVsStandardPct))}
              />
              <Row
                label="Max cash exposure"
                cells={analysis.scenarios.map((entry) => formatMoney(entry.metrics.maxCashExposure))}
              />
              <Row
                label="Break-even overrun"
                cells={analysis.scenarios.map((entry) =>
                  entry.metrics.breakEvenOverrunPct == null
                    ? 'n/a'
                    : formatPct(entry.metrics.breakEvenOverrunPct, 0),
                )}
              />
              <Row
                label="Downside case"
                strong
                cells={analysis.scenarios.map(
                  (entry) =>
                    `${formatMoney(entry.scenario.downside.revenue)} · ${formatPct(entry.scenario.downside.marginPct)}`,
                )}
                tones={analysis.scenarios.map((entry) =>
                  MarginTone(entry.scenario.downside.marginPct, 0.35),
                )}
              />
              <Row
                label="Upside case"
                cells={analysis.scenarios.map((entry) =>
                  entry.scenario.upside
                    ? `${formatMoney(entry.scenario.upside.revenue)} · ${formatPct(entry.scenario.upside.marginPct)}`
                    : '—',
                )}
              />
              <tr>
                <td>Guardrails</td>
                {analysis.scenarios.map((entry) => {
                  const breaches = entry.guardrails.filter((status) => status.breached);
                  return (
                    <td className="num" key={entry.scenario.scenarioId}>
                      {breaches.length === 0 ? (
                        <span className="badge good">
                          <span className="dot" />
                          Pass
                        </span>
                      ) : (
                        <span className="badge breach">
                          <span className="dot" />
                          {breaches.length} breach{breaches.length === 1 ? '' : 'es'}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  cells,
  tones,
  strong,
}: {
  label: string;
  cells: string[];
  tones?: ('good' | 'warn' | 'breach')[];
  strong?: boolean;
}) {
  const colourFor = (tone?: 'good' | 'warn' | 'breach') =>
    tone === 'breach'
      ? 'var(--status-breach)'
      : tone === 'warn'
        ? 'var(--status-warn)'
        : tone === 'good'
          ? 'var(--status-good)'
          : undefined;
  return (
    <tr className={strong ? 'total' : undefined}>
      <td>{label}</td>
      {cells.map((cell, index) => (
        <td className="num" key={index} style={{ color: colourFor(tones?.[index]) }}>
          {cell}
        </td>
      ))}
    </tr>
  );
}

