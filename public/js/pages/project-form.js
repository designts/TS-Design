import { h, icon, cx, toast, navigate, PageHeader, EmptyState, link, TextInput, TextArea, LinesArea, TagInput, Select, MultiSelect, FormSection, Repeater, fileToDataUrl } from '../ui.js';
import { getProject, createProject, updateProject, uploadImage } from '../store.js';
import { LIMITS as L, STEPS, STEP_LABELS, stepForKey, emptyProject, normalizeProject, validateProject, newId, splitComma } from '/shared/project.js';
import { PROJECT_TYPES, DOMAINS, INDUSTRIES_BY_DOMAIN, ALL_INDUSTRIES, SERVICES, PLATFORMS, ROLES, SCOPES, TECH_CATEGORIES, EVIDENCE, LANES, STEP_KINDS, ASSET_KINDS } from '/shared/catalog.js';

export function ProjectFormPage({ id, query }) {
  const editing = !!id;
  const existing = editing ? getProject(id) : null;
  if (editing && !existing) return EmptyState({ title: 'Project not found', body: 'It may have been deleted.', action: link('/projects', { class: 'btn-secondary' }, 'Back to projects') });
  const qType = query.get('type');
  const initial = editing ? structuredClone(existing) : { ...emptyProject(), ...(['feature', 'project', 'staffing'].includes(qType) ? { type: qType } : {}) };
  return h('div', {},
    PageHeader(editing
      ? { eyebrow: 'Edit source record', title: 'Edit project', description: 'Changes update this project record. Case studies already assembled from it keep their own copy.' }
      : { eyebrow: 'New source record', title: 'Create project', description: 'Capture the project once. Its information can then be reused across any number of case studies.' }),
    ProjectForm({
      initial, submitLabel: editing ? 'Save changes' : 'Save project',
      onCancel: () => navigate(editing ? `/projects/${id}` : '/projects'),
      onSubmit: async (project) => {
        const saved = editing ? await updateProject(id, project) : await createProject(project);
        toast(project.status === 'draft' ? 'Project saved as draft' : 'Project saved');
        navigate(editing ? `/projects/${saved.id}` : '/projects');
      },
    }));
}

