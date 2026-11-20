// Shared list components: project rows/table, case study cards/rows, delete dialogs, PDF button.
import { h, link, icon, cx, toast, confirmDialog, navigate, refresh, ProjectTypeBadge, StatusBadge, CaseTypeBadge } from './ui.js';
import { formatDate } from '/shared/project.js';
import { duplicateProject, deleteProject, caseStudiesUsingProject, deleteCaseStudy, duplicateCaseStudy } from './store.js';

export function PdfButton({ kind, id, compact, disabledReason, className }) {
  const label = 'Download PDF';
  return h('button', {
    type: 'button', class: cx(compact ? 'btn-ghost btn-sm px-2' : 'btn-secondary', className), disabled: !!disabledReason, title: disabledReason || label, 'aria-label': compact ? label : undefined,
    onClick: () => {
      const w = window.open(`/${kind === 'project' ? 'projects' : 'case-studies'}/${id}/print`, '_blank');
      if (!w) toast('Allow pop-ups for this site to download the PDF.', 'error');
    },
  }, icon('download', { size: compact ? 15 : 16 }), !compact && label);
}

export async function confirmDeleteProject(project, onDeleted) {
  const used = caseStudiesUsingProject(project.id);
  const extra = used.length > 0 && h('div', { class: 'mt-4 rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm' },
    h('p', { class: 'flex items-start gap-2 font-bold text-warning' }, icon('alert', { size: 16, className: 'mt-0.5' }), 'Used in ', used.length === 1 ? '1 case study' : `${used.length} case studies`),
    h('p', { class: 'mt-1.5 text-fg-muted' }, 'These case studies will ', h('strong', { class: 'text-fg' }, 'not'), ' be deleted. They keep the content already copied from this project, but will show the source as deleted. Update or regenerate them if they should no longer include it.'),
    h('ul', { class: 'mt-2 space-y-1' }, used.map((c) => h('li', {}, h('a', { href: `/case-studies/${c.id}`, class: 'text-fg underline-offset-2 hover:underline' }, c.title)))));
  const ok = await confirmDialog({ title: 'Delete this project?', body: `"${project.name}" will be removed from the Projects Library. This can't be undone.`, confirmLabel: 'Delete project', extra });
  if (!ok) return;
  try { await deleteProject(project.id); toast(`Deleted "${project.name}"`); onDeleted ? onDeleted() : refresh(); }
  catch (e) { toast(e.message, 'error'); }
}
export async function confirmDeleteCaseStudy(cs, onDeleted) {
  const ok = await confirmDialog({ title: 'Delete this case study?', body: `"${cs.title}" will be removed. Its source projects are not affected. This can't be undone.`, confirmLabel: 'Delete case study' });
  if (!ok) return;
  try { await deleteCaseStudy(cs.id); toast(`Deleted "${cs.title}"`); onDeleted ? onDeleted() : refresh(); }
  catch (e) { toast(e.message, 'error'); }
}

async function duplicateProjectAndEdit(id) {
  try { const p = await duplicateProject(id); toast('Project duplicated as a draft'); navigate(`/projects/${p.id}/edit`); } catch (e) { toast(e.message, 'error'); }
}

export const ProjectRow = (p) => link(`/projects/${p.id}`, { class: 'flex items-center justify-between gap-4 rounded-xl px-3 py-3 transition hover:bg-ink-850' },
  h('div', { class: 'min-w-0' }, h('div', { class: 'truncate font-bold' }, p.name), h('div', { class: 'mt-0.5 truncate text-xs text-fg-subtle' }, p.domain, ' · ', formatDate(p.updatedAt))),
  h('div', { class: 'flex shrink-0 items-center gap-2' }, h('span', { class: 'hidden sm:inline' }, ProjectTypeBadge(p.type)), StatusBadge(p.status)));

