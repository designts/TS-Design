// Case Study Builder — HTTP server (zero dependencies).
// Persists projects + case studies in data/db.json and serves the SPA.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { SEED_PROJECTS, SEED_CASE_STUDIES } from '../shared/seed.js';
import { generateCaseStudy } from '../shared/generate.js';
import { normalizeProject, validateProject, newId, nowIso } from '../shared/project.js';
import { CASE_STUDY_TYPES } from '../shared/catalog.js';

const PORT = Number(process.env.PORT || 4400);
const ROOT = path.resolve('.');
const PUBLIC_DIR = path.join(ROOT, 'public');
const SHARED_DIR = path.join(ROOT, 'shared');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
const ASSET_DIR = path.join(DATA_DIR, 'assets');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const REMOTE_BRAND = process.env.BRAND_BASE_URL || 'https://case-study-builder-teal.vercel.app/brand';
const MAX_UPLOAD = 8 * 1024 * 1024;

fs.mkdirSync(ASSET_DIR, { recursive: true });

// ------------------------------------------------------------------ storage
function seedState() { return { projects: structuredClone(SEED_PROJECTS), caseStudies: structuredClone(SEED_CASE_STUDIES), assets: [] }; }
let db;
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { db = seedState(); }
db.assets = db.assets || [];
let saveTimer;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 30); }
function flush() { const tmp = DB_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 1)); fs.renameSync(tmp, DB_FILE); }
flush();
process.on('exit', flush);

// ------------------------------------------------------------------ helpers
class HttpError extends Error { constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; } }
const fail = (s, m, x) => { throw new HttpError(s, m, x); };
function send(res, status, body, headers = {}) {
  const buf = Buffer.isBuffer(body);
  res.writeHead(status, { 'Content-Type': buf ? 'application/octet-stream' : 'application/json; charset=utf-8', ...headers });
  res.end(buf ? body : JSON.stringify(body));
}
async function readBody(req, limit = 2 * 1024 * 1024) {
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > limit) fail(413, 'Request too large'); chunks.push(c); }
  if (!size) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail(400, 'Invalid JSON'); }
}
const findProject = (id) => db.projects.find((p) => p.id === id) || fail(404, 'That project could not be found. It may already have been deleted.');
const findCase = (id) => db.caseStudies.find((c) => c.id === id) || fail(404, 'That case study could not be found. It may already have been deleted.');

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

// ------------------------------------------------------------------ routes
const routes = [];
const route = (method, pattern, handler) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler });

route('GET', '/api/config', async (req, res) => {
  const local = fs.existsSync(path.join(PUBLIC_DIR, 'brand', 'techstalwarts-logo-dark.svg'));
  send(res, 200, { brandBase: local ? '/brand' : REMOTE_BRAND, brandSource: local ? 'local' : 'remote' });
});
route('GET', '/api/state', async (req, res) => send(res, 200, { projects: db.projects, caseStudies: db.caseStudies }));

// projects
route('POST', '/api/projects', async (req, res) => {
  const { project } = await readBody(req);
  const p = cleanProject(project);
  checkProject(p);
  const now = nowIso();
  const created = { ...p, id: newId('prj'), createdAt: now, updatedAt: now };
  db.projects.unshift(created);
  save();
  send(res, 201, created);
});
route('PUT', '/api/projects/:id', async (req, res, { id }) => {
  const existing = findProject(id);
  const { project } = await readBody(req);
  const p = cleanProject(project);
  checkProject(p);
  Object.assign(existing, p, { id, updatedAt: nowIso() });
  save();
  send(res, 200, existing);
});
route('POST', '/api/projects/:id/duplicate', async (req, res, { id }) => {
  const src = findProject(id);
  const now = nowIso();
  const copy = { ...structuredClone(src), id: newId('prj'), name: `Copy of ${src.name}`.slice(0, 120), status: 'draft', createdAt: now, updatedAt: now };
  db.projects.unshift(copy);
  save();
  send(res, 201, copy);
});
route('DELETE', '/api/projects/:id', async (req, res, { id }) => {
  findProject(id);
  db.projects = db.projects.filter((p) => p.id !== id);
  save();
  send(res, 200, { ok: true });
});

