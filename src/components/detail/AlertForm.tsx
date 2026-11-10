import { useState, type FormEvent } from 'react';
import { useSession } from '../../context/SessionContext';
import { SEVERITIES, validateAlert, type AlertFormErrors } from '../../domain/alerts';
import { useSendAlert } from '../../mutations/alerts';
import { mutationErrorMessage } from '../../mutations/errorMessage';
import { Alert, Button, Field, inputClass } from '../ui';

export function AlertForm({ truckId }: { truckId: string }) {
  const { identity } = useSession();
  const send = useSendAlert(truckId);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<string>('info');
  const [errors, setErrors] = useState<AlertFormErrors>({});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateAlert({ message, severity });
    setErrors(result.ok ? {} : result.errors);
    if (result.ok) send.mutate(result.value, { onSuccess: () => setMessage('') });
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
        <Field label="Message to driver" error={errors.message}>
          <input
            className={inputClass}
            value={message}
            maxLength={200}
            placeholder="e.g. Check tyre pressure"
            onChange={(e) => setMessage(e.target.value)}
          />
        </Field>
        <Field label="Severity" error={errors.severity}>
          <select
            className={inputClass}
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            {SEVERITIES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
      </div>
      <div>
        <Button type="submit" variant="primary" disabled={send.isPending}>
          {send.isPending ? 'Sending…' : 'Send alert'}
        </Button>
      </div>
      {send.isError && <Alert>{mutationErrorMessage(send.error, identity.id)}</Alert>}
    </form>
  );
}
