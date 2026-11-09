# PROMPTS.md: AI usage journal

Tool: Claude Code (Claude Opus). For each stage: what I asked, what the AI produced, and what I **rejected or corrected**, with the reason.

---

## Planning (before Stage 0)

**Prompt (summary):** I gave the AI the full assignment, including `server.js`, my fixed stack decisions, and a list of server behaviours I believed were true. I asked for a staged plan with a requirements traceability matrix, and told it to check my claims against the code.

**Output:** `docs/PLAN.md`: 58 requirement IDs, each mapped to one of 9 stages, with tests, explain-back questions and a time budget (13.75 h of 16 h).

**My claims the AI corrected after reading `server.js`:**

- "Retry according to `Retry-After`": cross-origin, the browser can't read that header (no `Access-Control-Expose-Headers`, s9–16). That forces a same-origin Vite proxy.
- "The version-409 contains `lastModifiedBy`": it does, but `reassign` never sets it (s370), so after a reassign it names the wrong dispatcher. Decision: always refetch routes and take the latest of assigned/modified/reassigned.
- "Sim speed is capped at 80": true for live readings only. Batch speed is ±5 (can be negative or up to 85) and history is ±10. The plausibility limit is 130, not 80.
- "Refetch the route": there is no single-route GET, only `GET /api/routes`.

**What I rejected / added:**

- I added an explicit rule that `server.js` is read-only for the whole project (`git diff` check in every stage's definition of done). The assignment forbids modifying it.

---

## Stage 0: Observe the real data

**Prompt (summary):** Extract `server.js` from the assignment HTML unchanged, then write a script that captures every SSE/WS/REST message type and quirk as JSON fixtures.

**Output:** `scripts/capture-fixtures.mjs`. It spawns the unchanged server and records:

- SSE: `connected`, `heartbeat`, `telemetry`, `gps_batch`, a fuel-0 sequence, a 999 sequence and an out-of-order reading
- REST: every error status
- WS: every message type, plus a real ghost leave arriving after a reconnect

**Checks I did:**

- Decoded the HTML entities only (`&amp;` → `&`, etc.), with `&amp;` decoded last so nothing is double-decoded.
- `node --check server.js` passes. No CR characters. 552 lines.
- sha256 = `9ebc2c99249c1792d3a7a3e01438f9e3513092276c18828e76e8d865cac7d6f7`.
- Line numbers quoted in the plan (e.g. s295, s300, s318) match the file.

**What the real captures showed (every plan claim confirmed, none contradicted):**

| Plan claim                                                                 | Captured evidence                                                                                        |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Fuel glitch = 1–2 readings of exactly 0, then recovers                     | truck_8: 88.85 → 0 → 0 → 88.79, at 75–80 km/h                                                            |
| 999 also fires in maintenance                                              | truck_7: 4 readings of 999 while `status: maintenance`                                                   |
| Out-of-order lag 3–8 s                                                     | 6.3 s, flagged `_reordered` (we must ignore that flag)                                                   |
| Batch speed can be negative                                                | 14-point batch over 26 s, min speed −0.8                                                                 |
| `Retry-After` not exposed by CORS                                          | 503 has `retry-after: 3`, no `access-control-expose-headers`                                             |
| Version-409 names the wrong person after a reassign                        | Eli reassigned (v2); Dana's stale PATCH got `lastModifiedBy: "Dana~…"`                                   |
| Processing-409 and reassign-409 have no actor                              | bodies contain only `error` (+ `currentVersion`)                                                         |
| Ghost leave arrives after reconnect, also to the reconnected client itself | observer: `joined` at +4 ms, `left` at +10 015 ms; reconnected client received its own `dispatcher_left` |
| Leave timestamp is send time, so it can't identify the old connection      | `leave.timestamp − closedAt` = 10 017 ms                                                                 |
| `activeDispatchers` is wrong after a ghost                                 | late leave reports 1 while the dispatcher is still connected                                             |
| Unregistered client produces `dispatcherId: null`                          | captured `dispatcher_viewing` with `dispatcherId: null`                                                  |
| Missing `newTruckId` → 404, not 400                                        | `reassign404MissingTarget`                                                                               |

**Notes for later stages:** fixtures contain the debug fields `_reordered`/`_batch*`, so guards must ignore extra fields. Telemetry statuses in `sse.json` reflect the route actions the script made in parallel (truck_1 is `idle` after being reassigned away). That is expected.

**What I corrected in the AI's script before running it:** removed a leftover no-op `waitFor` call and a duplicate `route_updated` capture (the first `route_updated` already is A's own echo).

