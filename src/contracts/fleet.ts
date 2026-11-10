import { z } from 'zod';

export const TruckStatusSchema = z.enum(['active', 'idle', 'maintenance']);
export type TruckStatus = z.infer<typeof TruckStatusSchema>;

export const LatLngSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});
export type LatLng = z.infer<typeof LatLngSchema>;

export const FleetTruckSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: TruckStatusSchema,
  location: LatLngSchema,
  speed: z.number(),
  heading: z.number(),
  fuel: z.number(),
  engineTemp: z.number(),
  currentRouteId: z.string().nullable(),
  // Bumps on every simulation tick, so it can't be used for locking (route _version is).
  _version: z.number(),
});
export type FleetTruck = z.infer<typeof FleetTruckSchema>;

export const FleetSnapshotSchema = z.object({
  fleet: z.array(FleetTruckSchema),
  timestamp: z.number(),
});
export type FleetSnapshot = z.infer<typeof FleetSnapshotSchema>;

export const TruckDetailSchema = FleetTruckSchema.extend({
  mileage: z.number(),
  lastUpdate: z.number(),
});
export type TruckDetail = z.infer<typeof TruckDetailSchema>;

export const TruckAlertSchema = z.object({
  id: z.string(),
  truckId: z.string(),
  message: z.string(),
  severity: z.string(),
  sentBy: z.string().optional(),
  timestamp: z.number(),
  acknowledged: z.boolean(),
});
export type TruckAlert = z.infer<typeof TruckAlertSchema>;

export interface SendAlertRequest {
  message: string;
  severity: string;
}

export const WsTruckAlertSchema = z.object({
  type: z.literal('truck_alert'),
  alert: TruckAlertSchema,
});

export const WsFleetResetSchema = z.object({
  type: z.literal('fleet_reset'),
  timestamp: z.number(),
});
