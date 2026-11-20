// Exercises the Vercel deployment path: the api/index.js function against an Upstash-compatible
// REST store (in-process fake), Vercel-style pre-parsed request bodies, and the password middleware.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Readable } from 'node:stream';

// --- fake Upstash Redis REST endpoint
const kv = new Map();
let redisCalls = 0;
const fake = http.createServer(async (req, res) => {
  let body = ''; for await (const c of req) body += c;
  redisCalls++;
  if (req.headers.authorization !== 'Bearer test-token') { res.writeHead(401); return res.end(JSON.stringify({ error: 'unauthorized' })); }
  const [cmd, key, value] = JSON.parse(body);
  if (cmd === 'GET') { res.end(JSON.stringify({ result: kv.has(key) ? kv.get(key) : null })); return; }
  if (cmd === 'SET') { kv.set(key, value); res.end(JSON.stringify({ result: 'OK' })); return; }
  res.writeHead(400); res.end(JSON.stringify({ error: 'unknown command' }));
});
let handler;
before(async () => {
  await new Promise((r) => fake.listen(0, r));
  process.env.KV_REST_API_URL = `http://127.0.0.1:${fake.address().port}`;
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.VERCEL = '1';
  ({ default: handler } = await import('../api/index.js'));
});
after(() => fake.close());

/** Call the Vercel function like Vercel does (body already parsed onto req.body). */
async function call(method, url, body) {
  const req = Object.assign(Readable.from([]), { method, url, headers: {}, body });
  let status, headers, payload = '';
  const res = { writeHead(s, h) { status = s; headers = h || {}; }, end(b) { payload = b ? String(b) : ''; } };
  await handler(req, res);
  return { status, headers, body: payload && headers['Content-Type']?.includes('json') ? JSON.parse(payload) : payload };
}

test('first request seeds Redis; data persists across "cold starts"', async () => {
  const r = await call('GET', '/api/state');
  assert.equal(r.status, 200);
  assert.equal(r.body.projects.length, 7);
  assert.ok(kv.has('case-study-builder:db'), 'seed written to Redis');
  const cfg = await call('GET', '/api/config');
  assert.equal(cfg.body.storage.data, 'redis');
  assert.equal(cfg.body.brandBase, '/brand');
  assert.equal(cfg.body.maxUploadBytes, 3 * 1024 * 1024, 'Vercel upload cap');
});

test('writes go to Redis and are read back on the next request', async () => {
  const created = await call('POST', '/api/projects', { project: { name: 'Vercel Redis Project', status: 'draft' } });
  assert.equal(created.status, 201);
  const stored = JSON.parse(kv.get('case-study-builder:db'));
  assert.equal(stored.projects[0].name, 'Vercel Redis Project');
  const before = redisCalls;
  const state = await call('GET', '/api/state');
  assert.ok(redisCalls > before, 'state is re-read from Redis, not a stale instance cache');
  assert.equal(state.body.projects[0].name, 'Vercel Redis Project');
  const cs = await call('POST', '/api/case-studies/generate', { type: 'project', projectIds: [created.body.id] });
  assert.equal(cs.status, 201);
  assert.ok(JSON.parse(kv.get('case-study-builder:db')).caseStudies.some((c) => c.id === cs.body.id));
});

test('read-only requests do not write to Redis', async () => {
  const snapshot = kv.get('case-study-builder:db');
  await call('GET', '/api/state');
  assert.equal(kv.get('case-study-builder:db'), snapshot);
});

test('validation and 404s still work through the function', async () => {
  assert.equal((await call('POST', '/api/projects', { project: { name: '' } })).status, 422);
  assert.equal((await call('GET', '/api/nope')).status, 404);
});

test('password middleware: off without APP_PASSWORD, enforced with it', async () => {
  const { default: middleware } = await import('../middleware.js');
  delete process.env.APP_PASSWORD;
  const open = middleware(new Request('https://x.test/'));
  assert.notEqual(open.status, 401);
  process.env.APP_PASSWORD = 'pa:ss✓';
  const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
  assert.equal(middleware(new Request('https://x.test/')).status, 401);
  assert.equal(middleware(new Request('https://x.test/', { headers: { authorization: `Basic ${b64('any:wrong')}` } })).status, 401);
  assert.notEqual(middleware(new Request('https://x.test/api/state', { headers: { authorization: `Basic ${b64('team:pa:ss✓')}` } })).status, 401);
  delete process.env.APP_PASSWORD;
});
