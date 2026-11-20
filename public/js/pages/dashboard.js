import { h, link, icon, SearchInput } from '../ui.js';
import { store } from '../store.js';
import { CASE_STUDY_TYPES } from '/shared/catalog.js';
import { ProjectRow, CaseStudyRow } from '../components.js';

const byUpdated = (a, b) => b.updatedAt.localeCompare(a.updatedAt);

export function DashboardPage() {
  const { projects, caseStudies } = store;
  const recentProjects = [...projects].sort(byUpdated).slice(0, 5);
  const recentCases = [...caseStudies].sort(byUpdated).slice(0, 4);
  const domains = [...new Set(projects.map((p) => p.domain))];
  const totals = [
    { label: 'Projects', value: projects.length, detail: `${projects.filter((p) => p.status === 'completed').length} completed · ${projects.filter((p) => p.status === 'draft').length} draft`, href: '/projects' },
    { label: 'Case studies', value: caseStudies.length, detail: `${caseStudies.filter((c) => c.status === 'completed').length} completed · ${caseStudies.filter((c) => c.status === 'draft').length} draft`, href: '/case-studies' },
    { label: 'Domains covered', value: domains.length, detail: domains.join(' · '), href: '/projects' },
  ];

  const results = h('div', { class: 'absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-ink-700 bg-ink-850 shadow-2xl', hidden: true });
  const onSearch = (q) => {
    const t = q.trim().toLowerCase();
    if (!t) { results.hidden = true; return; }
    const hits = [
      ...projects.filter((p) => [p.name, p.domain, p.industry, ...p.tags].some((x) => x.toLowerCase().includes(t))).map((p) => ({ href: `/projects/${p.id}`, title: p.name, kind: 'Project' })),
      ...caseStudies.filter((c) => [c.title, c.domain].some((x) => x.toLowerCase().includes(t))).map((c) => ({ href: `/case-studies/${c.id}`, title: c.title, kind: 'Case study' })),
    ].slice(0, 8);
    results.hidden = false;
    results.replaceChildren(...(hits.length ? hits.map((r) => link(r.href, { class: 'flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-ink-800' }, h('span', { class: 'truncate' }, r.title), h('span', { class: 'shrink-0 text-xs text-fg-subtle' }, r.kind)))
      : [h('p', { class: 'px-4 py-3 text-sm text-fg-subtle' }, 'No matches.')]));
  };

  return h('div', { class: 'space-y-10' },
    h('section', { class: 'relative overflow-hidden rounded-3xl border border-ink-700/70 bg-ink-900 px-6 py-10 sm:px-10 sm:py-12' },
      h('div', { 'aria-hidden': 'true', class: 'pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-accent/15 blur-3xl' }),
      h('div', { class: 'relative grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-end' },
        h('div', {},
          h('div', { class: 'eyebrow mb-4 flex items-center gap-2' }, h('span', { class: 'h-px w-6 bg-accent' }), ' Welcome back'),
          h('h1', { class: 'text-4xl leading-[1.1] sm:text-5xl' }, 'Turn delivered work into', h('br'), 'compelling case studies', h('span', { class: 'text-accent' }, '.')),
          h('p', { class: 'mt-4 max-w-xl text-fg-muted' }, 'Capture each project once as a reusable record, then assemble one or more projects into domain, project or staffing case studies.'),
          h('div', { class: 'mt-8 flex flex-wrap gap-3' },
            link('/projects/new', { class: 'btn-secondary px-5 py-3' }, icon('plus'), ' Create project'),
            link('/case-studies/new', { class: 'btn-primary px-5 py-3' }, icon('sparkle'), ' Assemble case study'))),
        h('div', { class: 'relative' },
          SearchInput({ value: '', onInput: onSearch, placeholder: 'Search projects and case studies', label: 'Quick search' }),
          results,
          h('div', { class: 'mt-4 flex flex-wrap gap-2 text-xs' }, h('span', { class: 'text-fg-subtle' }, 'Start a:'),
            CASE_STUDY_TYPES.map((t) => link(`/case-studies/new?type=${t.value}`, { class: 'rounded-full border border-ink-700 px-3 py-1 text-fg-muted hover:border-accent hover:text-fg' }, t.short, ' case study')))))),
    h('section', { 'aria-label': 'Totals', class: 'grid gap-px overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-700/70 sm:grid-cols-3' },
      totals.map((t) => link(t.href, { class: 'bg-ink-900 px-6 py-6 transition hover:bg-ink-850' },
        h('div', { class: 'eyebrow' }, t.label), h('div', { class: 'mt-2 text-4xl font-bold' }, t.value), h('div', { class: 'mt-1 truncate text-sm text-fg-subtle' }, t.detail)))),
    h('section', { class: 'grid gap-8 xl:grid-cols-2 [&>*]:min-w-0' },
      h('div', {},
        h('div', { class: 'mb-3 flex items-center justify-between' }, h('h2', { class: 'text-xl' }, 'Recent projects'),
          link('/projects', { class: 'flex items-center gap-1 text-sm text-fg-muted hover:text-fg' }, 'All projects ', icon('arrowRight', { size: 16 }))),
        h('div', { class: 'surface p-2' }, recentProjects.map(ProjectRow))),
      h('div', {},
        h('div', { class: 'mb-3 flex items-center justify-between' }, h('h2', { class: 'text-xl' }, 'Recent case studies'),
          link('/case-studies', { class: 'flex items-center gap-1 text-sm text-fg-muted hover:text-fg' }, 'All case studies ', icon('arrowRight', { size: 16 }))),
        h('div', { class: 'surface p-2' }, recentCases.map(CaseStudyRow)))));
}
