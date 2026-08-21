'use client';

import { ConfirmButton } from './ConfirmButton';
import { useModel } from '@/lib/store';

/**
 * Starting over, two ways.
 *
 * "New" is the one a Head of Consulting actually reaches for — a real engagement begins
 * with a blank sheet, and until this existed the app could only ever show one model.
 * "Sample" puts the demonstration engagement back, which is what you want when you have
 * been experimenting and would like the worked example again.
 *
 * Both discard the current model, so both ask twice. Neither is undoable: undo is for
 * taking back a keystroke, not for resurrecting a document you chose to abandon.
 */
export function StartControls() {
  const { startBlank, reset, isDirty } = useModel();
  return (
    <span className="start-controls">
      <ConfirmButton
        className="ghost tiny"
        label="New"
        confirmLabel="Discard this and start fresh?"
        title="Start a new engagement from a blank plan"
        onConfirm={startBlank}
      />
      {isDirty && (
        <ConfirmButton
          className="ghost tiny"
          label="Sample"
          confirmLabel="Discard and load the sample?"
          title="Reload the sample engagement"
          onConfirm={reset}
        />
      )}
    </span>
  );
}
