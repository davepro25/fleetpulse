import type { CreateRouteRequest } from '../../contracts';

export const PRIORITIES = ['low', 'normal', 'high'] as const;

const DESTINATION_MAX = 120;
const NOTES_MAX = 500;

export interface RouteFormInput {
  truckId: string;
  destination: string;
  priority: string;
  notes: string;
}

export type RouteFormErrors = Partial<Record<keyof RouteFormInput, string>>;

export type RouteFormResult =
  { ok: true; value: Required<CreateRouteRequest> } | { ok: false; errors: RouteFormErrors };

export function validateRouteForm(input: RouteFormInput, assignableIds: string[]): RouteFormResult {
  const destination = input.destination.trim();
  const notes = input.notes.trim();
  const errors: RouteFormErrors = {};

  if (!assignableIds.includes(input.truckId)) errors.truckId = 'Pick a truck that is free';
  if (!destination) errors.destination = 'Destination is required';
  else if (destination.length > DESTINATION_MAX)
    errors.destination = `At most ${DESTINATION_MAX} characters`;
  if (!(PRIORITIES as readonly string[]).includes(input.priority))
    errors.priority = 'Pick a priority';
  if (notes.length > NOTES_MAX) errors.notes = `At most ${NOTES_MAX} characters`;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { truckId: input.truckId, destination, priority: input.priority, notes },
  };
}
