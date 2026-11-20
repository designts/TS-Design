import { h, icon, cx, link, toast, navigate, EmptyState, TextInput, TextArea, LinesArea, CaseTypeBadge, StatusBadge, ProjectTypeBadge } from '../ui.js';
import { store, getCaseStudy, saveCaseStudy } from '../store.js';
import { formatDate, newId } from '/shared/project.js';
import { CaseStudyDocument, buildContext } from '../case-study/render.js';
import { PdfButton, confirmDeleteCaseStudy } from '../components.js';

// Which item fields are editable per section kind (label per field).
const FIELDS = {
  hero: { title: 'Label', body: 'Value', list: 'Chips' }, overview: { tag: 'Group', title: 'Title', body: 'Text' },
  challenges: { tag: 'Business area', title: 'Challenge', body: 'Description', meta: 'Business implication' },
  challenge_approach: { tag: 'Column (Challenge / Approach)', title: 'Summary', list: 'Points' },
  capabilities: { tag: 'Category', title: 'Capability', body: 'What it enables', meta: 'Users', list: 'Features' },
  features: { title: 'Feature', meta: 'Challenge addressed', body: 'Solution delivered', list: 'Key functionality', value: 'Business benefit' },
  solution: { tag: 'Label', title: 'Title', body: 'Text', list: 'List' },
  workflows: { title: 'Workflow', body: 'Purpose', meta: 'Starting event', tag: 'Systems & departments', value: 'Final output' },
  technology: { title: 'Category', list: 'Technologies' }, snapshot: { value: 'Value', title: 'Label', body: 'Detail' }, team: { title: 'Group', list: 'Entries' }, deployment: {},
  engagements: { title: 'Engagement', tag: 'Industry', meta: 'Period', body: 'Description', value: 'Highlight' },
  impact: { value: 'Value', title: 'Outcome', tag: 'Evidence (Measured / Qualitative / Expected)', meta: 'Baseline, period, source' },
  before_after: { title: 'Process', body: 'Before', value: 'After' }, summary: { title: 'Heading', body: 'Text', list: 'List' }, gallery: { title: 'Title', body: 'Caption' },
};
const MULTILINE = ['body', 'meta'];

