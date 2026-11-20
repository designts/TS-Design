// TechStalwarts Case Study Generator — HTTP server (zero dependencies).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, save, newId, ASSET_DIR, EXPORT_DIR, THUMB_DIR } from './db.js';
import { getTemplate, publicTemplate, templateIds, templateSummary, mappingRows, allNodeIds, state as templateState, setNodeOverride } from './templates.js';
import { sniffImage, placeholderPng, FIGMA_MAX_IMAGE } from './images.js';
import { validate, emptyData } from '../shared/validate.js';
import { compile } from '../shared/compile.js';
import { derive } from '../shared/derive.js';

const PORT = Number(process.env.PORT || 4400);
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'admin-change-me';
const ADMIN_CAN_EDIT = process.env.ADMIN_CAN_EDIT !== 'false';
const MAX_UPLOAD = 8 * 1024 * 1024;
const PUBLIC_DIR = path.resolve('public');
const SHARED_DIR = path.resolve('shared');

if (!process.env.ADMIN_PASSCODE) console.warn('⚠  ADMIN_PASSCODE not set — using the development default "admin-change-me".');

// ---------------------------------------------------------------- helpers
class HttpError extends Error { constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; } }
const fail = (status, message, extra) => { throw new HttpError(status, message, extra); };

function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  res.writeHead(status, { 'Content-Type': isBuf ? 'application/octet-stream' : 'application/json; charset=utf-8', ...headers });
  res.end(isBuf ? body : JSON.stringify(body));
}

async function readBody(req, limit = 2 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) fail(413, 'Request too large');
    chunks.push(c);
  }
  if (!size) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail(400, 'Invalid JSON'); }
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
}

function currentUser(req) {
  const sid = parseCookies(req).sid;
  const s = sid && db.sessions[sid];
  return s ? s.user : null;
}
const requireUser = (req) => currentUser(req) || fail(401, 'Please sign in');
function requireAdmin(req) {
  const u = requireUser(req);
  if (u.role !== 'admin') fail(403, 'Admin only');
  return u;
}
function requirePlugin(req) {
  const token = req.headers['x-plugin-token'];
  const a = Buffer.from(String(token || '')), b = Buffer.from(db.config.pluginToken);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) fail(401, 'Invalid plugin token');
}

const now = () => new Date().toISOString();
const findCase = (id) => db.caseStudies.find((c) => c.id === id) || fail(404, 'Case study not found');

function canView(user, cs) { return user.role === 'admin' || cs.ownerEmail === user.email; }

function titleOf(cs) {
  const d = cs.data || {};
  return (cs.templateId === 'staffing' ? d.client_name && `${d.client_name} — Staffing` : d.project_title) || 'Untitled case study';
}

function log(cs, user, action, note) {
  cs.history.push({ at: now(), by: user ? user.name : 'Figma plugin', action, note: note || undefined });
}

function caseView(cs, user) {
  const t = getTemplate(cs.templateId);
  const gen = cs.generation;
  return {
    id: cs.id, templateId: cs.templateId, templateName: t.name, title: titleOf(cs), status: cs.status, isTest: !!cs.isTest,
    ownerName: cs.ownerName, ownerEmail: cs.ownerEmail, createdAt: cs.createdAt, updatedAt: cs.updatedAt, submittedAt: cs.submittedAt,
    approvedAt: cs.approvedAt, approvedBy: cs.approvedBy, version: cs.version, stale: !!cs.stale,
    data: cs.data, derived: derive(cs.templateId, cs.data),
    changeRequests: cs.changeRequests, history: cs.history,
    generation: gen ? {
      status: gen.status, requestedAt: gen.requestedAt, requestedBy: gen.requestedBy, version: gen.version,
      completedAt: gen.completedAt, error: gen.error, warnings: gen.warnings,
      figmaUrl: gen.result ? `https://www.figma.com/design/${gen.result.fileKey}/?node-id=${encodeURIComponent(gen.result.sectionId.replace(':', '-'))}` : null,
      frames: gen.result ? gen.result.frames : [],
      exports: gen.exports || [],
    } : null,
    permissions: permissions(cs, user),
  };
}

