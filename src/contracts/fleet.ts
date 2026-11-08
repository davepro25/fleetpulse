// Trucks: REST /api/fleet*, alerts, and the fleet_reset event.

export type TruckStatus = 'active' | 'idle' | 'maintenance';

export interface LatLng {
  lat: number;
  lng: number;
}

/** GET /api/fleet item. No mileage, no lastUpdate. `_version` bumps every sim tick: not a lock. */
export interface FleetTruck {
  id: string;
  name: string;
  status: TruckStatus;
  location: LatLng;
  speed: number;
  heading: number;
  fuel: number;
  engineTemp: number;
  currentRouteId: string | null;
  _version: number;
}

export interface FleetSnapshot { fleet: FleetTruck[]; timestamp: number }

/** GET /api/fleet/:truckId: the only source of mileage. */
export interface TruckDetail extends FleetTruck {
  mileage: number;
  lastUpdate: number;
}

/** POST /api/fleet/:truckId/alert response and the truck_alert event payload. */
export interface TruckAlert {
  id: string;
  truckId: string;
  message: string;
  severity: string;
  /** Undefined when the request had no X-Dispatcher-Id (the endpoint does not require it). */
  sentBy?: string;
  timestamp: number;
  acknowledged: boolean;
}

export interface SendAlertRequest { message: string; severity: string }

/** Reaches everyone. */
export interface WsTruckAlert { type: 'truck_alert'; alert: TruckAlert }
/** Server state was reset: route ids restart at route_1, positions and versions re-randomised. */
export interface WsFleetReset { type: 'fleet_reset'; timestamp: number }
