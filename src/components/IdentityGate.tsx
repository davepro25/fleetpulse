import { useState, type FormEvent, type ReactNode } from 'react';
import {
  clearIdentity,
  createIdentity,
  loadIdentity,
  validateName,
  type Identity,
} from '../utils/identity';
import { Button, Field, inputClass } from './ui';

export function IdentityGate({
  children,
}: {
  children: (identity: Identity, signOut: () => void) => ReactNode;
}) {
  const [identity, setIdentity] = useState<Identity | null>(() => loadIdentity());
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  const signOut = () => {
    clearIdentity();
    setName('');
    setIdentity(null);
  };

  if (identity) return children(identity, signOut);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateName(name);
    if (result.ok) setIdentity(createIdentity(result.name));
    else setError(result.error);
  };

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <form
        onSubmit={submit}
        noValidate
        className="grid w-full max-w-sm gap-4 rounded-lg bg-white p-6 shadow-sm ring-1 ring-slate-200"
      >
        <div>
          <h1 className="text-xl font-semibold text-slate-900">FleetPulse</h1>
          <p className="text-sm text-slate-500">Enter your name to start dispatching.</p>
        </div>
        <Field label="Dispatcher name" error={error}>
          <input
            className={inputClass}
            value={name}
            maxLength={24}
            autoFocus
            aria-invalid={error !== undefined}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Button type="submit" variant="primary">
          Start
        </Button>
      </form>
    </main>
  );
}
