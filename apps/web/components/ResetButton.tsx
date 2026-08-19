'use client';

import { useModel } from '@/lib/store';

/** Only appears once the model has been edited. */
export function ResetButton() {
  const { isDirty, reset } = useModel();
  if (!isDirty) return null;
  return (
    <button className="ghost tiny" onClick={reset} title="Discard every edit and reload the original engagement">
      Reset model
    </button>
  );
}
