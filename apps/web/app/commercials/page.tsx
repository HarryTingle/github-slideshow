'use client';

import { formatMoney, formatPct, type Engagement } from '@scope/engine';
import { GuardrailRow, MarginTone } from '@/components/bits';
import { LeaveDesk } from '@/components/LeaveDesk';
import { PricingDesk } from '@/components/PricingDesk';
import { ScenarioEditor } from '@/components/ScenarioEditor';
import { scenarioColour, useModel } from '@/lib/store';

/**
 * The page the product exists for: one delivery plan, several commercial shapes,
 * compared on one screen.
 */
export default function CommercialsPage() {
  const {
    stressed,
    analysis,
    sensitivity,
    setSensitivity,
    selectedScenarioId,
    setSelectedScenarioId,
    update,
  } = useModel();

  const selected =
    analysis.scenarios.find((entry) => entry.scenario.scenarioId === selectedScenarioId) ??
    analysis.scenarios[0]!;
  const selectedDefinition =
    stressed.scenarios.find((scenario) => scenario.id === selected.scenario.scenarioId) ??
    stressed.scenarios[0]!;

  const fork = () =>
    update((draft: Engagement) => {
      const source = draft.scenarios.find((scenario) => scenario.id === selectedDefinition.id);
      if (!source) return draft;
      const id = `sc-${Date.now().toString(36)}`;
      return {
        ...draft,
        scenarios: [...draft.scenarios, { ...source, id, name: `${source.name} (copy)` }],
      };
    });

  const remove = (id: string) =>
    update((draft: Engagement) => ({
      ...draft,
      scenarios: draft.scenarios.length > 1 ? draft.scenarios.filter((s) => s.id !== id) : draft.scenarios,
    }));

  const stressActive = sensitivity.slipWeeks > 0 || sensitivity.extraDiscountPct > 0;

  return (
    <>
      <div className="scenario-picker">
        <div className="segmented">
          {analysis.scenarios.map((option) => (
            <button
              key={option.scenario.scenarioId}
              aria-pressed={option.scenario.scenarioId === selected.scenario.scenarioId}
              onClick={() => setSelectedScenarioId(option.scenario.scenarioId)}
            >
              {option.scenario.name}
            </button>
          ))}
        </div>
        <button onClick={fork}>Fork scenario</button>
      </div>

      <PricingDesk />

      <LeaveDesk />

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head">
          <h3>Sensitivity</h3>
          <span className="card-note">
            {stressActive
              ? 'Applied to every scenario below'
              : 'What happens if the plan slips or the discount deepens'}
          </span>
        </div>
        <div className="card-body">
          <div className="grid cols-2 gap-24">
            <div className="field">
              <label>
                Plan slips by {sensitivity.slipWeeks} week{sensitivity.slipWeeks === 1 ? '' : 's'}
              </label>
              <input
                type="range"
                min={0}
                max={6}
                value={sensitivity.slipWeeks}
                onChange={(event) =>
                  setSensitivity({ ...sensitivity, slipWeeks: Number.parseInt(event.target.value, 10) })
                }
              />
              <span className="hint">Fixed price absorbs it; T&amp;M does not.</span>
            </div>
            <div className="field">
              <label>Extra discount {(sensitivity.extraDiscountPct * 100).toFixed(0)}%</label>
              <input
                type="range"
                min={0}
                max={25}
                value={Math.round(sensitivity.extraDiscountPct * 100)}
                onChange={(event) =>
                  setSensitivity({
                    ...sensitivity,
                    extraDiscountPct: Number.parseInt(event.target.value, 10) / 100,
                  })
                }
              />
              <span className="hint">Charge rates only; fixed price is unaffected.</span>
            </div>
          </div>
          {stressActive && (
            <button
              className="ghost tiny mt-8"
              style={{ marginTop: 10 }}
              onClick={() => setSensitivity({ slipWeeks: 0, extraDiscountPct: 0 })}
            >
              Clear sensitivity
            </button>
          )}
        </div>
      </div>

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
                <tr>
                  <td />
                  {analysis.scenarios.map((entry) => (
                    <td className="num" key={entry.scenario.scenarioId}>
                      <button
                        className="tiny"
                        aria-pressed={entry.scenario.scenarioId === selectedScenarioId}
                        onClick={() => setSelectedScenarioId(entry.scenario.scenarioId)}
                      >
                        Edit
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid cols-3">
        <div className="card">
          <div className="card-head">
            <h3>Edit</h3>
            <span className="card-note">{selectedDefinition.name}</span>
          </div>
          <div className="card-body">
            <div className="field" style={{ marginBottom: 16 }}>
              <label>Name</label>
              <input
                type="text"
                value={selectedDefinition.name}
                onChange={(event) =>
                  update((draft: Engagement) => ({
                    ...draft,
                    scenarios: draft.scenarios.map((scenario) =>
                      scenario.id === selectedDefinition.id
                        ? { ...scenario, name: event.target.value }
                        : scenario,
                    ),
                  }))
                }
              />
            </div>
            <ScenarioEditor scenario={selectedDefinition} />
            {stressed.scenarios.length > 1 && (
              <button
                className="ghost tiny"
                style={{ marginTop: 16 }}
                onClick={() => remove(selectedDefinition.id)}
              >
                Delete this scenario
              </button>
            )}
          </div>
        </div>

        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-head">
            <h3>{selected.scenario.name}</h3>
            <span className="card-note">
              {selectedDefinition.notes ?? 'No note on this scenario'}
            </span>
          </div>
          <div className="card-body">
            <div className="grid cols-3" style={{ marginBottom: 4 }}>
              <CaseTile
                label="Downside"
                revenue={selected.scenario.downside.revenue}
                pct={selected.scenario.downside.marginPct}
                caption={selected.scenario.downside.label}
                floor={0.35}
              />
              <CaseTile
                label="Expected"
                revenue={selected.scenario.expected.revenue}
                pct={selected.scenario.expected.marginPct}
                caption={selected.scenario.expected.label}
                floor={0.4}
              />
              {selected.scenario.upside ? (
                <CaseTile
                  label="Upside"
                  revenue={selected.scenario.upside.revenue}
                  pct={selected.scenario.upside.marginPct}
                  caption={selected.scenario.upside.label}
                  floor={0.4}
                />
              ) : (
                <div className="stat">
                  <div className="label">Upside</div>
                  <div className="value sm" style={{ color: 'var(--ink-400)' }}>
                    Unbounded
                  </div>
                  <div className="foot">No cap — cannot be shown as a figure</div>
                </div>
              )}
            </div>

            <div className="sep" />

            {selected.guardrails.map((status) => (
              <GuardrailRow key={status.guardrail.id} status={status} />
            ))}

            {selected.scenario.notes.length > 0 && (
              <>
                <div className="sep" />
                <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
                  {selected.scenario.notes.map((note) => (
                    <li key={note} style={{ marginBottom: 4 }}>
                      {note}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {selected.scenario.isHybrid && (
              <>
                <div className="sep" />
                <table>
                  <thead>
                    <tr>
                      <th>Phase</th>
                      <th>Structure</th>
                      <th className="num">Revenue</th>
                      <th className="num">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.scenario.parts.map((part) => (
                      <tr key={part.label}>
                        <td>{part.label}</td>
                        <td className="muted">{part.structure.label}</td>
                        <td className="num">{formatMoney(part.structure.revenue)}</td>
                        <td className="num">{formatPct(part.structure.expected.marginPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      </div>
    </>
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

function CaseTile({
  label,
  revenue,
  pct,
  caption,
  floor,
}: {
  label: string;
  revenue: number;
  pct: number | null;
  caption: string;
  floor: number;
}) {
  const tone = MarginTone(pct, floor);
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div
        className="value sm"
        style={{
          color:
            tone === 'breach'
              ? 'var(--status-breach)'
              : tone === 'warn'
                ? 'var(--status-warn)'
                : 'var(--ink-900)',
        }}
      >
        {formatMoney(revenue)}
      </div>
      <div className="foot">
        {formatPct(pct)} margin · {caption}
      </div>
    </div>
  );
}
