'use client';

import { formatMoney, pounds, type CommercialStructure, type Engagement, type Scenario } from '@scope/engine';
import { useModel } from '@/lib/store';

const STRUCTURE_LABELS: Record<CommercialStructure['type'], string> = {
  tm: 'Time & materials',
  cappedTm: 'Capped T&M',
  fixedPrice: 'Fixed price',
  milestone: 'Milestone-based',
  retainer: 'Retainer / pod',
  outcomeShare: 'Outcome share',
};

function defaultStructure(type: CommercialStructure['type'], rateCardId?: string): CommercialStructure {
  switch (type) {
    case 'tm':
      return { type: 'tm', rateCardId };
    case 'cappedTm':
      return { type: 'cappedTm', rateCardId, cap: pounds(250000) };
    case 'fixedPrice':
      return { type: 'fixedPrice', contractValue: pounds(230000), contingencyPct: 0.15 };
    case 'milestone':
      return { type: 'milestone', contractValue: pounds(230000), contingencyPct: 0.15, payments: [] };
    case 'retainer':
      return { type: 'retainer', monthlyValue: pounds(60000), months: 4 };
    case 'outcomeShare':
      return {
        type: 'outcomeShare',
        baseFee: pounds(185000),
        shape: 'benefitPct',
        sharePercent: 0.1,
        expectedBenefit: pounds(600000),
        cap: pounds(280000),
        contingencyPct: 0.15,
      };
  }
}

function MoneyField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  hint?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="number"
        step={1000}
        value={Math.round(value / 100)}
        onChange={(event) => onChange(pounds(Number.parseFloat(event.target.value) || 0))}
      />
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