---

## Stage 1: Architecture & scaffold

**Prompt (summary):** Scaffold Vite + React + TS strict + Vitest so that `npm start` runs the unchanged server and the client together. Write the wire contracts, the README architecture/decision log, and a test that guards `server.js`.

**Output:** a hand-written minimal scaffold instead of `npm create vite`, plus the wire contracts, a same-origin proxy in `vite.config.mts`, and the README draft.

**Corrected / rejected:**

- Rejected the Vite template. It refuses to scaffold into a non-empty folder, adds `"type": "module"` (which would crash the CommonJS `server.js`) and brings ESLint and demo assets nobody asked for. Writing the few needed files by hand was smaller.
- `npm init` had added `"type": "commonjs"`. I removed the field entirely, as the plan says.
- Found a risk the plan missed: this machine has `core.autocrlf=true`, so a Windows checkout would rewrite `server.js` with CRLF and change its bytes. Added `.gitattributes`.
- Used `tsc --noEmit` with a single `tsconfig.json` instead of `tsc -b` with project references. One config is enough here.

**Verified:** `npm test` is green (typecheck). A smoke script started `npm start` and confirmed the app is served on :5173 and, through the proxy: `/api/fleet` 200, a 503 with a readable `Retry-After: 3`, an SSE `connected` frame and a WS `ping` → `pong`. Both ports were freed afterwards.

**Changed after my review:** I found the single 150-line `src/contracts.ts` hard to read and asked why it wasn't split into a `types/` folder per page with an `index.ts`. The AI agreed to split it but argued against splitting **per page**: `Route` is used by the routes panel, the detail panel, WS events and the audit log, so a per-page split forces an arbitrary owner or duplicates types. We split **by domain** instead: `src/contracts/{fleet,telemetry,routes,presence}.ts` + `ws.ts` (the cross-domain WS unions) + `index.ts` (`export type *`). Domain files import each other directly, never through the index, so there are no barrel cycles. Imports stay `from '../contracts'`.

**Changed after my review: leaner.**

- I rejected the AI's `server.js` sha256 test as over-engineering. `git diff --quiet <S0 commit> -- server.js` in every stage's definition of done already guards the file.
- I narrowed `.gitattributes` from `* text=auto eol=lf` (every file) to `server.js -text`. Only the server has to stay byte-identical.
- With the hash test gone, nothing in `src` needs Node. The AI had proposed splitting the tsconfig into app/node configs. Instead I removed `@types/node` and kept one `tsconfig.json` that covers `src` only with `vite/client` types. A `node:fs` import in browser code now fails typecheck (verified with a probe file).
- I uninstalled libraries no stage uses yet (zustand, leaflet, react-leaflet, recharts, jsdom, RTL, the type packages). Each stage now installs what it first uses, so every commit's `package.json` diff matches its code.

---

## Stage 2: Transport layer

**Prompt (summary):** Implement the plan's Stage 2: type guards tested against the captured fixtures, a REST client (dispatcher header, `If-Match`, `Retry-After`-driven retry through TanStack Query), SSE and WS clients that own their reconnection, keepalive and cleanup, a sessionStorage identity with the name encoded in the id, and the `live.ts` composition root.

