import { validate } from '/shared/validate.js';
import { derive, monthLabel, parseMonth } from '/shared/derive.js';

// ============================================================ utilities
const $app = document.getElementById('app');
const state = { me: null, templates: null, dirty: false, poll: null };

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
const svg = (markup) => h('span', { html: markup, style: { display: 'inline-flex' } });
const ICONS = {
  project: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c8202f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18M8 21h8"/></svg>',
  staffing: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c8202f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14.5c2.8 0 5 2.2 5 5"/></svg>',
  up: '↑', down: '↓', remove: '✕',
};
const STATUS = {
  draft: 'Draft', submitted: 'Submitted', changes_requested: 'Changes requested', generating: 'Generating', generated: 'Ready for review', approved: 'Approved',
};
const chip = (status) => h('span', { class: `chip ${status}` }, STATUS[status] || status);
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function toast(msg, error = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show' + (error ? ' error' : '');
  clearTimeout(t._t);
  t._t = setTimeout(() => (t.className = ''), 3200);
}

async function api(method, url, body) {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status; err.data = data;
    if (res.status === 401 && url !== '/api/login') { state.me = null; render(); }
    throw err;
  }
  return data;
}

function modal({ title, subtitle, body, foot, wide }) {
  const close = () => back.remove();
  const back = h('div', { class: 'modal-backdrop', onclick: (e) => e.target === back && close() },
    h('div', { class: `modal ${wide ? 'wide' : ''}`, role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'modal-head' }, h('div', { style: { flex: 1 } }, h('h2', {}, title), subtitle && h('div', { class: 'muted small', style: { marginTop: '4px' } }, subtitle)), h('button', { class: 'btn ghost icon', onclick: close, 'aria-label': 'Close' }, '✕')),
      h('div', { class: 'modal-body' }, body),
      foot && h('div', { class: 'modal-foot' }, typeof foot === 'function' ? foot(close) : foot)));
  document.body.append(back);
  const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
  return close;
}

async function getTemplates() {
  if (!state.templates) state.templates = await api('GET', '/api/templates');
  return state.templates;
}
const templateById = (id) => state.templates.find((t) => t.id === id);

// ============================================================ routing
window.addEventListener('hashchange', () => {
  if (state.dirty && !confirm('You have unsaved changes. Leave without saving?')) { history.back(); return; }
  state.dirty = false;
  render();
});
window.addEventListener('beforeunload', (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });

async function render() {
  clearInterval(state.poll);
  document.querySelectorAll('.modal-backdrop').forEach((m) => m.remove());
  if (!state.me) {
    try { state.me = (await api('GET', '/api/me')).user; } catch { /* offline */ }
  }
  if (!state.me) return renderLogin();
  await getTemplates();
  const hash = location.hash.replace(/^#/, '') || '/';
  const [path, query] = hash.split('?');
  const params = new URLSearchParams(query || '');
  const parts = path.split('/').filter(Boolean);
  const admin = state.me.role === 'admin';
  let view;
  try {
    if (parts[0] === 'cs' && parts[1]) view = await viewCaseStudy(parts[1], params);
    else if (parts[0] === 'review' && admin) view = await viewReview();
    else if (parts[0] === 'templates' && admin && parts[1]) view = await viewTemplateDetail(parts[1]);
    else if (parts[0] === 'templates' && admin) view = await viewTemplates();
    else view = await viewDashboard(params);
  } catch (e) {
    view = h('div', { class: 'card card-pad empty' }, h('h3', {}, 'Could not load this page'), h('p', {}, e.message), h('a', { href: '#/' }, 'Back to case studies'));
  }
  $app.replaceChildren(topbar(parts[0] || ''), h('main', { class: 'page' }, view));
  window.scrollTo(0, 0);
}

function topbar(active) {
  const admin = state.me.role === 'admin';
  const link = (href, label, key) => h('a', { href, class: active === key ? 'active' : '' }, label);
  return h('header', { class: 'topbar' }, h('div', { class: 'topbar-inner' },
    h('a', { class: 'brand', href: '#/' }, h('img', { class: 'brand-mark', src: '/favicon.svg', alt: '' }), 'Case Study Studio', h('small', {}, 'TechStalwarts')),
    h('nav', { class: 'nav' },
      link('#/', 'Case studies', ''),
      admin && link('#/review', 'Review queue', 'review'),
      admin && link('#/templates', 'Templates', 'templates')),
    h('div', { class: 'spacer' }),
    h('div', { class: 'user' }, h('span', {}, state.me.name), h('span', { class: `role-pill ${admin ? 'admin' : ''}` }, admin ? 'Admin' : 'Stakeholder'),
      h('button', { class: 'btn ghost sm', onclick: async () => { await api('POST', '/api/logout'); state.me = null; state.templates = null; location.hash = '#/'; render(); } }, 'Sign out'))));
}

// ============================================================ login
function renderLogin() {
  let role = 'stakeholder';
  const name = h('input', { id: 'login-name', type: 'text', autocomplete: 'name', required: true });
  const email = h('input', { id: 'login-email', type: 'email', autocomplete: 'email', required: true });
  const pass = h('input', { id: 'login-pass', type: 'password', autocomplete: 'current-password' });
  const passField = h('div', { class: 'field', style: { display: 'none' } }, h('label', { class: 'lbl', for: 'login-pass' }, 'Admin passcode'), pass);
  const err = h('div', { class: 'err' });
  const toggle = h('div', { class: 'role-toggle' });
  const setRole = (r) => {
    role = r;
    toggle.replaceChildren(...[['stakeholder', 'Stakeholder'], ['admin', 'Admin']].map(([k, l]) => h('button', { type: 'button', class: role === k ? 'on' : '', onclick: () => setRole(k) }, l)));
    passField.style.display = role === 'admin' ? '' : 'none';
  };
  setRole(role);
  const form = h('form', {
    class: 'card card-pad stack', onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      try {
        state.me = (await api('POST', '/api/login', { name: name.value, email: email.value, role, passcode: pass.value })).user;
        render();
      } catch (ex) { err.textContent = ex.message; }
    },
  },
    h('div', {}, h('h2', {}, 'Sign in'), h('div', { class: 'muted small' }, 'Provide case study information; TechStalwarts templates handle the design.')),
    toggle,
    h('div', { class: 'field' }, h('label', { class: 'lbl', for: 'login-name' }, 'Your name'), name),
    h('div', { class: 'field' }, h('label', { class: 'lbl', for: 'login-email' }, 'Work email'), email),
    passField, err,
    h('button', { class: 'btn primary', type: 'submit', style: { width: '100%' } }, 'Continue'));
  $app.replaceChildren(h('div', { class: 'login-wrap' }, h('div', { class: 'login' }, h('div', { class: 'brand' }, h('img', { class: 'brand-mark', src: '/favicon.svg', alt: '' }), 'Case Study Studio'), form)));
  name.focus();
}

