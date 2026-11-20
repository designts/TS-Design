import { h, link, icon, PageHeader, SearchInput, FilterSelect, EmptyState } from '../ui.js';
import { store } from '../store.js';
import { CASE_STUDY_TYPES } from '/shared/catalog.js';
import { CaseStudyCard } from '../components.js';

const filters = { q: '', type: 'all', domain: 'all', status: 'all' };

export function CaseStudiesPage() {
  const all = store.caseStudies;
  const domains = [...new Set(all.map((c) => c.domain))].sort();
  const listHost = h('div');
  const draw = () => {
    const t = filters.q.trim().toLowerCase();
    const rows = [...all].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).filter((c) => (!t || c.title.toLowerCase().includes(t) || c.domain.toLowerCase().includes(t))
      && (filters.type === 'all' || c.type === filters.type) && (filters.domain === 'all' || c.domain === filters.domain) && (filters.status === 'all' || c.status === filters.status));
    listHost.replaceChildren(all.length === 0
      ? EmptyState({ title: 'No case studies yet', body: 'Assemble your first case study from saved projects.', action: link('/case-studies/new', { class: 'btn-primary' }, 'Assemble case study') })
      : rows.length === 0 ? EmptyState({ title: 'No case studies match', body: 'Try another search or clear the filters.' })
        : h('div', { class: 'grid gap-x-6 gap-y-8 pt-2 md:grid-cols-2 2xl:grid-cols-3' }, rows.map(CaseStudyCard)));
  };
  const page = h('div', {},
    PageHeader({ eyebrow: 'Assembled presentations', title: 'Case Studies', description: 'Consolidated case studies built from one or more saved projects. Each keeps its own editable content and links back to its source projects.',
      actions: link('/case-studies/new', { class: 'btn-primary' }, icon('sparkle'), ' Assemble case study') }),
    h('div', { class: 'mb-8 grid gap-3 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]' },
      SearchInput({ value: filters.q, onInput: (v) => { filters.q = v; draw(); }, placeholder: 'Search by title or domain', label: 'Search case studies' }),
      FilterSelect({ label: 'Filter by case study type', value: filters.type, onChange: (v) => { filters.type = v; draw(); }, options: [{ value: 'all', label: 'All types' }, ...CASE_STUDY_TYPES.map((x) => ({ value: x.value, label: x.short }))] }),
      FilterSelect({ label: 'Filter by domain', value: filters.domain, onChange: (v) => { filters.domain = v; draw(); }, options: [{ value: 'all', label: 'All domains' }, ...domains.map((d) => ({ value: d, label: d }))] }),
      FilterSelect({ label: 'Filter by status', value: filters.status, onChange: (v) => { filters.status = v; draw(); }, options: [{ value: 'all', label: 'All statuses' }, { value: 'draft', label: 'Draft' }, { value: 'completed', label: 'Completed' }] })),
    listHost);
  draw();
  return page;
}
