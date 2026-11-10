import ky from 'ky';

// The only retry layer for REST: TanStack retries are off (queryClient.ts).
export const api = ky.create({
  retry: {
    limit: 3,
    methods: ['get'], // a retried PUT/PATCH could apply twice
    statusCodes: [502, 503, 504], // 503 is quirk 7; the proxy answers 502/504 while server.js is down
    afterStatusCodes: [503], // ky waits for Retry-After on these
    maxRetryAfter: 30_000,
  },
});
