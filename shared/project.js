// Project record: empty shape, character limits, form steps, normalisation and validation.

export const LIMITS = {
  name: { min: 3, max: 120 }, tagline: { min: 30, max: 300 }, description: { min: 100, max: 2000 },
  industry: { min: 2, max: 80 }, client: { min: 2, max: 120 }, engagementPeriod: { max: 60 }, tag: { max: 40 },
  businessContext: { min: 50, max: 1500 }, shortItem: { max: 120 }, stakeholder: { min: 3, max: 200 },
  challengeTitle: { min: 3, max: 120 }, challengeArea: { max: 60 }, challengeDescription: { min: 50, max: 2000 }, challengeImplication: { max: 500 },
  solutionSummary: { min: 30, max: 1000 },
  capabilityName: { min: 3, max: 100 }, capabilityCategory: { max: 60 }, capabilityDescription: { min: 30, max: 800 }, capabilityUsers: { max: 200 },
  featureName: { min: 3, max: 100 }, featureProblem: { max: 1000 }, featureSolution: { min: 30, max: 1000 }, featureStep: { max: 200 }, featureBenefit: { max: 500 },
  workflowName: { min: 3, max: 100 }, workflowPurpose: { min: 50, max: 1500 }, workflowShort: { max: 300 }, workflowStep: { min: 2, max: 120 },
  technology: { min: 2, max: 80 },
  outcomeValue: { max: 20 }, outcomeLabel: { min: 20, max: 500 }, outcomeBaseline: { max: 200 }, outcomePeriod: { max: 100 }, outcomeSource: { min: 5, max: 300 },
  beforeAfter: { max: 300 }, technicalHighlight: { max: 300 }, futureOpportunities: { max: 1000 },
  staffingSummary: { min: 10, max: 200 }, staffingPoint: { max: 300 }, outcomeSummary: { max: 800 }, reportingPeriod: { max: 60 },
  contribution: { min: 30, max: 1000 }, constraints: { min: 20, max: 1000 }, notes: { max: 2000 },
  assetTitle: { min: 2, max: 120 }, assetCaption: { max: 300 },
};

export const STEP_LABELS = {
  basics: 'Basics', context: 'Context & challenges', features: 'Feature & capabilities', solution: 'Solution & modules', workflows: 'Workflows',
  'staffing-engagement': 'Challenge & approach', 'staffing-team': 'Team & scaling', technology: 'Technology', outcomes: 'Outcomes & evidence', contribution: 'Contribution & assets',
};
export const STEPS = {
  feature: ['basics', 'context', 'features', 'workflows', 'technology', 'outcomes', 'contribution'],
  project: ['basics', 'context', 'solution', 'workflows', 'technology', 'outcomes', 'contribution'],
  staffing: ['basics', 'staffing-engagement', 'staffing-team', 'technology', 'outcomes', 'contribution'],
};

/** Which form step an error key belongs to. */
export function stepForKey(key, type) {
  const root = key.split('.')[0];
  if (root === 'staffing') return ['challengeSummary', 'challengePoints', 'approachSummary', 'approachPoints'].includes(key.split('.')[1] || '') ? 'staffing-engagement' : 'staffing-team';
  return ({
    name: 'basics', tagline: 'basics', description: 'basics', domain: 'basics', industry: 'basics', client: 'basics', engagementPeriod: 'basics', tags: 'basics',
    businessContext: 'context', stakeholders: 'context', businessFunctions: 'context', businessProcesses: 'context', challenges: 'context',
    solutionSummary: 'solution', modules: 'solution',
    features: type === 'feature' ? 'features' : 'solution', capabilities: type === 'feature' ? 'features' : 'solution',
    workflows: 'workflows', technologies: 'technology', outcomes: 'outcomes', beforeAfter: 'outcomes', technicalHighlights: 'outcomes', futureOpportunities: 'outcomes',
    contribution: 'contribution', constraints: 'contribution', notes: 'contribution', assets: 'contribution',
  })[root] || 'basics';
}

export const isBlank = (s) => !s || !String(s).trim();
export const nowIso = () => new Date().toISOString();
export const splitLines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);
export const splitComma = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
export function newId(prefix = 'id') {
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(16).slice(2) + Date.now().toString(16);
  return `${prefix}_${rand.replace(/-/g, '').slice(0, 8)}`;
}
const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const formatDate = (iso) => fmt.format(new Date(iso));

