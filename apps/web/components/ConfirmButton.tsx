'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A destructive action that asks once.
 *
 * Two clicks rather than a browser dialog: `window.confirm` is blocked in a sandboxed
 * frame, and there is no undo in this app yet, so deleting a phase with nine people on
 * it should take more than a stray click.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className = 'row-x',
  title,
}: {
  label: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
  title?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const arm = () => {
    setArmed(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setArmed(false), 4000);
  };

  return (
    <button
      className={armed ? 'confirm-armed' : className}
      title={armed ? undefined : title}
      onBlur={() => setArmed(false)}
      onClick={() => {
        if (!armed) return arm();
        setArmed(false);
        onConfirm();
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