function permissions(cs, user) {
  const owner = cs.ownerEmail === user.email;
  const admin = user.role === 'admin';
  const s = cs.status;
  return {
    edit: (owner && ['draft', 'changes_requested', 'submitted'].includes(s)) || (admin && ADMIN_CAN_EDIT && s !== 'approved' && s !== 'generating'),
    editAdminFields: admin && s !== 'approved' && s !== 'generating',
    submit: owner && ['draft', 'changes_requested'].includes(s),
    requestChanges: admin && ['submitted', 'generated'].includes(s),
    generate: admin && ['submitted', 'generated'].includes(s),
    approve: admin && s === 'generated' && !cs.stale,
    reopen: admin && s === 'approved',
    delete: (owner && s === 'draft') || admin,
  };
}

// ---------------------------------------------------------------- generation
function queueGeneration(cs, user) {
  const t = getTemplate(cs.templateId);
  const errors = validate(t, cs.data, 'generate');
  if (Object.keys(errors).length) fail(422, 'Some information is missing or invalid', { errors });
  const { ops, assets, warnings } = compile(t, cs.data); // t.bindings already include admin node overrides
  const version = (cs.version || 0) + 1;
  const previousSectionId = cs.generation && cs.generation.result ? cs.generation.result.sectionId : null;
  cs.version = version;
  cs.generation = {
    jobId: `${cs.id}-v${version}`, status: 'queued', version, requestedAt: now(), requestedBy: user.name,
    ops, assets, warnings, previousSectionId, previousResult: cs.generation && cs.generation.result, previousExports: cs.generation && cs.generation.exports,
    previousStatus: cs.status,
  };
  cs.status = 'generating';
  cs.stale = false;
  log(cs, user, `Generation v${version} queued`);
}

function jobFor(cs) {
  const t = getTemplate(cs.templateId);
  const g = cs.generation;
  return {
    id: g.jobId, caseStudyId: cs.id, version: g.version, title: titleOf(cs), isTest: !!cs.isTest,
    sectionName: `${cs.isTest ? 'TEST · ' : ''}CS-${cs.id.slice(0, 6)} · ${titleOf(cs)} · v${g.version}`,
    template: { id: t.id, name: t.name, figma: t.figma },
    ops: g.ops, assets: g.assets, previousSectionId: g.previousSectionId,
  };
}

// ---------------------------------------------------------------- static files
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
function serveStatic(res, baseDir, rel) {
  const file = path.resolve(baseDir, '.' + path.posix.normalize('/' + rel));
  if (!file.startsWith(baseDir)) return send(res, 404, { error: 'Not found' });
  fs.readFile(file, (err, buf) => {
    if (err) {
      if (baseDir === PUBLIC_DIR) return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, html) => (e2 ? send(res, 404, { error: 'Not found' }) : send(res, 200, html, { 'Content-Type': MIME['.html'] })));
      return send(res, 404, { error: 'Not found' });
    }
    send(res, 200, buf, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  });
}

function sendFile(res, file, mime, downloadName) {
  if (!fs.existsSync(file)) return send(res, 404, { error: 'File not found' });
  const headers = { 'Content-Type': mime, 'Cache-Control': 'private, max-age=3600' };
  if (downloadName) headers['Content-Disposition'] = `attachment; filename="${downloadName.replace(/[^\w.\- ]/g, '_')}"`;
  send(res, 200, fs.readFileSync(file), headers);
}

function storeAsset(buf, { filename, ownerEmail }) {
  const info = sniffImage(buf);
  if (!info) fail(415, 'Only PNG, JPEG or GIF images are supported');
  if (info.width > FIGMA_MAX_IMAGE || info.height > FIGMA_MAX_IMAGE) fail(422, `Image is ${info.width}×${info.height}px; Figma accepts at most ${FIGMA_MAX_IMAGE}px per side`);
  const id = newId(10);
  fs.writeFileSync(path.join(ASSET_DIR, `${id}.${info.ext}`), buf);
  const meta = { id, mime: info.mime, ext: info.ext, width: info.width, height: info.height, size: buf.length, filename: filename || `image.${info.ext}`, ownerEmail, createdAt: now() };
  db.assets.push(meta);
  save();
  return meta;
}
const assetMeta = (id) => db.assets.find((a) => a.id === id);

