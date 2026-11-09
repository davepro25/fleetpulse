import { useId, type ReactNode } from 'react';

interface Props {
  title: string;
  children: ReactNode;
  /** Re-computed on every render from live data: the action can become invalid while open. */
  disabledReason: string | null;
  onConfirm(): void;
  onCancel(): void;
}

// Not window.confirm: that blocks the page, so the dialog couldn't react to a WS update.
export function ConfirmDialog({ title, children, disabledReason, onConfirm, onCancel }: Props) {
  const titleId = useId();

  return (
    <div className="dialog-backdrop" onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="dialog">
        <h3 id={titleId}>{title}</h3>
        <p>{children}</p>
        {disabledReason && (
          <p role="alert" className="warn">
            {disabledReason}
          </p>
        )}
        <div className="dialog-actions">
          <button onClick={onCancel}>Cancel</button>
          <button onClick={onConfirm} disabled={disabledReason !== null} autoFocus>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
