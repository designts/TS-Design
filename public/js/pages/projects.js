import { h, link, icon, PageHeader, SearchInput, FilterSelect, EmptyState } from '../ui.js';
import { store } from '../store.js';
import { PROJECT_TYPES } from '/shared/catalog.js';
import { ProjectsTable } from '../components.js';

const filters = { q: '', domain: 'all', type: 'all', status: 'all' };

export function ProjectsPage() {
  const all = store.projects;
  const domains = [...new Set(all.map((p) => p.domain))].sort();
  const listHost = h('div');
  const countHost = h('div', { class: 'mb-3 flex items-center justify-between text-sm text-fg-subtle' });

  const draw = () => {
    const t = filters.q.trim().toLowerCase();
    const rows = [...all].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).filter((p) => (!t || p.name.toLowerCase().includes(t))
      && (filters.domain === 'all' || p.domain === filters.domain) && (filters.type === 'all' || p.type === filters.type) && (filters.status === 'all' || p.status === filters.status));
    const filtered = filters.q || filters.domain !== 'all' || filters.type !== 'all' || filters.status !== 'all';
    countHost.replaceChildren(h('span', {}, rows.length, ' of ', all.length, ' projects'),
      filtered && h('button', { class: 'text-fg-muted hover:text-fg', onClick: () => { Object.assign(filters, { q: '', domain: 'all', type: 'all', status: 'all' }); page.replaceWith(ProjectsPage()); } }, 'Clear filters'));
    listHost.replaceChildren(rows.length ? ProjectsTable(rows) : EmptyState({ title: 'No projects match', body: 'Try a different name or clear the filters.' }));
  };

  const page = h('div', {},
    PageHeader({ eyebrow: 'Source records', title: 'Projects', description: 'Reusable records of products, engagements, features and staffing solutions. Each project can feed any number of case studies.',
      actions: link('/projects/new', { class: 'btn-primary' }, icon('plus'), ' Create project') }),
    h('div', { class: 'mb-4 grid gap-3 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]' },
      SearchInput({ value: filters.q, onInput: (v) => { filters.q = v; draw(); }, placeholder: 'Search by project name', label: 'Search projects' }),
      FilterSelect({ label: 'Filter by domain', value: filters.domain, onChange: (v) => { filters.domain = v; draw(); }, options: [{ value: 'all', label: 'All domains' }, ...domains.map((d) => ({ value: d, label: d }))] }),
      FilterSelect({ label: 'Filter by project type', value: filters.type, onChange: (v) => { filters.type = v; draw(); }, options: [{ value: 'all', label: 'All types' }, ...PROJECT_TYPES.map((t) => ({ value: t.value, label: t.short }))] }),
      FilterSelect({ label: 'Filter by status', value: filters.status, onChange: (v) => { filters.status = v; draw(); }, options: [{ value: 'all', label: 'All statuses' }, { value: 'draft', label: 'Draft' }, { value: 'completed', label: 'Completed' }] })),
    countHost, listHost);
  draw();
  return page;
}
