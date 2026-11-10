export const QUERY_KEYS = {
  fleet: ['fleet'],
  routes: ['routes'],
  truck: (truckId: string) => ['truck', truckId],
  history: (truckId: string) => ['history', truckId],
} as const;
