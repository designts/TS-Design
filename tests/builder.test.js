import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SEED_PROJECTS, SEED_CASE_STUDIES } from '../shared/seed.js';
import { generateCaseStudy } from '../shared/generate.js';
import { validateProject, emptyProject } from '../shared/project.js';

test('seed case studies match the reference structure', () => {
  const kinds = Object.fromEntries(SEED_CASE_STUDIES.map((c) => [c.id, c.sections.map((s) => s.kind)]));
  assert.deepEqual(kinds['cs-sliceal'], ['hero', 'overview', 'solution', 'gallery', 'impact', 'technology', 'summary']);
  assert.deepEqual(kinds['cs-staffing'], ['hero', 'engagements', 'challenge_approach', 'snapshot', 'team', 'deployment', 'impact']);
  assert.equal(SEED_CASE_STUDIES.find((c) => c.id === 'cs-fintech-lending').title, 'Lending across Fintech');
});

test('optional sections without data are omitted; core sections stay', () => {
  const p = { ...emptyProject(), id: 'x', name: 'Bare', tagline: 't', type: 'project', domain: 'Retail' };
  const cs = generateCaseStudy('project', [p]);
  assert.deepEqual(cs.sections.map((s) => s.kind), ['hero', 'overview', 'solution', 'impact', 'technology']);
});

test('single-project staffing case study uses the client name in the headline', () => {
  const cs = generateCaseStudy('staffing', [SEED_PROJECTS.find((p) => p.id === 'prj-logistics-team')]);
  assert.equal(cs.title, "Scaling a European fleet-management SaaS company's technology capabilities");
  assert.ok(cs.sections.find((s) => s.kind === 'snapshot').items.some((i) => i.value === '9'));
});

test('validation: drafts need a name only; completed projects need type-specific fields', () => {
  const p = { ...emptyProject(), name: 'Ok name' };
  assert.deepEqual(validateProject(p, 'draft'), {});
  const e = validateProject(p, 'complete');
  assert.ok(e.tagline && e.description && e.domain && e.contribution && e.technologies && e.outcomes);
  assert.ok(validateProject({ ...p, type: 'staffing' }, 'complete')['staffing.peakTeamSize']);
  assert.equal(validateProject({ ...p, name: 'x'.repeat(130) }, 'draft').name.startsWith('Project name must be at most 120'), true);
});

// ---------------------------------------------------------------- API
const PORT = 4498;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'csb-'));
let proc;
before(async () => {
  proc = spawn(process.execPath, ['server/server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir }, stdio: 'pipe' });
  await new Promise((res, rej) => { proc.stdout.on('data', (d) => String(d).includes('running at') && res()); proc.on('exit', rej); });
});
after(() => { proc.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });
const call = async (method, url, body) => {
  const r = await fetch(`http://localhost:${PORT}${url}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
};

test('API: create → assemble → edit → duplicate → delete', async () => {
  let r = await call('POST', '/api/projects', { project: { ...emptyProject(), name: '  ' } });
  assert.equal(r.status, 422, 'a name is required even for drafts');
  r = await call('POST', '/api/projects', { project: { ...emptyProject(), name: 'Short', status: 'completed' } });
  assert.equal(r.status, 422, 'completed projects need the full set of fields');
  r = await call('POST', '/api/projects', { project: { ...emptyProject(), name: 'API Test Project', domain: 'Retail', status: 'draft' } });
  assert.equal(r.status, 201);
  const pid = r.body.id;
  r = await call('POST', '/api/case-studies/generate', { type: 'project', projectIds: [pid, 'prj-sliceal'] });
  assert.equal(r.status, 400, 'project type takes one project');
  r = await call('POST', '/api/case-studies/generate', { type: 'project', projectIds: [pid] });
  assert.equal(r.status, 201);
  const cs = r.body;
  cs.sections[1].hidden = true; cs.title = 'Edited'; cs.status = 'completed';
  r = await call('PUT', `/api/case-studies/${cs.id}`, { caseStudy: cs });
  assert.equal(r.body.title, 'Edited'); assert.equal(r.body.status, 'completed'); assert.equal(r.body.sections[1].hidden, true);
  r = await call('POST', `/api/case-studies/${cs.id}/duplicate`);
  assert.equal(r.body.title, 'Copy of Edited'); assert.equal(r.body.status, 'draft');
  assert.equal((await call('DELETE', `/api/projects/${pid}`)).status, 200);
  const state = (await call('GET', '/api/state')).body;
  assert.ok(state.caseStudies.some((c) => c.id === cs.id), 'case studies keep their content when a source project is deleted');
});
