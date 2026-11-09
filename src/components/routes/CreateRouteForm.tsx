import { useEffect, useState, type FormEvent } from 'react';
import type { Route, TruckStatus } from '../../contracts';
import { useSession } from '../../context/SessionContext';
import { assignableTruckIds } from '../../domain/routes/transitions';
import {
  PRIORITIES,
  validateRouteForm,
  type RouteFormErrors,
  type RouteFormInput,
} from '../../domain/routes/validation';
import { mutationErrorMessage, useCreateRoute } from '../../mutations/routes';
import { Alert, Button, Field, inputClass } from '../ui';
import { TruckOption } from './TruckOption';

const EMPTY: RouteFormInput = { truckId: '', destination: '', priority: 'normal', notes: '' };

interface Props {
  routes: Route[];
  statuses: Record<string, TruckStatus>;
  /** The truck selected on the map or list is offered first, if it is free. */
  selectedId: string | null;
}

export function CreateRouteForm({ routes, statuses, selectedId }: Props) {
  const { identity } = useSession();
  const create = useCreateRoute();
  const [input, setInput] = useState(EMPTY);
  const [errors, setErrors] = useState<RouteFormErrors>({});

  const assignable = assignableTruckIds(statuses, routes);
  const selectedIsFree = selectedId !== null && assignable.includes(selectedId);
  const set = (field: keyof RouteFormInput, value: string) =>
    setInput((current) => ({ ...current, [field]: value }));

  useEffect(() => {
    if (selectedIsFree) set('truckId', selectedId);
  }, [selectedId, selectedIsFree]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateRouteForm(input, assignable);
    setErrors(result.ok ? {} : result.errors);
    if (result.ok) create.mutate(result.value, { onSuccess: () => setInput(EMPTY) });
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-3 rounded-md bg-slate-50 p-3">
      <h3 className="text-sm font-medium text-slate-900">New route</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Truck" error={errors.truckId}>
          <select
            className={inputClass}
            value={input.truckId}
            onChange={(e) => set('truckId', e.target.value)}
          >
            <option value="">Choose a free truck</option>
            {assignable.map((id) => (
              <TruckOption key={id} id={id} />
            ))}
          </select>
        </Field>
        <Field label="Priority" error={errors.priority}>
          <select
            className={inputClass}
            value={input.priority}
            onChange={(e) => set('priority', e.target.value)}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Destination" error={errors.destination}>
        <input
          className={inputClass}
          value={input.destination}
          maxLength={120}
          placeholder="e.g. Dizengoff 50, Tel Aviv"
          onChange={(e) => set('destination', e.target.value)}
        />
      </Field>
      <Field label="Notes (optional)" error={errors.notes}>
        <input
          className={inputClass}
          value={input.notes}
          maxLength={500}
          onChange={(e) => set('notes', e.target.value)}
        />
      </Field>
      <p className="text-xs text-slate-500">
        Trucks in maintenance or already on a route are not offered.
      </p>
      <div>
        <Button type="submit" variant="primary" disabled={create.isPending}>
          {create.isPending ? 'Assigning…' : 'Assign route'}
        </Button>
      </div>
      {create.isError && <Alert>{mutationErrorMessage(create.error, identity.id)}</Alert>}
    </form>
  );
}
