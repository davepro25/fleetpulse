// Captures real payloads from the unchanged server.js into src/test/fixtures/{sse,rest,ws}.json.
// Tooling only (not app code). Spawns its own server on :3000, so nothing else may use that port.
// Usage: node scripts/capture-fixtures.mjs
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000/ws';
const OUT = 'src/test/fixtures';
const SSE_TIMEOUT_MS = 6 * 60_000;
const A = { dispatcherId: 'Dana~aaaa1111', name: 'Dana' };
const B = { dispatcherId: 'Eli~bbbb2222', name: 'Eli' };

const server = spawn(process.execPath, ['server.js'], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((resolve) => server.stdout.on('data', (d) => d.toString().includes('running') && resolve()));

try {
  const [sse, wsAndRest] = await Promise.all([captureSse(), captureWsAndRest()]);
  writeFileSync(`${OUT}/sse.json`, JSON.stringify(sse, null, 2) + '\n');
  writeFileSync(`${OUT}/rest.json`, JSON.stringify(wsAndRest.rest, null, 2) + '\n');
  writeFileSync(`${OUT}/ws.json`, JSON.stringify(wsAndRest.ws, null, 2) + '\n');
  console.log('done; missing SSE cases:', sse.missing);
} finally {
  server.kill();
}

// ---------- SSE ----------
async function captureSse() {
  const out = {};
  const res = await fetch(`${BASE}/api/telemetry/stream`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  const deadline = Date.now() + SSE_TIMEOUT_MS;
  let buffer = '';
  let previous = null; // previous telemetry message, so sequences start with a clean reading
  let fuel = null;     // { truckId, messages } while a fuel-0 sequence is being collected
  let speed = null;    // same for speed 999
  const required = ['connected', 'heartbeat', 'telemetry', 'gps_batch', 'fuelGlitchSequence', 'speedStuckSequence', 'outOfOrder'];

  while (Date.now() < deadline && !required.every((k) => k in out)) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let sep;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      if (!frame.startsWith('data: ')) continue;
      const msg = JSON.parse(frame.slice(6));
      if (!(msg.type in out)) out[msg.type] = msg;
      if (msg.type !== 'telemetry') continue;

      const reading = (id) => msg.readings.find((r) => r.truckId === id);
      if (!out.outOfOrder && msg.readings.some((r) => r.timestamp < msg.timestamp)) {
        out.outOfOrder = { previous, message: msg };
      }
      if (fuel) {
        fuel.messages.push(msg);
        if (reading(fuel.truckId)?.fuel !== 0) { out.fuelGlitchSequence = fuel; fuel = null; }
      } else if (!out.fuelGlitchSequence) {
        const hit = msg.readings.find((r) => r.fuel === 0);
        if (hit) fuel = { truckId: hit.truckId, messages: [previous, msg] };
      }
      if (speed) {
        speed.messages.push(msg);
        if (reading(speed.truckId)?.speed !== 999) { out.speedStuckSequence = speed; speed = null; }
      } else if (!out.speedStuckSequence) {
        const hit = msg.readings.find((r) => r.speed === 999);
        if (hit) speed = { truckId: hit.truckId, messages: [previous, msg] };
      }
      previous = msg;
    }
  }
  await reader.cancel();
  out.missing = required.filter((k) => !(k in out));
  return out;
}

// ---------- WS + REST ----------
function openClient(label) {
  const ws = new WebSocket(WS_URL);
  const log = [];
  ws.addEventListener('message', (e) => log.push({ receivedAt: Date.now(), msg: JSON.parse(e.data) }));
  const opened = new Promise((r) => ws.addEventListener('open', r, { once: true }));
  return { label, ws, log, opened };
}

async function waitFor(client, predicate, timeoutMs = 15_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const hit = client.log.find(predicate);
    if (hit) return hit;
    await sleep(20);
  }
  return null;
}

