// One place for cache keys, so invalidation (live.ts) and cache writes can't drift from the queries.
export const QUERY_KEYS = {
  fleet: ['fleet'],
  routes: ['routes'],
} as const;