// ---------------------------------------------------------------- routes
const routes = [];
const route = (method, pattern, handler) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler });

// --- auth
route('POST', '/api/login', async (req, res) => {
  const { name, email, role, passcode } = await readBody(req);
  if (!name || !String(name).trim()) fail(400, 'Enter your name');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '')) fail(400, 'Enter a valid email');
  if (!['stakeholder', 'admin'].includes(role)) fail(400, 'Choose a role');
  if (role === 'admin' && passcode !== ADMIN_PASSCODE) fail(403, 'Incorrect admin passcode');
  const sid = newId(24);
  const user = { name: String(name).trim(), email: String(email).trim().toLowerCase(), role };
  db.sessions[sid] = { user, createdAt: now() };
  save();
  send(res, 200, { user }, { 'Set-Cookie': `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 14}` });
});
route('POST', '/api/logout', async (req, res) => {
  delete db.sessions[parseCookies(req).sid];
  save();
  send(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; Path=/; Max-Age=0' });
});
route('GET', '/api/me', async (req, res) => send(res, 200, { user: currentUser(req), adminCanEdit: ADMIN_CAN_EDIT }));

// --- templates (stakeholder view)
route('GET', '/api/templates', async (req, res) => {
  const u = requireUser(req);
  send(res, 200, templateIds().map((id) => publicTemplate(getTemplate(id), { admin: u.role === 'admin' })));
});

// --- uploads
route('POST', '/api/uploads', async (req, res) => {
  const u = requireUser(req);
  const { filename, data } = await readBody(req, MAX_UPLOAD * 1.4);
  if (!data) fail(400, 'No file');
  const buf = Buffer.from(String(data).replace(/^data:[^,]+,/, ''), 'base64');
  if (buf.length > MAX_UPLOAD) fail(413, 'Images must be 8 MB or smaller');
  const meta = storeAsset(buf, { filename, ownerEmail: u.email });
  send(res, 201, { id: meta.id, width: meta.width, height: meta.height, filename: meta.filename });
});
function canSeeAsset(u, a) {
  if (u.role === 'admin' || a.ownerEmail === u.email) return true;
  return db.caseStudies.some((c) => canView(u, c) && JSON.stringify(c.data).includes(`"${a.id}"`));
}
route('GET', '/api/assets/:id', async (req, res, p) => {
  const u = requireUser(req);
  const a = assetMeta(p.id);
  if (!a || !canSeeAsset(u, a)) fail(404, 'Image not found');
  sendFile(res, path.join(ASSET_DIR, `${a.id}.${a.ext}`), a.mime);
});
route('GET', '/api/assets/:id/meta', async (req, res, p) => {
  const u = requireUser(req);
  const a = assetMeta(p.id);
  if (!a || !canSeeAsset(u, a)) fail(404, 'Image not found');
  send(res, 200, { id: a.id, width: a.width, height: a.height, filename: a.filename });
});

// --- case studies
route('GET', '/api/case-studies', async (req, res) => {
  const u = requireUser(req);
  const list = db.caseStudies.filter((c) => canView(u, c)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  send(res, 200, list.map((c) => { const v = caseView(c, u); delete v.data; delete v.history; return v; }));
});
route('POST', '/api/case-studies', async (req, res) => {
  const u = requireUser(req);
  const { templateId } = await readBody(req);
  const t = getTemplate(templateId) || fail(400, 'Unknown template');
  const cs = { id: newId(8), templateId: t.id, ownerEmail: u.email, ownerName: u.name, status: 'draft', data: emptyData(t), createdAt: now(), updatedAt: now(), version: 0, changeRequests: [], history: [] };
  log(cs, u, 'Created');
  db.caseStudies.push(cs);
  save();
  send(res, 201, caseView(cs, u));
});
route('GET', '/api/case-studies/:id', async (req, res, p) => {
  const u = requireUser(req);
  const cs = findCase(p.id);
  if (!canView(u, cs)) fail(404, 'Case study not found');
  send(res, 200, caseView(cs, u));
});
route('PUT', '/api/case-studies/:id', async (req, res, p) => {
  const u = requireUser(req);
  const cs = findCase(p.id);
  if (!canView(u, cs)) fail(404, 'Case study not found');
  const perms = permissions(cs, u);
  const t = getTemplate(cs.templateId);
  const { data } = await readBody(req);
  if (!data || typeof data !== 'object') fail(400, 'Missing data');
  const next = { ...cs.data };
  let changed = false;
  for (const f of t.fields) {
    if (!(f.key in data)) continue;
    const allowed = f.adminOnly ? perms.editAdminFields : perms.edit;
    if (!allowed) { if (JSON.stringify(data[f.key]) !== JSON.stringify(cs.data[f.key])) fail(403, cs.status === 'approved' ? 'This case study is approved and locked. An admin can reopen it.' : 'You cannot edit this case study in its current status'); continue; }
    if (JSON.stringify(data[f.key]) !== JSON.stringify(cs.data[f.key])) { next[f.key] = data[f.key]; changed = true; }
  }
  const errors = validate(t, next, 'draft');
  if (Object.keys(errors).length) fail(422, 'Please fix the highlighted fields', { errors });
  // Uploaded images must exist (and belong to someone who can see this case study).
  for (const f of t.fields) {
    const ids = f.type === 'image' ? [next[f.key]] : f.type === 'repeater' ? (next[f.key] || []).flatMap((it) => f.itemFields.filter((s) => s.type === 'image').map((s) => it && it[s.key])) : [];
    for (const id of ids) if (id && !assetMeta(id)) fail(422, `Image for "${f.label}" is missing — please upload it again`);
  }
  if (changed) {
    cs.data = next;
    cs.updatedAt = now();
    if (cs.generation && ['generated'].includes(cs.status)) cs.stale = true;
    log(cs, u, 'Edited information');
    save();
  }
  send(res, 200, caseView(cs, u));
});
route('DELETE', '/api/case-studies/:id', async (req, res, p) => {
  const u = requireUser(req);
  const cs = findCase(p.id);
  if (!canView(u, cs) || !permissions(cs, u).delete) fail(403, 'You cannot delete this case study');
  db.caseStudies = db.caseStudies.filter((c) => c !== cs);
  save();
  send(res, 200, { ok: true, note: cs.generation && cs.generation.result ? 'The generated copy in Figma was not deleted.' : undefined });
});
route('POST', '/api/case-studies/:id/submit', async (req, res, p) => {
  const u = requireUser(req);
  const cs = findCase(p.id);
  if (!canView(u, cs) || !permissions(cs, u).submit) fail(403, 'This case study cannot be submitted now');
  const errors = validate(getTemplate(cs.templateId), cs.data, 'submit');
  if (Object.keys(errors).length) fail(422, 'Some required information is missing', { errors });
  cs.status = 'submitted';
  cs.submittedAt = now();
  cs.updatedAt = now();
  cs.changeRequests.forEach((r) => { r.resolved = true; });
  log(cs, u, 'Submitted for review');
  save();
  send(res, 200, caseView(cs, u));
});
route('POST', '/api/case-studies/:id/request-changes', async (req, res, p) => {
  const u = requireAdmin(req);
  const cs = findCase(p.id);
  if (!permissions(cs, u).requestChanges) fail(409, 'Changes can only be requested on submitted or generated case studies');
  const { note, fields } = await readBody(req);
  if (!note || !String(note).trim()) fail(400, 'Describe what is missing or needs changing');
  cs.changeRequests.push({ id: newId(4), at: now(), by: u.name, note: String(note).trim(), fields: Array.isArray(fields) ? fields : [], resolved: false });
  cs.status = 'changes_requested';
  cs.updatedAt = now();
  log(cs, u, 'Requested changes', String(note).trim());
  save();
  send(res, 200, caseView(cs, u));
});
route('POST', '/api/case-studies/:id/generate', async (req, res, p) => {
  const u = requireAdmin(req);
  const cs = findCase(p.id);
  if (!permissions(cs, u).generate) fail(409, 'Only submitted or previously generated case studies can be generated');
  queueGeneration(cs, u);
  cs.updatedAt = now();
  save();
  send(res, 200, caseView(cs, u));
});
route('POST', '/api/case-studies/:id/cancel-generation', async (req, res, p) => {
  const u = requireAdmin(req);
  const cs = findCase(p.id);
  if (cs.status !== 'generating') fail(409, 'Nothing to cancel');
  const g = cs.generation;
  cs.status = g.previousStatus === 'generated' && g.previousResult ? 'generated' : 'submitted';
  cs.generation = g.previousResult ? { ...g, status: 'done', result: g.previousResult, exports: g.previousExports, error: null } : null;
  log(cs, u, `Generation v${g.version} cancelled`);
  save();
  send(res, 200, caseView(cs, u));
});
route('POST', '/api/case-studies/:id/approve', async (req, res, p) => {
  const u = requireAdmin(req);
  const cs = findCase(p.id);
  if (!permissions(cs, u).approve) fail(409, cs.stale ? 'Information changed since the last generation — regenerate before approving' : 'Only generated case studies can be approved');
  cs.status = 'approved';
  cs.approvedAt = now();
  cs.approvedBy = u.name;
  cs.updatedAt = now();
  log(cs, u, `Approved v${cs.version}`);
  save();
  send(res, 200, caseView(cs, u));
});
route('POST', '/api/case-studies/:id/reopen', async (req, res, p) => {
  const u = requireAdmin(req);
  const cs = findCase(p.id);
  if (!permissions(cs, u).reopen) fail(409, 'Only approved case studies can be reopened');
  cs.status = 'generated';
  cs.approvedAt = null;
  cs.approvedBy = null;
  log(cs, u, 'Reopened for revision');
  save();
  send(res, 200, caseView(cs, u));
});
route('GET', '/api/case-studies/:id/exports/:file', async (req, res, p) => {
  const u = requireUser(req);
  const cs = findCase(p.id);
  if (!canView(u, cs)) fail(404, 'Not found');
  const exp = (cs.generation && cs.generation.exports || []).flatMap((e) => [e.png, e.pdf]).find((f) => f === p.file) || fail(404, 'Export not found');
  const download = new URL(req.url, 'http://x').searchParams.has('download');
  sendFile(res, path.join(EXPORT_DIR, cs.id, exp), exp.endsWith('.pdf') ? 'application/pdf' : 'image/png', download ? `${titleOf(cs)} - ${exp}` : null);
});

// --- admin: templates
route('GET', '/api/admin/templates', async (req, res) => {
  requireAdmin(req);
  send(res, 200, { templates: templateIds().map((id) => templateSummary(getTemplate(id))), pluginToken: db.config.pluginToken, serverUrl: `http://localhost:${PORT}` });
});
route('GET', '/api/admin/templates/:id', async (req, res, p) => {
  requireAdmin(req);
  const t = getTemplate(p.id) || fail(404, 'Unknown template');
  send(res, 200, { summary: templateSummary(t), mapping: mappingRows(t), fields: t.fields, lastSync: templateState(t.id).lastSync });
});
route('PUT', '/api/admin/templates/:id/reference', async (req, res, p) => {
  const u = requireAdmin(req);
  const t = getTemplate(p.id) || fail(404, 'Unknown template');
  const { fileKey, fileName, sectionId, frames } = await readBody(req);
  const nodeId = /^\d+:\d+$/;
  if (!/^[A-Za-z0-9]{10,}$/.test(fileKey || '')) fail(400, 'File key looks wrong (find it in the Figma URL after /design/)');
  if (!nodeId.test(sectionId || '')) fail(400, 'Section node ID must look like 665:692');
  if (!Array.isArray(frames) || frames.length !== t.figma.frames.length || frames.some((f) => !nodeId.test(f.id || ''))) fail(400, `Provide ${t.figma.frames.length} frame node ID(s)`);
  templateState(t.id).reference = { fileKey, fileName: fileName || t.figma.fileName, sectionId, frames: frames.map((f, i) => ({ ...t.figma.frames[i], id: f.id })) };
  templateState(t.id).lastSync = null; // must re-sync against the new reference
  templateState(t.id).updatedBy = u.name;
  save();
  send(res, 200, templateSummary(getTemplate(t.id)));
});
route('PUT', '/api/admin/templates/:id/nodes', async (req, res, p) => {
  requireAdmin(req);
  getTemplate(p.id) || fail(404, 'Unknown template');
  const { bindingId, path: refPath, nodeId } = await readBody(req);
  if (nodeId && !/^I?[\d:;]+$/.test(nodeId)) fail(400, 'Node ID must look like 648:85 (or I648:234;648:54 for a layer inside an instance)');
  setNodeOverride(p.id, bindingId, refPath, nodeId);
  const t = getTemplate(p.id);
  send(res, 200, { summary: templateSummary(t), mapping: mappingRows(t) });
});
route('POST', '/api/admin/templates/:id/test', async (req, res, p) => {
  const u = requireAdmin(req);
  const t = getTemplate(p.id) || fail(404, 'Unknown template');
  const data = { ...emptyData(t), ...structuredClone(t.sampleData || {}) };
  for (const key of data.sampleImages || []) {
    const field = t.fields.find((f) => f.key === key);
    const portrait = /screen/.test(key);
    const meta = storeAsset(placeholderPng(portrait ? 390 : 480, portrait ? 844 : 120), { filename: `test-${key}.png`, ownerEmail: u.email });
    if (field) data[key] = meta.id;
  }
  delete data.sampleImages;
  const cs = { id: newId(8), templateId: t.id, ownerEmail: u.email, ownerName: u.name, status: 'submitted', isTest: true, data, createdAt: now(), updatedAt: now(), submittedAt: now(), version: 0, changeRequests: [], history: [] };
  log(cs, u, 'Template test created with sample data');
  db.caseStudies.push(cs);
  queueGeneration(cs, u);
  save();
  send(res, 201, caseView(cs, u));
});

// --- Figma plugin API (token auth, CORS for the plugin iframe)
route('GET', '/api/plugin/hello', async (req, res) => { requirePlugin(req); send(res, 200, { ok: true, templates: templateIds() }); });
route('GET', '/api/plugin/templates', async (req, res) => {
  requirePlugin(req);
  send(res, 200, templateIds().map((id) => { const t = getTemplate(id); return { id: t.id, name: t.name, figma: t.figma, nodeIds: allNodeIds(t) }; }));
});
route('POST', '/api/plugin/templates/:id/sync', async (req, res, p) => {
  requirePlugin(req);
  const t = getTemplate(p.id) || fail(404, 'Unknown template');
  const { report } = await readBody(req, 30 * 1024 * 1024);
  if (!report || !report.nodes) fail(400, 'Missing sync report');
  const st = templateState(t.id);
  st.thumbnails = (report.thumbnails || []).map((th) => {
    const file = `${t.id}-${th.frameId.replace(/[^\d]/g, '_')}.png`;
    fs.writeFileSync(path.join(THUMB_DIR, file), Buffer.from(th.png, 'base64'));
    return { frameId: th.frameId, file };
  });
  delete report.thumbnails;
  st.lastSync = report;
  save();
  send(res, 200, templateSummary(t));
});
route('GET', '/api/thumbnails/:file', async (req, res, p) => {
  requireAdmin(req);
  sendFile(res, path.join(THUMB_DIR, path.basename(p.file)), 'image/png');
});
route('GET', '/api/plugin/jobs', async (req, res) => {
  requirePlugin(req);
  send(res, 200, db.caseStudies.filter((c) => c.status === 'generating' && c.generation && ['queued', 'running'].includes(c.generation.status))
    .map((c) => ({ id: c.generation.jobId, caseStudyId: c.id, title: titleOf(c), template: getTemplate(c.templateId).name, version: c.generation.version, status: c.generation.status, requestedAt: c.generation.requestedAt, isTest: !!c.isTest })));
});
const caseByJob = (jobId) => db.caseStudies.find((c) => c.generation && c.generation.jobId === jobId) || fail(404, 'Job not found (it may have been cancelled or superseded)');
route('POST', '/api/plugin/jobs/:id/claim', async (req, res, p) => {
  requirePlugin(req);
  const cs = caseByJob(p.id);
  if (cs.status !== 'generating') fail(409, 'Job is no longer queued');
  cs.generation.status = 'running';
  cs.generation.startedAt = now();
  save();
  send(res, 200, jobFor(cs));
});
route('GET', '/api/plugin/assets/:id', async (req, res, p) => {
  requirePlugin(req);
  const a = assetMeta(p.id) || fail(404, 'Image not found');
  sendFile(res, path.join(ASSET_DIR, `${a.id}.${a.ext}`), a.mime);
});
route('POST', '/api/plugin/jobs/:id/complete', async (req, res, p) => {
  requirePlugin(req);
  const cs = caseByJob(p.id);
  if (cs.status !== 'generating') fail(409, 'Job is no longer active');
  const { result, exports } = await readBody(req, 150 * 1024 * 1024);
  if (!result || !result.sectionId) fail(400, 'Missing result');
  const dir = path.join(EXPORT_DIR, cs.id);
  fs.mkdirSync(dir, { recursive: true });
  const files = (exports || []).map((e, i) => {
    const base = `v${cs.generation.version}-${String(i + 1).padStart(2, '0')}`;
    fs.writeFileSync(path.join(dir, `${base}.png`), Buffer.from(e.png, 'base64'));
    fs.writeFileSync(path.join(dir, `${base}.pdf`), Buffer.from(e.pdf, 'base64'));
    return { name: e.name, nodeId: e.nodeId, png: `${base}.png`, pdf: `${base}.pdf` };
  });
  const g = cs.generation;
  Object.assign(g, { status: 'done', completedAt: now(), result, exports: files, warnings: [...(g.warnings || []), ...(result.warnings || [])], error: null });
  delete g.previousResult; delete g.previousExports;
  cs.status = 'generated';
  cs.updatedAt = now();
  log(cs, null, `Generated v${g.version} in Figma`, result.removedPrevious ? 'Previous generated copy replaced' : undefined);
  save();
  send(res, 200, { ok: true });
});
route('POST', '/api/plugin/jobs/:id/fail', async (req, res, p) => {
  requirePlugin(req);
  const cs = caseByJob(p.id);
  const { message } = await readBody(req);
  const g = cs.generation;
  g.status = 'failed';
  g.error = String(message || 'Unknown error').slice(0, 2000);
  cs.status = g.previousStatus === 'generated' ? 'generated' : 'submitted';
  if (g.previousResult) { g.result = g.previousResult; g.exports = g.previousExports; }
  log(cs, null, `Generation v${g.version} failed`, g.error);
  save();
  send(res, 200, { ok: true });
});

// ---------------------------------------------------------------- server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const isPlugin = url.pathname.startsWith('/api/plugin/');
  if (isPlugin) {
    // The Figma plugin UI runs in a sandboxed iframe with a null origin.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Plugin-Token');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.writeHead(204).end();
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
    if (url.pathname.startsWith('/shared/')) return serveStatic(res, SHARED_DIR, url.pathname.slice('/shared'.length));
    return serveStatic(res, PUBLIC_DIR, url.pathname === '/' ? '/index.html' : url.pathname);
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message, ...(e.extra || {}) });
    console.error(e);
    send(res, 500, { error: 'Something went wrong on the server' });
  }
});

server.listen(PORT, () => {
  console.log(`Case Study Generator running at http://localhost:${PORT}`);
  console.log(`Figma plugin token: ${db.config.pluginToken}`);
});
