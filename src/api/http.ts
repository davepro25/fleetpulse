import ky from 'ky';
import type { z } from 'zod';

// The only retry layer for REST: TanStack retries are off (queryClient.ts).
const api = ky.create({
  retry: {
    limit: 3,
    methods: ['get'], // a retried PUT/PATCH could apply twice
    statusCodes: [502, 503, 504], // 503 is quirk 7; the proxy answers 502/504 while server.js is down
    afterStatusCodes: [503], // ky waits for Retry-After on these
    maxRetryAfter: 30_000,
  },
});

export async function getJson<S extends z.ZodType>(
  path: string,
  schema: S,
  signal?: AbortSignal,
): Promise<z.output<S>> {
  const body = await api.get(path, { signal }).json();
  return schema.parse(body);
}

export interface SendOptions {
  dispatcherId: string;
  body?: unknown;
  /** Route _version. Sent as a bare integer because the server parseInt()s it. */
  ifMatch?: number;
}

/** Throws ky's HTTPError on non-2xx; the parsed error body (e.g. a 409) is in `error.data`. */
export async function sendJson<S extends z.ZodType>(
  method: 'post' | 'patch' | 'put',
  path: string,
  { dispatcherId, body = {}, ifMatch }: SendOptions,
  schema: S,
): Promise<z.output<S>> {
  const headers: Record<string, string> = { 'X-Dispatcher-Id': dispatcherId };
  if (ifMatch !== undefined) headers['If-Match'] = String(ifMatch);

  const data = await api(path, { method, headers, json: body }).json();
  return schema.parse(data);
}