function ProjectActions(p) {
  return h('div', { class: 'flex items-center justify-end gap-1' },
    link(`/projects/${p.id}`, { class: 'btn-ghost btn-sm', 'aria-label': `Open ${p.name}` }, 'Open'),
    link(`/projects/${p.id}/edit`, { class: 'btn-ghost btn-sm px-2', 'aria-label': `Edit ${p.name}`, title: 'Edit' }, icon('edit', { size: 16 })),
    h('button', { class: 'btn-ghost btn-sm px-2', 'aria-label': `Duplicate ${p.name}`, title: 'Duplicate', onClick: () => duplicateProjectAndEdit(p.id) }, icon('copy', { size: 16 })),
    PdfButton({ kind: 'project', id: p.id, compact: true }),
    h('button', { class: 'btn-ghost btn-sm px-2 hover:text-accent', 'aria-label': `Delete ${p.name}`, title: 'Delete', onClick: () => confirmDeleteProject(p) }, icon('trash', { size: 16 })));
}

export function ProjectsTable(projects) {
  return h('div', { class: 'surface overflow-hidden' },
    h('table', { class: 'hidden w-full text-left text-sm md:table' },
      h('thead', { class: 'border-b border-ink-700/70 text-xs text-fg-subtle' }, h('tr', {},
        h('th', { class: 'px-5 py-3 font-medium' }, 'Project'), h('th', { class: 'px-3 py-3 font-medium' }, 'Domain'), h('th', { class: 'px-3 py-3 font-medium' }, 'Type'),
        h('th', { class: 'px-3 py-3 font-medium' }, 'Updated'), h('th', { class: 'px-3 py-3 font-medium' }, 'Status'), h('th', { class: 'px-5 py-3 font-medium' }, h('span', { class: 'sr-only' }, 'Actions')))),
      h('tbody', { class: 'divide-y divide-ink-700/50' }, projects.map((p) => h('tr', { class: 'group cursor-pointer transition hover:bg-ink-850', onClick: (e) => { if (!e.target.closest('a,button')) navigate(`/projects/${p.id}`); } },
        h('td', { class: 'max-w-md px-5 py-4' }, link(`/projects/${p.id}`, { class: 'font-bold text-fg group-hover:text-white' }, p.name), h('p', { class: 'mt-1 line-clamp-1 text-fg-subtle' }, p.tagline || p.description)),
        h('td', { class: 'px-3 py-4 text-fg-muted' }, p.domain, h('div', { class: 'text-xs text-fg-subtle' }, p.industry)),
        h('td', { class: 'px-3 py-4' }, ProjectTypeBadge(p.type)),
        h('td', { class: 'px-3 py-4 whitespace-nowrap text-fg-muted' }, formatDate(p.updatedAt)),
        h('td', { class: 'px-3 py-4' }, StatusBadge(p.status)),
        h('td', { class: 'px-5 py-4' }, ProjectActions(p)))))),
    h('ul', { class: 'divide-y divide-ink-700/50 md:hidden' }, projects.map((p) => h('li', { class: 'space-y-2 p-4' },
      link(`/projects/${p.id}`, { class: 'block font-bold' }, p.name),
      h('p', { class: 'line-clamp-2 text-sm text-fg-subtle' }, p.tagline || p.description),
      h('div', { class: 'flex flex-wrap items-center gap-2 text-xs text-fg-muted' }, ProjectTypeBadge(p.type), StatusBadge(p.status), h('span', {}, p.domain), '·', h('span', {}, formatDate(p.updatedAt))),
      ProjectActions(p)))));
}

