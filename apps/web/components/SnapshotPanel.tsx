'use client';

import {
  AUDIENCE_LABELS,
  diffSnapshot,
  formatDelta,
  formatFigure,
  verifySnapshot,
  type Audience,
  type Snapshot,
  type SnapshotDiff,
  type StructuralChange,
} from '@scope/engine';
import { useMemo, useState } from 'react';
import { ConfirmButton } from './ConfirmButton';
import { formatIssuedAt, SNAPSHOT_LIMIT, type SnapshotsValue } from '@/lib/snapshots';
import { useModel } from '@/lib/store';

/**
 * Issued packs.
 *
 * The point of the panel is the one line under each pack: what has changed in the
 * model since it was sent. Everything else — issuing, opening, deleting — is in
 * service of that line being trustworthy.
 */
export function SnapshotPanel({
  store,
  audience,
  openId,
  onOpen,
}: {
  store: SnapshotsValue;
  /** The Outputs view being looked at — the pack is issued as that audience. */
  audience: Audience;
  openId: string | null;
  onOpen: (id: string | null) => void;
}) {
  const { engagement, selectedScenarioId, analysis } = useModel();
  const { snapshots, hydrated, issue, remove, storageError } = store;
  const [issuedBy, setIssuedBy] = useState('');
  const [note, setNote] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Open by default: a pack that has fallen behind the model is exactly the thing you
  // need to be told about, and a collapsed list tells you nothing.
  const [listOpen, setListOpen] = useState(true);

  // Issuing always freezes the live model. While a pack is open the page is showing a
  // frozen one, so the control is held rather than quietly acting on something else.
  const frozen = openId !== null;

  const scenarioName =
    analysis.scenarios.find((entry) => entry.scenario.scenarioId === selectedScenarioId)?.scenario
      .name ?? 'the selected scenario';

  // One diff per pack against the model as it stands. Recomputed when either moves.
  const diffs = useMemo(() => {
    const map = new Map<string, SnapshotDiff>();
    for (const snapshot of snapshots) map.set(snapshot.id, diffSnapshot(snapshot, engagement));
    return map;
  }, [snapshots, engagement]);

  const moved = useMemo(
    () => [...diffs.values()].filter((diff) => !diff.unchanged).length,
    [diffs],
  );

  const onIssue = () => {
    const snapshot = issue(engagement, {
      scenarioId: selectedScenarioId,
      audience,
      issuedBy: issuedBy.trim() || 'Unattributed',
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    if (snapshot) {
      setNote('');
      setListOpen(true);
      setExpandedId(snapshot.id);
    }
  };

  return (
    <>
      <div className="issue-row">
        <div className="field">
          <label htmlFor="issued-by">Issued by</label>
          <input
            id="issued-by"
            type="text"
            value={issuedBy}
            placeholder="Your name"
            disabled={frozen}
            onChange={(event) => setIssuedBy(event.target.value)}
          />
        </div>
        <div className="field grow">
          <label htmlFor="issue-note">Note</label>
          <input
            id="issue-note"
            type="text"
            value={note}
            placeholder="Where it went, and why"
            disabled={frozen}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <button className="primary" onClick={onIssue} disabled={frozen}>
          Issue this pack
        </button>
      </div>

      <div className="stack" style={{ gap: 4, marginTop: 8 }}>
        <span className="tiny muted">
          {frozen ? (
            <>
              Close the pack you are reading to issue a new one — an issued pack always
              freezes the live model, never another pack.
            </>
          ) : (
            <>
              Freezes the model as it stands, as the{' '}
              <strong>{AUDIENCE_LABELS[audience]}</strong> view of{' '}
              <strong>{scenarioName}</strong>. Editing the model afterwards will not change it.
            </>
          )}
        </span>
        {storageError && (
          <span className="tiny" style={{ color: 'var(--terracotta-700)' }}>{storageError}</span>
        )}
      </div>

      {hydrated && snapshots.length > 0 && (
        <div className="issued">
          <button
            className="ghost issued-toggle"
            aria-expanded={listOpen}
            onClick={() => setListOpen(!listOpen)}
          >
            <span className="caret" aria-hidden>
              {listOpen ? '▾' : '▸'}
            </span>
            {snapshots.length} issued pack{snapshots.length === 1 ? '' : 's'}
            {moved > 0 && (
              <span className="badge warn" style={{ marginLeft: 8 }}>
                <span className="dot" />
                {moved} behind the model
              </span>
            )}
            <span className="tiny muted" style={{ marginLeft: 'auto' }}>
              {snapshots.length} of {SNAPSHOT_LIMIT} kept
            </span>
          </button>

          {listOpen && (
            <div className="snapshot-list">
              {snapshots.map((snapshot) => (
                <SnapshotRow
                  key={snapshot.id}
                  snapshot={snapshot}
                  diff={diffs.get(snapshot.id)!}
                  open={openId === snapshot.id}
                  expanded={expandedId === snapshot.id}
                  onToggleExpand={() =>
                    setExpandedId(expandedId === snapshot.id ? null : snapshot.id)
                  }
                  onOpen={() => onOpen(openId === snapshot.id ? null : snapshot.id)}
                  onDelete={() => {
                    if (openId === snapshot.id) onOpen(null);
                    remove(snapshot.id);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function SnapshotRow({
  snapshot,
  diff,
  open,
  expanded,
  onToggleExpand,
  onOpen,
  onDelete,
}: {
  snapshot: Snapshot;
  diff: SnapshotDiff;
  open: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  // Cheap, and it is the whole basis of trusting the pack — so it is always checked.
  const verification = useMemo(() => verifySnapshot(snapshot), [snapshot]);

  return (
    <div className={`snapshot${open ? ' open' : ''}`}>
      <div className="snapshot-head">
        <span className="snapshot-version">v{snapshot.version}</span>
        <div className="snapshot-id">
          <div className="small" style={{ color: 'var(--ink-900)' }}>
            {AUDIENCE_LABELS[snapshot.audience]} · {snapshot.scenarioName}
          </div>
          <div className="tiny muted">
            {formatIssuedAt(snapshot.issuedAt)} · {snapshot.issuedBy}
            {snapshot.note ? ` · “${snapshot.note}”` : ''}
          </div>
        </div>
        <span className={`badge ${diff.unchanged ? 'good' : 'warn'}`}>
          <span className="dot" />
          {diff.unchanged ? 'Current' : 'Model has moved'}
        </span>
        <div className="snapshot-actions">
          <button className="tiny" onClick={onOpen} aria-pressed={open}>
            {open ? 'Close' : 'Open'}
          </button>
          <button className="tiny ghost" onClick={onToggleExpand} aria-expanded={expanded}>
            {expanded ? 'Hide changes' : 'What changed'}
          </button>
          <ConfirmButton
            className="tiny ghost"
            label="Delete"
            confirmLabel="Delete pack?"
            onConfirm={onDelete}
          />
        </div>
      </div>

      <div className={`snapshot-headline${diff.unchanged ? ' quiet' : ''}`}>{diff.headline}</div>

      {!verification.agrees && (
        <div className="snapshot-warning">
          This pack’s stored figures no longer match what its own frozen model computes.
          The calculation changed after it was issued — {verification.differences.length} figure
          {verification.differences.length === 1 ? '' : 's'} affected, starting with{' '}
          {verification.differences[0]!.label.toLowerCase()}. The figures above are the ones that
          were issued.
        </div>
      )}

      {expanded && <SnapshotChanges diff={diff} />}
    </div>
  );
}

function SnapshotChanges({ diff }: { diff: SnapshotDiff }) {
  if (diff.unchanged) {
    return <div className="empty">Nothing has changed since this pack was issued.</div>;
  }

  return (
    <div className="snapshot-changes">
      {diff.figures.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Figure</th>
                <th className="num">As issued</th>
                <th className="num">Now</th>
                <th className="num">Movement</th>
              </tr>
            </thead>
            <tbody>
              {diff.figures.map((change) => (
                <tr key={change.key}>
                  <td>{change.label}</td>
                  <td className="num">{formatFigure(change.from, change.format)}</td>
                  <td className="num">{formatFigure(change.to, change.format)}</td>
                  <td
                    className="num"
                    style={{
                      color:
                        change.favourable == null
                          ? 'var(--ink-500)'
                          : change.favourable
                            ? 'var(--status-good)'
                            : 'var(--status-breach)',
                    }}
                  >
                    {formatDelta(change)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {diff.structural.length > 0 && (
        <div className="structural">
          <div className="tiny muted" style={{ marginBottom: 6 }}>
            Why — {diff.structural.length} change{diff.structural.length === 1 ? '' : 's'} to the
            plan
          </div>
          {diff.structural.map((change, index) => (
            <ChangeLine key={`${change.entity}-${change.label}-${index}`} change={change} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChangeLine({ change }: { change: StructuralChange }) {
  return (
    <div className="change-line">
      <span className={`change-kind ${change.kind}`}>
        {change.kind === 'added' ? '+' : change.kind === 'removed' ? '−' : '~'}
      </span>
      <span className="small">
        <strong style={{ fontWeight: 500, color: 'var(--ink-900)' }}>{change.label}</strong>{' '}
        <span className="muted">{change.detail}</span>
      </span>
    </div>
  );
}
