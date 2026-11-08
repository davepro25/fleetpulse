# FleetPulse: real-time fleet dashboard

> Draft. Sections are completed stage by stage (see `docs/PLAN.md`); final version in Stage 8.

## Setup

Requires Node ≥ 20 and the latest Chrome.

```bash
npm install
npm start     # mock server on :3000 + Vite dev server on :5173 (open http://localhost:5173)
npm test      # typecheck + all tests
```

`server.js` is the assignment's mock server, unchanged. `.gitattributes` marks it `-text` so a Windows checkout never rewrites its line endings.
`npm run capture-fixtures` regenerates `tests/fixtures/*.json` from a fresh server instance.

## Architecture

API clients validate every inbound payload with zod and hand typed messages to one composition root
(`src/live.ts`). Telemetry goes through a pure TypeScript pipeline, with no React, into a Zustand store.
REST data lives in TanStack Query, and WebSocket route events are written into the same cache.
Components read through per-truck selectors.

```mermaid
flowchart LR
  SSE["/api/telemetry/stream"] --> sse[api/sse.ts]
  WSS["/ws"] --> ws[api/ws.ts]
  REST["/api/*"] --> http[api/http.ts]
  sse & ws & http --> schemas[contracts: zod]
  schemas --> live[live.ts]
  live --> pipe["domain/telemetry (pure)"] --> tstore[(telemetry store)]
  live --> pres["domain/presence.ts (pure)"] --> pstore[(presence store)]
  live --> rcache[queries/routes.ts] --> qc[(TanStack cache)]
  rcache --> audit[(audit store)]
  http --> qc
  tstore & pstore & qc & audit --> sel[selectors] --> ui[components]
  ui -- mutations --> http
  ui -- viewing_truck --> ws
```

| Folder            | Responsibility                                                            |
| ----------------- | ------------------------------------------------------------------------- |
| `src/api/`        | Talks to the server: REST (ky), SSE, WebSocket                            |
| `src/contracts/`  | zod schema + inferred type for every payload, one file per domain         |
| `src/domain/`     | Pure TypeScript, no React: telemetry pipeline, route rules, presence      |
| `src/stores/`     | Zustand stores for live data                                              |
| `src/queries/`    | TanStack Query options and cache updates                                  |
| `src/context/`    | `AppContext`: identity and socket (dependency injection only)             |
| `src/hooks/`      | Shared hooks                                                              |
| `src/components/` | React components, grouped by feature                                      |
| `src/utils/`      | Small helpers: backoff, JSON, dispatcher identity                         |
| `src/live.ts`     | Composition root: wires the API clients to stores and caches              |
| `tests/`          | All tests; `tests/fixtures/` holds payloads captured from the real server |

## Key decisions and trade-offs

| Decision                                       | Rejected alternative                        | Why                                                                                                                                |
| ---------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| TanStack Query for REST                        | hand-rolled fetch state                     | keeps last data on error, cache writable from WS events                                                                            |
| ky for HTTP (TanStack retry off)               | own fetch wrapper / axios / ofetch          | built-in retry that honours `Retry-After`, GET-only retries, parsed error body; axios has no retry, ofetch retries 409 by default  |
| Zustand + selectors for live data              | Context / TanStack for SSE                  | per-truck subscriptions; Context re-renders all consumers on every tick                                                            |
| Context only for DI (identity, socket)         | module singletons                           | explicit wiring, testable; values practically never change                                                                         |
| Pure reducer for telemetry                     | stateful class / RxJS                       | same input → same output; tested without React, DOM or timers                                                                      |
| zod schemas, types inferred                    | hand-written guards + separate types        | one definition per shape, so the runtime check and the type can't drift                                                            |
| Prettier (`server.js` ignored)                 | no formatter                                | consistent formatting; the server must stay byte-identical                                                                         |
| Vite proxy (same origin)                       | calling :3000 directly                      | server sends no `Access-Control-Expose-Headers`, so `Retry-After` would be unreadable                                              |
| `concurrently` (devDep)                        | `&` or a hand-rolled spawn script           | works on Windows, kills both processes on Ctrl+C                                                                                   |
| No `"type"` in package.json, `vite.config.mts` | rename server to `.cjs`                     | `server.js` is CommonJS and must stay unchanged                                                                                    |
| `.gitattributes`: `server.js -text`            | `* eol=lf` for all files / local git config | only the server must stay byte-identical; `core.autocrlf=true` would add CR on checkout. Local config doesn't travel with the repo |
| One `tsconfig.json`, `src` only, no Node types | split app/node configs with `tsc -b`        | browser code can't import `node:*`; nothing in `src` needs Node, so a second config buys nothing                                   |
| Leaflet `CircleMarker`                         | default `Marker`                            | no icon-asset bundling issue; colour by status directly                                                                            |
| Own ~20-line `ErrorBoundary`                   | `react-error-boundary`                      | a few lines                                                                                                                        |
| Own `ConfirmDialog`                            | `window.confirm`                            | non-blocking, can disable itself if the route changes while open                                                                   |
| Plain validation functions                     | form library                                | three small forms                                                                                                                  |
| Arrays + `appendCapped` (N = 150)              | RingBuffer class                            | tiny N, immutable updates suit Zustand                                                                                             |
| Route `_version` for locking                   | truck `_version`                            | truck version bumps on every simulation tick                                                                                       |
| RTL + jsdom only for UI-behaviour tests        | Playwright e2e                              | a handful of UI tests; logic is tested as pure functions                                                                           |

## Handling multi-dispatcher conflicts

_Stage 5._

## What I'd monitor in production

_Stage 8._

## Known issues and limitations

_Stage 8._

## What I'd improve with more time

_Stage 8._
