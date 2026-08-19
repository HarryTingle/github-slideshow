'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildWorkbookPlan, describeWorkbook, downloadWorkbook, downloadsAreBlocked } from '@/lib/export';
import { useModel } from '@/lib/store';

/**
 * Export to Excel.
 *
 * The workbook carries formulas rather than frozen totals, because a colleague or a
 * client checking our arithmetic is the point of exporting at all. A workbook of values
 * is a screenshot with extra steps.
 */
export function ExportButton() {
  const { stressed, analysis, selectedScenarioId } = useModel();
  const [state, setState] = useState<'idle' | 'working' | 'failed'>('idle');
  // Checked after mount: the server has no window, and the answer must not differ
  // between the server and client render.
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => setEmbedded(downloadsAreBlocked()), []);

  const plan = useMemo(
    () => buildWorkbookPlan(stressed, analysis, selectedScenarioId),
    [stressed, analysis, selectedScenarioId],
  );

  const save = async () => {
    setState('working');
    try {
      await downloadWorkbook(stressed, analysis, selectedScenarioId);
      setState('idle');
    } catch {
      setState('failed');
    }
  };

  return (
    <div className="row gap-16 wrap" style={{ alignItems: 'flex-start' }}>
      {/*
        No button when the page cannot save a file. An embedded frame is not allowed to
        hand over a spreadsheet, and a control that does nothing when pressed is worse
        than one that is honestly absent.
      */}
      {!embedded && (
        <button className="primary" onClick={save} disabled={state === 'working'}>
          {state === 'working' ? 'Building…' : 'Export to Excel'}
        </button>
      )}
      <div className="stack" style={{ gap: 4, flex: 1, minWidth: 260 }}>
        <span className="tiny muted">{describeWorkbook(plan)}</span>
        {embedded && (
          <span className="tiny" style={{ color: 'var(--terracotta-700)' }}>
            This preview runs in an embedded frame, which cannot hand over a spreadsheet.
            Run the app locally and the workbook downloads from here.
          </span>
        )}
        {state === 'failed' && (
          <span className="tiny" style={{ color: 'var(--terracotta-700)' }}>
            The workbook could not be saved. Check the browser is not blocking downloads.
          </span>
        )}
      </div>
    </div>
  );
}
