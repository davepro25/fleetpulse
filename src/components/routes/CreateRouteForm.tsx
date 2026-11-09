import { useState, type FormEvent } from 'react';
import type { Route, TruckStatus } from '../../contracts';
import { useApp } from '../../context/AppContext';
import { assignableTruckIds } from '../../domain/routes/transitions';
import {
  PRIORITIES,
  validateRouteForm,
  type RouteFormErrors,
  type RouteFormInput,
} from '../../domain/routes/validation';
import { mutationErrorMessage, useCreateRoute } from '../../hooks/useRouteMutations';
import { TruckOption } from './TruckOption';

const EMPTY: RouteFormInput = { truckId: '', destination: '', priority: 'normal', notes: '' };

interface Props {
  routes: Route[];
  statuses: Record<string, TruckStatus>;
}

export function CreateRouteForm({ routes, statuses }: Props) {
  const { identity } = useApp();
  const create = useCreateRoute();
  const [input, setInput] = useState(EMPTY);
  const [errors, setErrors] = useState<RouteFormErrors>({});

  const assignable = assignableTruckIds(statuses, routes);
  const set = (field: keyof RouteFormInput, value: string) =>
    setInput((current) => ({ ...current, [field]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateRouteForm(input, assignable);
    setErrors(result.ok ? {} : result.errors);
    if (result.ok) create.mutate(result.value, { onSuccess: () => setInput(EMPTY) });
  };

  return (
    <form className="route-form" onSubmit={submit} noValidate>
      <label>
        Truck
        <select value={input.truckId} onChange={(e) => set('truckId', e.target.value)}>
          <option value="">Choose a free truck</option>
          {assignable.map((id) => (
            <TruckOption key={id} id={id} />
          ))}
        </select>
        {errors.truckId && <span className="field-error">{errors.truckId}</span>}
      </label>
      <label>
        Destination
        <input
          value={input.destination}
          maxLength={120}
          onChange={(e) => set('destination', e.target.value)}
        />
        {errors.destination && <span className="field-error">{errors.destination}</span>}
      </label>
      <label>
        Priority
        <select value={input.priority} onChange={(e) => set('priority', e.target.value)}>
          {PRIORITIES.map((priority) => (
            <option key={priority}>{priority}</option>
          ))}
        </select>
        {errors.priority && <span className="field-error">{errors.priority}</span>}
      </label>
      <label>
        Notes
        <input value={input.notes} maxLength={500} onChange={(e) => set('notes', e.target.value)} />
        {errors.notes && <span className="field-error">{errors.notes}</span>}
      </label>
      <button type="submit" disabled={create.isPending}>
        {create.isPending ? 'Assigning…' : 'Assign route'}
      </button>
      {create.isError && (
        <p role="alert" className="warn">
          {mutationErrorMessage(create.error, identity.id)}
        </p>
      )}
    </form>
  );
}
