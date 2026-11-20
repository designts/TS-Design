// Print view used for "Download PDF": renders the saved document full-width and opens the
// browser's print dialog (choose "Save as PDF"). Images must load before printing.
import { h, icon } from '../ui.js';
import { store, getCaseStudy, getProject } from '../store.js';
import { CaseStudyDocument, buildContext } from '../case-study/render.js';
import { ProjectHeader, ProjectBody } from './project-detail.js';

export function PrintPage(kind, id) {
  const item = kind === 'project' ? getProject(id) : getCaseStudy(id);
  if (!item) return h('div', { class: 'p-10 text-center text-fg-muted' }, 'Not found.');
  document.title = kind === 'project' ? item.name : item.title;
  const doc = kind === 'project'
    ? h('div', { class: 'mx-auto max-w-[1100px] space-y-8 bg-ink-950 p-10' }, ProjectHeader(item), ProjectBody(item, { forPdf: true }))
    : h('div', { class: 'mx-auto max-w-[1280px] bg-ink-950' }, CaseStudyDocument(buildContext(item, store.projects)));
  const bar = h('div', { class: 'no-print sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-ink-700/60 bg-ink-900/95 px-6 py-3 text-sm backdrop-blur' },
    h('span', { class: 'text-fg-muted' }, 'Choose ', h('b', { class: 'text-fg' }, 'Save as PDF'), ' as the destination in the print dialog. Enable “Background graphics” for the full design.'),
    h('div', { class: 'flex gap-2' }, h('button', { class: 'btn-primary btn-sm', onClick: () => window.print() }, icon('download', { size: 14 }), ' Save as PDF'), h('button', { class: 'btn-ghost btn-sm', onClick: () => window.close() }, 'Close')));
  const root = h('div', { class: 'min-h-screen bg-ink-950' }, bar, doc);
  // Print once all images have finished loading (or failed).
  setTimeout(() => {
    const imgs = [...root.querySelectorAll('img')];
    Promise.all(imgs.map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; })))).then(() => setTimeout(() => window.print(), 300));
  }, 50);
  return root;
}