**Output:** `src/transport/{guards,http,backoff,sse,ws,identity,connectionStore,AppContext,IdentityGate}`, `src/fleet/queries.ts`, `src/live.ts`, and a temporary status line in `App.tsx`. 30 tests: guards against every fixture, the 503 → exactly 3 s retry, giving up after 3 retries with the old snapshot kept, header shapes, and SSE/WS lifecycles with fake `EventSource`/`WebSocket` and fake timers.

**Corrected during the stage:**

- I trimmed the contracts to the fields we read (`activeDispatchers`, `truckVersion`, top-level `truckId` on `route_assigned`), so every guard checks exactly what its type claims.
- The first version of the "accepts every fixture" test only compared `type`. I tightened it to also assert that no real reading gets dropped.
- **Bug found by manual testing, not by the tests:** I opened the client before `server.js` was running. SSE and WS recovered on their own, but the fleet snapshot stayed failed: `onReconnected` fired only on a _second_ open, and here the first open was the recovery. Fix: fire on the first open after **any** failure. Two tests added. The proxy's 502/504 also became retryable (it returns them while the server is down).
- The temporary status line said "retrying (1/3)" after the query had already given up. Fixed to "failed".
- Simplified from the plan: no dropped-reading counter, because nothing consumes it yet.

**Verified in the browser:**

- The identity gate rejects `<b>x`, and a reload keeps `Dana~f90cfcb1`. A second tab asks for a new name.
- A real 503 from the app's own query was followed by a retry 3.0 s later (performance timings 85 ms → 3107 ms).
- Client started first, then the server: SSE/WS went `reconnecting` → `open` and the snapshot loaded without a reload.
- WS RTT is shown after the first ping. In dev, StrictMode's double mount leaves one EventSource per load (cleanup works).

**Tooling note:** stopping a background `npm start` from the agent left orphaned `node server.js` and `vite` processes, which made one manual check falsely pass. They were found and killed. Ctrl+C in a real terminal does not have this problem (`concurrently -k`).

**Changed after my review of Stage 2.** I asked whether existing packages could replace our code, aiming for short, clean, clear code.

- **zod replaced the hand-written guards and the separate types.** Each shape is now defined once, and its type is inferred from the schema, so check and type can't drift. That removed `guards.ts` (165 lines). Malformed-reading filtering stays inside the telemetry schema (`transform` + `safeParse`).
- **ky replaced our fetch wrapper.** We compared ky, ofetch, wretch and axios. Only ky honours `Retry-After` without extra code; ofetch retries 409 by default (dangerous here) and axios has no retry. The retry moved from TanStack to ky (TanStack `retry: false`), so there is exactly one retry layer. ky's `methods: ['get']` guarantees mutations are never re-sent. A test pins this.
- **Rejected socket.io.** The server speaks plain `ws`, and the socket.io client needs a socket.io server, which would mean modifying `server.js`.
- **Prettier added**, with `server.js` and the fixtures in `.prettierignore`. Comments cut to the ones that explain a non-obvious why.
- **Folder structure changed to a standard React layout.** I didn't like `AppContext` living under `transport/`. Now: `api/`, `contracts/`, `context/`, `stores/`, `queries/`, `components/`, `utils/` (later `domain/` for pure logic and `hooks/`), with all tests in a top-level `tests/` folder. The plan's file paths for later stages were remapped to match.
- **Tests slimmed from 31 to 15.** Each remaining test proves a specific behaviour: the 3 s `Retry-After` wait, giving up while keeping old data, no mutation retries, the bare-integer `If-Match`, SSE reconnect only on CLOSED, refetch after a failed start, WS re-register/re-announce, the pong timeout, cleanup on close, fixture parsing, malformed-reading isolation, and identity.
- **Re-verified in the browser after the switch.** With the server down, ky retried the proxy's 502s 3× with backoff. After the server started, SSE recovery triggered a refetch, which got a real 503, and the retry came exactly 3.0 s later (13207 → 16231 ms).