async function http(method, path, { dispatcherId, ifMatch, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (dispatcherId) headers['X-Dispatcher-Id'] = dispatcherId;
  if (ifMatch !== undefined) headers['If-Match'] = String(ifMatch);
  const res = await fetch(BASE + path, { method, headers, body: body && JSON.stringify(body) });
  return { status: res.status, headers: Object.fromEntries(res.headers), body: await res.json() };
}

async function captureWsAndRest() {
  const rest = {};
  const ws = {};
  const a = openClient('A');
  const b = openClient('B');
  await Promise.all([a.opened, b.opened]);

  a.ws.send(JSON.stringify({ type: 'register_dispatcher', ...A }));
  ws.registered = (await waitFor(a, (e) => e.msg.type === 'registered')).msg;
  b.ws.send(JSON.stringify({ type: 'register_dispatcher', ...B }));
  ws.dispatcher_joined = (await waitFor(a, (e) => e.msg.type === 'dispatcher_joined')).msg;
  b.ws.send(JSON.stringify({ type: 'viewing_truck', truckId: 'truck_3' }));
  ws.dispatcher_viewing = (await waitFor(a, (e) => e.msg.type === 'dispatcher_viewing')).msg;
  b.ws.send(JSON.stringify({ type: 'viewing_truck', truckId: null }));
  ws.dispatcher_viewing_null = (await waitFor(a, (e) => e.msg.type === 'dispatcher_viewing' && e.msg.truckId == null)).msg;
  a.ws.send(JSON.stringify({ type: 'ping' }));
  ws.pong = (await waitFor(a, (e) => e.msg.type === 'pong')).msg;
  a.ws.send('x');
  ws.error = (await waitFor(a, (e) => e.msg.type === 'error')).msg;
  const anon = openClient('unregistered');
  await anon.opened;
  anon.ws.send(JSON.stringify({ type: 'viewing_truck', truckId: 'truck_5' }));
  ws.dispatcher_viewing_unregistered = (await waitFor(a, (e) => e.msg.type === 'dispatcher_viewing' && e.msg.dispatcherId == null)).msg;
  anon.ws.close();

  // REST: fleet (until both a 503 and a 200 were seen)
  for (let i = 0; i < 200 && !(rest.fleet503 && rest.fleet200); i++) {
    const r = await http('GET', '/api/fleet');
    if (r.status === 503) rest.fleet503 ??= r;
    else rest.fleet200 ??= r;
  }
  rest.truckDetail = await http('GET', '/api/fleet/truck_1');
  rest.truckDetail404 = await http('GET', '/api/fleet/truck_99');
  rest.history = await http('GET', '/api/telemetry/history/truck_1?limit=5');

  // REST: route creation and its errors
  const route = { truckId: 'truck_1', destination: 'Dizengoff 50, Tel Aviv', priority: 'high', notes: 'fragile' };
  rest.createRoute401 = await http('POST', '/api/routes', { body: route });
  rest.createRoute400 = await http('POST', '/api/routes', { dispatcherId: A.dispatcherId, body: { truckId: 'truck_1' } });
  rest.createRoute404 = await http('POST', '/api/routes', { dispatcherId: A.dispatcherId, body: { ...route, truckId: 'truck_99' } });
  rest.createRoute201 = await http('POST', '/api/routes', { dispatcherId: A.dispatcherId, body: route });
  ws.route_assigned = (await waitFor(a, (e) => e.msg.type === 'route_assigned')).msg;
  rest.createRoute409 = await http('POST', '/api/routes', { dispatcherId: B.dispatcherId, body: route });
  const r1 = rest.createRoute201.body;

  // QUIRK 8: PATCH (If-Match 1) races a reassign by B -> 409 "during processing"
  const patching = http('PATCH', `/api/routes/${r1.id}`, { dispatcherId: A.dispatcherId, ifMatch: 1, body: { status: 'in-progress' } });
  await sleep(50);
  rest.reassign200 = await http('PUT', `/api/routes/${r1.id}/reassign`, { dispatcherId: B.dispatcherId, body: { newTruckId: 'truck_4' } });
  ws.route_reassigned = (await waitFor(a, (e) => e.msg.type === 'route_reassigned')).msg;
  rest.patch409Processing = await patching;
  // Stale If-Match after B's reassign -> 409 version; lastModifiedBy names A, not B
  rest.patch409Version = await http('PATCH', `/api/routes/${r1.id}`, { dispatcherId: A.dispatcherId, ifMatch: 1, body: { status: 'in-progress' } });
  rest.routesAfterReassign = await http('GET', '/api/routes');
  rest.patch200 = await http('PATCH', `/api/routes/${r1.id}`, { dispatcherId: A.dispatcherId, ifMatch: rest.reassign200.body._version, body: { status: 'in-progress' } });
  // A made this PATCH, so this is also A's own echo (route events reach the sender too)
  ws.route_updated = (await waitFor(a, (e) => e.msg.type === 'route_updated')).msg;

  // Reassign errors
  await http('POST', '/api/routes', { dispatcherId: A.dispatcherId, body: { ...route, truckId: 'truck_2' } });
  rest.reassign409Busy = await http('PUT', `/api/routes/${r1.id}/reassign`, { dispatcherId: B.dispatcherId, body: { newTruckId: 'truck_2' } });
  rest.reassign400Maintenance = await http('PUT', `/api/routes/${r1.id}/reassign`, { dispatcherId: B.dispatcherId, body: { newTruckId: 'truck_7' } });
  rest.reassign404MissingTarget = await http('PUT', `/api/routes/${r1.id}/reassign`, { dispatcherId: B.dispatcherId, body: {} });

  // Alert
  rest.alert201 = await http('POST', '/api/fleet/truck_1/alert', { dispatcherId: A.dispatcherId, body: { message: 'Check tyre pressure', severity: 'warning' } });
  ws.truck_alert = (await waitFor(a, (e) => e.msg.type === 'truck_alert')).msg;

  // QUIRK 6: B disconnects and reconnects with the same id until one leave arrives >= 9 s late
  let current = b;
  ws.ghostAttempts = [];
  for (let attempt = 1; attempt <= 25 && !ws.ghostLeaveAfterReconnect; attempt++) {
    const closedAt = Date.now();
    const fromIndex = a.log.length;
    current.ws.close();
    const next = openClient(`B#${attempt}`);
    await next.opened;
    next.ws.send(JSON.stringify({ type: 'register_dispatcher', ...B }));
    let leave = null;
    const end = Date.now() + 12_000;
    while (!leave && Date.now() < end) {
      leave = a.log.slice(fromIndex).find((e) => e.msg.type === 'dispatcher_left' && e.msg.dispatcherId === B.dispatcherId) ?? null;
      if (!leave) await sleep(20);
    }
    const delayMs = leave ? leave.receivedAt - closedAt : null;
    ws.ghostAttempts.push({ attempt, delayMs });
    if (delayMs !== null && delayMs >= 9_000) {
      ws.ghostLeaveAfterReconnect = {
        closedAt,
        observerLog: a.log.slice(fromIndex),   // joined (reconnect) then the late left
        reconnectedClientLog: next.log.slice(), // includes its own late dispatcher_left
      };
    } else if (!ws.dispatcher_left) {
      ws.dispatcher_left = leave?.msg;
    }
    current = next;
  }

  // Reset last: clears routes and dispatchers on the server
  rest.reset = await http('POST', '/api/reset');
  ws.fleet_reset = (await waitFor(a, (e) => e.msg.type === 'fleet_reset')).msg;

  a.ws.close();
  current.ws.close();
  return { rest, ws };
}