function PctField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  hint?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="number"
        step={1}
        value={Math.round(value * 1000) / 10}
        onChange={(event) => onChange((Number.parseFloat(event.target.value) || 0) / 100)}
      />
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function ScenarioEditor({ scenario }: { scenario: Scenario }) {
  const { update, stressed } = useModel();

  const setStructure = (next: CommercialStructure) =>
    update((draft: Engagement) => ({
      ...draft,
      scenarios: draft.scenarios.map((candidate) =>
        candidate.id === scenario.id ? { ...candidate, structure: next } : candidate,
      ),
    }));

  const structure = scenario.structure;
  const rateCardId = 'rateCardId' in structure ? structure.rateCardId : undefined;

  return (
    <div className="stack gap-16">
      <div className="field">
        <label>Structure</label>
        <select
          value={structure.type}
          onChange={(event) =>
            setStructure(defaultStructure(event.target.value as CommercialStructure['type'], rateCardId ?? stressed.rateCards[0]?.id))
          }
        >
          {Object.entries(STRUCTURE_LABELS).map(([type, label]) => (
            <option key={type} value={type}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {(structure.type === 'tm' || structure.type === 'cappedTm') && (
        <div className="field">
          <label>Rate card</label>
          <select
            value={structure.rateCardId ?? ''}
            onChange={(event) =>
              setStructure({ ...structure, rateCardId: event.target.value || undefined })
            }
          >
            <option value="">Standard rates</option>
            {stressed.rateCards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {structure.type === 'cappedTm' && (
        <MoneyField
          label="Cap (£)"
          value={structure.cap}
          onChange={(cap) => setStructure({ ...structure, cap })}
          hint="A cap at or below planned revenue is a fixed price with extra steps."
        />
      )}

      {structure.type === 'fixedPrice' && (
        <>
          <MoneyField
            label="Contract value (£)"
            value={structure.contractValue}
            onChange={(contractValue) => setStructure({ ...structure, contractValue })}
          />
          <PctField
            label="Contingency (%)"
            value={structure.contingencyPct}
            onChange={(contingencyPct) => setStructure({ ...structure, contingencyPct })}
            hint="Applied to cost, not added to price."
          />
        </>
      )}

      {structure.type === 'milestone' && (
        <>
          <MoneyField
            label="Contract value (£)"
            value={structure.contractValue}
            onChange={(contractValue) => setStructure({ ...structure, contractValue })}
          />
          <div className="field">
            <label>Payments</label>
            {stressed.milestones.map((milestone) => {
              const payment = structure.payments.find((entry) => entry.milestoneId === milestone.id);
              return (
                <div className="row gap-10" key={milestone.id} style={{ marginBottom: 6 }}>
                  <span className="small" style={{ flex: 1 }}>
                    {milestone.name} <span className="muted tiny">wk {milestone.week}</span>
                  </span>
                  <input
                    type="number"
                    step={1000}
                    style={{ width: 110 }}
                    value={Math.round((payment?.value ?? 0) / 100)}
                    onChange={(event) => {
                      const value = pounds(Number.parseFloat(event.target.value) || 0);
                      const others = structure.payments.filter((entry) => entry.milestoneId !== milestone.id);
                      setStructure({
                        ...structure,
                        payments: [...others, { milestoneId: milestone.id, value }],
                      });
                    }}
                  />
                </div>
              );
            })}
            <span className="hint">
              Allocated{' '}
              {formatMoney(structure.payments.reduce((sum, entry) => sum + entry.value, 0))} of{' '}
              {formatMoney(structure.contractValue)}
            </span>
          </div>
          <PctField
            label="Contingency (%)"
            value={structure.contingencyPct}
            onChange={(contingencyPct) => setStructure({ ...structure, contingencyPct })}
          />
        </>
      )}

      {structure.type === 'retainer' && (
        <>
          <MoneyField
            label="Monthly value (£)"
            value={structure.monthlyValue}
            onChange={(monthlyValue) => setStructure({ ...structure, monthlyValue })}
          />
          <div className="field">
            <label>Months</label>
            <input
              type="number"
              value={structure.months}
              onChange={(event) =>
                setStructure({ ...structure, months: Math.max(1, Number.parseInt(event.target.value, 10) || 1) })
              }
            />
          </div>
        </>
      )}

      {structure.type === 'outcomeShare' && (
        <>
          <MoneyField
            label="Base fee (£)"
            value={structure.baseFee}
            onChange={(baseFee) => setStructure({ ...structure, baseFee })}
            hint="This is the downside. Everything above it is contingent."
          />
          <div className="field">
            <label>Shape</label>
            <select
              value={structure.shape}
              onChange={(event) =>
                setStructure({ ...structure, shape: event.target.value as typeof structure.shape })
              }
            >
              <option value="benefitPct">Percentage of measured benefit</option>
              <option value="gainShare">Gain-share against a baseline</option>
              <option value="bonus">Bonus on outcome achievement</option>
            </select>
          </div>
          <PctField
            label="Share (%)"
            value={structure.sharePercent}
            onChange={(sharePercent) => setStructure({ ...structure, sharePercent })}
          />
          <MoneyField
            label="Expected benefit (£)"
            value={structure.expectedBenefit}
            onChange={(expectedBenefit) => setStructure({ ...structure, expectedBenefit })}
          />
          {structure.shape === 'gainShare' && (
            <MoneyField
              label="Baseline (£)"
              value={structure.baseline ?? 0}
              onChange={(baseline) => setStructure({ ...structure, baseline })}
            />
          )}
          <MoneyField
            label="Cap (£)"
            value={structure.cap ?? 0}
            onChange={(cap) => setStructure({ ...structure, cap: cap || undefined })}
            hint="Zero means uncapped — the upside becomes unbounded, not a number."
          />
          <PctField
            label="Contingency (%)"
            value={structure.contingencyPct}
            onChange={(contingencyPct) => setStructure({ ...structure, contingencyPct })}
          />
        </>
      )}

      {scenario.structureByPhase && Object.keys(scenario.structureByPhase).length > 0 && (
        <div className="trace-formula">
          <strong>Hybrid deal.</strong> The structure above applies to any phase without its own.
          {Object.entries(scenario.structureByPhase).map(([phaseId, phaseStructure]) => {
            const phase = stressed.phases.find((candidate) => candidate.id === phaseId);
            return (
              <div key={phaseId} className="tiny" style={{ marginTop: 4 }}>
                {phase?.name}: <code>{STRUCTURE_LABELS[phaseStructure.type]}</code>
                {phaseStructure.type === 'fixedPrice' && ` at ${formatMoney(phaseStructure.contractValue)}`}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
