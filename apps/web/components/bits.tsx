'use client';

import { formatMoney, formatPct, type Finding, type GuardrailStatus } from '@scope/engine';
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

/** The fictional-data disclaimer. Present wherever numbers are, on purpose. */
export function FictionPill() {
  const { isDirty } = useModel();
  return (
    <span className="pill-fiction" title="Meridian Retail Group is invented, as is the rate card behind it.">
      Fictional data{isDirty ? ' · edited' : ''}
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
