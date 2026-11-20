import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile, bindingNodeRefs } from '../shared/compile.js';
import { validate, emptyData } from '../shared/validate.js';
import { deriveStaffing } from '../shared/derive.js';

const load = (id) => JSON.parse(fs.readFileSync(new URL(`../templates/${id}.json`, import.meta.url), 'utf8'));
const staffing = load('staffing');
const project = load('project-specific');

test('every field in both templates is consumed by at least one binding', () => {
  for (const t of [staffing, project]) {
    const used = new Set();
    for (const b of t.bindings) {
      if (b.field) used.add(b.field);
      JSON.stringify(b).replace(/\{([a-z_]+)\}/g, (_, k) => used.add(k));
    }
    used.add('engagement_status'); // drives chart marker text
    used.add('period_start'); used.add('period_end'); used.add('monthly_deployment'); // feed derived values
    const unmapped = t.fields.map((f) => f.key).filter((k) => !used.has(k));
    assert.deepEqual(unmapped, [], `${t.id} has unmapped fields`);
  }
});

test('node references are real-looking Figma IDs (no placeholders)', () => {
  for (const t of [staffing, project]) for (const b of t.bindings) for (const r of bindingNodeRefs(b)) assert.match(r.nodeId, /^I?\d+:\d+(;\d+:\d+)*$/, `${t.id}/${b.id}/${r.path}`);
});

test('derived staffing figures come from the deployment table', () => {
  const d = deriveStaffing({ period_start: '2025-01', period_end: '2025-06', engagement_status: 'completed', monthly_deployment: [
    { month: '2025-01', engineering: 3, qa: 1, data_other: 1 }, { month: '2025-04', engineering: 6, qa: 2, data_other: 1 }, { month: '2025-06', engineering: 4, qa: 1, data_other: 1 }] });
  assert.equal(d.initial_team, '5'); assert.equal(d.peak_team, '9'); assert.equal(d.final_team, '6');
  assert.equal(d.duration_months, '6'); assert.equal(d.period_label, 'Jan 2025 – Jun 2025');
  assert.equal(deriveStaffing({ period_start: '2025-03', engagement_status: 'ongoing', monthly_deployment: [{ month: '2025-05', engineering: 1, qa: 0, data_other: 0 }] }).period_label, 'Mar 2025 – Present');
});

test('validation enforces required fields, template capacity and month order', () => {
  const data = emptyData(staffing);
  const e1 = validate(staffing, data, 'submit');
  assert.ok(e1.client_name && e1.monthly_deployment && e1.challenge_points);
  assert.deepEqual(validate(staffing, data, 'draft'), {}, 'drafts may be incomplete');
  data.client_name = 'x'.repeat(40);
  assert.match(validate(staffing, data, 'draft').client_name, /Max 28/);
  data.monthly_deployment = [{ month: '2025-03', engineering: 1, qa: 0, data_other: 0 }, { month: '2025-02', engineering: 1, qa: 0, data_other: 0 }];
  assert.match(validate(staffing, data, 'draft')['monthly_deployment.1.month'], /ascending/);
  data.engagement_status = 'completed';
  assert.equal(validate(staffing, data, 'submit').period_end, 'Required');
});

test('admin-only fields are required for generation, not for stakeholder submission', () => {
  const d = { ...project.sampleData, client_logo: 'abcdef0123456789', screen_primary: 'abcdef0123456789', screen_secondary: 'abcdef0123456789', case_number: '' };
  assert.equal(validate(project, d, 'submit').case_number, undefined);
  assert.equal(validate(project, d, 'generate').case_number, 'Required');
});

test('staffing compile: tokens, derived values, chart scale and markers', () => {
  const { ops, warnings } = compile(staffing, staffing.sampleData);
  assert.deepEqual(warnings, []);
  const byBinding = Object.fromEntries(ops.map((o) => [o.binding, o]));
  assert.deepEqual(byBinding.s1_headline.replacements, [['[Client Name]', 'TEST Client']]);
  assert.equal(byBinding.snapshot_peak.props['Value#648:4'], '14');
  const chart = byBinding.deployment_chart;
  assert.equal(chart.months.length, 7);
  assert.deepEqual(chart.yValues, ['0', '4', '8', '12', '16', '20']);
  assert.equal(chart.pxPerUnit, 12);
  assert.deepEqual(chart.markers.map((m) => [m.kind, m.index, m.text]), [['initial', 0, 'Initial'], ['final', 6, 'Current'], ['peak', 3, 'Peak']]);
  // approach has 2 of 3 points -> 3rd slot hidden
  assert.deepEqual(byBinding.approach_points.values, ['TEST point one.', 'TEST point two.', null]);
  // impact: 3 metrics -> 4th card hidden; blank source not sent as a prop
  assert.equal(byBinding.impact_metrics.items[3], null);
  assert.equal(byBinding.impact_metrics.items[1].hideSource, true);
  assert.equal('Source#648:9' in byBinding.impact_metrics.items[1].props, false);
});

test('peak on the last month merges the markers', () => {
  const data = { ...staffing.sampleData, engagement_status: 'completed', monthly_deployment: [{ month: '2026-01', engineering: 1, qa: 0, data_other: 0 }, { month: '2026-02', engineering: 5, qa: 0, data_other: 0 }] };
  const chart = compile(staffing, data).ops.find((o) => o.op === 'stackedBar');
  assert.deepEqual(chart.markers.map((m) => m.text), ['Initial', 'Peak · Final']);
  assert.deepEqual(chart.yValues, ['0', '2', '4', '6', '8', '10'], 'template default axis kept for small teams');
});

test('project compile: balanced two-column modules, optional colour, logos', () => {
  const data = { ...project.sampleData, client_logo: 'logo0000000000', screen_primary: 'scr10000000000', screen_secondary: 'scr20000000000', brand_color: '' };
  const { ops, assets } = compile(project, data);
  const mods = ops.find((o) => o.binding === 'modules');
  const filled = mods.values.map((v) => v !== null);
  assert.deepEqual(filled.slice(0, 6), [true, true, true, false, false, false]); // left column: 3 of 5
  assert.deepEqual(filled.slice(6), [true, true, false, false, false, false]); // right column: 2 of 5
  assert.equal(ops.some((o) => o.binding === 'brand_color'), false, 'blank colour keeps template design');
  assert.ok(ops.some((o) => o.op === 'hide' && o.node === '665:710'), 'clipped third screen hidden in copies');
  assert.deepEqual(assets.sort(), ['logo0000000000', 'scr10000000000', 'scr20000000000']);
});
