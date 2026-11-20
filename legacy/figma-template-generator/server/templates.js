// Template registry: approved template definitions (templates/*.json) merged with
// admin-managed state (Figma reference updates, node re-mappings, last sync).
import fs from 'node:fs';
import path from 'node:path';
import { db, save } from './db.js';
import { resolveBindings, bindingNodeRefs, bindingFields } from '../shared/compile.js';

const TEMPLATE_DIR = path.resolve('templates');

const definitions = Object.fromEntries(
  fs.readdirSync(TEMPLATE_DIR).filter((f) => f.endsWith('.json')).map((f) => {
    const t = JSON.parse(fs.readFileSync(path.join(TEMPLATE_DIR, f), 'utf8'));
    return [t.id, t];
  }),
);

export const templateIds = () => Object.keys(definitions);

export function state(id) {
  if (!db.templates[id]) db.templates[id] = { reference: null, nodeOverrides: {}, lastSync: null, thumbnails: [] };
  return db.templates[id];
}

/** Effective template = approved definition + admin overrides. */
export function getTemplate(id) {
  const def = definitions[id];
  if (!def) return null;
  const st = state(id);
  const t = structuredClone(def);
  if (st.reference) t.figma = { ...t.figma, ...st.reference };
  t.bindings = resolveBindings(def, st.nodeOverrides);
  return t;
}

/** What stakeholders see: no node IDs, no admin-only fields. */
export function publicTemplate(t, { admin = false } = {}) {
  return {
    id: t.id, name: t.name, description: t.description, cta: t.cta,
    sections: t.sections.filter((s) => admin || !s.adminOnly),
    fields: t.fields.filter((f) => admin || !f.adminOnly),
    derived: t.derived || [],
    frames: t.figma.frames.map((f) => ({ label: f.label || f.name })),
  };
}

export function allNodeIds(t) {
  const ids = new Set();
  t.figma.frames.forEach((f) => ids.add(f.id));
  if (t.figma.sectionId) ids.add(t.figma.sectionId);
  for (const b of t.bindings) bindingNodeRefs(b).forEach((r) => ids.add(r.nodeId));
  return [...ids];
}

export function mappingRows(t) {
  const sync = state(t.id).lastSync;
  const fieldLabel = (k) => {
    if (k.startsWith('derived.')) {
      const d = (t.derived || []).find((x) => x.key === k.slice(8));
      if (!d) return `${k.slice(8)} (calculated)`;
      const src = (d.from || []).map((s) => (t.fields.find((x) => x.key === s) || {}).label || s);
      return `${d.label} (calculated from ${src.join(', ')})`;
    }
    const f = t.fields.find((x) => x.key === k);
    return f ? f.label : k;
  };
  return t.bindings.map((b) => ({
    id: b.id,
    type: b.type,
    layer: b.nodeName,
    note: b.note,
    fields: bindingFields(b).map((k) => ({ key: k, label: fieldLabel(k) })),
    nodes: bindingNodeRefs(b).map((r) => ({
      ...r,
      status: sync ? (sync.nodes[r.nodeId] || { exists: false }) : null,
      overridden: !!(state(t.id).nodeOverrides[b.id] || {})[r.path],
    })),
  }));
}

export function templateSummary(t) {
  const st = state(t.id);
  const mappedFieldKeys = new Set();
  t.bindings.forEach((b) => bindingFields(b).forEach((k) => {
    if (!k.startsWith('derived.')) return mappedFieldKeys.add(k);
    const d = (t.derived || []).find((x) => x.key === k.slice(8));
    (d && d.from || []).forEach((src) => mappedFieldKeys.add(src));
  }));
  const rows = mappingRows(t);
  let status = 'Not synced';
  let missing = 0;
  if (st.lastSync) {
    missing = rows.flatMap((r) => r.nodes).filter((n) => !n.status || !n.status.exists || n.status.insideTemplate === false).length;
    const framesMissing = st.lastSync.frames.filter((f) => !f.exists).length;
    status = st.lastSync.fileMismatch ? 'Wrong Figma file' : framesMissing || missing ? 'Needs attention' : 'Ready';
    missing += framesMissing;
  }
  return {
    id: t.id, name: t.name, description: t.description,
    figma: t.figma,
    figmaUrl: `https://www.figma.com/design/${t.figma.fileKey}/?node-id=${encodeURIComponent(t.figma.sectionId.replace(':', '-'))}`,
    status, problems: missing,
    lastSyncedAt: st.lastSync ? st.lastSync.checkedAt : null,
    mappedFields: [...mappedFieldKeys].filter((k) => t.fields.some((f) => f.key === k)).length,
    totalFields: t.fields.length,
    bindings: t.bindings.length,
    thumbnails: st.thumbnails,
  };
}

export function setNodeOverride(id, bindingId, refPath, nodeId) {
  const def = definitions[id];
  const b = def && def.bindings.find((x) => x.id === bindingId);
  if (!b) throw Object.assign(new Error('Unknown binding'), { status: 404 });
  if (!bindingNodeRefs(b).some((r) => r.path === refPath)) throw Object.assign(new Error('Unknown layer reference'), { status: 400 });
  const st = state(id);
  st.nodeOverrides[bindingId] = st.nodeOverrides[bindingId] || {};
  const original = bindingNodeRefs(b).find((r) => r.path === refPath).nodeId;
  if (!nodeId || nodeId === original) delete st.nodeOverrides[bindingId][refPath];
  else st.nodeOverrides[bindingId][refPath] = nodeId;
  save();
}
