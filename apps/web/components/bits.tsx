'use client';

import { formatMoney, formatPct, meridian, type Finding, type GuardrailStatus } from '@scope/engine';
import { useModel } from '@/lib/store';

export function Stat({
  label,
  value,
  foot,
  tone = 'neutral',
  small,
}: {
  label: string;
  value: string;
  foot?: React.ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'breach';
  small?: boolean;
}) {
  const colour =
    tone === 'good'
      ? 'var(--status-good)'
      : tone === 'warn'
        ? 'var(--status-warn)'
        : tone === 'breach'
          ? 'var(--status-breach)'
          : 'var(--ink-900)';
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className={`value${small ? ' sm' : ''}`} style={{ color: colour }}>
        {value}
      </div>
      {foot && <div className="foot">{foot}</div>}
    </div>
  );
}

export function GuardrailRow({ status }: { status: GuardrailStatus }) {
  return (
    <div className="row gap-10" style={{ padding: '8px 0', alignItems: 'flex-start' }}>
      <span className={`badge ${status.breached ? 'breach' : 'good'}`} style={{ marginTop: 1 }}>
        <span className="dot" />
        {status.breached ? 'Breach' : 'Pass'}
      </span>
      <span className="small" style={{ color: status.breached ? 'var(--ink-800)' : 'var(--ink-500)' }}>
        {status.explanation}
      </span>
    </div>
  );
}

export function Findings({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) {
    return <div className="empty">Nothing to flag. The model is internally consistent.</div>;
  }
  const order = { error: 0, warning: 1, info: 2 } as const;
  const sorted = [...findings].sort((a, b) => order[a.severity] - order[b.severity]);
  return (
    <div>
      {sorted.map((finding) => (
        <div className={`finding ${finding.severity}`} key={finding.id}>
          <span className="icon" aria-hidden>
            {finding.severity === 'error' ? '!' : finding.severity === 'warning' ? '▲' : 'i'}
          </span>
          <span className="small">
            <span className="sr-only">{finding.severity}: </span>
            {finding.message}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * The provenance marker. Present wherever numbers are, on purpose.
 *
 * Deliberately specific rather than a general "demo data" note: the rate card is real
 * on both sides now, so margin percentages are real for a given plan. The plan is not,
 * so the absolute figures are not either.
 */
export function FictionPill() {
  const { engagement } = useModel();
  // The marker has to track what is actually on screen. Once somebody starts their own
  // engagement, calling it fictional is simply false — and a provenance marker that
  // lies about provenance is worse than none, because it is the thing people rely on to
  // know whether a figure can be quoted.
  const sample = engagement.id === meridian.id;

  return (
    <span
      className={`pill-fiction${sample ? '' : ' own'}`}
      title={
        sample
          ? 'Charge and cost rates are the practice’s real card, and annual leave is the ' +
            'real 23-day allowance. Margin percentages are therefore real for a given ' +
            'plan. The engagement is invented — Meridian Retail Group, the team, the ' +
            'client rate card, the contract values and the guardrail thresholds are all ' +
            'made up, so no absolute figure here may be quoted.'
          : 'The grade ladder, capabilities, charge and cost rates and the 23-day leave ' +
            'allowance are the practice’s real reference data. The plan and the ' +
            'commercials are yours. Guardrail thresholds are still placeholders — see ' +
            'REVIEW Q5.'
      }
    >
      {sample ? 'Real rate card · sample engagement' : 'Real rate card · your engagement'}
    </span>
  );
}

export function MarginTone(pct: number | null, floor = 0.4): 'good' | 'warn' | 'breach' {
  if (pct == null) return 'warn';
  if (pct >= floor) return 'good';
  if (pct >= floor - 0.1) return 'warn';
  return 'breach';
}

export function Money({ value, decimals }: { value: number | null | undefined; decimals?: boolean }) {
  return <span className="mono-num">{formatMoney(value, { decimals })}</span>;
}

export function Pct({ value, decimals = 1 }: { value: number | null | undefined; decimals?: number }) {
  return <span className="mono-num">{formatPct(value, decimals)}</span>;
}
