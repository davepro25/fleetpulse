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
| Plan claim | Captured evidence |
|---|---|
| Fuel glitch = 1–2 readings of exactly 0, then recovers | truck_8: 88.85 → 0 → 0 → 88.79, at 75–80 km/h |
| 999 also fires in maintenance | truck_7: 4 readings of 999 while `status: maintenance` |
| Out-of-order lag 3–8 s | 6.3 s, flagged `_reordered` (we must ignore that flag) |
| Batch speed can be negative | 14-point batch over 26 s, min speed −0.8 |
| `Retry-After` not exposed by CORS | 503 has `retry-after: 3`, no `access-control-expose-headers` |
| Version-409 names the wrong person after a reassign | Eli reassigned (v2); Dana's stale PATCH got `lastModifiedBy: "Dana~…"` |
| Processing-409 and reassign-409 have no actor | bodies contain only `error` (+ `currentVersion`) |
| Ghost leave arrives after reconnect, also to the reconnected client itself | observer: `joined` at +4 ms, `left` at +10 015 ms; reconnected client received its own `dispatcher_left` |
| Leave timestamp is send time, so it can't identify the old connection | `leave.timestamp − closedAt` = 10 017 ms |
| `activeDispatchers` is wrong after a ghost | late leave reports 1 while the dispatcher is still connected |
| Unregistered client produces `dispatcherId: null` | captured `dispatcher_viewing` with `dispatcherId: null` |
| Missing `newTruckId` → 404, not 400 | `reassign404MissingTarget` |

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