function StackIcon(count) {
  return h('div', { 'aria-hidden': 'true', class: 'relative h-11 w-11 shrink-0' },
    count > 2 && h('span', { class: 'absolute top-0 left-2 h-9 w-8 rounded-md border border-ink-600 bg-ink-750' }),
    count > 1 && h('span', { class: 'absolute top-1 left-1 h-9 w-8 rounded-md border border-ink-600 bg-ink-800' }),
    h('span', { class: 'absolute top-2 left-0 grid h-9 w-8 place-items-center rounded-md border border-accent-line bg-accent-soft text-xs font-bold text-accent' }, count));
}
export const CaseStudyRow = (cs) => link(`/case-studies/${cs.id}`, { class: 'flex items-center gap-4 rounded-xl px-3 py-3 transition hover:bg-ink-850' },
  StackIcon(cs.sourceProjectIds.length),
  h('div', { class: 'min-w-0 flex-1' }, h('div', { class: 'truncate font-bold' }, cs.title),
    h('div', { class: 'mt-0.5 truncate text-xs text-fg-subtle' }, cs.domain, ' · ', cs.sourceProjectIds.length, ' source ', cs.sourceProjectIds.length === 1 ? 'project' : 'projects', ' · ', formatDate(cs.updatedAt))),
  StatusBadge(cs.status));

export function CaseStudyCard(cs) {
  const shown = cs.sections.filter((s) => !s.hidden).length;
  const n = cs.sourceProjectIds.length;
  return h('article', { class: 'group relative flex flex-col rounded-2xl border border-ink-700/70 bg-ink-900 transition hover:border-ink-600' },
    h('span', { 'aria-hidden': 'true', class: 'absolute inset-x-4 -top-1.5 h-3 rounded-t-2xl border border-b-0 border-ink-700/70 bg-ink-850' }),
    h('div', { class: 'relative flex flex-1 flex-col rounded-2xl bg-ink-900 p-6' },
      h('div', { class: 'flex items-start justify-between gap-3' }, CaseTypeBadge(cs.type), StatusBadge(cs.status)),
      link(`/case-studies/${cs.id}`, { class: 'mt-4 block' }, h('h3', { class: 'text-xl leading-snug group-hover:text-white' }, cs.title)),
      h('p', { class: 'mt-2 line-clamp-2 text-sm text-fg-subtle' }, cs.subtitle),
      h('dl', { class: 'mt-6 grid grid-cols-3 gap-3 border-t border-ink-700/60 pt-4 text-sm' },
        h('div', {}, h('dt', { class: 'text-xs text-fg-subtle' }, 'Domain'), h('dd', { class: 'mt-0.5 truncate' }, cs.domain)),
        h('div', {}, h('dt', { class: 'text-xs text-fg-subtle' }, 'Sources'), h('dd', { class: 'mt-0.5' }, n, ' ', n === 1 ? 'project' : 'projects')),
        h('div', {}, h('dt', { class: 'text-xs text-fg-subtle' }, 'Updated'), h('dd', { class: 'mt-0.5 whitespace-nowrap' }, formatDate(cs.updatedAt)))),
      h('div', { class: 'mt-5 flex items-center justify-between gap-2' },
        h('span', { class: 'text-xs text-fg-subtle' }, shown, ' sections'),
        h('div', { class: 'flex gap-1' },
          link(`/case-studies/${cs.id}`, { class: 'btn-ghost btn-sm', 'aria-label': `Open and edit ${cs.title}` }, icon('edit', { size: 15 }), ' Open'),
          h('button', { class: 'btn-ghost btn-sm px-2', 'aria-label': `Duplicate ${cs.title}`, title: 'Duplicate', onClick: async () => {
            try { const c = await duplicateCaseStudy(cs.id); toast('Case study duplicated as a draft'); navigate(`/case-studies/${c.id}`); } catch (e) { toast(e.message, 'error'); }
          } }, icon('copy', { size: 15 })),
          PdfButton({ kind: 'caseStudy', id: cs.id, compact: true }),
          h('button', { class: 'btn-ghost btn-sm px-2 hover:text-accent', 'aria-label': `Delete ${cs.title}`, title: 'Delete', onClick: () => confirmDeleteCaseStudy(cs) }, icon('trash', { size: 15 }))))));
}
