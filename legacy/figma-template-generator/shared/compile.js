// Mapping layer: turns (template bindings + submitted data) into a flat list of
// Figma operations that the Figma plugin executes against a *copy* of the master.
// Every op references master-template node IDs; the plugin translates them to the
// cloned nodes and refuses to touch anything outside the clone.
import { derive, monthLabel, parseMonth } from './derive.js';

const blank = (v) => v === undefined || v === null || String(v).trim() === '';

/** Apply admin overrides of node references: overrides[bindingId][refPath] = newNodeId */
export function resolveBindings(template, overrides = {}) {
  const bindings = JSON.parse(JSON.stringify(template.bindings));
  for (const b of bindings) {
    const o = overrides[b.id];
    if (!o) continue;
    for (const [path, nodeId] of Object.entries(o)) setPath(b, path, nodeId);
  }
  return bindings;
}

function setPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
  cur[parts[parts.length - 1]] = value;
}

/** Lists every node reference a binding uses, as { path, nodeId } (for sync verification + admin mapping review). */
export function bindingNodeRefs(b) {
  const refs = [];
  const add = (path, id) => id && refs.push({ path, nodeId: id });
  add('node', b.node);
  add('container', b.container);
  add('bars', b.bars);
  add('barPrototype', b.barPrototype);
  add('textStyleFrom', b.textStyleFrom);
  add('collapseUpTo', b.collapseUpTo);
  (b.slots || []).forEach((s, i) => { add(`slots.${i}.node`, s.node); add(`slots.${i}.text`, s.text); add(`slots.${i}.hide`, s.hide); add(`slots.${i}.source`, s.source); });
  (b.left || []).forEach((s, i) => { add(`left.${i}.hide`, s.hide); add(`left.${i}.text`, s.text); });
  (b.right || []).forEach((s, i) => { add(`right.${i}.hide`, s.hide); add(`right.${i}.text`, s.text); });
  (b.yLabels || []).forEach((id, i) => add(`yLabels.${i}`, id));
  Object.entries(b.markers || {}).forEach(([k, id]) => add(`markers.${k}`, id));
  return refs;
}

/** Fields that a binding consumes (for the "mapped fields" count and the mapping table). */
export function bindingFields(b) {
  const keys = new Set();
  if (b.field) keys.add(b.field);
  const scan = (s) => String(s).replace(/\{([a-z_.]+)\}/g, (_, k) => { keys.add(k); return ''; });
  if (b.value) scan(b.value);
  Object.values(b.replace || {}).forEach(scan);
  Object.values(b.props || {}).forEach((v) => typeof v === 'string' && scan(v));
  if (b.type === 'stackedBar') keys.add('engagement_status');
  return [...keys];
}

function interpolate(tpl, ctx) {
  let missing = false;
  const out = String(tpl).replace(/\{([a-z_.]+)\}/g, (_, key) => {
    const v = key.startsWith('derived.') ? ctx.derived[key.slice(8)] : ctx.data[key];
    if (blank(v)) missing = true;
    return blank(v) ? '' : String(v).trim();
  });
  return { text: out, missing };
}

function niceScale(maxTotal) {
  // 5 equal steps, like the template's 0–10 axis in steps of 2.
  const steps = [1, 2, 4, 5, 10, 15, 20, 25, 50, 100];
  const target = Math.max(maxTotal * 1.08, 1);
  const step = steps.find((s) => s * 5 >= target) || Math.ceil(target / 5);
  return { step, yMax: step * 5 };
}

/**
 * @returns {{ ops: object[], assets: string[], warnings: string[] }}
 */
