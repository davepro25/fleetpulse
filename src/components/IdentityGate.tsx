import { useState, type FormEvent, type ReactNode } from 'react';
import { createIdentity, loadIdentity, validateName, type Identity } from '../utils/identity';

export function IdentityGate({ children }: { children: (identity: Identity) => ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null>(() => loadIdentity());
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (identity) return children(identity);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateName(name);
    if (result.ok) setIdentity(createIdentity(result.name));
    else setError(result.error);
  };

  return (
    <form className="identity-gate" onSubmit={submit}>
      <h1>FleetPulse</h1>
      <label htmlFor="dispatcher-name">Your dispatcher name</label>
      <input
        id="dispatcher-name"
        value={name}
        maxLength={24}
        autoFocus
        onChange={(e) => setName(e.target.value)}
        aria-invalid={error !== null}
        aria-describedby="dispatcher-name-error"
      />
      {error && (
        <p id="dispatcher-name-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit">Start</button>
    </form>
  );
}