function ProjectForm({ initial, submitLabel, onSubmit, onCancel }) {
  const data = initial;
  let step = 'basics';
  let errors = {};
  let mode = 'complete';
  let dirty = false;
  let saving = false;
  const reg = []; // { key, el, prefix }

  window.__beforeNavigate = () => !dirty || window.confirm('Discard unsaved changes?');
  const touch = () => { dirty = true; window.__dirty = true; if (Object.keys(errors).length) { errors = validateProject(data, mode); updateErrors(); } };
  const err = (k) => errors[k];
  const errIn = (k) => errors[k] ?? (Object.entries(errors).find(([key]) => key.startsWith(`${k}.`)) || [])[1];
  const bind = (el, key, prefix = false) => { reg.push({ key, el, prefix }); el.setError?.(prefix ? errIn(key) : err(key)); return el; };
  const set = (k, v) => { data[k] = v; touch(); };
  const setStaffing = (k, v) => { data.staffing = { ...data.staffing, [k]: v }; touch(); };

  const nav = h('nav', { 'aria-label': 'Form sections', class: 'min-w-0 lg:sticky lg:top-8 lg:self-start' });
  const alertHost = h('div');
  const content = h('div', { class: 'surface space-y-8 p-5 sm:p-8' });
  const footer = h('div', { class: 'sticky bottom-0 z-10 -mx-4 mt-6 border-t border-ink-700/60 bg-ink-950/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-5' });

  function stepErrorCounts() {
    const m = new Map();
    Object.keys(errors).forEach((k) => { const s = stepForKey(k, data.type); m.set(s, (m.get(s) || 0) + 1); });
    return m;
  }
  function drawNav() {
    const steps = STEPS[data.type];
    const idx = Math.max(0, steps.indexOf(step));
    const counts = stepErrorCounts();
    nav.replaceChildren(
      h('div', { class: 'mb-3 flex items-center justify-between text-xs text-fg-subtle' }, h('span', {}, 'Step ', idx + 1, ' of ', steps.length), h('span', {}, Math.round(((idx + 1) / steps.length) * 100), '%')),
      h('div', { class: 'mb-4 h-1 overflow-hidden rounded-full bg-ink-800' }, h('div', { class: 'h-full rounded-full bg-accent transition-all', style: { width: `${((idx + 1) / steps.length) * 100}%` } })),
      h('ol', { class: 'flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0' }, steps.map((s, i) => h('li', { class: 'shrink-0' },
        h('button', { type: 'button', onClick: () => goStep(s), 'aria-current': s === step ? 'step' : undefined, class: cx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition', s === step ? 'bg-ink-800 text-fg' : 'text-fg-muted hover:bg-ink-850 hover:text-fg') },
          h('span', { class: cx('grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold', counts.has(s) ? 'bg-accent text-white' : i < idx ? 'bg-ink-700 text-fg' : s === step ? 'bg-accent/20 text-accent' : 'bg-ink-800 text-fg-subtle') },
            counts.has(s) ? counts.get(s) : i < idx ? icon('check', { size: 12 }) : i + 1),
          STEP_LABELS[s])))));
  }
  function drawAlert() {
    const entries = Object.entries(errors);
    if (!entries.length) { alertHost.replaceChildren(); return; }
    alertHost.replaceChildren(h('div', { role: 'alert', class: 'mb-6 rounded-xl border border-accent-line bg-accent-soft px-4 py-3 text-sm' },
      h('div', { class: 'font-bold text-accent' }, 'Please fix ', entries.length === 1 ? '1 field' : `${entries.length} fields`, ' before saving', mode === 'draft' ? ' as a draft' : ''),
      h('ul', { class: 'mt-1 list-disc pl-5 text-fg-muted' },
        entries.slice(0, 8).map(([k, m]) => h('li', {}, h('button', { type: 'button', class: 'text-left underline-offset-2 hover:underline', onClick: () => goStep(stepForKey(k, data.type)) },
          h('span', { class: 'text-fg-subtle' }, STEP_LABELS[stepForKey(k, data.type)], ':'), ' ', m))),
        entries.length > 8 && h('li', {}, '…and ', entries.length - 8, ' more'))));
  }
  function updateErrors() {
    for (const r of reg) if (r.el.isConnected) r.el.setError?.(r.custom ? r.custom() : r.prefix ? errIn(r.key) : err(r.key));
    content.querySelectorAll('[data-err-prefix]').forEach((card) => {
      const bad = !!errIn(card.dataset.errPrefix);
      card.classList.toggle('border-accent-line', bad);
      card.classList.toggle('border-ink-700', !bad);
    });
    drawNav(); drawAlert();
  }
  function goStep(s) { step = s; drawAll(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  // A repeater bound to data[key] (or data.staffing[key]); re-renders on add/remove.
  function bindRepeater(key, opts) {
    const items = data[key];
    const r = Repeater({ ...opts, items, error: errIn(key) === err(key) ? err(key) : undefined, onChange: (next, o = {}) => { data[key] = next; touch(); if (!o.silent) drawContent(); } });
    r.querySelectorAll('[data-item-id]').forEach((card) => { card.dataset.errPrefix = `${key}.${card.dataset.itemId}`; if (errIn(card.dataset.errPrefix)) { card.classList.add('border-accent-line'); card.classList.remove('border-ink-700'); } });
    reg.push({ key, el: { setError: (e) => r.setError(e), get isConnected() { return r.isConnected; } }, prefix: false });
    return r;
  }

  // ---------- reusable repeaters
  const featuresRepeater = () => bindRepeater('features', {
    label: 'Features', addLabel: 'Add feature', itemTitle: (f) => f.name || 'Feature',
    create: () => ({ id: newId('ft'), name: '', problem: '', solution: '', functionality: [], benefit: '', relatedFeatures: [] }),
    render: (f, up) => h('div', { class: 'grid gap-4 md:grid-cols-2' },
      bind(TextInput({ label: 'Feature name', required: true, limit: L.featureName, value: f.name, onChange: (v) => up({ name: v }), className: 'md:col-span-2' }), `features.${f.id}.name`),
      bind(TextArea({ label: 'Challenge addressed', limit: L.featureProblem, value: f.problem, onChange: (v) => up({ problem: v }), rows: 3 }), `features.${f.id}.problem`),
      bind(TextArea({ label: 'Feature functionality (solution delivered)', required: true, limit: L.featureSolution, value: f.solution, onChange: (v) => up({ solution: v }), rows: 3 }), `features.${f.id}.solution`),
      bind(LinesArea({ label: 'Key functionality steps', limit: L.featureStep, value: f.functionality, onChange: (v) => up({ functionality: v }), rows: 4 }), `features.${f.id}.functionality`, true),
      h('div', { class: 'space-y-4' },
        bind(TextArea({ label: 'Business benefit', limit: L.featureBenefit, value: f.benefit, onChange: (v) => up({ benefit: v }), rows: 2, hint: 'Evidence-based only' }), `features.${f.id}.benefit`),
        TextInput({ label: 'Related features', value: f.relatedFeatures.join(', '), onChange: (v) => up({ relatedFeatures: splitComma(v) }), hint: 'Comma separated' }))),
  });
  const capabilitiesRepeater = () => bindRepeater('capabilities', {
    label: 'Capabilities', addLabel: 'Add capability', itemTitle: (c) => c.name || 'Capability',
    create: () => ({ id: newId('cap'), name: '', category: '', description: '', users: '', features: [] }),
    render: (c, up) => h('div', { class: 'grid gap-4 md:grid-cols-2' },
      bind(TextInput({ label: 'Capability name', required: true, limit: L.capabilityName, value: c.name, onChange: (v) => up({ name: v }) }), `capabilities.${c.id}.name`),
      bind(TextInput({ label: 'Category / business function', limit: L.capabilityCategory, value: c.category, onChange: (v) => up({ category: v }), placeholder: 'e.g. Core operations' }), `capabilities.${c.id}.category`),
      bind(TextArea({ label: 'Capability description', required: true, limit: L.capabilityDescription, value: c.description, onChange: (v) => up({ description: v }), rows: 2, className: 'md:col-span-2' }), `capabilities.${c.id}.description`),
      bind(TextInput({ label: 'Primary users', limit: L.capabilityUsers, value: c.users, onChange: (v) => up({ users: v }) }), `capabilities.${c.id}.users`),
      TextInput({ label: 'Features', value: c.features.join(', '), onChange: (v) => up({ features: splitComma(v) }), hint: 'Comma separated' })),
  });

  function deploymentTable() {
    const rows = data.staffing.deployment;
    const upd = (id, patch) => { setStaffing('deployment', rows.map((r) => (r.id === id ? { ...r, ...patch } : r))); };
    return h('div', { class: 'space-y-3' },
      h('div', { class: 'overflow-x-auto' }, h('table', { class: 'w-full min-w-[480px] text-sm' },
        h('thead', { class: 'text-left text-xs text-fg-subtle' }, h('tr', {}, ['Month', 'Engineering', 'QA / Testing', 'Data / AI / Other', 'Total'].map((x) => h('th', { class: 'pb-2 font-medium' }, x)), h('th'))),
        h('tbody', {}, rows.map((r) => {
          const total = h('td', { class: 'py-1 pr-2 font-bold' }, r.engineering + r.qa + r.other);
          return h('tr', {},
            h('td', { class: 'py-1 pr-2' }, h('input', { class: 'input py-1.5', 'aria-label': 'Month', maxlength: 20, value: r.month, onInput: (e) => upd(r.id, { month: e.target.value }) })),
            ['engineering', 'qa', 'other'].map((k) => h('td', { class: 'py-1 pr-2' }, h('input', { class: 'input py-1.5', type: 'number', min: 0, max: 9999, 'aria-label': k, value: r[k], onInput: (e) => {
              const v = Math.min(9999, Math.max(0, parseInt(e.target.value || '0', 10) || 0));
              r[k] = v; upd(r.id, { [k]: v }); total.textContent = r.engineering + r.qa + r.other;
            } }))),
            total,
            h('td', { class: 'py-1' }, h('button', { type: 'button', class: 'btn-ghost btn-sm px-2', 'aria-label': `Remove ${r.month}`, onClick: () => { setStaffing('deployment', rows.filter((x) => x.id !== r.id)); drawContent(); } }, icon('trash', { size: 15 }))));
        })))),
      h('button', { type: 'button', class: 'btn-secondary btn-sm', onClick: () => { setStaffing('deployment', [...rows, { id: newId('m'), month: '', engineering: 0, qa: 0, other: 0 }]); drawContent(); } }, icon('plus', { size: 14 }), ' Add month'));
  }

  function assetsRepeater() {
    return bindRepeater('assets', {
      label: 'Assets', addLabel: 'Add asset', itemTitle: (a) => a.title || 'Asset',
      create: () => ({ id: newId('as'), title: '', caption: '', kind: 'screenshot' }),
      render: (a, up) => {
        const preview = h('label', { class: 'group relative grid aspect-[4/3] cursor-pointer place-items-center overflow-hidden rounded-lg border border-dashed border-ink-600 bg-ink-850 text-center text-xs text-fg-subtle hover:border-accent' });
        const titleField = bind(TextInput({ label: 'Title', required: true, limit: L.assetTitle, value: a.title, onChange: (v) => up({ title: v }) }), `assets.${a.id}.title`);
        const drawPreview = () => {
          const file = h('input', { type: 'file', accept: 'image/*', class: 'sr-only', 'aria-label': `Image for ${a.title || 'asset'}`, onChange: async (e) => {
            const f = e.target.files[0];
            if (!f) return;
            try {
              const up1 = await uploadImage(f.name, await fileToDataUrl(f));
              const patch = { fileName: f.name, previewUrl: up1.url };
              if (!a.title) { patch.title = f.name.replace(/\.[^.]+$/, '').slice(0, L.assetTitle.max); titleField.querySelector('input').value = patch.title; }
              up(patch); drawPreview();
            } catch (ex) { toast(ex.message, 'error'); }
          } });
          preview.replaceChildren(a.previewUrl ? h('img', { src: a.previewUrl, alt: a.caption || a.title, class: 'h-full w-full object-cover' })
            : h('span', { class: 'flex flex-col items-center gap-1 px-2' }, icon('upload'), a.fileName || 'Choose image'), file);
        };
        drawPreview();
        return h('div', { class: 'grid gap-4 md:grid-cols-[160px_minmax(0,1fr)]' }, preview,
          h('div', { class: 'grid gap-4 md:grid-cols-2' }, titleField,
            Select({ label: 'Type', value: a.kind, onChange: (v) => up({ kind: v }), options: Object.entries(ASSET_KINDS).map(([value, label]) => ({ value, label })) }),
            bind(TextInput({ label: 'Caption', limit: L.assetCaption, value: a.caption, onChange: (v) => up({ caption: v }), className: 'md:col-span-2', hint: 'What the visual demonstrates' }), `assets.${a.id}.caption`)));
      },
    });
  }

  // ---------- steps
  function stepContent() {
    const S = data.staffing;
    switch (step) {
      case 'basics': {
        const industries = [...(INDUSTRIES_BY_DOMAIN[data.domain] || []), ...ALL_INDUSTRIES.filter((x) => !(INDUSTRIES_BY_DOMAIN[data.domain] || []).includes(x))];
        return [
          FormSection({ title: 'Project type', description: 'Shapes the rest of the form and what is required. A project of any type can still be used in any case study.' },
            h('div', { role: 'radiogroup', 'aria-label': 'Project type', class: 'grid gap-3 md:grid-cols-3' }, PROJECT_TYPES.map((t) => h('button', {
              type: 'button', role: 'radio', 'aria-checked': String(data.type === t.value), 'aria-label': t.label,
              onClick: () => { data.type = t.value; if (t.value === 'staffing' && !data.domain) data.domain = 'Staffing'; if (!STEPS[data.type].includes(step)) step = 'basics'; touch(); drawAll(); },
              class: cx('rounded-xl border p-4 text-left transition', data.type === t.value ? 'border-accent bg-accent-soft' : 'border-ink-700 bg-ink-850 hover:border-ink-600'),
            }, h('div', { class: 'flex items-center justify-between font-bold' }, t.short, data.type === t.value && icon('check', { className: 'text-accent' })),
            h('p', { class: 'mt-1.5 text-xs leading-relaxed text-fg-subtle' }, t.description))))),
          FormSection({ title: 'Overview' },
            bind(TextInput({ label: 'Project name', required: true, limit: L.name, value: data.name, onChange: (v) => set('name', v), placeholder: 'e.g. Sliceal — Real Estate Tokenization Platform' }), 'name'),
            bind(TextInput({ label: 'Short summary', required: true, limit: L.tagline, value: data.tagline, onChange: (v) => set('tagline', v), placeholder: 'One or two sentences a reader remembers', hint: 'Used as the hero statement in case studies' }), 'tagline'),
            bind(TextArea({ label: 'Detailed project description', required: true, limit: L.description, value: data.description, onChange: (v) => set('description', v), rows: 5 }), 'description'),
            h('div', { class: 'grid gap-5 md:grid-cols-2' },
              bind(Select({ label: 'Domain', required: true, value: data.domain, onChange: (v) => { set('domain', v); drawContent(); }, placeholder: 'Select a domain', searchable: true, options: DOMAINS.map((d) => ({ value: d, label: d })) }), 'domain'),
              bind(Select({ label: 'Industry', required: true, value: data.industry, onChange: (v) => set('industry', v), placeholder: 'Select or type an industry', allowCustom: true, options: industries.map((d) => ({ value: d, label: d })), hint: 'Pick from the list or type your own' }), 'industry'),
              bind(TextInput({ label: 'Client or product name', limit: L.client, value: data.client, onChange: (v) => set('client', v), placeholder: 'Client name or anonymised descriptor' }), 'client'),
              bind(TextInput({ label: 'Engagement period', limit: L.engagementPeriod, value: data.engagementPeriod, onChange: (v) => set('engagementPeriod', v), placeholder: 'e.g. Mar 2025 – Feb 2026' }), 'engagementPeriod')),
            MultiSelect({ label: 'Services delivered', value: data.services, onChange: (v) => set('services', v), options: SERVICES, placeholder: 'Select services' }),
            data.type !== 'staffing' && MultiSelect({ label: 'Platforms', value: data.platforms, onChange: (v) => set('platforms', v), options: PLATFORMS, placeholder: 'Select platforms' }),
            bind(TagInput({ label: 'Tags', value: data.tags, onChange: (v) => set('tags', v), placeholder: 'Keywords that help find this project' }), 'tags', true)),
        ];
      }
      case 'context':
        return [
          FormSection({ title: 'Business context', description: data.type === 'feature' ? 'The business area this feature sits in.' : 'The situation before the project started.' },
            bind(TextArea({ label: 'Business context', required: true, limit: L.businessContext, value: data.businessContext, onChange: (v) => set('businessContext', v), rows: 4 }), 'businessContext'),
            h('div', { class: 'grid gap-5 md:grid-cols-3' },
              bind(LinesArea({ label: 'Target users & stakeholders', required: true, limit: L.stakeholder, value: data.stakeholders, onChange: (v) => set('stakeholders', v), placeholder: 'SME borrowers\nCredit analysts' }), 'stakeholders', true),
              bind(LinesArea({ label: 'Business functions', limit: L.shortItem, value: data.businessFunctions, onChange: (v) => set('businessFunctions', v), placeholder: 'Loan origination\nCollections' }), 'businessFunctions', true),
              bind(LinesArea({ label: 'Key business processes', limit: L.shortItem, value: data.businessProcesses, onChange: (v) => set('businessProcesses', v), placeholder: 'Credit decision\nLoan funding' }), 'businessProcesses', true))),
          FormSection({ title: 'Business challenges', description: data.type === 'feature' ? 'The business problem the feature addresses.' : 'Each challenge should map to something the project delivered.' },
            bindRepeater('challenges', {
              label: 'Challenges', addLabel: 'Add challenge', itemTitle: (c) => c.title || 'Challenge',
              create: () => ({ id: newId('ch'), area: '', title: '', description: '', implication: '' }),
              render: (c, up) => h('div', { class: 'grid gap-4 md:grid-cols-2' },
                bind(TextInput({ label: 'Challenge', required: true, limit: L.challengeTitle, value: c.title, onChange: (v) => up({ title: v }), placeholder: 'e.g. Manual, error-prone workflows' }), `challenges.${c.id}.title`),
                bind(TextInput({ label: 'Business area', limit: L.challengeArea, value: c.area, onChange: (v) => up({ area: v }), placeholder: 'e.g. Operations · Finance' }), `challenges.${c.id}.area`),
                bind(TextArea({ label: 'Description', required: true, limit: L.challengeDescription, value: c.description, onChange: (v) => up({ description: v }), rows: 3 }), `challenges.${c.id}.description`),
                bind(TextArea({ label: 'Business implication', limit: L.challengeImplication, value: c.implication, onChange: (v) => up({ implication: v }), rows: 3 }), `challenges.${c.id}.implication`)),
            })),
        ];
      case 'features':
        return [
          FormSection({ title: 'Feature showcase', description: 'The feature this project is about: the problem, what was built, how it works and the benefit. Add at least one feature or one capability.' }, featuresRepeater()),
          FormSection({ title: 'Capabilities', description: 'Group what was delivered by business function.' }, capabilitiesRepeater()),
        ];
      case 'solution':
        return [
          FormSection({ title: 'Solution', description: 'What was built for the client.' },
            bind(TextArea({ label: 'Solution summary', required: true, limit: L.solutionSummary, value: data.solutionSummary, onChange: (v) => set('solutionSummary', v), rows: 3, placeholder: 'e.g. Platform development: delivered a comprehensive tokenization platform for users to invest in real estate.' }), 'solutionSummary'),
            bind(LinesArea({ label: 'Modules / technical highlights', limit: L.shortItem, value: data.modules, onChange: (v) => set('modules', v), rows: 6, placeholder: 'Order Management\nInvestment Calculator\nUAE Pass Authentication' }), 'modules', true)),
          FormSection({ title: 'Capabilities (optional)' }, capabilitiesRepeater()),
          FormSection({ title: 'Key features (optional)' }, featuresRepeater()),
        ];
      case 'workflows':
        return [FormSection({ title: 'Functionality & workflows', description: 'Optional. End-to-end business processes the solution supports; used for workflow sections in case studies.' },
          bindRepeater('workflows', {
            label: 'Workflows', addLabel: 'Add workflow', itemTitle: (w) => w.name || 'Workflow',
            create: () => ({ id: newId('wf'), name: '', purpose: '', trigger: '', steps: [], systems: '', output: '' }),
            render: (w, up) => h('div', { class: 'space-y-4' },
              h('div', { class: 'grid gap-4 md:grid-cols-2' },
                bind(TextInput({ label: 'Workflow name', required: true, limit: L.workflowName, value: w.name, onChange: (v) => up({ name: v }) }), `workflows.${w.id}.name`),
                bind(TextInput({ label: 'Starting event', limit: L.workflowShort, value: w.trigger, onChange: (v) => up({ trigger: v }) }), `workflows.${w.id}.trigger`)),
              bind(TextArea({ label: 'Workflow description', required: true, limit: L.workflowPurpose, value: w.purpose, onChange: (v) => up({ purpose: v }), rows: 3 }), `workflows.${w.id}.purpose`),
              Repeater({
                label: 'Steps', items: w.steps, addLabel: 'Add step', itemTitle: (s) => s.label || 'Step',
                create: () => ({ id: newId('st'), label: '', lane: 'user', kind: 'action' }),
                onChange: (next, o = {}) => { w.steps = next; touch(); if (!o.silent) drawContent(); },
                render: (s, up2) => h('div', { class: 'grid gap-3 md:grid-cols-3' },
                  bind(TextInput({ label: 'Step', limit: L.workflowStep, value: s.label, onChange: (v) => up2({ label: v }) }), `workflows.${w.id}.steps.${s.id}`),
                  Select({ label: 'Lane', value: s.lane, onChange: (v) => up2({ lane: v }), options: Object.entries(LANES).map(([value, label]) => ({ value, label })) }),
                  Select({ label: 'Step type', value: s.kind, onChange: (v) => up2({ kind: v }), options: Object.entries(STEP_KINDS).map(([value, label]) => ({ value, label })) })),
              }),
              h('div', { class: 'grid gap-4 md:grid-cols-2' },
                bind(TextInput({ label: 'Systems & departments involved', limit: L.workflowShort, value: w.systems, onChange: (v) => up({ systems: v }) }), `workflows.${w.id}.systems`),
                bind(TextInput({ label: 'Final output / business outcome', limit: L.workflowShort, value: w.output, onChange: (v) => up({ output: v }) }), `workflows.${w.id}.output`))),
          }))];
      case 'staffing-engagement':
        return [
          FormSection({ title: 'The challenge', description: 'Why the client needed external technology capacity.' },
            bind(TextInput({ label: 'Challenge summary', required: true, limit: L.staffingSummary, value: S.challengeSummary, onChange: (v) => setStaffing('challengeSummary', v), placeholder: 'One-line summary of the client challenge' }), 'staffing.challengeSummary'),
            bind(LinesArea({ label: 'Challenge points', limit: L.staffingPoint, value: S.challengePoints, onChange: (v) => setStaffing('challengePoints', v), placeholder: 'Business or engineering challenge\nCapability gap or delivery bottleneck' }), 'staffing.challengePoints', true)),
          FormSection({ title: 'Our approach', description: 'How the resource engagement was structured.' },
            bind(TextInput({ label: 'Approach summary', required: true, limit: L.staffingSummary, value: S.approachSummary, onChange: (v) => setStaffing('approachSummary', v), placeholder: 'One-line summary of our response' }), 'staffing.approachSummary'),
            bind(LinesArea({ label: 'Approach points', limit: L.staffingPoint, value: S.approachPoints, onChange: (v) => setStaffing('approachPoints', v), placeholder: 'Resource engagement strategy\nHow skills and team structure were selected' }), 'staffing.approachPoints', true)),
        ];
      case 'staffing-team':
        return [
          FormSection({ title: 'Engagement snapshot' },
            h('div', { class: 'grid gap-4 md:grid-cols-2' },
              bind(TextInput({ label: 'Reporting period', limit: L.reportingPeriod, value: S.reportingPeriod, onChange: (v) => setStaffing('reportingPeriod', v), placeholder: 'Jan 2026 – Jun 2026' }), 'staffing.reportingPeriod'),
              bind(TextInput({ label: 'Duration (months)', inputMode: 'numeric', value: S.durationMonths, onChange: (v) => setStaffing('durationMonths', v) }), 'staffing.durationMonths'),
              bind(TextInput({ label: 'Initial team size', inputMode: 'numeric', value: S.initialTeamSize, onChange: (v) => setStaffing('initialTeamSize', v) }), 'staffing.initialTeamSize'),
              bind(TextInput({ label: 'Peak team size', required: true, inputMode: 'numeric', value: S.peakTeamSize, onChange: (v) => setStaffing('peakTeamSize', v) }), 'staffing.peakTeamSize'),
              bind(TextInput({ label: 'Final / current team size', inputMode: 'numeric', value: S.finalTeamSize, onChange: (v) => setStaffing('finalTeamSize', v) }), 'staffing.finalTeamSize')),
            bind(MultiSelect({ label: 'Team composition (roles)', required: true, value: S.roles, onChange: (v) => setStaffing('roles', v), options: ROLES, placeholder: 'Select roles' }), 'staffing.roles', true)),
          FormSection({ title: 'Resource deployment over time', description: 'Active resources per month by discipline. Drives the scaling chart in staffing case studies.' }, deploymentTable()),
          FormSection({ title: 'Outcome summary' },
            bind(TextArea({ label: 'How the engagement helped the client', limit: L.outcomeSummary, value: S.outcomeSummary, onChange: (v) => setStaffing('outcomeSummary', v), rows: 3 }), 'staffing.outcomeSummary')),
        ];
      case 'technology': {
        const techErr = h('p', { class: 'text-sm text-accent' });
        reg.push({ key: 'technologies', el: { setError: (e) => { techErr.textContent = e || ''; techErr.hidden = !e; }, get isConnected() { return techErr.isConnected; } } });
        techErr.hidden = !err('technologies'); techErr.textContent = err('technologies') || '';
        return [FormSection({ title: 'Technologies & integrations', description: `Confirmed technologies only. Add each one under its category (${L.technology.min}–${L.technology.max} characters each).${data.type === 'project' ? ' At least one is required for project-specific projects.' : ''}` },
          techErr,
          h('div', { class: 'grid gap-5 md:grid-cols-2' }, TECH_CATEGORIES.map((c) => {
            const inCat = data.technologies.filter((x) => x.category === c.value);
            const el = TagInput({ label: c.label, value: inCat.map((x) => x.name), maxLength: L.technology.max, placeholder: c.value === 'integrations' ? 'e.g. Payment gateway, UAE Pass' : 'Type and press Enter',
              onChange: (names) => {
                const keep = data.technologies.filter((x) => x.category !== c.value);
                const cur = data.technologies.filter((x) => x.category === c.value);
                set('technologies', [...keep, ...names.map((n) => cur.find((x) => x.name === n) || { id: newId('tech'), name: n, category: c.value })]);
              } });
            reg.push({ key: `tech-${c.value}`, el: { setError: (e) => el.setError(e), get isConnected() { return el.isConnected; } }, custom: () => data.technologies.filter((x) => x.category === c.value).map((x) => err(`technologies.${x.id}`)).find(Boolean) });
            el.setError(inCat.map((x) => err(`technologies.${x.id}`)).find(Boolean));
            return el;
          })))];
      }
      case 'outcomes':
        return [
          FormSection({ title: 'Business outcomes', description: `Only record results you have evidence for. Mark each as measured, qualitative or expected; measured results need a source.${data.type === 'project' ? ' At least one outcome is required for project-specific projects.' : ''}` },
            bindRepeater('outcomes', {
              label: 'Outcomes', addLabel: 'Add outcome', itemTitle: (o) => o.label || 'Outcome',
              create: () => ({ id: newId('out'), value: '', label: '', evidence: 'measured', baseline: '', period: '', source: '' }),
              render: (o, up) => h('div', { class: 'grid gap-4 md:grid-cols-3' },
                bind(TextInput({ label: 'Value', limit: L.outcomeValue, value: o.value, onChange: (v) => up({ value: v }), placeholder: 'e.g. 40%', hint: 'Leave blank for qualitative results' }), `outcomes.${o.id}.value`),
                bind(TextInput({ label: 'Business outcome', required: true, limit: L.outcomeLabel, value: o.label, onChange: (v) => up({ label: v }), className: 'md:col-span-2', placeholder: 'e.g. Reduction in manual processing effort' }), `outcomes.${o.id}.label`),
                Select({ label: 'Evidence', value: o.evidence, onChange: (v) => up({ evidence: v }), options: Object.entries(EVIDENCE).map(([value, label]) => ({ value, label })) }),
                bind(TextInput({ label: 'Baseline', limit: L.outcomeBaseline, value: o.baseline, onChange: (v) => up({ baseline: v }) }), `outcomes.${o.id}.baseline`),
                bind(TextInput({ label: 'Period', limit: L.outcomePeriod, value: o.period, onChange: (v) => up({ period: v }) }), `outcomes.${o.id}.period`),
                bind(TextInput({ label: 'Evidence source', limit: L.outcomeSource, value: o.source, onChange: (v) => up({ source: v }), className: 'md:col-span-3', placeholder: 'e.g. Client operations report, Q2 2026', hint: 'Required for measured results' }), `outcomes.${o.id}.source`)),
            })),
          FormSection({ title: 'Before → after', description: 'Only where supporting data exists.' },
            bindRepeater('beforeAfter', {
              label: 'Process changes', addLabel: 'Add process change', itemTitle: (b) => b.process || 'Process',
              create: () => ({ id: newId('ba'), process: '', before: '', after: '' }),
              render: (b, up) => h('div', { class: 'grid gap-4 md:grid-cols-3' },
                bind(TextInput({ label: 'Process', required: true, limit: L.beforeAfter, value: b.process, onChange: (v) => up({ process: v }) }), `beforeAfter.${b.id}.process`),
                bind(TextInput({ label: 'Before', required: true, limit: L.beforeAfter, value: b.before, onChange: (v) => up({ before: v }) }), `beforeAfter.${b.id}.before`),
                bind(TextInput({ label: 'After', required: true, limit: L.beforeAfter, value: b.after, onChange: (v) => up({ after: v }) }), `beforeAfter.${b.id}.after`)),
            })),
          FormSection({ title: 'Technical highlights & future opportunities' },
            bind(LinesArea({ label: 'Technical highlights', limit: L.technicalHighlight, value: data.technicalHighlights, onChange: (v) => set('technicalHighlights', v), placeholder: 'Implementation considerations worth calling out' }), 'technicalHighlights', true),
            bind(TextArea({ label: 'Future opportunities', limit: L.futureOpportunities, value: data.futureOpportunities, onChange: (v) => set('futureOpportunities', v), rows: 2, hint: 'Only documented next steps or roadmap items' }), 'futureOpportunities')),
        ];
      case 'contribution':
        return [
          FormSection({ title: "Our organization's contribution" },
            MultiSelect({ label: 'Scope of contribution', value: data.scope, onChange: (v) => set('scope', v), options: SCOPES, placeholder: 'Select scope' }),
            bind(TextArea({ label: 'What we delivered', required: true, limit: L.contribution, value: data.contribution, onChange: (v) => set('contribution', v), rows: 3 }), 'contribution'),
            bind(TextArea({ label: 'Project limitations or constraints', limit: L.constraints, value: data.constraints, onChange: (v) => set('constraints', v), rows: 2, hint: 'Optional. Shown in the project PDF, not in case studies' }), 'constraints')),
          FormSection({ title: 'Screenshots & supporting assets', description: 'Images are uploaded to this server and used in case study previews and PDFs.' }, assetsRepeater()),
          FormSection({ title: 'Notes' },
            bind(TextArea({ label: 'Additional notes (optional)', limit: L.notes, value: data.notes, onChange: (v) => set('notes', v), rows: 3, hint: 'Internal only; not used in case studies' }), 'notes')),
        ];
      default: return [];
    }
  }

  function drawContent() {
    reg.length = 0;
    content.replaceChildren(
      h('div', { class: 'flex flex-wrap items-baseline justify-between gap-2' },
        h('div', { class: 'eyebrow' }, STEPS[data.type].indexOf(step) + 1, '. ', STEP_LABELS[step]),
        h('div', { class: 'text-xs text-fg-subtle' }, h('span', { class: 'text-accent' }, '*'), ' required to save as Completed')),
      ...stepContent());
    // technology per-category custom errors
    for (const r of reg) if (r.custom) r.el.setError(r.custom());
    drawNav(); drawFooter();
  }
  function drawFooter() {
    const steps = STEPS[data.type];
    const idx = Math.max(0, steps.indexOf(step));
    footer.replaceChildren(h('div', { class: 'flex flex-wrap items-center justify-between gap-3' },
      h('div', { class: 'flex gap-2' },
        h('button', { type: 'button', class: 'btn-ghost', disabled: idx === 0, onClick: () => goStep(steps[idx - 1]) }, icon('arrowLeft', { size: 16 }), ' Back'),
        idx < steps.length - 1 && h('button', { type: 'button', class: 'btn-secondary', onClick: () => goStep(steps[idx + 1]) }, 'Next: ', STEP_LABELS[steps[idx + 1]], ' ', icon('arrowRight', { size: 16 }))),
      h('div', { class: 'flex flex-wrap gap-2' },
        h('button', { type: 'button', class: 'btn-ghost', onClick: () => { if (!dirty || window.confirm('Discard unsaved changes?')) { dirty = false; window.__dirty = false; window.__beforeNavigate = null; onCancel(); } } }, 'Cancel'),
        h('button', { type: 'button', class: 'btn-secondary', disabled: saving, onClick: () => save('draft') }, 'Save as draft'),
        h('button', { type: 'button', class: 'btn-primary', disabled: saving, onClick: () => save('complete') }, icon('check', { size: 16 }), ' ', submitLabel))));
  }
  function drawAll() { drawAlert(); drawContent(); }

  async function save(m) {
    mode = m;
    errors = validateProject(data, m);
    const first = Object.keys(errors)[0];
    if (first) { step = stepForKey(first, data.type); drawAll(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    saving = true; drawFooter();
    try {
      dirty = false; window.__dirty = false; window.__beforeNavigate = null;
      await onSubmit({ ...normalizeProject(data), status: m === 'complete' ? 'completed' : 'draft' });
    } catch (e) {
      dirty = true; window.__dirty = true; window.__beforeNavigate = () => !dirty || window.confirm('Discard unsaved changes?');
      if (e.data && e.data.errors) { errors = e.data.errors; drawAll(); }
      toast(e.message, 'error');
    } finally { saving = false; if (footer.isConnected) drawFooter(); }
  }

  drawAll();
  return h('div', { class: 'grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]' }, nav, h('div', { class: 'min-w-0' }, alertHost, content, footer));
}