export function compile(template, data, overrides = {}) {
  const derived = derive(template.id, data);
  const ctx = { data, derived };
  const ops = [];
  const assets = new Set();
  const warnings = [];

  for (const b of resolveBindings(template, overrides)) {
    switch (b.type) {
      case 'text': {
        const { text, missing } = interpolate(b.value, ctx);
        if (missing || blank(text)) ops.push({ op: 'hide', node: b.node, binding: b.id });
        else ops.push({ op: 'text', node: b.node, value: text, binding: b.id });
        break;
      }
      case 'tokens': {
        const replacements = [];
        for (const [token, tpl] of Object.entries(b.replace)) {
          const { text, missing } = interpolate(tpl, ctx);
          if (missing) warnings.push(`${b.nodeName}: no value for ${token}`);
          replacements.push([token, text]);
        }
        ops.push({ op: 'tokens', node: b.node, replacements, binding: b.id });
        break;
      }
      case 'props': {
        const props = {};
        for (const [k, tpl] of Object.entries(b.props)) props[k] = interpolate(tpl, ctx).text;
        ops.push({ op: 'props', node: b.node, props, binding: b.id });
        break;
      }
      case 'image': {
        const id = data[b.field];
        if (blank(id)) { warnings.push(`${b.nodeName}: no image supplied – layer left as in template`); break; }
        assets.add(id);
        ops.push({ op: 'image', node: b.node, asset: id, scaleMode: b.scaleMode || 'FILL', binding: b.id });
        break;
      }
      case 'fill': {
        const color = data[b.field];
        if (blank(color)) break; // keep template design colour
        ops.push({ op: 'fill', node: b.node, color, binding: b.id });
        break;
      }
      case 'hide':
        ops.push({ op: 'hide', node: b.node, binding: b.id });
        break;
      case 'slots': {
        const values = (data[b.field] || []).filter((v) => !blank(v)).map((v) => String(v).trim());
        ops.push({ op: 'slots', slots: b.slots, values: b.slots.map((_, i) => (i < values.length ? values[i] : null)), binding: b.id });
        break;
      }
      case 'twoColumnList': {
        const values = (data[b.field] || []).filter((v) => !blank(v)).map((v) => String(v).trim());
        const leftCount = Math.min(b.left.length, Math.ceil(values.length / 2));
        const left = values.slice(0, leftCount), right = values.slice(leftCount);
        const slots = [...b.left, ...b.right];
        const vals = [...b.left.map((_, i) => left[i] ?? null), ...b.right.map((_, i) => right[i] ?? null)];
        ops.push({ op: 'slots', slots, values: vals, collapseUpTo: b.collapseUpTo, binding: b.id });
        break;
      }
      case 'chips': {
        const values = (data[b.field] || []).filter((v) => !blank(v)).map((v) => String(v).trim());
        ops.push({ op: 'chips', container: b.container, slots: b.slots, values, binding: b.id });
        break;
      }
      case 'cards': {
        const items = (data[b.field] || []).filter((it) => it && !blank(it.value));
        ops.push({
          op: 'cards', slots: b.slots, binding: b.id,
          items: b.slots.map((_, i) => {
            const it = items[i];
            if (!it) return null;
            const props = { [b.props.value]: String(it.value).trim(), [b.props.label]: String(it.label || '').trim() };
            if (!blank(it.source)) props[b.props.source] = `${b.sourcePrefix || ''}${String(it.source).trim()}`;
            return { props, hideSource: blank(it.source) };
          }),
        });
        break;
      }
      case 'logos': {
        const items = (data[b.field] || []).filter((it) => it && !blank(it.name)).map((it) => {
          if (!blank(it.logo)) assets.add(it.logo);
          return { name: String(it.name).trim(), asset: blank(it.logo) ? null : it.logo };
        });
        ops.push({ op: 'logos', container: b.container, items, height: b.height, textStyleFrom: b.textStyleFrom, binding: b.id });
        break;
      }
      case 'stackedBar': {
        const rows = (data[b.field] || []).filter((r) => parseMonth(r.month));
        const totals = rows.map((r) => b.series.reduce((s, k) => s + (Number(r[k]) || 0), 0));
        const maxTotal = Math.max(0, ...totals);
        const { step, yMax } = niceScale(maxTotal);
        const years = new Set(rows.map((r) => parseMonth(r.month).year));
        const months = rows.map((r, i) => {
          const p = parseMonth(r.month);
          const label = years.size > 1 ? `${monthLabel(r.month, false)} ’${String(p.year).slice(2)}` : monthLabel(r.month, false);
          return { label, total: totals[i], values: b.series.map((k) => Number(r[k]) || 0), seriesNames: b.series.map((k) => b.seriesNames[k]) };
        });
        const peakIndex = totals.indexOf(maxTotal);
        const last = months.length - 1;
        const finalText = data.engagement_status === 'completed' ? 'Final' : 'Current';
        // One marker per bar. If the peak coincides with the first/last month, merge the labels onto the Peak marker.
        const markers = [];
        if (peakIndex === 0) markers.push({ kind: 'peak', index: 0, text: last === 0 ? 'Peak' : 'Initial · Peak' });
        else markers.push({ kind: 'initial', index: 0, text: 'Initial' });
        if (peakIndex === last && last > 0) markers.push({ kind: 'peak', index: last, text: `Peak · ${finalText}` });
        else if (last > 0) markers.push({ kind: 'final', index: last, text: finalText });
        if (peakIndex > 0 && peakIndex < last) markers.push({ kind: 'peak', index: peakIndex, text: 'Peak' });
        ops.push({
          op: 'stackedBar', binding: b.id, bars: b.bars, barPrototype: b.barPrototype, markerNodes: b.markers,
          yLabels: b.yLabels, yValues: [0, 1, 2, 3, 4, 5].map((i) => String(i * step)), pxPerUnit: b.plotHeightPx / yMax,
          months, markers,
        });
        break;
      }
      default:
        warnings.push(`Unknown binding type ${b.type}`);
    }
  }
  return { ops, assets: [...assets], warnings, derived };
}