export function EditorPage(id) {
  const saved = getCaseStudy(id);
  if (!saved) return EmptyState({ title: 'Case study not found', body: 'It may have been deleted.', action: link('/case-studies', { class: 'btn-secondary' }, 'Back to case studies') });

  let draft = structuredClone(saved);
  let openId = null;
  let previewOnly = false;
  const isDirty = () => JSON.stringify(draft) !== JSON.stringify(getCaseStudy(id));
  window.__beforeNavigate = () => !isDirty() || window.confirm('Leave without saving your changes?');
  const sourceName = (pid) => (pid ? (store.projects.find((p) => p.id === pid) || {}).name : undefined);

  const root = h('div', { class: '-mt-4' });
  const headerHost = h('div', { class: 'no-print z-20 -mx-4 mb-6 border-b border-ink-700/60 bg-ink-950/95 px-4 py-4 backdrop-blur sm:-mx-8 sm:px-8 lg:sticky lg:top-0 lg:-mx-12 lg:px-12' });
  const bodyHost = h('div');
  const previewHost = h('div', { class: 'min-w-0' });
  root.append(headerHost, bodyHost);

  const changed = (opts = {}) => { window.__dirty = isDirty(); drawHeader(); if (opts.list) drawAside(); drawPreview(); };
  const updateSection = (s) => { draft = { ...draft, sections: draft.sections.map((x) => (x.id === s.id ? s : x)) }; };

  function drawHeader() {
    const dirty = isDirty();
    const titleInput = h('input', { id: 'cs-title', value: draft.title, maxlength: 160, class: '-ml-2 w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-2xl font-bold outline-none hover:border-ink-700 focus:border-accent sm:text-3xl',
      onInput: (e) => { draft.title = e.target.value; window.__dirty = isDirty(); dirtyMark.hidden = !isDirty(); saveBtn.disabled = !isDirty(); } });
    const dirtyMark = h('span', { class: 'text-warning', hidden: !dirty }, '● Unsaved changes');
    const saveBtn = h('button', { class: 'btn-secondary', disabled: !dirty, onClick: () => persist() }, 'Save draft');
    if (headerHost.querySelector('#cs-title') === document.activeElement) return; // don't steal focus while typing the title
    headerHost.replaceChildren(h('div', { class: 'flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between' },
      h('div', { class: 'min-w-0 flex-1' },
        h('button', { class: 'mb-2 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg', onClick: () => navigate('/case-studies') }, icon('arrowLeft', { size: 16 }), ' Case Studies Library'),
        h('label', { class: 'sr-only', for: 'cs-title' }, 'Case study title'), titleInput,
        h('div', { class: 'mt-2 flex flex-wrap items-center gap-2 text-xs text-fg-subtle' }, CaseTypeBadge(draft.type), StatusBadge(draft.status),
          h('span', { class: 'rounded-md border border-warning/40 px-2 py-0.5 text-warning' }, 'Prototype draft · not AI-generated'),
          h('span', {}, 'Updated ', formatDate(draft.updatedAt)), dirtyMark)),
      h('div', { class: 'flex flex-wrap gap-2' },
        h('button', { class: 'btn-ghost', 'aria-pressed': String(previewOnly), onClick: () => { previewOnly = !previewOnly; drawBody(); drawHeader(); } }, icon(previewOnly ? 'edit' : 'eye', { size: 16 }), ' ', previewOnly ? 'Show editor' : 'Preview only'),
        PdfButton({ kind: 'caseStudy', id, disabledReason: dirty ? 'Save your changes first: the PDF uses the saved case study.' : undefined }),
        saveBtn,
        draft.status === 'draft' ? h('button', { class: 'btn-primary', onClick: () => persist('completed') }, icon('check', { size: 16 }), ' Mark completed')
          : h('button', { class: 'btn-secondary', onClick: () => persist('draft') }, 'Move back to draft'),
        h('button', { class: 'btn-ghost px-2.5 hover:text-accent', 'aria-label': 'Delete case study', title: 'Delete case study', onClick: () => confirmDeleteCaseStudy(getCaseStudy(id), () => { window.__beforeNavigate = null; navigate('/case-studies'); }) }, icon('trash', { size: 16 })))));
  }

  async function persist(status = draft.status) {
    const next = { ...draft, title: draft.title.trim() || saved.title || 'Untitled case study', status };
    try {
      const res = await saveCaseStudy(next);
      draft = structuredClone(res);
      toast(status === 'completed' && saved.status !== 'completed' ? 'Case study marked as completed' : 'Draft saved');
      window.__dirty = false;
      drawHeader(); drawAside(); drawPreview();
    } catch (e) { toast(e.message, 'error'); }
  }

  function moveSection(sid, dir) {
    const hero = draft.sections.find((s) => s.kind === 'hero');
    const content = draft.sections.filter((s) => s.kind !== 'hero');
    const i = content.findIndex((s) => s.id === sid), j = i + dir;
    if (j < 0 || j >= content.length) return;
    [content[i], content[j]] = [content[j], content[i]];
    draft = { ...draft, sections: [...(hero ? [hero] : []), ...content] };
    changed({ list: true });
  }

  function SectionEditor(s) {
    const map = FIELDS[s.kind] || {};
    const blocks = s.items.filter((x) => x.tag !== 'visual');
    const patchItem = (iid, patch) => { const ns = { ...s, items: s.items.map((x) => (x.id === iid ? { ...x, ...patch } : x)) }; Object.assign(s, ns); updateSection(s); changed(); };
    return h('div', { class: 'space-y-4' },
      s.kind !== 'hero' && TextInput({ label: 'Eyebrow', value: s.eyebrow, onChange: (v) => { s.eyebrow = v; updateSection(s); changed(); } }),
      TextInput({ label: 'Heading', value: s.heading, onChange: (v) => { s.heading = v; updateSection(s); changed(); } }),
      TextArea({ label: s.kind === 'hero' ? 'Value proposition' : 'Introduction', value: s.intro, rows: 3, onChange: (v) => { s.intro = v; updateSection(s); changed(); } }),
      Object.keys(map).length > 0 && h('div', { class: 'space-y-3' }, h('div', { class: 'text-sm font-bold' }, 'Content blocks'),
        blocks.map((b, n) => {
          const summaryTitle = h('span', {}, b.title || b.value || 'Untitled block');
          return h('details', { class: 'group rounded-lg border border-ink-700 bg-ink-850/60', open: blocks.length <= 2 },
            h('summary', { class: 'flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm' },
              h('span', { class: 'truncate' }, h('span', { class: 'mr-2 text-xs text-fg-subtle' }, String(n + 1).padStart(2, '0')), summaryTitle),
              icon('chevronDown', { size: 16, className: 'text-fg-subtle transition group-open:rotate-180' })),
            h('div', { class: 'space-y-3 border-t border-ink-700 p-3' },
              Object.entries(map).map(([k, label]) => (k === 'list'
                ? LinesArea({ label, value: b.list || [], rows: 4, onChange: (v) => patchItem(b.id, { list: v }) })
                : MULTILINE.includes(k) ? TextArea({ label, value: b[k] || '', rows: 2, onChange: (v) => patchItem(b.id, { [k]: v }) })
                  : TextInput({ label, value: b[k] || '', onChange: (v) => { patchItem(b.id, { [k]: v }); if (k === 'title' || k === 'value') summaryTitle.textContent = b.title || b.value || 'Untitled block'; } }))),
              b.steps && h('p', { class: 'text-xs text-fg-subtle' }, 'Workflow steps come from the source project.'),
              h('div', { class: 'flex items-center justify-between gap-2 pt-1' },
                h('span', { class: 'truncate text-xs text-fg-subtle' }, sourceName(b.sourceProjectId) ? `Source: ${sourceName(b.sourceProjectId)}` : 'Added in this case study'),
                h('button', { type: 'button', class: 'btn-ghost btn-sm px-2 hover:text-accent', onClick: () => { s.items = s.items.filter((x) => x.id !== b.id); updateSection(s); changed({ list: true }); } }, icon('trash', { size: 14 }), ' Remove'))));
        }),
        h('button', { type: 'button', class: 'btn-secondary btn-sm', onClick: () => { s.items = [...s.items, { id: newId('item'), title: '', body: '' }]; updateSection(s); changed({ list: true }); } }, icon('plus', { size: 14 }), ' Add block')),
      s.kind === 'deployment' && h('p', { class: 'text-xs text-fg-subtle' }, "The chart is drawn from the source projects' monthly deployment data."));
  }

  function SectionRow(s, number, isHero) {
    const open = openId === s.id;
    const content = draft.sections.filter((x) => x.kind !== 'hero');
    const idx = content.indexOf(s);
    return h('li', { class: cx('rounded-xl border transition', open ? 'border-ink-600 bg-ink-900' : 'border-ink-700/70 bg-ink-900/60', s.hidden && 'opacity-60') },
      h('div', { class: 'flex items-center gap-1 p-2' },
        h('button', { class: 'flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-ink-850', 'aria-expanded': String(open), onClick: () => {
          openId = open ? null : s.id; drawAside();
          if (!s.hidden) document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } },
          h('span', { class: 'w-5 text-xs text-fg-subtle' }, isHero ? 'H' : String(number).padStart(2, '0')),
          h('span', { class: 'min-w-0' }, h('span', { class: 'block truncate text-sm font-bold' }, s.heading || s.eyebrow),
            h('span', { class: 'block text-[11px] text-fg-subtle' }, isHero ? 'Hero · always first' : `${s.eyebrow} · ${s.core ? 'Core' : 'Optional'}`,
              !isHero && s.items.length === 0 && !s.intro && !(s.deployment || []).length && ' · needs content'))),
        !isHero && [
          h('button', { class: 'btn-ghost btn-sm px-1.5', 'aria-label': `Move ${s.heading} up`, disabled: idx === 0, onClick: () => moveSection(s.id, -1) }, icon('chevronUp', { size: 16 })),
          h('button', { class: 'btn-ghost btn-sm px-1.5', 'aria-label': `Move ${s.heading} down`, disabled: idx === content.length - 1, onClick: () => moveSection(s.id, 1) }, icon('chevronDown', { size: 16 })),
          h('button', { class: 'btn-ghost btn-sm px-1.5', disabled: s.core, title: s.core ? "Core sections can't be hidden" : s.hidden ? 'Show section' : 'Hide section', 'aria-label': s.hidden ? `Show ${s.heading}` : `Hide ${s.heading}`,
            onClick: () => { updateSection({ ...s, hidden: !s.hidden }); changed({ list: true }); } }, icon(s.hidden ? 'eyeOff' : 'eye', { size: 16 }))]),
      open && h('div', { class: 'border-t border-ink-700/70 p-4' }, SectionEditor(draft.sections.find((x) => x.id === s.id))));
  }
  const FixedRow = (label, detail, target) => h('li', { class: 'flex items-center gap-3 rounded-xl border border-dashed border-ink-700 bg-ink-950/40 px-4 py-2.5' },
    icon('lock', { size: 15, className: 'shrink-0 text-fg-subtle' }),
    h('button', { class: 'min-w-0 flex-1 text-left', onClick: () => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
      h('span', { class: 'block truncate text-sm font-bold' }, label), h('span', { class: 'block text-[11px] text-fg-subtle' }, detail)));

  const aside = h('aside', { class: 'no-print min-w-0 space-y-6 xl:sticky xl:top-[150px] xl:max-h-[calc(100vh-170px)] xl:self-start xl:overflow-y-auto xl:pr-2' });
  function drawAside() {
    const sources = draft.sourceProjectIds.map((pid) => store.projects.find((p) => p.id === pid)).filter(Boolean);
    const hero = draft.sections.find((s) => s.kind === 'hero');
    const content = draft.sections.filter((s) => s.kind !== 'hero');
    const shown = content.filter((s) => !s.hidden);
    aside.replaceChildren(
      h('div', { class: 'surface p-4' },
        h('div', { class: 'eyebrow mb-3 flex items-center gap-2' }, icon('folder', { size: 14 }), ' Source projects (', sources.length, ')'),
        h('ul', { class: 'space-y-1.5' }, sources.map((p) => h('li', {}, link(`/projects/${p.id}`, { class: 'flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-ink-850' }, h('span', { class: 'truncate' }, p.name), ProjectTypeBadge(p.type)))),
          sources.length < draft.sourceProjectIds.length && h('li', { class: 'px-2 text-xs text-warning' }, draft.sourceProjectIds.length - sources.length === 1 ? '1 source project was' : `${draft.sourceProjectIds.length - sources.length} source projects were`, ' deleted. The content copied from it stays in this case study; update or regenerate the case study to remove it.')),
        h('p', { class: 'mt-3 text-xs text-fg-subtle' }, "This case study holds its own copy of the content; later project edits don't change it.")),
      h('div', {},
        h('div', { class: 'mb-3 flex items-center justify-between' }, h('h2', { class: 'text-lg' }, 'Template'), h('span', { class: 'text-xs text-fg-subtle' }, shown.length, ' of ', content.length, ' content sections shown')),
        h('ol', { class: 'space-y-2' },
          hero && SectionRow(hero, 0, true),
          FixedRow('TechStalwarts company profile', 'Fixed template · same in every case study', 'section-company'),
          content.map((s, n) => SectionRow(s, n + 1, false)),
          FixedRow('TechStalwarts closing footer', 'Fixed template · same in every case study', 'section-footer'))));
  }
  function drawPreview() { previewHost.replaceChildren(CaseStudyDocument(buildContext(draft, store.projects))); }
  function drawBody() {
    bodyHost.replaceChildren(h('div', { class: cx('grid gap-8', !previewOnly && 'xl:grid-cols-[380px_minmax(0,1fr)]') }, !previewOnly && aside, previewHost));
  }

  drawHeader(); drawAside(); drawPreview(); drawBody();
  return root;
}