**`/ponytail-review` of `src/utils`:** I asked whether lodash or built-ins could replace the helpers. Answer: no. lodash has no backoff, `_.attempt` doesn't shorten `parseJson`, and the identity is our own logic. Adding lodash would mean a dependency for zero saved lines. Applied the review's trims instead:

- Deleted `displayName`: it had no caller until Stage 6. It also had a bug: server-generated ids like `dispatcher_9f8e7d6c` all rendered as "Unknown (dispatch)". It comes back in Stage 6 with a whole-id fallback.
- `loadIdentity` now validates with a zod schema, like everything else, and `Identity` is inferred from it.
- Removed the unused `random` parameter of `backoffMs` and moved the file to `src/api/` (its only callers are the SSE/WS clients).
- Removed the `storage` injection parameter: Node 26 has a global `sessionStorage`, so the tests use the real one.

---

## Stage 3: Telemetry pipeline (TDD)

**Prompt (summary):** Build the pure TypeScript pipeline test-first: per-truck ordering by sensor timestamp, `gps_batch` merged into the path only, fuel and speed detectors driven by a per-vehicle profile, and bounded buffers. Then the Zustand store and the `live.ts` wiring.

**TDD loop:** `tests/telemetry.test.ts` was written first and failed (module missing). Then `profiles.ts`, `detectors.ts` and `pipeline.ts` were implemented until all 8 tests passed. The tests feed the **real captured sequences** through the pipeline: truck_8's fuel 0 % glitch, truck_7's stuck 999, a real `gps_batch` and a real out-of-order reading. Synthetic frames are built only from a captured reading, for the cases the capture didn't contain (sustained drop, gradual decline, 200-reading cap).

**Checks that the tests really catch mistakes:**

- A detector hard-coded to `fuel === 0` fails the sustained-drop test, which drops to 3.
- A hard-coded 80 km/h limit fails the profile test (batch jitter reaches 85).
- Ordering by arrival fails the out-of-order test.
- No detector mentions `truck_7` or `0`. Every threshold lives in `profiles.ts`.

**Simplified from the plan, each with a reason:**

- `FuelGuard` dropped: the fuel state fits in `SensorValue` (trusted = `value`, suspect-since = `fault.since`).
- `buffers.ts` dropped: one private `mergeByTimestamp` covers samples and path.
- `applySnapshot` dropped: SSE fills every truck within 2 s, and the snapshot is only needed for names.
- Selectors and `reset()` moved to the stages that first use them.

**Corrected:** my test checked path order with a default `.sort()`, which sorts as strings. Switched to a numeric comparator.

**Verified live in the browser** (by reading the store module from the page):

- 12 trucks in the store.
- truck_7 reported 999 while in `maintenance`: shown as 0 with `out_of_range`.
- truck_3 reported fuel 0: still shown as 50.4 with `sudden_drop`.
- A `gps_batch` for truck_11 grew its path to 21 points while samples stayed at 7.

**Changed after my review of Stage 3:** while studying `checkFuel` I read the condition as inverted. The logic was right, but the name was misleading: `fuelGlitchConfirmMs` reads as "time to confirm a glitch", while it is the time after which a drop is accepted as **real**. Renamed to `fuelDropConfirmMs`, so the line reads the way it behaves.

---

## Stage 4: Fleet overview UI

**Prompt (summary):** Build the first screen: a Leaflet map and a truck list with status colours, sensor-fault annotations and a low-fuel badge, a connection banner with a staleness indicator, and an error boundary per panel. Keep re-renders per truck.

**Output:** `components/fleet/{FleetMap,TruckMarker,TruckList,statusStyle}`, `components/{ConnectionBanner,ErrorBoundary}`, `hooks/useNow`, `utils/format`, plus selectors (`useTruckIds`, `useTruck`, `isStale`) and `useTruckName`.

