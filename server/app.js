// API request handler shared by the Node server (local / Render) and the Vercel function.
import crypto from 'node:crypto';
import { SEED_PROJECTS, SEED_CASE_STUDIES } from '../shared/seed.js';
import { generateCaseStudy } from '../shared/generate.js';
import { normalizeProject, validateProject, newId, nowIso } from '../shared/project.js';
import { CASE_STUDY_TYPES } from '../shared/catalog.js';
import { createDataStore, createImageStore, storageInfo, onVercel } from './storage.js';

const REMOTE_BRAND = process.env.BRAND_BASE_URL || 'https://case-study-builder-teal.vercel.app/brand';
// Vercel functions accept request bodies up to 4.5 MB, so uploads (sent as base64) are capped lower there.
export const MAX_UPLOAD = (onVercel ? 3 : 8) * 1024 * 1024;

let dataStore;
let imageStore;
const stores = () => { dataStore ||= createDataStore(); imageStore ||= createImageStore(); return { dataStore, imageStore }; };

const seedState = () => ({ projects: structuredClone(SEED_PROJECTS), caseStudies: structuredClone(SEED_CASE_STUDIES), assets: [] });
let fileCache = null; // the JSON-file backend is single-process, so keep it in memory
async function loadDb() {
  const { dataStore: s } = stores();
  if (s.kind === 'file' && fileCache) return fileCache;
  let db = await s.load();
  if (!db) { db = seedState(); await s.save(db); }
  db.assets ||= [];
  if (s.kind === 'file') fileCache = db;
  return db;
}

// ------------------------------------------------------------------ helpers
export class HttpError extends Error { constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; } }
const fail = (s, m, x) => { throw new HttpError(s, m, x); };
export function send(res, status, body, headers = {}) {
  const buf = Buffer.isBuffer(body);
  res.writeHead(status, { 'Content-Type': buf ? 'application/octet-stream' : 'application/json; charset=utf-8', ...headers });
  res.end(buf ? body : JSON.stringify(body));
}
async function readBody(req, limit = 2 * 1024 * 1024) {
  if (req.body !== undefined) { // Vercel pre-parses JSON bodies
    if (typeof req.body === 'object' && req.body !== null && !Buffer.isBuffer(req.body)) return req.body;
    const text = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');
    if (!text) return {};
    if (text.length > limit) fail(413, 'Request too large');
    try { return JSON.parse(text); } catch { fail(400, 'Invalid JSON'); }
  }
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > limit) fail(413, 'Request too large'); chunks.push(c); }
  if (!size) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail(400, 'Invalid JSON'); }
}
const findProject = (db, id) => db.projects.find((p) => p.id === id) || fail(404, 'That project could not be found. It may already have been deleted.');
const findCase = (db, id) => db.caseStudies.find((c) => c.id === id) || fail(404, 'That case study could not be found. It may already have been deleted.');

const PROJECT_KEYS = Object.keys(normalizeProject({}));
function cleanProject(input) {
  const p = normalizeProject(input || {});
  const out = {};
  for (const k of PROJECT_KEYS) out[k] = p[k];
  out.type = ['feature', 'project', 'staffing'].includes(p.type) ? p.type : 'project';
  out.status = p.status === 'completed' ? 'completed' : 'draft';
  return out;
}
function checkProject(p) {
  const errors = validateProject(p, p.status === 'completed' ? 'complete' : 'draft');
  if (Object.keys(errors).length) fail(422, 'Please fix the highlighted fields', { errors });
}
function sniff(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { mime: 'image/png', ext: 'png' };
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf.length > 6 && buf.toString('ascii', 0, 4) === 'GIF8') return { mime: 'image/gif', ext: 'gif' };
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  return null;
}

// Optional site-wide password (HTTP Basic auth; any username). Off unless APP_PASSWORD is set.
export function authorized(header) {
  const want = process.env.APP_PASSWORD || '';
  if (!want) return true;
  const m = /^Basic (.+)$/.exec(header || '');
  if (!m) return false;
  const given = Buffer.from(Buffer.from(m[1], 'base64').toString('utf8').split(':').slice(1).join(':'));
  const w = Buffer.from(want);
  return given.length === w.length && crypto.timingSafeEqual(given, w);
}

// ------------------------------------------------------------------ routes
// Each handler gets (ctx, params) and returns [status, body, headers?]. Set ctx.changed to persist.
const routes = [];
const route = (method, pattern, handler) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler });

route('GET', '/api/config', async (ctx) => [200, { brandBase: ctx.brandLocal ? '/brand' : REMOTE_BRAND, brandSource: ctx.brandLocal ? 'local' : 'remote', maxUploadBytes: MAX_UPLOAD, storage: storageInfo() }]);
route('GET', '/api/state', async ({ db }) => [200, { projects: db.projects, caseStudies: db.caseStudies }]);

route('POST', '/api/projects', async (ctx) => {
  const { project } = await readBody(ctx.req);
  const p = cleanProject(project);
  checkProject(p);
  const now = nowIso();
  const created = { ...p, id: newId('prj'), createdAt: now, updatedAt: now };
  ctx.db.projects.unshift(created);
  ctx.changed = true;
  return [201, created];
});
route('PUT', '/api/projects/:id', async (ctx, { id }) => {
  const existing = findProject(ctx.db, id);
  const { project } = await readBody(ctx.req);
  const p = cleanProject(project);
  checkProject(p);
  Object.assign(existing, p, { id, updatedAt: nowIso() });
  ctx.changed = true;
  return [200, existing];
});
route('POST', '/api/projects/:id/duplicate', async (ctx, { id }) => {
  const src = findProject(ctx.db, id);
  const now = nowIso();
  const copy = { ...structuredClone(src), id: newId('prj'), name: `Copy of ${src.name}`.slice(0, 120), status: 'draft', createdAt: now, updatedAt: now };
  ctx.db.projects.unshift(copy);
  ctx.changed = true;
  return [201, copy];
});
route('DELETE', '/api/projects/:id', async (ctx, { id }) => {
  findProject(ctx.db, id);
  ctx.db.projects = ctx.db.projects.filter((p) => p.id !== id);
  ctx.changed = true;
  return [200, { ok: true }];
});

