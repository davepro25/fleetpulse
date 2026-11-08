import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // ky already retries GETs; two layers would multiply the attempts
        staleTime: Infinity, // refetched explicitly (reconnect, reset), never on a timer
      },
    },
  });
}
