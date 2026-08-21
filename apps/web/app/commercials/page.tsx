'use client';

import { formatMoney, formatPct, type Engagement } from '@scope/engine';
import { GuardrailRow, MarginTone } from '@/components/bits';
import { FloorCard } from '@/components/FloorCard';
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

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head">
          <h3>Structure</h3>
          <span className="card-note">
            What kind of deal this is — decide it first; everything below prices it
          </span>
        </div>
        <div className="card-body">
          <div className="structure-row">
            <div className="field">
              <label htmlFor="scenario-name">Scenario name</label>
              <input
                id="scenario-name"
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
                  }), { label: 'the scenario name', coalesce: `sc-name:${selectedDefinition.id}` })
                }
              />
            </div>
            <ScenarioEditor scenario={selectedDefinition} />
            {stressed.scenarios.length > 1 && (
              <button className="ghost tiny" onClick={() => remove(selectedDefinition.id)}>
                Delete scenario
              </button>
            )}
          </div>
        </div>
      </div>

      <PricingDesk />

      <FloorCard />

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head">
          <h3>Levers</h3>
          <span className="card-note">
            {stressActive
              ? 'Stress applied — every figure on this page reflects it'
              : 'What the team takes, and what happens if the deal goes badly'}
          </span>
        </div>
        <div className="card-body">
          <h4 className="lever-heading">Leave the team takes</h4>
          <LeaveDesk />
          <div className="sep" />
          <h4 className="lever-heading">If it goes badly</h4>
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

      <div className="card">
          <div className="card-head">
            <h3>Where this scenario stands</h3>
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
                <UpsideAbsent parts={selected.scenario.parts} />
              )}
            </div>

            {selected.scenario.parts.map((part) =>
              part.structure.cap != null ? (
                <CapBand
                  key={`cap-${part.label}`}
                  label={selected.scenario.isHybrid ? part.label : null}
                  cap={part.structure.cap}
                  before={part.structure.revenueBeforeCap ?? 0}
                  headroomPct={part.structure.capHeadroomPct}
                />
              ) : null,
            )}

            <div className="sep" />

            {selected.guardrails.map((status) => (
              <GuardrailRow key={status.guardrail.id} status={status} />
            ))}

            {/*
              The cap band above states the binding note in full, so it is dropped from
              this list rather than printed twice on one screen. The engine keeps it, so
              it still travels to the Excel export and into an issued pack.
            */}
            {(() => {
              const notes = selected.scenario.notes.filter((note) => !note.startsWith('The cap binds:'));
              return notes.length > 0 ? (
                <>
                  <div className="sep" />
                  <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
                    {notes.map((note) => (
                      <li key={note} style={{ marginBottom: 4 }}>
                        {note}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null;
            })()}

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
    </>
  );
}

/**
 * Why there is no upside figure — which is not the same reason every time.
 *
 * A T&M deal has no ceiling, so an upside cannot be written down. A capped one has the
 * tightest ceiling there is. Saying "no cap" on a capped deal was the app contradicting
 * itself two inches above a band explaining the cap.
 */
function UpsideAbsent({ parts }: { parts: { structure: { cap: number | null; label: string } }[] }) {
  const cap = parts.find((part) => part.structure.cap != null)?.structure.cap ?? null;
  return (
    <div className="stat">
      <div className="label">Upside</div>
      <div className="value sm" style={{ color: 'var(--ink-400)' }}>
        {cap == null ? 'Unbounded' : 'None'}
      </div>
      <div className="foot">
        {cap == null
          ? 'No ceiling — cannot be shown as a figure'
          : `Billing stops at the ${formatMoney(cap)} cap`}
      </div>
    </div>
  );
}

/**
 * Where a capped T&M deal actually stands against its cap.
 *
 * A binding cap was previously invisible: revenue was silently clipped and nothing on
 * screen said so. The number that matters is not the percentage — it is how much
 * delivery goes unpaid, because that is the concession being made.
 */
function CapBand({
  label,
  cap,
  before,
  headroomPct,
}: {
  label: string | null;
  cap: number;
  before: number;
  headroomPct: number | null;
}) {
  const binds = before >= cap;
  const gap = Math.abs(before - cap);

  return (
    <div className={`cap-band${binds ? ' binds' : ''}`}>
      <span className={`badge ${binds ? 'breach' : 'good'}`}>
        <span className="dot" />
        {binds ? 'Cap binds' : 'Within cap'}
      </span>
      <span className="small">
        {label && <strong>{label}: </strong>}
        {binds ? (
          <>
            The plan bills <strong>{formatMoney(before)}</strong> at the agreed rates against a
            cap of <strong>{formatMoney(cap)}</strong> — <strong>{formatMoney(gap)}</strong> of
            delivery goes unpaid. This is a fixed price wearing a T&amp;M label.
          </>
        ) : (
          <>
            The plan bills <strong>{formatMoney(before)}</strong> against a cap of{' '}
            <strong>{formatMoney(cap)}</strong>, leaving <strong>{formatMoney(gap)}</strong> of
            headroom{headroomPct == null ? '' : ` (${formatPct(headroomPct, 0)})`} before the
            client stops paying for time.
          </>
        )}
      </span>
    </div>
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
