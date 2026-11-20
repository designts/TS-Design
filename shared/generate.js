// Assembles a case study draft from source projects. No AI: every section is
// built from fields in the selected project records; sections without
// supporting data are omitted (optional) or kept as "needs content" (core).
import { ORG, EVIDENCE, TECH_CATEGORIES } from './catalog.js';
import { isBlank, newId as makeId } from './project.js';

const uniq = (arr) => [...new Set(arr.map((x) => x.trim()).filter(Boolean))];
const join = (arr, sep = ' ') => arr.filter((x) => !isBlank(x)).join(sep);
function count(n, word) {
  if (n === 0) return '';
  const many = word.endsWith('y') ? `${word.slice(0, -1)}ies` : `${word}s`;
  return `${n} ${n === 1 ? word : many}`;
}
const firstVisualAssetId = (p) => (p.assets.find((a) => a.kind === 'screenshot' || a.kind === 'diagram') || {}).id;

class Builder {
  constructor(id) { this.newId = id; this.sections = []; }
  item(x) { return { id: this.newId(), ...x }; }
  add(kind, core, eyebrow, heading, intro, items, extra = {}) {
    const empty = !core && items.length === 0 && isBlank(intro);
    if (!empty || (extra.deployment && extra.deployment.length)) {
      this.sections.push({ id: this.newId(), kind, core, hidden: false, eyebrow, heading, intro, items: items.map((i) => this.item(i)), ...extra });
    }
  }
}

const challengesOf = (ps) => ps.flatMap((p) => p.challenges.map((c) => ({ tag: c.area, title: c.title, body: c.description, meta: c.implication, sourceProjectId: p.id })));
const outcomesOf = (ps) => ps.flatMap((p) => p.outcomes.map((o) => ({ value: o.value, title: o.label, tag: EVIDENCE[o.evidence], body: '', meta: join([o.baseline && `Baseline: ${o.baseline}`, o.period && `Period: ${o.period}`, o.source && `Source: ${o.source}`], ' · '), sourceProjectId: p.id })));
function technologyOf(ps) {
  const all = ps.flatMap((p) => p.technologies);
  return TECH_CATEGORIES.map((c) => ({ title: c.label, body: '', list: uniq(all.filter((x) => x.category === c.value).map((x) => x.name)) })).filter((x) => x.list.length > 0);
}
const workflowsOf = (ps) => ps.flatMap((p) => p.workflows.map((w) => ({ title: w.name, body: w.purpose, meta: w.trigger, tag: w.systems, value: w.output, steps: w.steps, sourceProjectId: p.id })));
const beforeAfterOf = (ps) => ps.flatMap((p) => p.beforeAfter.map((b) => ({ title: b.process, body: b.before, value: b.after, sourceProjectId: p.id })));

function addHeroVisual(w, ps) {
  const hero = w.sections[0];
  const withVisual = ps.find((p) => firstVisualAssetId(p));
  if (hero && withVisual) hero.items.push(w.item({ title: '', body: '', tag: 'visual', assetId: firstVisualAssetId(withVisual), sourceProjectId: withVisual.id }));
}

function mostCommon(values) {
  const m = new Map();
  for (const v of values.filter(Boolean)) m.set(v, (m.get(v) || 0) + 1);
  return ([...m.entries()].sort((a, b) => b[1] - a[1])[0] || [])[0] || '';
}

