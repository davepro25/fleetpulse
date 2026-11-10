import { HTTPError } from 'ky';
import { displayName } from '../utils/identity';
import { RouteConflictError } from './routes';

export function mutationErrorMessage(error: unknown, selfId: string): string {
  if (error instanceof RouteConflictError) {
    const { route, actor } = error.owner;
    if (!route || !actor)
      return 'Not applied: the route changed meanwhile. The list is now up to date.';
    const who = actor.dispatcherId === selfId ? 'you' : displayName(actor.dispatcherId);
    const when = new Date(actor.at).toLocaleTimeString();
    return `Not applied: ${route.id} was ${actor.action} by ${who} at ${when}. The list is now up to date.`;
  }
  if (error instanceof HTTPError) {
    const body = error.data as { error?: unknown } | undefined;
    return `Not applied: ${typeof body?.error === 'string' ? body.error : `server error ${error.response.status}`}.`;
  }
  return 'Not applied: no connection to the server. Try again.';
}
