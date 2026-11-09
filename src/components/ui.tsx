import type { ButtonHTMLAttributes, ReactNode } from 'react';

const BUTTON = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
  secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50',
  danger: 'bg-white text-red-700 ring-1 ring-inset ring-red-300 hover:bg-red-50',
} as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON };

export function Button({ variant = 'secondary', className = '', ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex cursor-pointer items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON[variant]} ${className}`}
    />
  );
}

export type Tone = 'neutral' | 'green' | 'blue' | 'amber' | 'red' | 'indigo';

const BADGE: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-300',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  blue: 'bg-sky-50 text-sky-800 ring-sky-200',
  amber: 'bg-amber-50 text-amber-900 ring-amber-200',
  red: 'bg-red-50 text-red-800 ring-red-200',
  indigo: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
};

const DOT: Record<Tone, string> = {
  neutral: 'bg-slate-400',
  green: 'bg-emerald-500',
  blue: 'bg-sky-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  indigo: 'bg-indigo-500',
};

/** Always text + colour, never colour alone. */
export function Badge({
  tone = 'neutral',
  dot = false,
  title,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${BADGE[tone]}`}
    >
      {dot && <span aria-hidden="true" className={`size-1.5 rounded-full ${DOT[tone]}`} />}
      {children}
    </span>
  );
}

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg bg-white ring-1 ring-slate-200">
      <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Alert({ tone = 'red', children }: { tone?: 'red' | 'amber'; children: ReactNode }) {
  const colors = tone === 'red' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900';
  return (
    <p role="alert" className={`rounded-md px-3 py-2 text-sm ${colors}`}>
      {children}
    </p>
  );
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {children}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-2 focus:outline-indigo-200 disabled:bg-slate-50';

export function Muted({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}
