'use client';

import { useMemo, useState } from 'react';
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
  const [state, setState] = useState<'idle' | 'working' | 'blocked' | 'failed'>('idle');

  const plan = useMemo(
    () => buildWorkbookPlan(stressed, analysis, selectedScenarioId),
    [stressed, analysis, selectedScenarioId],
  );

  const save = async () => {
    if (downloadsAreBlocked()) return setState('blocked');
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
      <button className="primary" onClick={save} disabled={state === 'working'}>
        {state === 'working' ? 'Building…' : 'Export to Excel'}
      </button>
      <div className="stack" style={{ gap: 4, flex: 1, minWidth: 260 }}>
        <span className="tiny muted">{describeWorkbook(plan)}</span>
        {state === 'blocked' && (
          <span className="tiny" style={{ color: 'var(--terracotta-700)' }}>
            This preview runs in an embedded frame, which blocks a page from saving files.
            Run the app locally to download the workbook.
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