// ============================================================ dashboard
function openTemplatePicker() {
  const opt = (t, label, icon) => h('div', { class: 'template-option' },
    h('div', { class: 'glyph' }, svg(icon)),
    h('div', { class: 't-label' }, label),
    h('h3', {}, t.name),
    h('p', {}, t.description),
    h('button', {
      class: 'btn primary', onclick: async (e) => {
        e.target.disabled = true;
        try {
          const cs = await api('POST', '/api/case-studies', { templateId: t.id });
          close();
          location.hash = `#/cs/${cs.id}`;
        } catch (ex) { toast(ex.message, true); e.target.disabled = false; }
      },
    }, t.cta));
  const project = templateById('project-specific'), staffing = templateById('staffing');
  const close = modal({
    title: 'Create Case Study', subtitle: 'Choose the type of case study. You only provide the information — the approved TechStalwarts template handles layout and design.', wide: true,
    body: h('div', { class: 'template-options' }, opt(project, 'Option A', ICONS.project), opt(staffing, 'Option B', ICONS.staffing)),
  });
}

async function viewDashboard(params) {
  const list = await api('GET', '/api/case-studies');
  const admin = state.me.role === 'admin';
  const filter = params.get('f') || 'all';
  const groups = {
    all: () => true, draft: (c) => c.status === 'draft', review: (c) => ['submitted', 'generating', 'generated'].includes(c.status),
    changes: (c) => c.status === 'changes_requested', approved: (c) => c.status === 'approved',
  };
  const labels = { all: 'All', draft: 'Drafts', review: 'In review', changes: 'Changes requested', approved: 'Approved' };
  const rows = list.filter(groups[filter] || groups.all);
  const table = rows.length ? h('table', { class: 'table' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Case study'), h('th', {}, 'Template'), admin && h('th', {}, 'Owner'), h('th', {}, 'Status'), h('th', {}, 'Updated'))),
    h('tbody', {}, rows.map((c) => h('tr', { class: 'click', onclick: () => (location.hash = `#/cs/${c.id}`) },
      h('td', { class: 'title-cell' }, c.title, c.isTest && h('span', { class: 'chip test', style: { marginLeft: '8px' } }, 'Template test'),
        c.stale && h('div', { class: 'small', style: { color: 'var(--amber)', fontWeight: 400 } }, 'Edited after generation — needs regeneration')),
      h('td', {}, c.templateName),
      admin && h('td', {}, c.ownerName, h('div', { class: 'muted small' }, c.ownerEmail)),
      h('td', {}, chip(c.status)),
      h('td', { class: 'muted' }, fmtDay(c.updatedAt))))))
    : h('div', { class: 'empty' }, h('h3', {}, list.length ? 'Nothing here' : 'No case studies yet'), h('p', {}, list.length ? 'No case studies match this filter.' : 'Create your first case study — pick a template and fill in the information it needs.'),
      !list.length && h('button', { class: 'btn primary', onclick: openTemplatePicker }, 'Create Case Study'));
  return h('div', {},
    h('div', { class: 'page-head' },
      h('div', {}, h('h1', {}, admin ? 'All case studies' : 'My case studies'), h('div', { class: 'sub' }, admin ? 'Every case study submitted by stakeholders.' : 'Provide the information; we generate the case study from the approved template.')),
      h('div', { class: 'spacer' }),
      h('button', { class: 'btn primary', onclick: openTemplatePicker }, '+ Create Case Study')),
    h('div', { class: 'filters' }, Object.entries(labels).map(([k, l]) => h('button', { class: filter === k ? 'on' : '', onclick: () => (location.hash = `#/?f=${k}`) }, l, ` (${list.filter(groups[k]).length})`))),
    h('div', { class: 'card' }, table));
}

async function viewReview() {
  const list = await api('GET', '/api/case-studies');
  const sections = [
    ['Awaiting review', 'Check the information, then generate the case study in Figma or request changes.', list.filter((c) => c.status === 'submitted')],
    ['Generated — awaiting approval', 'Review the preview and approve, or request changes.', list.filter((c) => c.status === 'generated')],
    ['Waiting for the Figma plugin', 'Open the TechStalwarts Case Study Generator plugin in the template file to process these.', list.filter((c) => c.status === 'generating')],
    ['Waiting on stakeholders', 'Changes were requested.', list.filter((c) => c.status === 'changes_requested')],
  ];
  return h('div', {},
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Review queue'), h('div', { class: 'sub' }, 'Everything that needs an admin decision.'))),
    sections.map(([title, sub, rows]) => h('div', { class: 'card', style: { marginBottom: '20px' } },
      h('div', { class: 'card-head' }, h('div', {}, h('h3', {}, `${title} (${rows.length})`), h('div', { class: 'muted small' }, sub))),
      rows.length ? h('table', { class: 'table' }, h('tbody', {}, rows.map((c) => h('tr', { class: 'click', onclick: () => (location.hash = `#/cs/${c.id}`) },
        h('td', { class: 'title-cell' }, c.title, c.isTest && h('span', { class: 'chip test', style: { marginLeft: '8px' } }, 'Template test')),
        h('td', {}, c.templateName), h('td', {}, c.ownerName), h('td', {}, chip(c.status), c.stale && h('div', { class: 'small', style: { color: 'var(--amber)' } }, 'Needs regeneration')),
        h('td', { class: 'muted' }, fmtDay(c.updatedAt))))))
        : h('div', { class: 'empty', style: { padding: '24px' } }, 'Nothing here.'))));
}

// ============================================================ case study
async function viewCaseStudy(id, params) {
  const cs = await api('GET', `/api/case-studies/${id}`);
  const t = templateById(cs.templateId);
  const tab = params.get('tab') || (cs.generation && cs.generation.exports.length && ['generated', 'approved'].includes(cs.status) ? 'preview' : 'info');
  const admin = state.me.role === 'admin';
  const p = cs.permissions;
  const refresh = () => render();

  if (cs.status === 'generating') state.poll = setInterval(async () => {
    const latest = await api('GET', `/api/case-studies/${id}`).catch(() => null);
    if (latest && latest.status !== 'generating') { toast(latest.status === 'generated' ? 'Case study generated' : 'Generation finished'); refresh(); }
  }, 4000);

  const act = (label, cls, fn) => h('button', {
    class: `btn ${cls}`, onclick: async (e) => {
      e.target.disabled = true;
      try { await fn(); } catch (ex) { toast(ex.message, true); if (ex.data && ex.data.errors) showServerErrors(ex.data.errors); } finally { e.target.disabled = false; }
    },
  }, label);

  const actions = h('div', { class: 'btn-group' },
    p.requestChanges && act('Request changes', '', () => requestChangesModal(cs, t)),
    p.generate && act(cs.generation && cs.generation.result ? 'Regenerate in Figma' : 'Generate in Figma', cs.status === 'submitted' || cs.stale ? 'primary' : '', async () => {
      if (state.dirty) throw new Error('Save your changes first');
      await api('POST', `/api/case-studies/${id}/generate`); toast('Queued for the Figma plugin'); refresh();
    }),
    admin && cs.status === 'generating' && act('Cancel generation', '', async () => { await api('POST', `/api/case-studies/${id}/cancel-generation`); refresh(); }),
    p.approve && act('Approve', 'primary', async () => { await api('POST', `/api/case-studies/${id}/approve`); toast('Approved'); location.hash = `#/cs/${id}?tab=preview`; }),
    p.reopen && act('Reopen for revision', '', async () => { await api('POST', `/api/case-studies/${id}/reopen`); refresh(); }),
    p.delete && act('Delete', 'ghost danger', async () => {
      if (!confirm(`Delete "${cs.title}"? This cannot be undone.${cs.generation && cs.generation.result ? ' The generated copy in Figma is not deleted.' : ''}`)) return;
      await api('DELETE', `/api/case-studies/${id}`); state.dirty = false; location.hash = '#/';
    }));

  const head = h('div', { class: 'cs-head' },
    h('div', { style: { flex: 1, minWidth: '280px' } },
      h('div', { class: 'eyebrow' }, t.name),
      h('h1', { style: { marginTop: '8px' } }, cs.title),
      h('div', { class: 'meta' }, chip(cs.status), cs.isTest && h('span', { class: 'chip test' }, 'Template test'),
        cs.version ? h('span', {}, `Version ${cs.version}`) : null, h('span', {}, `By ${cs.ownerName}`), h('span', {}, `Updated ${fmtDate(cs.updatedAt)}`))),
    actions);

  const banners = [];
  const openReqs = cs.changeRequests.filter((r) => !r.resolved);
  if (cs.status === 'changes_requested' && openReqs.length) {
    banners.push(h('div', { class: 'banner amber' }, h('div', {}, h('strong', {}, 'Changes requested'),
      openReqs.map((r) => h('div', { style: { marginTop: '6px' } }, h('div', { style: { whiteSpace: 'pre-wrap' } }, r.note), h('div', { class: 'small' }, `${r.by} · ${fmtDate(r.at)}${r.fields.length ? ' · Fields: ' + r.fields.map((k) => (t.fields.find((f) => f.key === k) || {}).label || k).join(', ') : ''}`))),
      p.submit && h('div', { class: 'small', style: { marginTop: '8px' } }, 'Update the highlighted fields, then submit again.'))));
  }
  if (cs.status === 'generating') {
    banners.push(h('div', { class: 'banner purple' }, h('div', {}, h('strong', {}, cs.generation.status === 'running' ? 'Generating in Figma…' : 'Queued for generation'),
      admin ? h('span', {}, 'The Figma plugin populates a copy of the approved template. Open the template file in Figma and run Plugins → Development → TechStalwarts Case Study Generator. This page updates automatically.')
        : h('span', {}, 'The case study is being generated from the approved template. This page updates automatically.'))));
  }
  if (cs.generation && cs.generation.status === 'failed') {
    banners.push(h('div', { class: 'banner red' }, h('div', {}, h('strong', {}, `Generation v${cs.generation.version} failed`), h('div', { class: 'mono', style: { whiteSpace: 'pre-wrap' } }, cs.generation.error),
      admin && h('div', { class: 'small', style: { marginTop: '6px' } }, 'If a template layer could not be found, sync the template and review its mappings under Templates.'))));
  }
  if (cs.stale && cs.status === 'generated') banners.push(h('div', { class: 'banner amber' }, h('div', {}, h('strong', {}, 'Information changed after generation'), 'Regenerate the case study before approving so the presentation matches the saved information.')));
  if (cs.status === 'approved') banners.push(h('div', { class: 'banner green' }, h('div', {}, h('strong', {}, `Approved by ${cs.approvedBy} · ${fmtDate(cs.approvedAt)}`), 'Final exports are available in the Preview tab.')));
  if (cs.status === 'submitted' && !admin) banners.push(h('div', { class: 'banner blue' }, h('div', {}, h('strong', {}, 'Submitted for review'), 'An admin will review your information and generate the case study. You can still update the information until then.')));

  const tabs = [['info', 'Information'], ['preview', 'Preview'], ['activity', 'Activity']];
  const tabBar = h('div', { class: 'tabs' }, tabs.map(([k, l]) => h('button', { class: tab === k ? 'on' : '', onclick: () => (location.hash = `#/cs/${id}?tab=${k}`) }, l,
    k === 'preview' && cs.generation && cs.generation.exports.length ? ` (${cs.generation.exports.length})` : '')));

  let body;
  if (tab === 'preview') body = previewTab(cs);
  else if (tab === 'activity') body = activityTab(cs);
  else body = p.edit || p.editAdminFields ? caseForm(cs, t) : readOnlyView(cs, t);

  return h('div', {}, head, banners, tabBar, body);
}

function previewTab(cs) {
  const g = cs.generation;
  if (!g || !g.exports.length) {
    return h('div', { class: 'card empty' }, h('h3', {}, 'No preview yet'),
      h('p', {}, cs.status === 'generating' ? 'The case study is being generated in Figma.' : 'A preview appears here once an admin generates the case study from the template.'));
  }
  const fileUrl = (f, dl) => `/api/case-studies/${cs.id}/exports/${f}${dl ? '?download' : ''}`;
  return h('div', {},
    h('div', { class: 'row wrap', style: { marginBottom: '16px' } },
      h('div', {}, h('h3', {}, `${cs.status === 'approved' ? 'Final case study' : 'Generated preview'} · v${g.version}`), h('div', { class: 'muted small' }, `Generated ${fmtDate(g.completedAt)} from the approved template. Typography, colours, layout and spacing come from the Figma master.`)),
      h('div', { class: 'spacer' }),
      g.figmaUrl && h('a', { class: 'btn', href: g.figmaUrl, target: '_blank', rel: 'noopener' }, 'Open in Figma ↗')),
    cs.stale && h('div', { class: 'banner amber' }, h('div', {}, 'This preview is out of date — the information was edited after it was generated.')),
    g.warnings && g.warnings.length ? h('div', { class: 'banner blue' }, h('div', {}, h('strong', {}, 'Notes from generation'), h('ul', {}, g.warnings.map((w) => h('li', {}, w))))) : null,
    g.exports.map((e, i) => h('div', { class: 'preview-frame' },
      h('div', { class: 'pf-head' }, h('span', {}, `${i + 1}. ${e.name.split(' — ')[0]}`), h('div', { class: 'spacer' }),
        h('a', { class: 'btn sm', href: fileUrl(e.png, true) }, 'PNG'), h('a', { class: 'btn sm', href: fileUrl(e.pdf, true) }, 'PDF')),
      h('img', { src: fileUrl(e.png), alt: e.name, loading: 'lazy' }))));
}

function activityTab(cs) {
  return h('div', { class: 'card card-pad' }, h('h3', { style: { marginBottom: '8px' } }, 'Activity'),
    h('ul', { class: 'timeline' }, cs.history.slice().reverse().map((e) => h('li', {}, h('time', {}, fmtDate(e.at)), h('div', {}, h('b', {}, e.by), ' · ', e.action, e.note && h('div', { class: 'note' }, e.note))))));
}

function requestChangesModal(cs, t) {
  const note = h('textarea', { rows: 4, placeholder: 'What is missing or needs to change?' });
  const boxes = t.fields.filter((f) => !f.adminOnly).map((f) => { const cb = h('input', { type: 'checkbox', value: f.key }); return { cb, el: h('label', { class: 'row small', style: { gap: '8px', padding: '3px 0' } }, cb, f.label) }; });
  const err = h('div', { class: 'err' });
  modal({
    title: 'Request changes', subtitle: 'The stakeholder will see your note and the flagged fields.',
    body: h('div', { class: 'field', style: { paddingTop: 0 } }, h('label', { class: 'lbl' }, 'Note to stakeholder'), note, h('div', { class: 'lbl', style: { marginTop: '16px' } }, 'Flag fields (optional)'),
      h('div', { style: { columns: 2, columnGap: '20px' } }, boxes.map((b) => b.el)), err),
    foot: (close) => [h('button', { class: 'btn', onclick: close }, 'Cancel'), h('button', {
      class: 'btn primary', onclick: async () => {
        try {
          await api('POST', `/api/case-studies/${cs.id}/request-changes`, { note: note.value, fields: boxes.filter((b) => b.cb.checked).map((b) => b.cb.value) });
          close(); toast('Changes requested'); render();
        } catch (ex) { err.textContent = ex.message; }
      },
    }, 'Send request')],
  });
  note.focus();
}

// ------------------------------------------------------------ read-only view
function readOnlyView(cs, t) {
  const value = (f, v) => {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return h('span', { class: 'muted' }, '—');
    switch (f.type) {
      case 'image': return h('img', { src: `/api/assets/${v}`, alt: f.label });
      case 'list': return h('ul', {}, v.filter(Boolean).map((x) => h('li', {}, x)));
      case 'month': return monthLabel(v);
      case 'select': return (f.options.find((o) => o.value === v) || {}).label || v;
      case 'color': return h('span', { class: 'row' }, h('span', { style: { width: '18px', height: '18px', borderRadius: '4px', background: v, border: '1px solid var(--line)' } }), v);
      case 'repeater': return h('div', {}, v.map((it, i) => h('div', { style: { padding: '4px 0' } }, `${i + 1}. `, f.itemFields.map((s) => it[s.key] === '' || it[s.key] === undefined ? null : h('span', { style: { marginRight: '14px' } }, h('span', { class: 'muted small' }, s.label + ': '), s.type === 'image' ? h('img', { src: `/api/assets/${it[s.key]}`, alt: '', style: { maxHeight: '28px', verticalAlign: 'middle' } }) : s.type === 'month' ? monthLabel(it[s.key]) : String(it[s.key]))))));
      default: return h('span', { style: { whiteSpace: 'pre-wrap' } }, String(v));
    }
  };
  const d = cs.derived;
  return h('div', {},
    t.sections.map((s) => {
      const fields = t.fields.filter((f) => f.section === s.key);
      if (!fields.length) return null;
      return h('div', { class: 'card form-section' }, h('div', { class: 'card-head' }, h('h3', {}, s.title), h('div', { class: 'appears' }, `Appears in: ${s.appearsIn}`)),
        h('div', { class: 'card-pad', style: { paddingTop: '4px' } }, h('div', { class: 'kv' }, fields.flatMap((f) => [h('div', { class: 'k' }, f.label), h('div', {}, value(f, cs.data[f.key]))]),
          s.key === 'deployment' && t.derived.length ? t.derived.flatMap((x) => [h('div', { class: 'k' }, x.label, h('div', { class: 'small' }, 'calculated')), h('div', {}, d[x.key] || '—')]) : [])));
    }));
}

// ------------------------------------------------------------ editable form
let formApi = null;
function showServerErrors(errors) { if (formApi) formApi.showErrors(errors); }

function caseForm(cs, t) {
  const admin = state.me.role === 'admin';
  const p = cs.permissions;
  const data = JSON.parse(JSON.stringify(cs.data));
  for (const f of t.fields) if (data[f.key] === undefined) data[f.key] = f.type === 'list' || f.type === 'repeater' ? [] : '';
  const flagged = new Set(cs.changeRequests.filter((r) => !r.resolved).flatMap((r) => r.fields));
  const registry = new Map(); // path -> { input, err }
  const fieldBlocks = new Map(); // field key -> wrapper
  let showAll = false;
  let errors = {};
  const editable = (f) => (f.adminOnly ? p.editAdminFields : p.edit);

  const markDirty = () => { state.dirty = true; stateEl.textContent = 'Unsaved changes'; stateEl.className = 'state dirty'; refreshErrors(); updateSide(); if (t.id === 'staffing') updateDerived(); };

  function register(path, input, err) { registry.set(path, { input, err }); }
  function refreshErrors(force) {
    errors = validate(t, data, 'submit');
    if (!admin) for (const f of t.fields) if (f.adminOnly) for (const k of Object.keys(errors)) if (k === f.key || k.startsWith(f.key + '.')) delete errors[k];
    const formatErrors = validate(t, data, 'draft');
    for (const [path, r] of registry) {
      const msg = showAll || force ? errors[path] : formatErrors[path]; // format errors always, "required" only after an attempt
      if (r.err) r.err.textContent = msg || '';
      if (r.input) r.input.classList.toggle('invalid', !!msg);
    }
  }

  // ---------- field renderers
  function counter(f, getValue) {
    if (!f.maxLength) return null;
    const c = h('span', { class: 'counter' });
    const upd = () => { const n = (getValue() || '').length; c.textContent = `${n}/${f.maxLength}`; c.classList.toggle('over', n > f.maxLength); };
    upd(); c._upd = upd;
    return c;
  }

  function scalarInput(f, get, set, path) {
    const dis = !editable(f);
    let input;
    if (f.type === 'textarea') input = h('textarea', { rows: f.rows || 3, placeholder: f.placeholder || '', disabled: dis });
    else if (f.type === 'number') input = h('input', { type: 'number', min: f.min, max: f.max, step: f.integer ? 1 : 'any', disabled: dis });
    else if (f.type === 'month') input = h('input', { type: 'month', disabled: dis });
    else if (f.type === 'select') input = h('select', { disabled: dis }, h('option', { value: '' }, 'Select…'), f.options.map((o) => h('option', { value: o.value }, o.label)));
    else input = h('input', { type: 'text', placeholder: f.placeholder || '', disabled: dis });
    input.value = get() ?? '';
    input.addEventListener(f.type === 'select' ? 'change' : 'input', () => { set(f.type === 'number' && input.value !== '' ? Number(input.value) : input.value); input._counter && input._counter._upd(); markDirty(); });
    return input;
  }

  function imageInput(f, get, set, path) {
    const dis = !editable(f);
    const box = h('div', { class: 'image-field' });
    const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif', style: { display: 'none' } });
    const draw = (meta) => {
      const id = get();
      box.replaceChildren(
        h('div', { class: 'thumb' }, id ? h('img', { src: `/api/assets/${id}`, alt: '' }) : h('span', { class: 'muted small' }, 'No image')),
        h('div', { class: 'info' }, id ? [h('b', {}, (meta && meta.filename) || 'Uploaded image'), meta ? `${meta.width} × ${meta.height}px` : ''] : [h('b', {}, 'Upload an image'), 'PNG, JPEG or GIF · max 8 MB · max 4096px per side']),
        !dis && h('div', { class: 'btn-group' }, h('button', { class: 'btn sm', type: 'button', onclick: () => file.click() }, id ? 'Replace' : 'Choose file'), id && h('button', { class: 'btn sm ghost danger', type: 'button', onclick: () => { set(''); draw(); markDirty(); } }, 'Remove')),
        file);
    };
    const upload = async (fileObj) => {
      if (!fileObj) return;
      if (!/^image\/(png|jpeg|gif)$/.test(fileObj.type)) return toast('Use a PNG, JPEG or GIF image', true);
      if (fileObj.size > 8 * 1024 * 1024) return toast('Images must be 8 MB or smaller', true);
      box.querySelector('.info').replaceChildren(h('b', {}, 'Uploading…'));
      const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(fileObj); });
      try {
        const meta = await api('POST', '/api/uploads', { filename: fileObj.name, data: dataUrl });
        set(meta.id); draw(meta); markDirty();
      } catch (ex) { toast(ex.message, true); draw(); }
    };
    file.addEventListener('change', () => upload(file.files[0]));
    if (!dis) {
      box.addEventListener('dragover', (e) => { e.preventDefault(); box.classList.add('drag'); });
      box.addEventListener('dragleave', () => box.classList.remove('drag'));
      box.addEventListener('drop', (e) => { e.preventDefault(); box.classList.remove('drag'); upload(e.dataTransfer.files[0]); });
    }
    draw();
    if (get()) api('GET', `/api/assets/${get()}/meta`).then(draw).catch(() => {});
    return box;
  }

  function colorInput(f, get, set) {
    const dis = !editable(f);
    const picker = h('input', { type: 'color', disabled: dis });
    const text = h('input', { type: 'text', placeholder: '#4F46E5', disabled: dis, maxlength: 7 });
    const sync = () => { text.value = get() || ''; picker.value = /^#[0-9a-f]{6}$/i.test(get()) ? get() : '#ffffff'; };
    picker.addEventListener('input', () => { set(picker.value.toUpperCase()); sync(); markDirty(); });
    text.addEventListener('input', () => { set(text.value.trim()); if (/^#[0-9a-f]{6}$/i.test(text.value)) picker.value = text.value; markDirty(); });
    sync();
    const wrap = h('div', { class: 'color-field' }, picker, text, !dis && h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { set(''); sync(); markDirty(); } }, 'Use template colour'));
    wrap._text = text;
    return wrap;
  }

  function moveItem(arr, i, d) { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }

  function listField(f) {
    const dis = !editable(f);
    const arr = data[f.key];
    if (!arr.length && !dis) for (let i = 0; i < Math.max(1, f.minItems || 1); i++) arr.push('');
    const rows = h('div', { class: 'list-rows' }, arr.map((v, i) => {
      const input = h('input', { type: 'text', value: v, disabled: dis, placeholder: (f.itemHints && f.itemHints[i]) || f.placeholder || '' });
      const err = h('div', { class: 'row-err' });
      const cnt = f.itemMaxLength ? h('span', { class: 'counter small muted', style: { minWidth: '52px', paddingTop: '10px', textAlign: 'right' } }) : null;
      const updCnt = () => { if (cnt) { cnt.textContent = `${input.value.length}/${f.itemMaxLength}`; cnt.style.color = input.value.length > f.itemMaxLength ? 'var(--red)' : ''; } };
      updCnt();
      input.addEventListener('input', () => { arr[i] = input.value; updCnt(); markDirty(); });
      register(`${f.key}.${i}`, input, err);
      return h('div', { class: 'list-row' }, h('span', { class: 'idx' }, String(i + 1).padStart(2, '0')), h('div', { class: 'grow' }, input, err), cnt,
        !dis && h('button', { class: 'btn icon ghost', type: 'button', title: 'Move up', disabled: i === 0, onclick: () => { moveItem(arr, i, -1); rerender(f); markDirty(); } }, ICONS.up),
        !dis && h('button', { class: 'btn icon ghost', type: 'button', title: 'Move down', disabled: i === arr.length - 1, onclick: () => { moveItem(arr, i, 1); rerender(f); markDirty(); } }, ICONS.down),
        !dis && h('button', { class: 'btn icon ghost danger', type: 'button', title: 'Remove', onclick: () => { arr.splice(i, 1); rerender(f); markDirty(); } }, ICONS.remove));
    }));
    const add = !dis && arr.length < f.maxItems ? h('button', { class: 'btn sm add-row', type: 'button', onclick: () => { arr.push(''); rerender(f); markDirty(); const ins = fieldBlocks.get(f.key).querySelectorAll('input'); ins[ins.length - 1]?.focus(); } }, `+ Add ${(f.itemLabel || 'item').toLowerCase()}`) : null;
    const cap = h('div', { class: 'help' }, `${arr.filter((x) => String(x).trim()).length} of max ${f.maxItems}`, f.minItems ? ` · min ${f.minItems}` : '');
    return [rows, add, cap];
  }

  function repeaterField(f) {
    const dis = !editable(f);
    const arr = data[f.key];
    const blankItem = () => Object.fromEntries(f.itemFields.map((s) => [s.key, s.type === 'number' ? '' : '']));
    if (f.layout === 'table') {
      const table = h('table', { class: 'grid-table' },
        h('thead', {}, h('tr', {}, f.itemFields.map((s) => h('th', {}, s.label)), h('th', { style: { textAlign: 'center' } }, 'Total'), h('th', {}))),
        h('tbody', {}, arr.map((item, i) => {
          const total = h('td', { class: 'total' });
          const updTotal = () => { total.textContent = (Number(item.engineering) || 0) + (Number(item.qa) || 0) + (Number(item.data_other) || 0); };
          updTotal();
          return h('tr', {},
            f.itemFields.map((s) => {
              const input = h('input', { type: s.type === 'month' ? 'month' : 'number', min: s.min, max: s.max, step: 1, value: item[s.key] ?? '', disabled: dis });
              const err = h('div', { class: 'cell-err' });
              input.addEventListener('input', () => { item[s.key] = s.type === 'number' && input.value !== '' ? Number(input.value) : input.value; updTotal(); markDirty(); });
              register(`${f.key}.${i}.${s.key}`, input, err);
              return h('td', {}, input, err);
            }),
            total,
            h('td', { style: { whiteSpace: 'nowrap' } }, !dis && h('button', { class: 'btn icon ghost danger', type: 'button', title: 'Remove month', onclick: () => { arr.splice(i, 1); rerender(f); markDirty(); } }, ICONS.remove)));
        })));
      const add = !dis && arr.length < f.maxItems ? h('button', {
        class: 'btn sm add-row', type: 'button', onclick: () => {
          const last = arr[arr.length - 1];
          const next = blankItem();
          const pm = last && parseMonth(last.month);
          if (pm) { const n = pm.index + 1; next.month = `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`; }
          else if (!last && parseMonth(data.period_start)) next.month = data.period_start;
          arr.push(next); rerender(f); markDirty();
        },
      }, '+ Add month') : null;
      return [table, add, h('div', { class: 'help' }, `${arr.length} of max ${f.maxItems} months`)];
    }
    const cards = arr.map((item, i) => h('div', { class: 'repeater-card' },
      h('div', { class: 'rc-head' }, `${f.itemLabel} ${i + 1}`, h('div', { class: 'spacer' }),
        !dis && h('button', { class: 'btn icon ghost', type: 'button', disabled: i === 0, title: 'Move up', onclick: () => { moveItem(arr, i, -1); rerender(f); markDirty(); } }, ICONS.up),
        !dis && h('button', { class: 'btn icon ghost', type: 'button', disabled: i === arr.length - 1, title: 'Move down', onclick: () => { moveItem(arr, i, 1); rerender(f); markDirty(); } }, ICONS.down),
        !dis && h('button', { class: 'btn icon ghost danger', type: 'button', title: 'Remove', onclick: () => { arr.splice(i, 1); rerender(f); markDirty(); } }, ICONS.remove)),
      h('div', { class: 'repeater-grid' }, f.itemFields.map((s) => {
        const path = `${f.key}.${i}.${s.key}`;
        const err = h('div', { class: 'err' });
        const get = () => item[s.key], set = (v) => { item[s.key] = v; };
        const sub = { ...s, adminOnly: f.adminOnly };
        const input = s.type === 'image' ? imageInput(sub, get, set, path) : scalarInput(sub, get, set, path);
        const cnt = counter(s, () => String(item[s.key] ?? ''));
        if (cnt) input._counter = cnt;
        register(path, s.type === 'image' ? input : input, err);
        return h('div', { class: 'field', style: s.type === 'image' ? { gridColumn: '1 / -1' } : null },
          h('label', { class: 'lbl' }, s.label, s.required ? h('span', { class: 'req' }, '*') : h('span', { class: 'opt' }, 'optional'), cnt), input, err);
      }))));
    const add = !dis && arr.length < f.maxItems ? h('button', { class: 'btn sm add-row', type: 'button', onclick: () => { arr.push(blankItem()); rerender(f); markDirty(); } }, `+ Add ${(f.itemLabel || 'item').toLowerCase()}`) : null;
    return [cards, add, h('div', { class: 'help' }, `${arr.length} of max ${f.maxItems}`)];
  }

  function fieldBlock(f) {
    for (const k of [...registry.keys()]) if (k === f.key || k.startsWith(f.key + '.')) registry.delete(k);
    const err = h('div', { class: 'err' });
    const required = f.required || (f.adminOnly && f.requiredForGeneration);
    let control, cnt = null;
    const get = () => data[f.key], set = (v) => { data[f.key] = v; };
    if (f.type === 'list') control = listField(f);
    else if (f.type === 'repeater') control = repeaterField(f);
    else if (f.type === 'image') control = imageInput(f, get, set, f.key);
    else if (f.type === 'color') control = colorInput(f, get, set);
    else { control = scalarInput(f, get, set, f.key); cnt = counter(f, () => String(data[f.key] ?? '')); control._counter = cnt; }
    register(f.key, f.type === 'color' ? control._text : !Array.isArray(control) ? control : null, err);
    const block = h('div', { class: `field ${flagged.has(f.key) ? 'flagged' : ''}`, id: `f-${f.key}` },
      h('div', { class: 'lbl' }, f.label, required ? h('span', { class: 'req', title: 'Required' }, '*') : f.requiredIf ? h('span', { class: 'opt' }, 'required when completed') : h('span', { class: 'opt' }, 'optional'),
        flagged.has(f.key) && h('span', { class: 'chip warn' }, 'Flagged by admin'), cnt),
      control, err, f.help && h('div', { class: 'help' }, f.help),
      f.key === 'monthly_deployment' && derivedBox);
    fieldBlocks.set(f.key, block);
    return block;
  }
  function rerender(f) { const old = fieldBlocks.get(f.key); const nb = fieldBlock(f); old.replaceWith(nb); refreshErrors(); }

  // ---------- derived figures (staffing)
  const derivedBox = h('div', {});
  function updateDerived() {
    if (t.id !== 'staffing') return;
    const d = derive(t.id, data);
    const rows = (data.monthly_deployment || []).filter((r) => parseMonth(r.month));
    const totals = rows.map((r) => (Number(r.engineering) || 0) + (Number(r.qa) || 0) + (Number(r.data_other) || 0));
    const max = Math.max(1, ...totals);
    derivedBox.replaceChildren(
      h('div', { class: 'derived-box' }, t.derived.map((x) => h('div', {}, h('b', {}, d[x.key] || '—'), h('span', {}, x.label)))),
      rows.length ? h('div', {}, h('div', { class: 'mini-chart', 'aria-label': 'Preview of the deployment chart' }, rows.map((r) => h('div', { class: 'bar' },
        [['engineering', '#2f6fd0'], ['qa', '#7ea6e0'], ['data_other', '#c3cde6']].map(([k, c]) => h('i', { style: { height: `${((Number(r[k]) || 0) / max) * 96}px`, background: c } }))))),
        h('div', { class: 'mini-chart-labels' }, rows.map((r) => h('span', {}, monthLabel(r.month, false))))) : null,
      h('div', { class: 'help' }, 'These figures and the chart are calculated from the table and the reporting period — they appear in the Engagement Snapshot, Scaling at a Glance and chart.'));
  }

  // ---------- layout
  const sections = t.sections.filter((s) => t.fields.some((f) => f.section === s.key));
  const sectionEls = sections.map((s) => h('section', { class: 'card form-section', id: `s-${s.key}` },
    h('div', { class: 'card-head' }, h('h3', {}, s.title, s.adminOnly && h('span', { class: 'role-pill admin', style: { marginLeft: '8px' } }, 'Admin')), h('div', { class: 'appears' }, `Appears in: ${s.appearsIn}`)),
    h('div', { class: 'fields' }, t.fields.filter((f) => f.section === s.key).map(fieldBlock))));

  const toc = h('div', { class: 'toc' });
  const progress = h('div', { class: 'progress' }, h('span', {}));
  const progressText = h('div', { class: 'small muted' });
  function updateSide() {
    const req = validate(t, data, admin ? 'generate' : 'submit');
    const sectionHasErr = (s) => t.fields.some((f) => f.section === s.key && Object.keys(req).some((k) => k === f.key || k.startsWith(f.key + '.')));
    toc.replaceChildren(...sections.map((s) => h('a', { href: `#s-${s.key}`, onclick: (e) => { e.preventDefault(); document.getElementById(`s-${s.key}`).scrollIntoView({ behavior: 'smooth' }); } }, h('span', { class: `dot ${sectionHasErr(s) ? (showAll ? 'err' : '') : 'done'}` }), s.title)));
    const reqFields = t.fields.filter((f) => (f.required || (admin && f.requiredForGeneration)));
    const ok = reqFields.filter((f) => !Object.keys(req).some((k) => k === f.key || k.startsWith(f.key + '.'))).length;
    progress.firstChild.style.width = `${Math.round((ok / Math.max(1, reqFields.length)) * 100)}%`;
    progressText.textContent = `${ok} of ${reqFields.length} required items complete`;
  }

  const side = h('aside', { class: 'side' },
    h('div', { class: 'card card-pad' }, h('h3', {}, 'Sections'), progress, progressText, h('div', { style: { marginTop: '12px' } }, toc)),
    h('div', { class: 'card card-pad small muted' }, h('b', { style: { color: 'var(--ink)' } }, 'You only provide the information.'), h('div', { style: { marginTop: '4px' } },
      `Layout, typography and visuals come from the approved “${t.name}” Figma template. Character limits match the space available in the template.`)));

  // ---------- save bar
  const stateEl = h('span', { class: 'state' }, 'All changes saved');
  async function save(quiet) {
    try {
      const updated = await api('PUT', `/api/case-studies/${cs.id}`, { data });
      state.dirty = false; stateEl.textContent = `Saved ${new Date().toLocaleTimeString()}`; stateEl.className = 'state';
      if (!quiet) toast('Saved');
      return updated;
    } catch (ex) {
      if (ex.data && ex.data.errors) showErrors(ex.data.errors);
      toast(ex.message, true);
      throw ex;
    }
  }
  function showErrors(errs) {
    showAll = true; refreshErrors(true);
    for (const [path, msg] of Object.entries(errs)) { const r = registry.get(path); if (r && r.err) r.err.textContent = msg; if (r && r.input) r.input.classList.add('invalid'); }
    updateSide();
    const first = Object.keys(errs)[0];
    const el = first && (document.getElementById(`f-${first.split('.')[0]}`));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  formApi = { showErrors };

  const submitBtn = p.submit && h('button', {
    class: 'btn primary', onclick: async (e) => {
      const errs = validate(t, data, 'submit');
      if (Object.keys(errs).length) { showErrors(errs); toast(`Complete the highlighted fields (${Object.keys(errs).length})`, true); return; }
      e.target.disabled = true;
      try {
        await save(true);
        await api('POST', `/api/case-studies/${cs.id}/submit`);
        toast('Submitted for review'); render();
      } catch (ex) { if (ex.data && ex.data.errors) showErrors(ex.data.errors); toast(ex.message, true); } finally { e.target.disabled = false; }
    },
  }, cs.status === 'changes_requested' ? 'Resubmit for review' : 'Submit for review');

  const bar = h('div', { class: 'savebar' }, h('div', { class: 'savebar-inner' }, stateEl, h('div', { class: 'spacer' }),
    admin && cs.status !== 'draft' && h('span', { class: 'small muted' }, cs.status === 'generated' ? 'Saving marks the preview as out of date.' : ''),
    h('button', { class: 'btn', onclick: () => save() }, cs.status === 'draft' || cs.status === 'changes_requested' ? 'Save draft' : 'Save changes'),
    submitBtn));

  setTimeout(() => { refreshErrors(); updateSide(); updateDerived(); }, 0);
  return h('div', {}, h('div', { class: 'layout-2' }, h('div', {}, sectionEls), side), bar);
}

// ============================================================ admin: templates
const CAPABILITIES = [
  ['ok', 'Read template structure (frames, text layers, image placeholders, components)'],
  ['ok', 'Duplicate the master into a "Generated Case Studies" page — masters are never edited'],
  ['ok', 'Update text (keeping mixed styles), component properties and image fills'],
  ['ok', 'Rebuild the native stacked-bar chart (bars, totals, markers, axis)'],
  ['ok', 'Export each generated frame as PNG and PDF'],
  ['warn', 'Runs inside Figma desktop: an admin must have the template file open with the plugin running. Figma\'s REST API cannot write to files, so there is no headless option.'],
];

async function viewTemplates() {
  const { templates, pluginToken, serverUrl } = await api('GET', '/api/admin/templates');
  const statusChip = (s) => h('span', { class: `chip ${s === 'Ready' ? 'ok' : s === 'Not synced' ? 'neutral' : 'bad'}` }, s);
  const copy = (text) => h('button', { class: 'btn sm', onclick: () => navigator.clipboard.writeText(text).then(() => toast('Copied')) }, 'Copy');
  return h('div', {},
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Template management'), h('div', { class: 'sub' }, 'The two approved TechStalwarts case study templates and how the app maps data onto them.'))),
    h('div', { class: 'card', style: { marginBottom: '24px' } },
      h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Template'), h('th', {}, 'Figma file reference'), h('th', {}, 'Status'), h('th', {}, 'Last synced'), h('th', {}, 'Mapped fields'), h('th', {}))),
        h('tbody', {}, templates.map((t) => h('tr', {},
          h('td', {}, h('div', { class: 'title-cell' }, t.name), t.thumbnails.length ? h('div', { class: 'tpl-thumbs', style: { marginTop: '8px' } }, t.thumbnails.map((th) => h('img', { src: `/api/thumbnails/${th.file}`, alt: '' }))) : null),
          h('td', {}, h('div', {}, t.figma.fileName), h('div', { class: 'mono muted' }, `${t.figma.fileKey}`), h('div', { class: 'mono muted' }, `Section ${t.figma.sectionId} · ${t.figma.frames.length} frame${t.figma.frames.length > 1 ? 's' : ''}`), h('a', { href: t.figmaUrl, target: '_blank', rel: 'noopener', class: 'small' }, 'Open in Figma ↗')),
          h('td', {}, statusChip(t.status), t.problems ? h('div', { class: 'small', style: { color: 'var(--red)', marginTop: '4px' } }, `${t.problems} layer problem${t.problems > 1 ? 's' : ''}`) : null),
          h('td', { class: 'muted' }, t.lastSyncedAt ? fmtDate(t.lastSyncedAt) : 'Never'),
          h('td', {}, `${t.mappedFields} / ${t.totalFields}`, h('div', { class: 'muted small' }, `${t.bindings} layer bindings`)),
          h('td', {}, h('div', { class: 'btn-group', style: { flexDirection: 'column', alignItems: 'stretch' } },
            h('a', { class: 'btn sm', href: `#/templates/${t.id}` }, 'Review mappings'),
            h('button', { class: 'btn sm', onclick: () => syncHelp() }, 'Sync from Figma'),
            h('button', { class: 'btn sm', onclick: () => referenceModal(t) }, 'Update reference'),
            h('button', {
              class: 'btn sm', onclick: async (e) => {
                e.target.disabled = true;
                try { const cs = await api('POST', `/api/admin/templates/${t.id}/test`); toast('Test generation queued'); location.hash = `#/cs/${cs.id}`; } catch (ex) { toast(ex.message, true); e.target.disabled = false; }
              },
            }, 'Test generation')))))))),
    h('div', { class: 'layout-2', style: { gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' } },
      h('div', { class: 'card card-pad' }, h('h3', {}, 'Figma plugin setup'),
        h('p', { class: 'muted small' }, 'Population happens through the bundled Figma plugin, which runs inside Figma desktop with the template file open.'),
        h('ol', { class: 'steps small' },
          h('li', {}, 'In Figma desktop, open ', h('b', {}, templates[0].figma.fileName), '.'),
          h('li', {}, 'Plugins → Development → Import plugin from manifest… → choose ', h('span', { class: 'mono' }, 'figma-plugin/manifest.json'), ' from this project.'),
          h('li', {}, 'Run ', h('b', {}, 'TechStalwarts Case Study Generator'), ', paste the server URL and token below, then press Connect.'),
          h('li', {}, 'Use ', h('b', {}, 'Sync templates'), ' to verify mappings, and ', h('b', {}, 'Process queue'), ' to generate queued case studies.')),
        h('div', { class: 'field' }, h('div', { class: 'lbl' }, 'Server URL'), h('div', { class: 'token-box' }, h('code', { class: 'mono' }, serverUrl), copy(serverUrl))),
        h('div', { class: 'field' }, h('div', { class: 'lbl' }, 'Plugin token'), h('div', { class: 'token-box' }, h('code', { class: 'mono' }, pluginToken), copy(pluginToken)))),
      h('div', { class: 'card card-pad' }, h('h3', { style: { marginBottom: '10px' } }, 'Figma integration capabilities'),
        h('div', { class: 'capability' }, CAPABILITIES.flatMap(([k, text]) => [h('span', {}, k === 'ok' ? '✅' : '⚠️'), h('span', {}, text)])))));
}

function syncHelp() {
  modal({
    title: 'Sync template structure', subtitle: 'Sync runs in Figma, where the template lives.',
    body: h('ol', { class: 'steps' }, h('li', {}, 'Open the template file in Figma desktop.'), h('li', {}, 'Run the TechStalwarts Case Study Generator plugin.'), h('li', {}, 'Press ', h('b', {}, 'Sync templates'), '. The plugin checks every mapped layer and uploads fresh thumbnails; this page shows the result.')),
    foot: (close) => h('button', { class: 'btn primary', onclick: () => { close(); render(); } }, 'Refresh status'),
  });
}

function referenceModal(t) {
  const fileKey = h('input', { type: 'text', value: t.figma.fileKey });
  const fileName = h('input', { type: 'text', value: t.figma.fileName });
  const sectionId = h('input', { type: 'text', value: t.figma.sectionId });
  const frames = t.figma.frames.map((f) => ({ f, input: h('input', { type: 'text', value: f.id }) }));
  const err = h('div', { class: 'err' });
  const fld = (label, input, help) => h('div', { class: 'field' }, h('label', { class: 'lbl' }, label), input, help && h('div', { class: 'help' }, help));
  modal({
    title: `Update reference — ${t.name}`, subtitle: 'Point the app at a moved or duplicated copy of the approved template. Duplicated Figma files keep their layer IDs, so mappings carry over; re-sync afterwards.',
    body: h('div', {}, fld('Figma file key', fileKey, 'From the URL: figma.com/design/<file key>/…'), fld('File name', fileName),
      fld('Template section node ID', sectionId), frames.map(({ f, input }) => fld(`Frame: ${f.label || f.name}`, input)), err),
    foot: (close) => [h('button', { class: 'btn', onclick: close }, 'Cancel'), h('button', {
      class: 'btn primary', onclick: async () => {
        try {
          await api('PUT', `/api/admin/templates/${t.id}/reference`, { fileKey: fileKey.value.trim(), fileName: fileName.value.trim(), sectionId: sectionId.value.trim(), frames: frames.map(({ input }) => ({ id: input.value.trim() })) });
          close(); toast('Reference updated — run Sync in the plugin'); render();
        } catch (ex) { err.textContent = ex.message; }
      },
    }, 'Save reference')],
  });
}

async function viewTemplateDetail(id) {
  const res = await api('GET', `/api/admin/templates/${id}`);
  const { summary } = res;
  let mapping = res.mapping;
  const tableBody = h('tbody', {});
  const typeLabel = { text: 'Text', tokens: 'Text placeholders', props: 'Component properties', image: 'Image fill', fill: 'Colour fill', hide: 'Hidden in copies', slots: 'Fixed list', twoColumnList: 'Two-column list', chips: 'Tags (grow)', cards: 'Metric cards', logos: 'Logo row', stackedBar: 'Stacked bar chart' };
  const drawRows = () => tableBody.replaceChildren(...mapping.map((b) => h('tr', {},
    h('td', {}, h('b', {}, b.layer), h('div', { class: 'muted small' }, typeLabel[b.type] || b.type), b.note && h('div', { class: 'small muted' }, b.note)),
    h('td', {}, b.fields.length ? b.fields.map((f) => h('div', {}, f.label, h('span', { class: 'mono muted' }, ` ${f.key}`))) : h('span', { class: 'muted' }, '—')),
    h('td', {}, b.nodes.slice(0, 40).map((n) => {
      const input = h('input', { value: n.nodeId, 'aria-label': `${b.layer} ${n.path}` });
      const st = n.status;
      const dot = h('span', { class: `status-dot ${!st ? 'unk' : st.exists && st.insideTemplate !== false ? 'ok' : 'bad'}`, title: !st ? 'Not synced' : st.exists ? `${st.type} "${st.name}"${st.insideTemplate === false ? ' — outside the template frames' : ''}` : 'Not found in Figma' });
      return h('div', { class: 'node-edit' }, dot, h('span', { class: 'path mono' }, n.path), input,
        h('button', {
          class: 'btn sm ghost', title: 'Save layer reference', onclick: async () => {
            try { const r = await api('PUT', `/api/admin/templates/${id}/nodes`, { bindingId: b.id, path: n.path, nodeId: input.value.trim() }); mapping = r.mapping; drawRows(); toast('Mapping updated — re-sync to verify'); } catch (ex) { toast(ex.message, true); }
          },
        }, 'Save'), n.overridden && h('span', { class: 'chip warn' }, 'edited'),
        st && st.exists && h('span', { class: 'small muted', style: { maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, st.name));
    })))));
  drawRows();
  return h('div', {},
    h('div', { class: 'page-head' }, h('div', {}, h('a', { href: '#/templates', class: 'small' }, '← Templates'), h('h1', { style: { marginTop: '6px' } }, `${summary.name} — field mappings`),
      h('div', { class: 'sub' }, `${summary.mappedFields} of ${summary.totalFields} form fields mapped onto ${summary.bindings} template layer bindings · `, summary.lastSyncedAt ? `last synced ${fmtDate(summary.lastSyncedAt)}` : 'not synced yet')),
      h('div', { class: 'spacer' }), h('a', { class: 'btn', href: summary.figmaUrl, target: '_blank', rel: 'noopener' }, 'Open template in Figma ↗')),
    summary.thumbnails.length ? h('div', { class: 'row wrap', style: { marginBottom: '20px', alignItems: 'flex-start' } }, summary.thumbnails.map((th) => h('img', { src: `/api/thumbnails/${th.file}`, alt: '', style: { height: '180px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff' } }))) : null,
    !summary.lastSyncedAt && h('div', { class: 'banner blue' }, h('div', {}, h('strong', {}, 'Not synced yet'), 'Run "Sync templates" in the Figma plugin to verify that every mapped layer exists in the template.')),
    h('div', { class: 'card' }, h('table', { class: 'table mapping-table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Template element'), h('th', {}, 'Data field'), h('th', {}, 'Figma layer IDs (sync status)'))), tableBody)));
}

render();
