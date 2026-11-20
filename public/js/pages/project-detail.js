import { h, icon, cx, link, toast, navigate, EmptyState, ProjectTypeBadge, StatusBadge, CaseTypeBadge, BrowserFrame } from '../ui.js';
import { getProject, caseStudiesUsingProject, duplicateProject } from '../store.js';
import { formatDate } from '/shared/project.js';
import { TECH_CATEGORIES, EVIDENCE, LANES, ASSET_KINDS } from '/shared/catalog.js';
import { PdfButton, confirmDeleteProject } from '../components.js';

const pad = (n) => String(n).padStart(2, '0');
const Block = (title, ...children) => h('section', { class: 'space-y-5 border-t border-ink-700/60 pt-8' }, h('h2', { class: 'text-xl' }, title), ...children);
const Chip = (t) => h('span', { class: 'rounded-full border border-ink-700 px-3 py-1 text-xs text-fg-muted' }, t);
const Card = (...c) => h('div', { class: 'rounded-xl border border-ink-700/70 bg-ink-850/70 p-5' }, ...c);

/** Read-only body of a project record (also used for the project PDF). */
export function ProjectBody(p, { forPdf = false } = {}) {
  const S = p.staffing;
  const facts = [['Domain', p.domain], ['Industry', p.industry], ['Client', p.client], ['Engagement', p.engagementPeriod]].filter(([, v]) => v);
  const tech = TECH_CATEGORIES.map((c) => ({ label: c.label, list: p.technologies.filter((t) => t.category === c.value).map((t) => t.name) })).filter((c) => c.list.length);
  const total = (m) => m.engineering + m.qa + m.other;
  return h('div', { class: 'space-y-8' },
    h('div', {},
      facts.length > 0 && h('dl', { class: 'grid grid-cols-2 gap-x-8 gap-y-5 border-y border-ink-700/60 py-5 md:grid-cols-4' }, facts.map(([k, v]) => h('div', {}, h('dt', { class: 'eyebrow' }, k), h('dd', { class: 'mt-1.5 text-sm' }, v)))),
      p.description && h('p', { class: 'mt-6 leading-relaxed text-fg-muted' }, p.description),
      (p.services.length > 0 || p.platforms.length > 0) && h('div', { class: 'mt-5 flex flex-wrap gap-2' }, [...p.services, ...p.platforms].map(Chip))),
    (p.businessContext || p.challenges.length > 0 || p.stakeholders.length > 0) && Block('Business context & challenges',
      p.businessContext && h('p', { class: 'leading-relaxed text-fg-muted' }, p.businessContext),
      p.stakeholders.length > 0 && h('div', { class: 'flex flex-wrap items-center gap-2 text-sm' }, h('span', { class: 'eyebrow mr-1' }, 'Users & stakeholders'), p.stakeholders.map(Chip)),
      p.challenges.map((c, i) => h('div', { class: 'grid gap-4 rounded-xl border border-ink-700/70 bg-ink-850/70 p-5 md:grid-cols-[40px_1.3fr_1fr]' },
        h('span', { class: 'text-xl font-bold text-accent' }, pad(i + 1)),
        h('div', {}, c.area && h('div', { class: 'eyebrow mb-1' }, c.area), h('div', { class: 'font-bold' }, c.title), c.description && h('p', { class: 'mt-1 text-sm text-fg-muted' }, c.description)),
        c.implication && h('div', {}, h('div', { class: 'eyebrow mb-1' }, 'Business implication'), h('p', { class: 'text-sm' }, c.implication))))),
    (p.solutionSummary || p.modules.length > 0) && Block('Solution & modules',
      p.solutionSummary && h('p', { class: 'leading-relaxed text-fg-muted' }, p.solutionSummary),
      p.modules.length > 0 && h('ul', { class: 'grid gap-x-10 gap-y-2.5 md:grid-cols-2' }, p.modules.map((m) => h('li', { class: 'flex gap-3 text-sm' }, h('span', { class: 'mt-[6px] h-2 w-2 shrink-0 rotate-45 bg-accent' }), m)))),
    (p.capabilities.length > 0 || p.features.length > 0) && Block('Capabilities & features',
      h('div', { class: 'grid gap-4 md:grid-cols-2' },
        p.capabilities.map((c) => Card(c.category && h('div', { class: 'eyebrow mb-1' }, c.category), h('div', { class: 'font-bold' }, c.name), c.description && h('p', { class: 'mt-1 text-sm text-fg-muted' }, c.description),
          h('div', { class: 'mt-3 space-y-1 text-xs text-fg-subtle' }, c.users && h('div', {}, 'Users: ', c.users), c.features.length > 0 && h('div', {}, 'Features: ', c.features.join(' · '))))),
        p.features.map((f) => Card(h('div', { class: 'eyebrow mb-1' }, 'Feature'), h('div', { class: 'font-bold' }, f.name),
          f.problem && h('p', { class: 'mt-2 text-sm' }, h('span', { class: 'text-fg-subtle' }, 'Challenge: '), f.problem),
          f.solution && h('p', { class: 'mt-1 text-sm text-fg-muted' }, f.solution),
          f.functionality.length > 0 && h('ol', { class: 'mt-3 space-y-1 text-sm' }, f.functionality.map((s, i) => h('li', { class: 'flex gap-2' }, h('span', { class: 'font-bold text-accent' }, i + 1, '.'), s))),
          f.benefit && h('p', { class: 'mt-3 text-sm' }, h('span', { class: 'text-fg-subtle' }, 'Benefit: '), f.benefit))))),
    p.workflows.length > 0 && Block('Workflows & functionality', p.workflows.map((w) => Card(
      h('div', { class: 'font-bold' }, w.name), w.purpose && h('p', { class: 'mt-1 text-sm text-fg-muted' }, w.purpose),
      w.steps.length > 0 && h('ol', { class: 'mt-4 flex flex-wrap gap-2' }, w.steps.map((s) => h('li', { class: cx('rounded-lg border px-3 py-2 text-xs', s.kind === 'decision' ? 'border-accent bg-accent-soft' : 'border-ink-600 bg-ink-800') },
        h('span', { class: 'block text-[10px] tracking-[0.14em] text-fg-subtle uppercase' }, LANES[s.lane]), s.label))),
      h('div', { class: 'mt-4 space-y-1 text-xs text-fg-subtle' }, w.trigger && h('div', {}, 'Starts: ', w.trigger), w.systems && h('div', {}, 'Involves: ', w.systems), w.output && h('div', {}, 'Output: ', w.output))))),
    p.type === 'staffing' && (S.challengeSummary || S.approachSummary || S.roles.length > 0 || S.deployment.length > 0) && Block('Staffing engagement',
      h('div', { class: 'grid gap-4 md:grid-cols-2' }, [['The challenge', S.challengeSummary, S.challengePoints], ['Our approach', S.approachSummary, S.approachPoints]].map(([label, sum, pts]) => Card(
        h('div', { class: 'eyebrow mb-2 text-accent' }, label), sum && h('div', { class: 'font-bold' }, sum),
        pts.length > 0 && h('ol', { class: 'mt-3 space-y-2 text-sm text-fg-muted' }, pts.map((x, i) => h('li', { class: 'flex gap-2' }, h('span', { class: 'font-bold text-accent' }, pad(i + 1)), x)))))),
      h('dl', { class: 'grid grid-cols-2 gap-4 md:grid-cols-5' }, [['Reporting period', S.reportingPeriod], ['Initial team', S.initialTeamSize], ['Peak team', S.peakTeamSize], ['Final team', S.finalTeamSize], ['Duration (months)', S.durationMonths]].map(([k, v]) => h('div', {}, h('dt', { class: 'eyebrow' }, k), h('dd', { class: 'mt-1 text-lg font-bold' }, v || '—')))),
      S.roles.length > 0 && h('div', { class: 'flex flex-wrap items-center gap-2' }, h('span', { class: 'eyebrow mr-1' }, 'Roles'), S.roles.map(Chip)),
      S.deployment.length > 0 && h('div', { class: 'overflow-x-auto rounded-xl border border-ink-700/70' }, h('table', { class: 'w-full text-left text-sm' },
        h('thead', { class: 'bg-ink-850 text-xs text-fg-subtle' }, h('tr', {}, ['Month', 'Engineering', 'QA / Testing', 'Data / AI / Other', 'Total'].map((x) => h('th', { class: 'px-4 py-2 font-medium' }, x)))),
        h('tbody', { class: 'divide-y divide-ink-700/60' }, S.deployment.map((m) => h('tr', {}, h('td', { class: 'px-4 py-2' }, m.month), h('td', { class: 'px-4 py-2' }, m.engineering), h('td', { class: 'px-4 py-2' }, m.qa), h('td', { class: 'px-4 py-2' }, m.other), h('td', { class: 'px-4 py-2 font-bold' }, total(m))))))),
      S.outcomeSummary && h('p', { class: 'text-fg-muted' }, S.outcomeSummary)),
    tech.length > 0 && Block('Technology & integrations', h('div', { class: 'grid gap-px overflow-hidden rounded-xl border border-ink-700/70 bg-ink-700/70 md:grid-cols-3' },
      tech.map((c) => h('div', { class: 'bg-ink-900 p-4' }, h('div', { class: 'eyebrow mb-2' }, c.label), h('div', { class: 'flex flex-wrap gap-1.5' }, c.list.map((t) => h('span', { class: 'rounded-md border border-ink-600 bg-ink-850 px-2.5 py-1 text-sm' }, t))))))),
    (p.outcomes.length > 0 || p.beforeAfter.length > 0 || p.technicalHighlights.length > 0 || p.futureOpportunities) && Block('Outcomes & evidence',
      p.outcomes.length > 0 && h('div', { class: 'grid gap-4 md:grid-cols-2' }, p.outcomes.map((o) => Card(
        h('div', { class: 'eyebrow mb-2' }, EVIDENCE[o.evidence]), o.value && h('div', { class: 'text-3xl font-bold' }, o.value), h('div', { class: 'font-bold' }, o.label),
        h('p', { class: 'mt-2 text-xs text-fg-subtle' }, [o.baseline && `Baseline: ${o.baseline}`, o.period && `Period: ${o.period}`, o.source && `Source: ${o.source}`].filter(Boolean).join(' · '))))),
      p.beforeAfter.length > 0 && h('div', { class: 'overflow-x-auto rounded-xl border border-ink-700/70' }, h('table', { class: 'w-full text-left text-sm' },
        h('thead', { class: 'bg-ink-850 text-xs text-fg-subtle' }, h('tr', {}, h('th', { class: 'px-4 py-2 font-medium' }, 'Process'), h('th', { class: 'px-4 py-2 font-medium' }, 'Before'), h('th', { class: 'px-4 py-2 font-medium text-accent' }, 'After'))),
        h('tbody', { class: 'divide-y divide-ink-700/60' }, p.beforeAfter.map((b) => h('tr', {}, h('td', { class: 'px-4 py-3 font-bold' }, b.process), h('td', { class: 'px-4 py-3 text-fg-subtle' }, b.before), h('td', { class: 'px-4 py-3' }, b.after)))))),
      p.technicalHighlights.length > 0 && h('div', {}, h('div', { class: 'eyebrow mb-2' }, 'Technical highlights'), h('ul', { class: 'space-y-1.5 text-sm' }, p.technicalHighlights.map((t) => h('li', { class: 'flex gap-2' }, h('span', { class: 'mt-2 h-1 w-1 shrink-0 rounded-full bg-accent' }), t)))),
      p.futureOpportunities && h('div', {}, h('div', { class: 'eyebrow mb-2' }, 'Future opportunities'), h('p', { class: 'text-sm text-fg-muted' }, p.futureOpportunities))),
    (p.contribution || p.scope.length > 0) && Block('Our contribution',
      p.contribution && h('p', { class: 'leading-relaxed text-fg-muted' }, p.contribution), p.scope.length > 0 && h('div', { class: 'flex flex-wrap gap-2' }, p.scope.map(Chip)),
      forPdf && p.constraints && h('div', {}, h('div', { class: 'eyebrow mb-1' }, 'Limitations or constraints'), h('p', { class: 'text-sm text-fg-muted' }, p.constraints))),
    p.assets.length > 0 && Block('Supporting assets', h('div', { class: 'grid gap-5 md:grid-cols-2' },
      p.assets.map((a) => BrowserFrame({ src: a.previewUrl, caption: `${ASSET_KINDS[a.kind] || 'Asset'} · ${a.title}${a.caption ? ` — ${a.caption}` : ''}` })))));
}

