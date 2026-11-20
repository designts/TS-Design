// End-to-end API test: runs the real server on a temp data dir and walks a staffing
// case study through draft → submit → changes requested → resubmit → generate →
// plugin claim/complete → stale edit → regenerate → approve.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 4499;
const BASE = `http://localhost:${PORT}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-test-'));
let proc;

before(async () => {
  proc = spawn(process.execPath, ['server/server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, ADMIN_PASSCODE: 'test-pass' }, stdio: 'pipe' });
  await new Promise((resolve, reject) => {
    proc.stdout.on('data', (d) => d.toString().includes('running at') && resolve());
    proc.on('exit', (c) => reject(new Error('server exited ' + c)));
  });
});
after(() => { proc.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });

function client() {
  let cookie = '';
  return async (method, url, body, headers = {}) => {
    const res = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json', cookie, ...headers }, body: body ? JSON.stringify(body) : undefined });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const json = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.arrayBuffer();
    return { status: res.status, body: json };
  };
}

const PNG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('full staffing workflow', async () => {
  const sh = client(), ad = client(), other = client();
  assert.equal((await sh('POST', '/api/login', { name: 'Sam', email: 'sam@example.com', role: 'stakeholder' })).status, 200);
  assert.equal((await ad('POST', '/api/login', { name: 'Ada', email: 'ada@example.com', role: 'admin', passcode: 'nope' })).status, 403);
  assert.equal((await ad('POST', '/api/login', { name: 'Ada', email: 'ada@example.com', role: 'admin', passcode: 'test-pass' })).status, 200);
  await other('POST', '/api/login', { name: 'Oz', email: 'oz@example.com', role: 'stakeholder' });

  // stakeholders don't see admin-only fields or node IDs
  const tpls = (await sh('GET', '/api/templates')).body;
  assert.deepEqual(tpls.map((t) => t.id).sort(), ['project-specific', 'staffing']);
  assert.ok(!JSON.stringify(tpls).includes('648:'), 'no Figma node IDs leak to stakeholders');
  assert.ok(!tpls.find((t) => t.id === 'project-specific').fields.some((f) => f.key === 'case_number'));

  const cs = (await sh('POST', '/api/case-studies', { templateId: 'staffing' })).body;
  assert.equal(cs.status, 'draft');
  assert.equal((await other('GET', `/api/case-studies/${cs.id}`)).status, 404, 'other stakeholders cannot see it');

  let r = await sh('POST', `/api/case-studies/${cs.id}/submit`);
  assert.equal(r.status, 422);
  assert.ok(r.body.errors.client_name);

  const data = {
    client_name: 'Acme Retail', industry: 'Retail', business_goal: 'a commerce re-platform', engagement_status: 'ongoing', period_start: '2025-01', period_end: '',
    challenge_summary: 'Demand outgrew the in-house team.', challenge_points: ['Peak season launches slipped.'],
    approach_summary: 'A flexible pod that scaled with demand.', approach_points: ['Started with a core team.', 'Added QA ahead of launches.'],
    team_roles: ['Frontend ×3', 'Backend ×2'], technologies: ['React', 'Node.js'],
    monthly_deployment: [{ month: '2025-01', engineering: 3, qa: 1, data_other: 0 }, { month: '2025-02', engineering: 5, qa: 2, data_other: 1 }, { month: '2025-03', engineering: 4, qa: 1, data_other: 1 }],
    outcome_statement: 'Acme shipped two seasonal launches on time.', impact_metrics: [{ value: '2', label: 'Launches on time', source: '' }, { value: '30%', label: 'Faster releases', source: 'Jira' }],
  };
  r = await sh('PUT', `/api/case-studies/${cs.id}`, { data: { ...data, client_name: 'x'.repeat(60) } });
  assert.equal(r.status, 422, 'over-long text rejected even for drafts');
  r = await sh('PUT', `/api/case-studies/${cs.id}`, { data });
  assert.equal(r.status, 200);
  assert.equal(r.body.derived.peak_team, '8');
  assert.equal((await sh('POST', `/api/case-studies/${cs.id}/submit`)).body.status, 'submitted');

  // stakeholder cannot generate/approve
  assert.equal((await sh('POST', `/api/case-studies/${cs.id}/generate`)).status, 403);

  // admin requests changes
  r = await ad('POST', `/api/case-studies/${cs.id}/request-changes`, { note: 'Add a third challenge point.', fields: ['challenge_points'] });
  assert.equal(r.body.status, 'changes_requested');
  data.challenge_points.push('Hiring took months.');
  await sh('PUT', `/api/case-studies/${cs.id}`, { data });
  assert.equal((await sh('POST', `/api/case-studies/${cs.id}/submit`)).body.status, 'submitted');

  // admin generates → plugin picks it up
  assert.equal((await ad('POST', `/api/case-studies/${cs.id}/generate`)).body.status, 'generating');
  const { pluginToken } = (await ad('GET', '/api/admin/templates')).body;
  const plugin = client();
  const P = { 'X-Plugin-Token': pluginToken };
  assert.equal((await plugin('GET', '/api/plugin/jobs')).status, 401);
  const jobs = (await plugin('GET', '/api/plugin/jobs', null, P)).body;
  assert.equal(jobs.length, 1);
  const job = (await plugin('POST', `/api/plugin/jobs/${jobs[0].id}/claim`, null, P)).body;
  assert.equal(job.template.figma.frames.length, 2);
  assert.ok(job.ops.find((o) => o.op === 'stackedBar'));
  assert.equal(job.previousSectionId, null);

  const result = { fileKey: 'RjCFW9LoK7yCWJ9A8SmPIp', pageId: '1:1', sectionId: '900:1', frames: [{ masterId: '648:69', nodeId: '900:2', name: 'Slide 1' }], warnings: [] };
  r = await plugin('POST', `/api/plugin/jobs/${job.id}/complete`, { result, exports: [{ name: 'Slide 1 — Acme', nodeId: '900:2', png: PNG_1x1, pdf: Buffer.from('%PDF-1.4').toString('base64') }] }, P);
  assert.equal(r.status, 200);
  let view = (await ad('GET', `/api/case-studies/${cs.id}`)).body;
  assert.equal(view.status, 'generated');
  assert.equal(view.generation.exports.length, 1);
  assert.equal((await sh('GET', `/api/case-studies/${cs.id}/exports/${view.generation.exports[0].png}`)).status, 200, 'owner can see preview');
  assert.equal((await sh('PUT', `/api/case-studies/${cs.id}`, { data: { ...data, industry: 'Changed' } })).status, 403, 'owner cannot edit after generation');

  // admin edit marks stale → approve blocked → regenerate replaces previous copy
  await ad('PUT', `/api/case-studies/${cs.id}`, { data: { industry: 'Retail & E-commerce' } });
  view = (await ad('GET', `/api/case-studies/${cs.id}`)).body;
  assert.equal(view.stale, true);
  assert.equal((await ad('POST', `/api/case-studies/${cs.id}/approve`)).status, 409);
  await ad('POST', `/api/case-studies/${cs.id}/generate`);
  const job2 = (await plugin('POST', `/api/plugin/jobs/${cs.id}-v2/claim`, null, P)).body;
  assert.equal(job2.previousSectionId, '900:1', 'regeneration replaces the previous generated copy');
  await plugin('POST', `/api/plugin/jobs/${job2.id}/complete`, { result: { ...result, sectionId: '901:1' }, exports: [] }, P);
  r = await ad('POST', `/api/case-studies/${cs.id}/approve`);
  assert.equal(r.body.status, 'approved');
  assert.equal((await ad('PUT', `/api/case-studies/${cs.id}`, { data: { industry: 'X' } })).status, 403, 'approved is locked');
});

test('uploads are validated and failures restore state', async () => {
  const ad = client();
  await ad('POST', '/api/login', { name: 'Ada', email: 'ada@example.com', role: 'admin', passcode: 'test-pass' });
  assert.equal((await ad('POST', '/api/uploads', { filename: 'x.txt', data: Buffer.from('hello').toString('base64') })).status, 415);
  const up = await ad('POST', '/api/uploads', { filename: 'dot.png', data: `data:image/png;base64,${PNG_1x1}` });
  assert.equal(up.status, 201);
  assert.equal(up.body.width, 1);

  // template test run creates placeholder images + queues a job; a plugin failure reverts status
  const test = (await ad('POST', '/api/admin/templates/project-specific/test')).body;
  assert.equal(test.status, 'generating');
  assert.ok(test.isTest);
  const { pluginToken } = (await ad('GET', '/api/admin/templates')).body;
  const P = { 'X-Plugin-Token': pluginToken };
  const plugin = client();
  const job = (await plugin('POST', `/api/plugin/jobs/${test.id}-v1/claim`, null, P)).body;
  assert.equal(job.assets.length, 3);
  assert.equal((await plugin('GET', `/api/plugin/assets/${job.assets[0]}`, null, P)).status, 200);
  await plugin('POST', `/api/plugin/jobs/${job.id}/fail`, { message: 'Mapped layer 665:999 is not part of the template copy' }, P);
  const view = (await ad('GET', `/api/case-studies/${test.id}`)).body;
  assert.equal(view.status, 'submitted');
  assert.match(view.generation.error, /665:999/);

  // sync report → template status
  const tpl = (await plugin('GET', '/api/plugin/templates', null, P)).body.find((t) => t.id === 'staffing');
  const nodes = Object.fromEntries(tpl.nodeIds.map((id) => [id, { exists: true, name: 'n', type: 'TEXT', insideTemplate: true }]));
  nodes['648:85'] = { exists: false };
  await plugin('POST', '/api/plugin/templates/staffing/sync', { report: { checkedAt: new Date().toISOString(), frames: [{ id: '648:69', exists: true }, { id: '648:189', exists: true }], nodes, thumbnails: [{ frameId: '648:69', png: PNG_1x1 }] } }, P);
  const summary = (await ad('GET', '/api/admin/templates')).body.templates.find((t) => t.id === 'staffing');
  assert.equal(summary.status, 'Needs attention');
  assert.equal(summary.problems, 1);
  assert.equal(summary.mappedFields, summary.totalFields);
});
