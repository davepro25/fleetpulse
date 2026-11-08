import { HTTPError } from 'ky';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendJson } from '../src/api/http';
import { RouteSchema } from '../src/contracts';
import { fleetQueryOptions } from '../src/queries/fleet';
import { createQueryClient } from '../src/queryClient';
import rest from './fixtures/rest.json';

const fetchMock = vi.fn<(request: Request) => Promise<Response>>();

const reply = (captured: { status: number; headers: Record<string, string>; body: unknown }) =>
  new Response(JSON.stringify(captured.body), {
    status: captured.status,
    headers: captured.headers,
  });

// Node's Request needs absolute URLs; in the browser "/api/..." resolves against the page.
class PageRequest extends Request {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(typeof input === 'string' ? new URL(input, 'http://localhost') : input, init);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('Request', PageRequest);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe('http', () => {
  it('waits exactly Retry-After (3 s) after a 503 before retrying', async () => {
    fetchMock
      .mockResolvedValueOnce(reply(rest.fleet503))
      .mockResolvedValueOnce(reply(rest.fleet200));

    const result = createQueryClient().fetchQuery(fleetQueryOptions);
    await vi.advanceTimersByTimeAsync(2_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await expect(result).resolves.toEqual(rest.fleet200.body);
  });

  it('gives up after 3 retries and keeps the last good snapshot', async () => {
    const client = createQueryClient();
    fetchMock.mockResolvedValueOnce(reply(rest.fleet200));
    await client.fetchQuery(fleetQueryOptions);

    fetchMock.mockImplementation(async () => reply(rest.fleet503));
    const refetch = client.fetchQuery({ ...fleetQueryOptions, staleTime: 0 });
    const outcome = expect(refetch).rejects.toBeInstanceOf(HTTPError);
    await vi.advanceTimersByTimeAsync(3 * 3_000);
    await outcome;

    expect(fetchMock).toHaveBeenCalledTimes(1 + 4);
    expect(client.getQueryData(fleetQueryOptions.queryKey)).toEqual(rest.fleet200.body);
  });

  it('never retries a mutation, even on 503', async () => {
    fetchMock.mockImplementation(async () => reply(rest.fleet503));

    const call = sendJson(
      'put',
      '/api/routes/route_1/reassign',
      { dispatcherId: 'Dana~aaaa1111', body: { newTruckId: 'truck_4' } },
      RouteSchema,
    );
    const outcome = expect(call).rejects.toBeInstanceOf(HTTPError);
    await vi.advanceTimersByTimeAsync(30_000);
    await outcome;

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends X-Dispatcher-Id and If-Match as a bare integer', async () => {
    fetchMock.mockResolvedValueOnce(reply(rest.patch200));

    await sendJson(
      'patch',
      '/api/routes/route_1',
      { dispatcherId: 'Dana~aaaa1111', ifMatch: 2, body: { status: 'in-progress' } },
      RouteSchema,
    );

    const request = fetchMock.mock.calls[0]![0];
    expect(request.headers.get('X-Dispatcher-Id')).toBe('Dana~aaaa1111');
    expect(request.headers.get('If-Match')).toBe('2');
  });
});