export function ProjectHeader(p) {
  return h('div', {},
    h('div', { class: 'eyebrow mb-3 flex items-center gap-2' }, h('span', { class: 'h-px w-6 bg-accent' }), 'Project · Source record'),
    h('h1', { class: 'text-3xl leading-tight sm:text-4xl' }, p.name),
    p.tagline && h('p', { class: 'mt-3 text-fg-muted' }, p.tagline),
    h('div', { class: 'mt-4 flex flex-wrap items-center gap-2' }, ProjectTypeBadge(p.type), StatusBadge(p.status), p.tags.map((t) => h('span', { class: 'rounded-md bg-ink-800 px-2 py-0.5 text-xs text-fg-muted' }, '#', t))));
}

export function ProjectDetailPage(id) {
  const p = getProject(id);
  if (!p) return EmptyState({ title: 'Project not found', body: 'It may have been deleted.', action: link('/projects', { class: 'btn-secondary' }, 'Back to projects') });
  const used = caseStudiesUsingProject(id);
  return h('div', {},
    link('/projects', { class: 'mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg' }, icon('arrowLeft', { size: 16 }), ' Projects library'),
    h('div', { class: 'grid gap-10 xl:grid-cols-[minmax(0,1fr)_320px]' },
      h('div', { class: 'min-w-0 space-y-8' }, ProjectHeader(p), ProjectBody(p)),
      h('aside', { class: 'space-y-5 xl:sticky xl:top-8 xl:self-start' },
        h('div', { class: 'surface space-y-2 p-4' },
          link(`/projects/${id}/edit`, { class: 'btn-primary w-full' }, icon('edit', { size: 16 }), ' Edit project'),
          h('button', { class: 'btn-secondary w-full', onClick: async () => { try { const c = await duplicateProject(id); toast('Project duplicated as a draft'); navigate(`/projects/${c.id}/edit`); } catch (e) { toast(e.message, 'error'); } } }, icon('copy', { size: 16 }), ' Duplicate project'),
          PdfButton({ kind: 'project', id, className: 'w-full' }),
          h('button', { class: 'btn-danger w-full', onClick: () => confirmDeleteProject(p, () => navigate('/projects')) }, icon('trash', { size: 16 }), ' Delete project'),
          link('/projects', { class: 'block pt-1 text-center text-sm text-fg-muted hover:text-fg' }, 'Return to Projects Library'),
          h('dl', { class: 'mt-3 space-y-1 border-t border-ink-700/60 pt-3 text-xs' },
            h('div', { class: 'flex justify-between' }, h('dt', { class: 'text-fg-subtle' }, 'Created'), h('dd', {}, formatDate(p.createdAt))),
            h('div', { class: 'flex justify-between' }, h('dt', { class: 'text-fg-subtle' }, 'Last updated'), h('dd', {}, formatDate(p.updatedAt))))),
        h('div', { class: 'surface p-4' },
          h('div', { class: 'eyebrow mb-1 flex items-center gap-2 text-accent' }, icon('layers', { size: 14 }), ' Assembled case studies'),
          h('p', { class: 'mb-3 text-xs text-fg-subtle' }, 'Case studies keep their own copy of the content. Editing this project does not change them.'),
          used.length === 0 ? h('p', { class: 'mb-3 text-sm text-fg-subtle' }, 'Not used in a case study yet.')
            : h('ul', { class: 'mb-3 space-y-2' }, used.map((c) => h('li', {}, link(`/case-studies/${c.id}`, { class: 'block rounded-lg border border-ink-700/70 bg-ink-850 p-3 hover:border-ink-600' },
              h('div', { class: 'text-sm font-bold' }, c.title), h('div', { class: 'mt-1.5 flex flex-wrap gap-1.5' }, CaseTypeBadge(c.type), StatusBadge(c.status)))))),
          link(`/case-studies/new?project=${id}`, { class: 'btn-secondary btn-sm w-full' }, icon('sparkle', { size: 14 }), ' Use in a new case study')))));
}
