import { useId, type ReactNode } from 'react';
import { Alert, Button } from './ui';

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
    <div
      className="fixed inset-0 z-[2000] grid place-items-center bg-slate-900/40 p-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="grid w-full max-w-sm gap-3 rounded-lg bg-white p-5 shadow-xl"
      >
        <h3 id={titleId} className="text-base font-semibold text-slate-900">
          {title}
        </h3>
        <p className="text-sm text-slate-700">{children}</p>
        {disabledReason && <Alert tone="amber">{disabledReason}</Alert>}
        <div className="flex justify-end gap-2">
          {/* Focus starts on Cancel: the safe choice for an action that changes a route. */}
          <Button onClick={onCancel} autoFocus>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={disabledReason !== null}>
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}