export function generateCaseStudy(type, projects, focus = '', idFn = () => makeId('sec')) {
  const w = new Builder(idFn);
  const domain = type === 'staffing' ? 'Staffing' : mostCommon(projects.map((p) => p.domain)) || 'Domain';
  let title, subtitle;

  if (type === 'project') {
    const p = projects[0];
    w.add('hero', true, 'Case study', p.name, p.tagline, [
      { title: 'Client', body: p.client },
      { title: 'Industry', body: join([p.domain, p.industry], ' · ') },
      { title: 'Engagement', body: p.engagementPeriod },
      { title: 'Platforms', body: p.platforms.join(' · ') },
      { title: 'Services', body: '', list: p.services },
    ].filter((x) => !isBlank(x.body) || (x.list || []).length > 0));
    addHeroVisual(w, [p]);
    w.add('overview', true, 'About', 'About the project', join([p.description, p.businessContext]), []);
    w.add('challenges', false, 'The challenge', 'What the client needed to solve', '', challengesOf([p]));
    w.add('solution', true, 'Solution', 'Solution', p.solutionSummary, [
      ...(p.modules.length ? [{ title: 'Modules', body: '', tag: 'Technical highlights', list: p.modules }] : []),
      ...p.features.map((f) => ({ title: f.name, body: f.solution, tag: 'Feature', list: f.functionality, value: f.benefit })),
      ...p.capabilities.map((c) => ({ title: c.name, body: c.description, tag: 'Capability', list: c.features })),
    ].map((x) => ({ ...x, sourceProjectId: p.id })));
    w.add('workflows', false, 'Workflow', 'How it works end to end', '', workflowsOf([p]));
    w.add('gallery', false, 'Product visuals', 'Inside the product', '', p.assets.filter((a) => a.kind === 'screenshot' || a.kind === 'diagram').map((a) => ({ title: a.title, body: a.caption, assetId: a.id, sourceProjectId: p.id })));
    w.add('impact', true, 'Outcomes', 'Results', '', outcomesOf([p]));
    w.add('before_after', false, 'Before → after', 'What changed', '', beforeAfterOf([p]));
    w.add('technology', true, 'Tech stack', 'Tech stack', '', technologyOf([p]));
    w.add('summary', false, 'Our contribution', `What ${ORG} delivered`, p.contribution, p.scope.length ? [{ title: 'Scope of contribution', body: '', list: p.scope }] : []);
    title = p.name;
    subtitle = p.tagline;
  } else if (type === 'staffing') {
    const one = projects.length === 1 ? projects[0] : undefined;
    let heading = 'Flexible engineering capacity, on demand';
    if (one) {
      const n = (one.client || 'the client').replace(/^(A|An|The) /, (m) => m.toLowerCase());
      heading = `Scaling ${n.endsWith('s') ? `${n}'` : `${n}'s`} technology capabilities`;
    }
    w.add('hero', true, 'Resource engagement case study', heading,
      one ? one.tagline : `${projects.length} staffing engagements across ${uniq(projects.map((p) => p.industry)).join(', ')}.`,
      one
        ? [{ title: 'Client', body: one.client }, { title: 'Industry', body: one.industry }, { title: 'Reporting period', body: one.staffing.reportingPeriod || one.engagementPeriod }].filter((x) => !isBlank(x.body))
        : [{ title: 'Engagements', body: count(projects.length, 'engagement') }, { title: 'Industries', body: uniq(projects.map((p) => p.industry)).join(' · ') }]);
    if (!one) {
      w.add('engagements', false, 'Engagements', 'Engagements in this case study', '', projects.map((p) => ({
        title: p.client || p.name, body: p.description, tag: p.industry, meta: p.staffing.reportingPeriod || p.engagementPeriod,
        value: p.staffing.peakTeamSize ? `Peak team: ${p.staffing.peakTeamSize}` : '', sourceProjectId: p.id,
      })));
    }
    w.add('challenge_approach', true, 'Client engagement & team strategy', 'The challenge and our approach', '', projects.flatMap((p) => [
      ...(isBlank(p.staffing.challengeSummary) && !p.staffing.challengePoints.length ? [] : [{ tag: 'Challenge', title: p.staffing.challengeSummary, body: '', list: p.staffing.challengePoints, sourceProjectId: p.id }]),
      ...(isBlank(p.staffing.approachSummary) && !p.staffing.approachPoints.length ? [] : [{ tag: 'Approach', title: p.staffing.approachSummary, body: '', list: p.staffing.approachPoints, sourceProjectId: p.id }]),
    ]));
    w.add('snapshot', true, 'Engagement snapshot', 'Engagement snapshot', '', one
      ? [
        { value: one.staffing.initialTeamSize, title: 'Initial team size', body: 'Specialists deployed at kickoff' },
        { value: one.staffing.peakTeamSize, title: 'Peak team size', body: 'Maximum concurrent resources' },
        { value: one.staffing.durationMonths && `${one.staffing.durationMonths}`, title: 'Engagement duration', body: `Months · ${one.staffing.reportingPeriod}` },
      ].filter((x) => !isBlank(x.value))
      : projects.filter((p) => !isBlank(p.staffing.peakTeamSize)).map((p) => ({
        value: p.staffing.peakTeamSize, title: p.client || p.name,
        body: join([p.staffing.initialTeamSize && `Started with ${p.staffing.initialTeamSize}`, `peak of ${p.staffing.peakTeamSize}`, p.staffing.durationMonths && `over ${p.staffing.durationMonths} months`], ', '),
        sourceProjectId: p.id,
      })));
    w.add('team', true, 'Team composition & technology', 'Team composition and technology stack', '', [
      { title: 'Team composition', body: '', list: uniq(projects.flatMap((p) => p.staffing.roles)) },
      { title: 'Technology stack', body: '', list: uniq(projects.flatMap((p) => p.technologies.map((x) => x.name))) },
    ].filter((x) => x.list.length > 0));
    w.add('deployment', false, 'Resource deployment over time', 'Capacity that adapts to business demand', 'Active resources per month, by discipline.', [], {
      deployment: projects.filter((p) => p.staffing.deployment.length > 0).map((p) => ({ projectId: p.id, label: p.client || p.name, months: p.staffing.deployment })),
    });
    w.add('impact', true, 'Engagement outcomes', 'Business impact', join(projects.map((p) => p.staffing.outcomeSummary)), outcomesOf(projects));
    title = w.sections[0].heading;
    subtitle = w.sections[0].intro;
  } else {
    const f = focus.trim();
    const caps = projects.flatMap((p) => p.capabilities.map((c) => ({ c, p })));
    const flows = projects.flatMap((p) => p.workflows);
    const fl = f.toLowerCase();
    const matches = (s) => !!fl && s.toLowerCase().includes(fl);
    w.add('hero', true, `${domain} domain case study`, f ? `${f} across ${domain}` : `Building the digital backbone of ${domain}`,
      join([`${ORG} has delivered ${projects.length} ${projects.length === 1 ? 'engagement' : 'engagements'} in ${domain}:`, projects.map((p) => p.name).join(', ') + '.']),
      [
        { title: 'Platforms', body: uniq(projects.flatMap((p) => p.platforms)).join(' · ') },
        { title: 'Business functions', body: count(uniq(projects.flatMap((p) => p.businessFunctions)).length, 'function') },
        { title: 'Engagements', body: count(projects.length, 'project') },
        { title: 'Scope', body: uniq(projects.flatMap((p) => p.scope)).join(' · ') },
        { title: 'Capabilities showcased', body: join([count(caps.length, 'capability'), count(flows.length, 'workflow')], ' · ') },
      ].filter((x) => !isBlank(x.body)));
    addHeroVisual(w, projects);
    w.add('overview', true, 'Domain overview', `What ${domain} involves — and where we fit`, join(projects.map((p) => p.businessContext)), [
      ...uniq(projects.flatMap((p) => p.businessFunctions)).map((x) => ({ title: x, body: '', tag: 'Business function' })),
      ...uniq(projects.flatMap((p) => p.stakeholders)).map((x) => ({ title: x, body: '', tag: 'Users & stakeholders' })),
      ...uniq(projects.flatMap((p) => p.businessProcesses)).map((x) => ({ title: x, body: '', tag: 'Key business process' })),
      ...projects.filter((p) => !isBlank(p.contribution)).map((p) => ({ title: p.name, body: p.contribution, tag: 'Our scope', sourceProjectId: p.id })),
    ]);
    w.add('challenges', true, 'Business challenges', 'The challenges our work addresses', '', challengesOf(projects));
    w.add('capabilities', true, 'Capabilities delivered', `Capabilities delivered across ${domain}`, '', caps.map(({ c, p }) => ({ tag: c.category, title: c.name, body: c.description, meta: c.users, list: c.features, sourceProjectId: p.id })));
    const feats = projects.flatMap((p) => p.features.map((ft) => ({ ft, p }))).sort((a, b) => Number(matches(b.ft.name)) - Number(matches(a.ft.name)));
    w.add('features', true, 'Feature & solution showcase', f ? `${f}: features delivered` : 'Features that solve real business problems', '', feats.map(({ ft, p }) => ({
      title: ft.name, meta: ft.problem, body: ft.solution, list: ft.functionality, value: ft.benefit, tag: p.name, assetId: firstVisualAssetId(p), sourceProjectId: p.id,
    })));
    w.add('workflows', false, 'End-to-end business workflow', 'How the work flows end to end', '', workflowsOf(projects));
    w.add('technology', false, 'Technology ecosystem', 'The technical foundation behind the work', '', technologyOf(projects));
    w.add('impact', true, 'Business impact & outcomes', 'The value our work created', '', outcomesOf(projects));
    w.add('before_after', false, 'Before → after', 'What changed for the business', '', beforeAfterOf(projects));
    w.add('summary', false, 'Engagement summary', 'Engagement summary', '', [
      { title: 'Scope of contribution', body: '', list: uniq(projects.flatMap((p) => p.scope)) },
      { title: 'Products & engagements', body: '', list: projects.map((p) => p.name) },
      { title: 'Technical highlights', body: '', list: uniq(projects.flatMap((p) => p.technicalHighlights)) },
      { title: 'Future opportunities', body: join(projects.map((p) => p.futureOpportunities)) },
    ].filter((x) => (x.list || []).length > 0 || !isBlank(x.body)));
    title = w.sections[0].heading;
    subtitle = `${domain} · ${count(projects.length, 'source project')}`;
  }
  return { title, subtitle, type, domain, focus: focus.trim(), sourceProjectIds: projects.map((p) => p.id), sections: w.sections, generatedBy: 'prototype' };
}