route('POST', '/api/case-studies/generate', async (ctx) => {
  const { type, projectIds, focus } = await readBody(ctx.req);
  if (!CASE_STUDY_TYPES.some((t) => t.value === type)) fail(400, 'Choose a case study type');
  if (!Array.isArray(projectIds) || projectIds.length === 0) fail(400, 'Select at least one project.');
  if (type === 'project' && projectIds.length > 1) fail(400, 'A project-specific case study uses exactly one project.');
  const projects = projectIds.map((pid) => findProject(ctx.db, pid));
  const now = nowIso();
  const cs = { ...generateCaseStudy(type, projects, String(focus || '').slice(0, 120)), id: newId('cs'), status: 'draft', createdAt: now, updatedAt: now };
  ctx.db.caseStudies.unshift(cs);
  ctx.changed = true;
  return [201, cs];
});
route('PUT', '/api/case-studies/:id', async (ctx, { id }) => {
  const existing = findCase(ctx.db, id);
  const { caseStudy } = await readBody(ctx.req, 4 * 1024 * 1024);
  if (!caseStudy || !Array.isArray(caseStudy.sections)) fail(400, 'Missing case study');
  const title = String(caseStudy.title || '').trim().slice(0, 160) || existing.title || 'Untitled case study';
  Object.assign(existing, {
    title,
    subtitle: String(caseStudy.subtitle ?? existing.subtitle ?? ''),
    status: caseStudy.status === 'completed' ? 'completed' : 'draft',
    sections: caseStudy.sections,
    updatedAt: nowIso(),
  });
  ctx.changed = true;
  return [200, existing];
});
route('POST', '/api/case-studies/:id/duplicate', async (ctx, { id }) => {
  const src = findCase(ctx.db, id);
  const now = nowIso();
  const copy = { ...structuredClone(src), id: newId('cs'), title: `Copy of ${src.title}`, status: 'draft', createdAt: now, updatedAt: now };
  ctx.db.caseStudies.unshift(copy);
  ctx.changed = true;
  return [201, copy];
});
route('DELETE', '/api/case-studies/:id', async (ctx, { id }) => {
  findCase(ctx.db, id);
  ctx.db.caseStudies = ctx.db.caseStudies.filter((c) => c.id !== id);
  ctx.changed = true;
  return [200, { ok: true }];
});
route('POST', '/api/reset', async (ctx) => {
  const fresh = seedState();
  ctx.db.projects = fresh.projects;
  ctx.db.caseStudies = fresh.caseStudies;
  ctx.changed = true;
  return [200, { ok: true }];
});

route('POST', '/api/uploads', async (ctx) => {
  const { filename, data } = await readBody(ctx.req, MAX_UPLOAD * 1.4);
  const buf = Buffer.from(String(data || '').replace(/^data:[^,]+,/, ''), 'base64');
  if (!buf.length) fail(400, 'No file');
  if (buf.length > MAX_UPLOAD) fail(413, `Images must be ${MAX_UPLOAD / 1024 / 1024} MB or smaller`);
  const info = sniff(buf) || fail(415, 'Use a PNG, JPEG, GIF or WebP image');
  const id = crypto.randomBytes(10).toString('hex');
  const blobUrl = await stores().imageStore.put(id, info.ext, info.mime, buf);
  ctx.db.assets.push({ id, ext: info.ext, mime: info.mime, filename: String(filename || '').slice(0, 200), blobUrl: blobUrl || undefined, createdAt: nowIso() });
  ctx.changed = true;
  return [201, { id, url: blobUrl || `/api/assets/${id}` }];
});
route('GET', '/api/assets/:id', async (ctx, { id }) => {
  const a = ctx.db.assets.find((x) => x.id === id) || fail(404, 'Image not found');
  if (a.blobUrl) return [302, null, { Location: a.blobUrl }];
  const buf = await stores().imageStore.get(a.id, a.ext);
  if (!buf) fail(404, 'Image not found');
  return [200, buf, { 'Content-Type': a.mime, 'Cache-Control': 'private, max-age=86400' }];
});

/** Handle an /api/* request. Returns false if no route matched. */
export async function handleApi(req, res, { brandLocal = false } = {}) {
  const url = new URL(req.url, 'http://localhost');
  try {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = r.re.exec(url.pathname);
      if (!m) continue;
      const ctx = { req, db: await loadDb(), changed: false, brandLocal };
      const [status, body, headers] = await r.handler(ctx, m.groups || {});
      if (ctx.changed) await stores().dataStore.save(ctx.db);
      if (status === 302) { res.writeHead(302, headers); return res.end(); }
      return send(res, status, body, headers);
    }
    fail(404, 'Not found');
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message, ...(e.extra || {}) });
    console.error(e);
    send(res, 500, { error: /No database configured/.test(e.message) ? e.message : 'Something went wrong on the server' });
  }
}
