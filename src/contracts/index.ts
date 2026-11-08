// Wire contracts for every payload server.js sends or accepts, split by domain.
// Derived from server.js and confirmed against src/test/fixtures. Types only: runtime checks
// live in src/transport/guards.ts. Domain files import each other directly, never via this file.
export type * from './fleet';
export type * from './telemetry';
export type * from './routes';
export type * from './presence';
export type * from './ws';