export function emptyProject() {
  return {
    name: '', tagline: '', description: '', type: 'project', domain: '', industry: '', client: '', engagementPeriod: '',
    services: [], platforms: [], tags: [], businessContext: '', businessFunctions: [], stakeholders: [], businessProcesses: [],
    challenges: [], solutionSummary: '', modules: [], capabilities: [], features: [], workflows: [], technologies: [], outcomes: [], beforeAfter: [],
    technicalHighlights: [], futureOpportunities: '',
    staffing: { reportingPeriod: '', challengeSummary: '', challengePoints: [], approachSummary: '', approachPoints: [], initialTeamSize: '', peakTeamSize: '', finalTeamSize: '', durationMonths: '', roles: [], deployment: [], outcomeSummary: '' },
    scope: [], contribution: '', constraints: '', assets: [], notes: '', status: 'draft',
  };
}

const t = (s) => String(s ?? '').trim();
const ts = (a) => (a || []).map(t).filter(Boolean);
const any = (...v) => v.some((x) => (Array.isArray(x) ? x.some((y) => String(y).trim()) : !!x && !!String(x).trim()));

/** Trim strings and drop empty repeater rows (same rules as the reference). */
export function normalizeProject(p) {
  const e = { ...emptyProject(), ...p, staffing: { ...emptyProject().staffing, ...(p.staffing || {}) } };
  return {
    ...e,
    name: t(e.name), tagline: t(e.tagline), description: t(e.description), domain: t(e.domain), industry: t(e.industry), client: t(e.client), engagementPeriod: t(e.engagementPeriod),
    services: ts(e.services), platforms: ts(e.platforms), tags: ts(e.tags),
    businessContext: t(e.businessContext), businessFunctions: ts(e.businessFunctions), stakeholders: ts(e.stakeholders), businessProcesses: ts(e.businessProcesses),
    challenges: e.challenges.map((c) => ({ ...c, area: t(c.area), title: t(c.title), description: t(c.description), implication: t(c.implication) })).filter((c) => any(c.area, c.title, c.description, c.implication)),
    solutionSummary: t(e.solutionSummary), modules: ts(e.modules),
    capabilities: e.capabilities.map((c) => ({ ...c, name: t(c.name), category: t(c.category), description: t(c.description), users: t(c.users), features: ts(c.features) })).filter((c) => any(c.name, c.category, c.description, c.users, c.features)),
    features: e.features.map((f) => ({ ...f, name: t(f.name), problem: t(f.problem), solution: t(f.solution), functionality: ts(f.functionality), benefit: t(f.benefit), relatedFeatures: ts(f.relatedFeatures) })).filter((f) => any(f.name, f.problem, f.solution, f.functionality, f.benefit)),
    workflows: e.workflows.map((w) => ({ ...w, name: t(w.name), purpose: t(w.purpose), trigger: t(w.trigger), systems: t(w.systems), output: t(w.output), steps: (w.steps || []).map((s) => ({ ...s, label: t(s.label) })).filter((s) => s.label) })).filter((w) => any(w.name, w.purpose, w.trigger, w.systems, w.output) || w.steps.length > 0),
    technologies: e.technologies.map((x) => ({ ...x, name: t(x.name) })).filter((x) => x.name),
    outcomes: e.outcomes.map((o) => ({ ...o, value: t(o.value), label: t(o.label), baseline: t(o.baseline), period: t(o.period), source: t(o.source) })).filter((o) => any(o.value, o.label, o.baseline, o.period, o.source)),
    beforeAfter: e.beforeAfter.map((b) => ({ ...b, process: t(b.process), before: t(b.before), after: t(b.after) })).filter((b) => any(b.process, b.before, b.after)),
    technicalHighlights: ts(e.technicalHighlights), futureOpportunities: t(e.futureOpportunities),
    staffing: {
      ...e.staffing, reportingPeriod: t(e.staffing.reportingPeriod), challengeSummary: t(e.staffing.challengeSummary), challengePoints: ts(e.staffing.challengePoints),
      approachSummary: t(e.staffing.approachSummary), approachPoints: ts(e.staffing.approachPoints), initialTeamSize: t(e.staffing.initialTeamSize), peakTeamSize: t(e.staffing.peakTeamSize),
      finalTeamSize: t(e.staffing.finalTeamSize), durationMonths: t(e.staffing.durationMonths), roles: ts(e.staffing.roles),
      deployment: (e.staffing.deployment || []).map((m) => ({ ...m, month: t(m.month) })).filter((m) => m.month || m.engineering + m.qa + m.other > 0),
      outcomeSummary: t(e.staffing.outcomeSummary),
    },
    scope: ts(e.scope), contribution: t(e.contribution), constraints: t(e.constraints),
    assets: e.assets.map((a) => ({ ...a, title: t(a.title), caption: t(a.caption) })).filter((a) => any(a.title, a.caption) || !!a.previewUrl), notes: t(e.notes),
  };
}

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
function lengthError(value, limit, label, required) {
  const v = String(value ?? '').trim();
  if (!v) return required ? `${label} is required.` : undefined;
  if (v.length > limit.max) return `${label} must be at most ${plural(limit.max, 'character')} (currently ${v.length}).`;
  if (limit.min && v.length < limit.min) return `${label} needs at least ${plural(limit.min, 'character')} (currently ${v.length}).`;
  return undefined;
}

