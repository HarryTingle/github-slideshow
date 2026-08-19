'use client';

import { useEffect } from 'react';
import { useModel } from '@/lib/store';

/**
 * Undo and redo, in the top bar and on the keyboard.
 *
 * The grid and the pricing desk are both destructive surfaces — a stray keystroke
 * changes a plan, and the target-margin solve rewrites every rate at once. Reset was the
 * only way back, and reset throws away the afternoon along with the mistake.
 */
export function UndoControls() {
  const { undo, redo, undoLabel, redoLabel } = useModel();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      // Handled here even inside a field. Every input on these screens is controlled, so
      // the browser's own undo would fight the model rather than help — and because a run
      // of keystrokes in one field is a single step, this is what the user meant anyway.
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  if (!undoLabel && !redoLabel) return null;

  return (
    <span className="undo-controls">
      <button
        className="ghost tiny"
        disabled={!undoLabel}
        onClick={undo}
        title={undoLabel ? `Undo ${undoLabel}` : 'Nothing to undo'}
      >
        ↶ Undo{undoLabel ? ` ${undoLabel}` : ''}
      </button>
      <button
        className="ghost tiny"
        disabled={!redoLabel}
        onClick={redo}
        title={redoLabel ? `Redo ${redoLabel}` : 'Nothing to redo'}
      >
        ↷
      </button>
    </span>
  );
}