// case studies
route('POST', '/api/case-studies/generate', async (req, res) => {
  const { type, projectIds, focus } = await readBody(req);
  if (!CASE_STUDY_TYPES.some((t) => t.value === type)) fail(400, 'Choose a case study type');
  if (!Array.isArray(projectIds) || projectIds.length === 0) fail(400, 'Select at least one project.');
  if (type === 'project' && projectIds.length > 1) fail(400, 'A project-specific case study uses exactly one project.');
  const projects = projectIds.map((pid) => findProject(pid));
  const now = nowIso();
  const cs = { ...generateCaseStudy(type, projects, String(focus || '').slice(0, 120)), id: newId('cs'), status: 'draft', createdAt: now, updatedAt: now };
  db.caseStudies.unshift(cs);
  save();
  send(res, 201, cs);
});
route('PUT', '/api/case-studies/:id', async (req, res, { id }) => {
  const existing = findCase(id);
  const { caseStudy } = await readBody(req, 8 * 1024 * 1024);
  if (!caseStudy || !Array.isArray(caseStudy.sections)) fail(400, 'Missing case study');
  const title = String(caseStudy.title || '').trim().slice(0, 160) || existing.title || 'Untitled case study';
  Object.assign(existing, {
    title,
    subtitle: String(caseStudy.subtitle ?? existing.subtitle ?? ''),
    status: caseStudy.status === 'completed' ? 'completed' : 'draft',
    sections: caseStudy.sections,
    updatedAt: nowIso(),
  });
  save();
  send(res, 200, existing);
});
route('POST', '/api/case-studies/:id/duplicate', async (req, res, { id }) => {
  const src = findCase(id);
  const now = nowIso();
  const copy = { ...structuredClone(src), id: newId('cs'), title: `Copy of ${src.title}`, status: 'draft', createdAt: now, updatedAt: now };
  db.caseStudies.unshift(copy);
  save();
  send(res, 201, copy);
});
route('DELETE', '/api/case-studies/:id', async (req, res, { id }) => {
  findCase(id);
  db.caseStudies = db.caseStudies.filter((c) => c.id !== id);
  save();
  send(res, 200, { ok: true });
});
route('POST', '/api/reset', async (req, res) => {
  db = { ...seedState(), assets: db.assets };
  save();
  send(res, 200, { ok: true });
});

// uploads
route('POST', '/api/uploads', async (req, res) => {
  const { filename, data } = await readBody(req, MAX_UPLOAD * 1.4);
  const buf = Buffer.from(String(data || '').replace(/^data:[^,]+,/, ''), 'base64');
  if (!buf.length) fail(400, 'No file');
  if (buf.length > MAX_UPLOAD) fail(413, 'Images must be 8 MB or smaller');
  const info = sniff(buf) || fail(415, 'Use a PNG, JPEG, GIF or WebP image');
  const id = crypto.randomBytes(10).toString('hex');
  fs.writeFileSync(path.join(ASSET_DIR, `${id}.${info.ext}`), buf);
  db.assets.push({ id, ext: info.ext, mime: info.mime, filename: String(filename || '').slice(0, 200), createdAt: nowIso() });
  save();
  send(res, 201, { id, url: `/api/assets/${id}` });
});
route('GET', '/api/assets/:id', async (req, res, { id }) => {
  const a = db.assets.find((x) => x.id === id) || fail(404, 'Image not found');
  send(res, 200, fs.readFileSync(path.join(ASSET_DIR, `${a.id}.${a.ext}`)), { 'Content-Type': a.mime, 'Cache-Control': 'private, max-age=86400' });
});

// ------------------------------------------------------------------ static
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json' };
function serveFile(res, base, rel, spaFallback) {
  const file = path.resolve(base, '.' + path.posix.normalize('/' + decodeURIComponent(rel)));
  if (!file.startsWith(base)) return send(res, 404, { error: 'Not found' });
  fs.readFile(file, (err, buf) => {
    if (err) {
      if (!spaFallback) return send(res, 404, { error: 'Not found' });
      return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e, html) => (e ? send(res, 500, { error: 'index.html missing' }) : send(res, 200, html, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' })));
    }
    send(res, 200, buf, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  });
}

// Optional site-wide password (HTTP Basic auth; any username). Off unless APP_PASSWORD is set.
const APP_PASSWORD = process.env.APP_PASSWORD || '';
function authorized(req) {
  if (!APP_PASSWORD) return true;
  const m = /^Basic (.+)$/.exec(req.headers.authorization || '');
  if (!m) return false;
  const given = Buffer.from(Buffer.from(m[1], 'base64').toString('utf8').split(':').slice(1).join(':'));
  const want = Buffer.from(APP_PASSWORD);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/healthz') return send(res, 200, { ok: true });
  if (!authorized(req)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Case Study Builder", charset="UTF-8"', 'Content-Type': 'text/plain' });
    return res.end('Password required');
  }
  try {
    if (url.pathname.startsWith('/api/')) {
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = r.re.exec(url.pathname);
        if (m) return await r.handler(req, res, m.groups || {});
      }
      fail(404, 'Not found');
    }
    if (url.pathname.startsWith('/shared/')) return serveFile(res, SHARED_DIR, url.pathname.slice(7), false);
    const isAsset = /\.[a-z0-9]+$/i.test(url.pathname);
    return serveFile(res, PUBLIC_DIR, url.pathname === '/' ? '/index.html' : url.pathname, !isAsset);
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message, ...(e.extra || {}) });
    console.error(e);
    send(res, 500, { error: 'Something went wrong on the server' });
  }
}).listen(PORT, () => console.log(`Case Study Builder running at http://localhost:${PORT}`));