**Deviations from the plan:**

- No jsdom or Testing Library. The two UI rules worth testing (how a faulted sensor is displayed, when data counts as stale) are pure functions (`formatSensor`, `isStale`), tested in the node environment, written first and seen failing. Two fewer dev dependencies.
- The raw faulty value is not shown even in the warning text. The plan had "(raw ignored)"; the requirement is that 999 is never displayed to the dispatcher.

**Corrected:** Leaflet's `positions` rejected `number[][]`. Instead of mapping to tuples, the path points (`{lat, lng, timestamp}`) are passed as-is, since they already are `LatLngLiteral`s. `formatTime` was written and unused, so it was deleted.

**Verified in the browser:**

- 12 markers, one per truck, coloured by status; Truck Golf is grey (maintenance).
- A fuel glitch on Truck Kilo showed 44 % with "Possible sensor glitch since …", and the marker got an amber ring.
- truck_7 (Golf) sent 999: the list showed "0 km/h · Sensor fault since 15:07:33", and the string 999 never appeared anywhere in the page.
- Selecting a truck highlights its row.
- With the server stopped, the banner showed "Live data: no update for 18s · Dispatch link: reconnecting".

**Not verified:** a forced crash inside one panel (error boundary isolation), and a React Profiler measurement of re-renders.

---

## Stage 5: Route management

**Prompt (summary):** Route creation, status changes with `If-Match`, reassign, confirmation dialogs, client-side validation, a 409 UX that names who made the conflicting change, and an audit log built from WS events plus our own results. Pure rules tested first.

**Output:** `domain/routes/{transitions,conflicts,validation}`, `api/routes`, `queries/routes` (`applyRouteChange`), `stores/auditStore`, `hooks/useRouteMutations`, `components/routes/*`, `ConfirmDialog`. 6 new tests, written first and seen failing.

**Simplified from the plan:**

- The 409 body is not parsed at all. "Who" always comes from `lastActor` of the refetched route. That's one path for create, version, processing and reassign conflicts, and it can't repeat the server's `lastModifiedBy` mistake (Stage 0 fixture: the body names Dana, Eli reassigned).
- `applyRouteChange(client, route)` takes only the route: `assignedBy` / `lastModifiedBy` / `reassignedBy` and their timestamps already say who and when. It is the single path for our own results and WS echoes, and the version makes the second copy a no-op.
- The audit dedupe checks the stored entries (max 200) instead of keeping a separate set of seen keys, which would grow forever.
- The confirm-dialog re-check is a pure function (`statusChangeBlockedReason`, `reassignBlockedReason` + a version check), so no React Testing Library.

**Bug caught while designing, before it was written:** the first idea sent the route's _current_ cached `_version` when the dispatcher pressed Confirm. If another dispatcher changed the route while the dialog was open, that would send the _new_ version and silently overwrite their change, defeating optimistic locking. Fix: capture the version when the dialog opens, send that as `If-Match`, and disable Confirm if the route's version moved meanwhile.

**Corrected in the tests:** a first version looped over "response first / echo first", but both copies are identical, so the loop proved nothing. Replaced by one honest test: the same change applied twice is a no-op.

**Defaults taken for open questions:** priority `low | normal | high`; destination free text, 1–120 characters.

**Verified with two tabs (Dana, Eli):**

- Dana's route appears once in both tabs. Dana sees "You assigned…", Eli sees "Dana assigned…", and Truck Delta leaves both pickers.
- Eli starts the route while Dana's "Cancel route" dialog is open: Confirm disables with "Eli updated this route while this was open".
- Quirk 8: Dana confirms Complete, and Eli reassigns during the PATCH delay. Dana gets the actor-less processing-409, and after the refetch sees "route_1 was reassigned by Eli at 16:05:12".
- Truck Golf (maintenance) and busy trucks never appear in the create or "Move to" pickers.
