import { h, icon, cx, link, toast, navigate, PageHeader, SearchInput, FilterSelect, ProjectTypeBadge, StatusBadge } from '../ui.js';
import { store, getProject, generateCaseStudy } from '../store.js';
import { CASE_STUDY_TYPES, PROJECT_TYPES } from '/shared/catalog.js';

const STEPS = ['Case study type', 'Source projects', 'Review selection', 'Create draft'];
const PROGRESS = ['Reading the selected project records', 'Mapping fields to the template sections', 'Omitting sections without supporting data', 'Creating an editable draft'];
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function AssemblePage(query) {
  const qType = query.get('type');
  const qProject = query.get('project');
  let type = CASE_STUDY_TYPES.some((t) => t.value === qType) ? qType : null;
  let stepIdx = type ? 1 : 0;
  let selected = qProject && getProject(qProject) ? [qProject] : [];
  let focus = '';
  let progress = -1;
  const pick = { q: '', domain: type === 'staffing' ? 'Staffing' : 'all', ptype: 'all' };

  const root = h('div');
  const def = () => CASE_STUDY_TYPES.find((t) => t.value === type);
  const chosen = () => selected.map(getProject).filter(Boolean);
  const domains = () => [...new Set(chosen().map((p) => p.domain))];
  const selectionError = () => (selected.length === 0 ? 'Select at least one project.' : type === 'project' && selected.length > 1 ? 'A project-specific case study uses exactly one project.' : null);
  const go = (i) => { stepIdx = i; draw(); window.scrollTo({ top: 0 }); };

  function SelectionSummary({ onContinue, continueLabel = 'Review selection', note }) {
    const e = selectionError();
    return h('aside', { class: 'xl:sticky xl:top-8 xl:self-start' }, h('div', { class: 'surface p-5' },
      h('div', { class: 'eyebrow' }, 'Selected'), h('div', { class: 'mt-1 text-4xl font-bold' }, selected.length),
      h('div', { class: 'text-sm text-fg-subtle' }, selected.length === 1 ? 'project' : 'projects', domains().length > 0 && ` · ${domains().join(', ')}`),
      note && h('p', { class: 'mt-3 text-xs text-fg-subtle' }, note),
      e && selected.length > 0 && h('p', { class: 'mt-3 text-xs text-accent' }, e),
      h('button', { class: 'btn-primary mt-5 w-full', disabled: !!e, onClick: onContinue }, continueLabel, ' ', icon('arrowRight', { size: 16 }))));
  }

  function ProjectPicker() {
    const single = type === 'project';
    const all = store.projects;
    const listHost = h('div', { role: single ? 'radiogroup' : 'group', 'aria-label': 'Source projects', class: 'surface divide-y divide-ink-700/50 overflow-hidden' });
    const quick = h('div');
    const domainOptions = [...new Set(all.map((p) => p.domain))].sort();
    const filtered = () => {
      const t = pick.q.trim().toLowerCase();
      return all.filter((p) => (!t || [p.name, p.description, p.industry, ...p.tags].some((x) => x.toLowerCase().includes(t))) && (pick.domain === 'all' || p.domain === pick.domain) && (pick.ptype === 'all' || p.type === pick.ptype));
    };
    const drawList = () => {
      const rows = filtered();
      listHost.replaceChildren(...(rows.length === 0 ? [h('p', { class: 'px-5 py-8 text-center text-sm text-fg-subtle' }, 'No projects match these filters.')]
        : rows.map((p) => {
          const on = selected.includes(p.id);
          return h('label', { class: cx('relative flex cursor-pointer gap-4 px-5 py-4 transition', on ? 'bg-accent-soft/60' : 'hover:bg-ink-850') },
            h('input', { type: single ? 'radio' : 'checkbox', name: 'source-projects', 'aria-label': p.name, class: 'sr-only', checked: on, onChange: () => {
              selected = single ? (selected.includes(p.id) ? [] : [p.id]) : (selected.includes(p.id) ? selected.filter((x) => x !== p.id) : [...selected, p.id]);
              draw();
            } }),
            h('span', { 'aria-hidden': 'true', class: cx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center border transition', single ? 'rounded-full' : 'rounded-md', on ? 'border-accent bg-accent text-white' : 'border-ink-600 bg-ink-850') }, on && icon('check', { size: 12 })),
            h('span', { class: 'min-w-0 flex-1' },
              h('span', { class: 'flex flex-wrap items-center gap-2' }, h('span', { class: 'font-bold' }, p.name), ProjectTypeBadge(p.type), p.status === 'draft' && StatusBadge('draft')),
              h('span', { class: 'mt-1 line-clamp-2 block text-sm text-fg-subtle' }, p.tagline || p.description),
              h('span', { class: 'mt-2 flex flex-wrap gap-1.5 text-xs' }, h('span', { class: 'rounded-md bg-ink-800 px-2 py-0.5 text-fg-muted' }, p.domain),
                p.industry && h('span', { class: 'rounded-md bg-ink-800 px-2 py-0.5 text-fg-muted' }, p.industry), p.tags.map((t) => h('span', { class: 'px-1 text-fg-subtle' }, '#', t)))));
        })));
      if (type === 'staffing') {
        const pill = (label, val) => h('button', { type: 'button', onClick: () => { pick.domain = val; draw(); }, class: cx('rounded-full border px-3 py-1', pick.domain === val ? 'border-accent bg-accent-soft text-accent' : 'border-ink-700 text-fg-muted') }, label);
        quick.replaceChildren(h('div', { class: 'flex flex-wrap items-center gap-2 text-sm' }, h('span', { class: 'text-fg-subtle' }, 'Quick filter:'), pill('Staffing domain', 'Staffing'), pill('All domains', 'all'),
          pick.domain === 'Staffing' && rows.length > 0 && h('button', { type: 'button', class: 'ml-auto text-fg-muted hover:text-fg', onClick: () => { selected = [...new Set([...selected, ...rows.map((p) => p.id)])]; draw(); } }, 'Select all ', rows.length, ' staffing projects')));
      }
    };
    drawList();
    return h('div', { class: 'space-y-4' },
      h('div', { class: 'grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]' },
        SearchInput({ value: pick.q, onInput: (v) => { pick.q = v; drawList(); }, placeholder: 'Search name, industry or tag', label: 'Search projects' }),
        FilterSelect({ label: 'Filter by domain', value: pick.domain, onChange: (v) => { pick.domain = v; draw(); }, options: [{ value: 'all', label: 'All domains' }, ...domainOptions.map((d) => ({ value: d, label: d }))] }),
        FilterSelect({ label: 'Filter by project type', value: pick.ptype, onChange: (v) => { pick.ptype = v; drawList(); }, options: [{ value: 'all', label: 'All project types' }, ...PROJECT_TYPES.map((t) => ({ value: t.value, label: t.short }))] })),
      quick, listHost);
  }

  function stepBody() {
    if (stepIdx === 0) {
      return h('section', { 'aria-labelledby': 'step-a' }, h('h2', { id: 'step-a', class: 'sr-only' }, 'Select the case study type'),
        h('div', { role: 'radiogroup', 'aria-label': 'Case study type', class: 'grid gap-4 lg:grid-cols-3' }, CASE_STUDY_TYPES.map((t, i) => h('button', {
          type: 'button', role: 'radio', 'aria-checked': String(type === t.value), 'aria-label': `${t.label}: ${t.description}`,
          onClick: () => { type = t.value; if (t.value === 'project' && selected.length > 1) selected = selected.slice(0, 1); if (t.value === 'staffing') pick.domain = 'Staffing'; draw(); },
          class: cx('group relative flex flex-col overflow-hidden rounded-2xl border p-6 text-left transition', type === t.value ? 'border-accent bg-accent-soft' : 'border-ink-700 bg-ink-900 hover:border-ink-600'),
        }, h('span', { class: 'text-5xl font-black text-ink-700 transition group-hover:text-ink-600' }, '0', i + 1),
        h('span', { class: 'mt-4 flex items-center justify-between text-lg font-bold' }, t.label, type === t.value && icon('check', { className: 'text-accent' })),
        h('span', { class: 'mt-2 text-sm leading-relaxed text-fg-muted' }, t.description),
        h('span', { class: 'mt-4 text-xs text-fg-subtle' }, t.selection)))),
        h('div', { class: 'mt-8 flex justify-end' }, h('button', { class: 'btn-primary', disabled: !type, onClick: () => go(1) }, 'Continue ', icon('arrowRight', { size: 16 }))));
    }
    if (stepIdx === 1) {
      return h('section', { 'aria-labelledby': 'step-b', class: 'grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]' },
        h('div', {},
          h('div', { class: 'mb-4' }, h('h2', { id: 'step-b', class: 'text-xl' }, 'Select source projects'), h('p', { class: 'mt-1 text-sm text-fg-subtle' }, def().selection, ' Any project type can be used.')),
          type === 'feature' && h('div', { class: 'mb-5 max-w-md' },
            h('label', { class: 'label', for: 'focus' }, 'Target feature or capability ', h('span', { class: 'text-fg-subtle' }, '(optional)')),
            h('input', { id: 'focus', class: 'input', value: focus, placeholder: 'e.g. Digital onboarding', onInput: (e) => { focus = e.target.value; } }),
            h('p', { class: 'mt-1.5 text-xs text-fg-subtle' }, 'Leave empty for a domain-wide case study.')),
          ProjectPicker()),
        SelectionSummary({ onContinue: () => go(2), note: type === 'project' ? 'Project-specific case studies focus on one project.' : undefined }));
    }
    if (stepIdx === 2) {
      return h('section', { 'aria-labelledby': 'step-c', class: 'grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]' },
        h('div', {},
          h('h2', { id: 'step-c', class: 'mb-1 text-xl' }, 'Review selection'),
          h('p', { class: 'mb-5 text-sm text-fg-subtle' }, def().label, focus && ` · focus: ${focus}`),
          type === 'feature' && domains().length > 1 && h('p', { class: 'mb-4 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning' }, 'The selection spans ', domains().length, ' domains (', domains().join(', '), '). Domain case studies usually focus on one.'),
          h('ul', { class: 'space-y-3' }, chosen().map((p) => h('li', { class: 'surface flex flex-col gap-4 p-5 sm:flex-row sm:items-start' },
            h('div', { class: 'min-w-0 flex-1' },
              h('div', { class: 'flex flex-wrap items-center gap-2' }, h('span', { class: 'font-bold' }, p.name), ProjectTypeBadge(p.type), StatusBadge(p.status)),
              h('p', { class: 'mt-1 text-sm text-fg-subtle' }, p.tagline || p.description),
              h('div', { class: 'mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-fg-muted' },
                h('span', {}, p.domain, ' · ', p.industry), h('span', {}, plural(p.challenges.length, 'challenge')),
                h('span', {}, plural(p.capabilities.length + p.features.length, 'capability or feature', 'capabilities or features')),
                h('span', {}, plural(p.outcomes.length, 'outcome')), h('span', {}, plural(p.technologies.length, 'technology', 'technologies')))),
            h('div', { class: 'flex gap-1' },
              h('a', { href: `/projects/${p.id}`, target: '_blank', class: 'btn-ghost btn-sm' }, 'View'),
              h('button', { class: 'btn-ghost btn-sm hover:text-accent', onClick: () => { selected = selected.filter((x) => x !== p.id); draw(); } }, icon('x', { size: 14 }), ' Remove'))))),
          h('button', { class: 'btn-secondary mt-4', onClick: () => go(1) }, icon('plus', { size: 16 }), ' ', type === 'project' ? 'Change project' : 'Add projects')),
        SelectionSummary({ onContinue: () => go(3), continueLabel: 'Continue to draft' }));
    }
    return h('section', { 'aria-labelledby': 'step-d', class: 'mx-auto max-w-2xl' }, h('div', { class: 'surface overflow-hidden' },
      h('div', { class: 'border-b border-ink-700/60 bg-warning-soft px-6 py-3 text-sm text-warning' }, h('strong', { class: 'font-bold' }, 'Prototype generation.'), ' No AI is used yet: the draft is assembled from the selected project records only, and sections without supporting data are left out or marked as placeholders.'),
      h('div', { class: 'p-6 sm:p-8' },
        h('h2', { id: 'step-d', class: 'text-2xl' }, 'Create the case study draft'),
        h('dl', { class: 'mt-6 grid gap-4 text-sm sm:grid-cols-3' },
          h('div', {}, h('dt', { class: 'eyebrow' }, 'Type'), h('dd', { class: 'mt-1' }, def().short)),
          h('div', {}, h('dt', { class: 'eyebrow' }, 'Source projects'), h('dd', { class: 'mt-1' }, selected.length)),
          h('div', {}, h('dt', { class: 'eyebrow' }, 'Domain'), h('dd', { class: 'mt-1' }, type === 'staffing' ? 'Staffing' : domains().join(', ')))),
        progress >= 0
          ? h('ol', { class: 'mt-8 space-y-3', 'aria-live': 'polite' }, PROGRESS.map((t, i) => h('li', { class: cx('flex items-center gap-3 text-sm', i <= progress ? 'text-fg' : 'text-fg-subtle') },
            h('span', { class: cx('grid h-5 w-5 place-items-center rounded-full', i < progress ? 'bg-success-soft text-success' : i === progress ? 'animate-pulse bg-accent/30' : 'bg-ink-800') }, i < progress && icon('check', { size: 12 })), t)))
          : h('div', { class: 'mt-8 flex flex-wrap gap-3' },
            h('button', { class: 'btn-primary px-5 py-3', disabled: !!selectionError(), onClick: runGeneration }, icon('sparkle'), ' Generate sample draft'),
            h('button', { class: 'btn-ghost', onClick: () => go(2) }, 'Back to review')))));
  }

  async function runGeneration() {
    progress = 0; draw();
    const request = generateCaseStudy(type, selected, focus).catch((e) => e);
    for (let i = 1; i <= PROGRESS.length; i++) { await new Promise((r) => setTimeout(r, 450)); progress = i; if (root.isConnected) draw(); }
    const res = await request;
    if (res instanceof Error) { progress = -1; draw(); toast(res.message, 'error'); return; }
    toast('Sample draft created');
    navigate(`/case-studies/${res.id}`);
  }

  function draw() {
    root.replaceChildren(
      PageHeader({ eyebrow: 'Assemble', title: 'Assemble a case study', description: 'Combine saved projects into a consolidated case study. Source projects are linked, never copied or changed.' }),
      h('ol', { class: 'mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4' }, STEPS.map((label, i) => h('li', {},
        h('button', { type: 'button', disabled: i > stepIdx || progress >= 0, onClick: () => go(i), 'aria-current': i === stepIdx ? 'step' : undefined,
          class: cx('w-full border-t-2 pt-3 text-left text-sm transition disabled:cursor-default', i === stepIdx ? 'border-accent text-fg' : i < stepIdx ? 'border-ink-500 text-fg-muted hover:text-fg' : 'border-ink-700 text-fg-subtle') },
          h('span', { class: 'block text-xs text-fg-subtle' }, 'Step ', String.fromCharCode(65 + i)), label)))),
      stepBody());
  }
  draw();
  return root;
}