/**
 * mode 'complete' → full rules (Save project); 'draft' → only "not too long".
 * Returns { [key]: message } in form order.
 */
export function validateProject(input, mode) {
  const p = normalizeProject(input);
  const errors = {};
  const complete = mode === 'complete';
  const type = p.type;
  const steps = new Set(STEPS[type]);
  const set = (k, m) => { if (m && !errors[k]) errors[k] = m; };
  const field = (k, v, limit, label, required = false) => {
    if (complete) set(k, lengthError(v, limit, label, required));
    else set(k, lengthError(v, { max: limit.max }, label, false));
  };
  const list = (k, arr, limit, label) => arr.forEach((v, i) => field(`${k}.${i}`, v, limit, `${label} ${i + 1}`));
  const L = LIMITS;

  set('name', lengthError(p.name, complete ? L.name : { max: L.name.max }, 'Project name', true));
  field('tagline', p.tagline, L.tagline, 'Short summary', true);
  field('description', p.description, L.description, 'Project description', true);
  if (complete && isBlank(p.domain)) set('domain', 'Choose a domain.');
  field('industry', p.industry, L.industry, 'Industry', true);
  field('client', p.client, L.client, 'Client or product name');
  field('engagementPeriod', p.engagementPeriod, L.engagementPeriod, 'Engagement period');
  list('tags', p.tags, L.tag, 'Tag');

  if (steps.has('context')) {
    field('businessContext', p.businessContext, L.businessContext, 'Business context', true);
    list('businessFunctions', p.businessFunctions, L.shortItem, 'Business function');
    list('businessProcesses', p.businessProcesses, L.shortItem, 'Business process');
    list('stakeholders', p.stakeholders, L.stakeholder, 'Stakeholder');
    if (complete && p.stakeholders.length === 0) set('stakeholders', 'Add at least one target user or stakeholder.');
    if (complete && p.challenges.length === 0) set('challenges', 'Add at least one business challenge.');
    p.challenges.forEach((c) => {
      const k = `challenges.${c.id}`;
      field(`${k}.title`, c.title, L.challengeTitle, 'Challenge', true);
      field(`${k}.area`, c.area, L.challengeArea, 'Business area');
      field(`${k}.description`, c.description, L.challengeDescription, 'Challenge description', true);
      field(`${k}.implication`, c.implication, L.challengeImplication, 'Business implication');
    });
  }
  if (steps.has('solution')) {
    field('solutionSummary', p.solutionSummary, L.solutionSummary, 'Solution summary', true);
    list('modules', p.modules, L.shortItem, 'Module');
  }
  if (steps.has('features') || steps.has('solution')) {
    if (complete && type === 'feature' && p.features.length === 0 && p.capabilities.length === 0) set('features', 'Add at least one feature or capability: this project type is built around it.');
    p.features.forEach((f) => {
      const k = `features.${f.id}`;
      field(`${k}.name`, f.name, L.featureName, 'Feature name', true);
      field(`${k}.problem`, f.problem, L.featureProblem, 'Challenge addressed');
      field(`${k}.solution`, f.solution, L.featureSolution, 'Feature functionality', true);
      list(`${k}.functionality`, f.functionality, L.featureStep, 'Functionality step');
      field(`${k}.benefit`, f.benefit, L.featureBenefit, 'Business benefit');
    });
    p.capabilities.forEach((c) => {
      const k = `capabilities.${c.id}`;
      field(`${k}.name`, c.name, L.capabilityName, 'Capability name', true);
      field(`${k}.category`, c.category, L.capabilityCategory, 'Category');
      field(`${k}.description`, c.description, L.capabilityDescription, 'Capability description', true);
      field(`${k}.users`, c.users, L.capabilityUsers, 'Primary users');
    });
  }
  if (steps.has('workflows')) {
    p.workflows.forEach((w) => {
      const k = `workflows.${w.id}`;
      field(`${k}.name`, w.name, L.workflowName, 'Workflow name', true);
      field(`${k}.purpose`, w.purpose, L.workflowPurpose, 'Workflow description', true);
      field(`${k}.trigger`, w.trigger, L.workflowShort, 'Starting event');
      field(`${k}.systems`, w.systems, L.workflowShort, 'Systems & departments');
      field(`${k}.output`, w.output, L.workflowShort, 'Final output');
      w.steps.forEach((s) => field(`${k}.steps.${s.id}`, s.label, L.workflowStep, 'Step'));
    });
  }
  if (steps.has('staffing-engagement')) {
    field('staffing.challengeSummary', p.staffing.challengeSummary, L.staffingSummary, 'Challenge summary', true);
    list('staffing.challengePoints', p.staffing.challengePoints, L.staffingPoint, 'Challenge point');
    field('staffing.approachSummary', p.staffing.approachSummary, L.staffingSummary, 'Approach summary', true);
    list('staffing.approachPoints', p.staffing.approachPoints, L.staffingPoint, 'Approach point');
  }
  if (steps.has('staffing-team')) {
    for (const [key, label, required] of [['initialTeamSize', 'Initial team size', false], ['peakTeamSize', 'Peak team size', true], ['finalTeamSize', 'Final team size', false], ['durationMonths', 'Duration (months)', false]]) {
      const v = String(p.staffing[key] ?? '');
      if (v) { if (!/^\d+$/.test(v) || Number(v) < 1 || Number(v) > 9999) set(`staffing.${key}`, `${label} must be a whole number from 1 to 9999.`); }
      else if (complete && required) set(`staffing.${key}`, `${label} is required.`);
    }
    if (complete && p.staffing.roles.length === 0) set('staffing.roles', 'Add at least one role in the team composition.');
    list('staffing.roles', p.staffing.roles, L.shortItem, 'Role');
    field('staffing.reportingPeriod', p.staffing.reportingPeriod, L.reportingPeriod, 'Reporting period');
    field('staffing.outcomeSummary', p.staffing.outcomeSummary, L.outcomeSummary, 'Outcome summary');
  }
  p.technologies.forEach((x) => field(`technologies.${x.id}`, x.name, L.technology, `Technology "${x.name.slice(0, 20)}"`));
  if (complete && type === 'project' && p.technologies.length === 0) set('technologies', 'Add at least one technology or platform.');
  if (complete && type === 'project' && p.outcomes.length === 0) set('outcomes', "Add at least one business outcome. Mark it qualitative or expected if it isn't measured.");
  p.outcomes.forEach((o) => {
    const k = `outcomes.${o.id}`;
    field(`${k}.value`, o.value, L.outcomeValue, 'Value');
    field(`${k}.label`, o.label, L.outcomeLabel, 'Business outcome', true);
    field(`${k}.baseline`, o.baseline, L.outcomeBaseline, 'Baseline');
    field(`${k}.period`, o.period, L.outcomePeriod, 'Period');
    field(`${k}.source`, o.source, L.outcomeSource, 'Evidence source', o.evidence === 'measured' || !!o.value);
  });
  p.beforeAfter.forEach((b) => {
    const k = `beforeAfter.${b.id}`;
    field(`${k}.process`, b.process, L.beforeAfter, 'Process', true);
    field(`${k}.before`, b.before, L.beforeAfter, 'Before', true);
    field(`${k}.after`, b.after, L.beforeAfter, 'After', true);
  });
  list('technicalHighlights', p.technicalHighlights, L.technicalHighlight, 'Technical highlight');
  field('futureOpportunities', p.futureOpportunities, L.futureOpportunities, 'Future opportunities');
  field('contribution', p.contribution, L.contribution, 'Our contribution', true);
  field('constraints', p.constraints, L.constraints, 'Limitations or constraints');
  field('notes', p.notes, L.notes, 'Notes');
  p.assets.forEach((a) => {
    const k = `assets.${a.id}`;
    field(`${k}.title`, a.title, L.assetTitle, 'Asset title', true);
    field(`${k}.caption`, a.caption, L.assetCaption, 'Caption');
  });
  return errors;
}
