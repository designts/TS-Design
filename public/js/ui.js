// Small DOM toolkit + the shared UI components (ported from the reference app).
import { STATUS_LABELS, caseStudyTypeShort, projectTypeShort } from '/shared/catalog.js';

export const cx = (...c) => c.filter(Boolean).join(' ');
let uid = 0;
export const useId = (p = 'f') => `${p}${++uid}`;

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class' || k === 'className') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'value' && (tag === 'input' || tag === 'textarea' || tag === 'select')) el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}
export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false || c === '') continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// ------------------------------------------------------------------ navigation
export function navigate(href, { replace = false } = {}) {
  if (window.__beforeNavigate && !window.__beforeNavigate()) return;
  history[replace ? 'replaceState' : 'pushState']({}, '', href);
  window.dispatchEvent(new Event('app:navigate'));
}
/** Re-render the current route (no dirty-check). */
export const refresh = () => window.dispatchEvent(new Event('app:navigate'));
export function link(href, props, ...children) {
  return h('a', { ...props, href, onClick: (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || props?.target) return;
    e.preventDefault();
    if (props?.onClick) props.onClick(e);
    navigate(href);
  } }, ...children);
}

// ------------------------------------------------------------------ icons
const ICON_PATHS = {
  grid: 'M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z', folder: 'M2.5 5.5a1.5 1.5 0 0 1 1.5-1.5h3.6l1.8 2H16a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5z',
  layers: 'M10 2.5 2.5 6.5 10 10.5l7.5-4zM2.5 10 10 14l7.5-4M2.5 13.5 10 17.5l7.5-4', plus: 'M10 4v12M4 10h12',
  sparkle: 'M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6zM15.5 13l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z',
  menu: 'M3 5h14M3 10h14M3 15h14', x: 'M5 5l10 10M15 5 5 15', search: 'M8.5 14a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM17 17l-4.2-4.2',
  copy: 'M7 7h9v9H7zM4 13V4h9', edit: 'M13.5 3.5l3 3L7 16H4v-3z', trash: 'M4 6h12M8 6V4h4v2M5.5 6l.8 10h7.4l.8-10',
  arrowRight: 'M4 10h12M11 5l5 5-5 5', arrowLeft: 'M16 10H4M9 5l-5 5 5 5', chevronUp: 'M5 12.5 10 7.5l5 5', chevronDown: 'M5 7.5l5 5 5-5', check: 'M4 10.5l4 4 8-9',
  eye: 'M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6zM10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  eyeOff: 'M3 3l14 14M8.2 4.2A8.6 8.6 0 0 1 10 4c5.5 0 8.5 6 8.5 6a14 14 0 0 1-2.4 3.1M5.3 5.9C3 7.5 1.5 10 1.5 10s3 6 8.5 6a8 8 0 0 0 3.6-.9',
  image: 'M3 4h14v12H3zM3 13l4-4 3 3 2-2 5 5M13.5 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  link: 'M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-.9.9M11.5 8.5a3 3 0 0 0-4.2 0L4.7 11.1a3 3 0 0 0 4.2 4.2l.9-.9',
  info: 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM10 9v5M10 6.2v.1', upload: 'M10 13V3M6 7l4-4 4 4M3.5 13v3.5h13V13', file: 'M5 2.5h6.5L15 6v11.5H5zM11.5 2.5V6H15',
  lock: 'M5 9h10v8.5H5zM7 9V6.5a3 3 0 0 1 6 0V9', download: 'M10 3v10M6 9l4 4 4-4M3.5 13.5v3h13v-3', alert: 'M10 3 1.5 17h17zM10 8v4M10 14.5v.1',
};
export function icon(name, { size = 18, className = '' } = {}) {
  const NS = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ 'aria-hidden': 'true', width: size, height: size, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: `shrink-0 ${className}` })) s.setAttribute(k, v);
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', ICON_PATHS[name]);
  s.append(p);
  return s;
}

// ------------------------------------------------------------------ toast + confirm
export function toast(message, variant = 'success') {
  const box = document.getElementById('toasts');
  const el = h('div', { class: 'pointer-events-auto flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-800 px-4 py-3 text-sm shadow-2xl shadow-black/50' },
    h('span', { class: variant === 'error' ? 'grid h-6 w-6 place-items-center rounded-full bg-accent-soft text-accent' : 'grid h-6 w-6 place-items-center rounded-full bg-success-soft text-success' }, icon(variant === 'error' ? 'alert' : 'check', { size: 14 })),
    message);
  box.append(el);
  setTimeout(() => el.remove(), variant === 'error' ? 6000 : 3500);
}

export function confirmDialog({ title, body, confirmLabel, extra }) {
  return new Promise((resolve) => {
    const close = (v) => { root.remove(); window.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => e.key === 'Escape' && close(false);
    const cancel = h('button', { class: 'btn-secondary', onClick: () => close(false) }, 'Cancel');
    const root = h('div', { class: 'fixed inset-0 z-50 grid place-items-center p-4', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'confirm-title', 'aria-describedby': 'confirm-body' },
      h('div', { class: 'absolute inset-0 bg-black/70', onClick: () => close(false) }),
      h('div', { class: 'relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-ink-700 bg-ink-850 p-6 shadow-2xl' },
        h('h2', { id: 'confirm-title', class: 'text-lg' }, title),
        h('p', { id: 'confirm-body', class: 'mt-2 text-sm text-fg-muted' }, body),
        extra,
        h('div', { class: 'mt-6 flex justify-end gap-2' }, cancel, h('button', { class: 'btn-danger', onClick: () => close(true) }, confirmLabel))));
    document.body.append(root);
    window.addEventListener('keydown', onKey);
    cancel.focus();
  });
}

// ------------------------------------------------------------------ badges / small bits
export const CaseTypeBadge = (type) => h('span', { class: 'inline-flex items-center gap-1.5 rounded-md border border-accent-line bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent' }, icon('layers', { size: 12 }), caseStudyTypeShort(type));
export const ProjectTypeBadge = (type) => h('span', { class: 'inline-flex shrink-0 items-center rounded-md border border-ink-700 bg-ink-850 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-fg-muted' }, projectTypeShort(type));
export const StatusBadge = (status) => h('span', { class: cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', status === 'completed' ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning') },
  h('span', { class: cx('h-1.5 w-1.5 rounded-full', status === 'completed' ? 'bg-success' : 'bg-warning') }), STATUS_LABELS[status]);
export const Pill = (text) => h('span', { class: 'rounded-full bg-ink-800 px-2.5 py-1 text-xs text-fg-muted' }, text);

export function PageHeader({ eyebrow, title, description, actions }) {
  return h('div', { class: 'mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between' },
    h('div', { class: 'max-w-2xl' },
      eyebrow && h('div', { class: 'eyebrow mb-3 flex items-center gap-2' }, h('span', { class: 'h-px w-6 bg-accent' }), eyebrow),
      h('h1', { class: 'text-3xl leading-tight sm:text-4xl' }, title),
      description && h('p', { class: 'mt-3 text-fg-muted' }, description)),
    actions && h('div', { class: 'flex flex-wrap gap-2' }, actions));
}
export const EmptyState = ({ title, body, action }) => h('div', { class: 'surface px-6 py-14 text-center' }, h('h3', { class: 'text-lg' }, title), h('p', { class: 'mx-auto mt-2 max-w-md text-sm text-fg-muted' }, body), action && h('div', { class: 'mt-6' }, action));

export function SearchInput({ value, onInput, placeholder, label }) {
  return h('label', { class: 'relative block w-full' }, h('span', { class: 'sr-only' }, label),
    icon('search', { className: 'pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-subtle' }),
    h('input', { class: 'input pl-10', value, placeholder, onInput: (e) => onInput(e.target.value) }));
}

export function BrowserFrame({ src, caption, className = '' }) {
  return h('figure', { class: cx('overflow-hidden rounded-xl border border-ink-700 bg-ink-850', className) },
    h('div', { class: 'flex items-center gap-1.5 border-b border-ink-700 px-3 py-2' }, h('span', { class: 'h-2 w-2 rounded-full bg-accent/80' }), h('span', { class: 'h-2 w-2 rounded-full bg-ink-600' }), h('span', { class: 'h-2 w-2 rounded-full bg-ink-600' })),
    src ? h('img', { src, alt: caption || '', class: 'aspect-[16/10] w-full object-cover' })
      : h('div', { class: 'grid aspect-[16/10] place-items-center bg-[radial-gradient(circle_at_30%_20%,#2a1416_0%,transparent_55%)] text-fg-subtle' },
        h('div', { class: 'flex flex-col items-center gap-2 px-6 text-center text-xs' }, icon('image', { size: 28 }), 'Product visual placeholder')),
    caption && h('figcaption', { class: 'border-t border-ink-700 px-3 py-2 text-xs text-fg-subtle' }, caption));
}

// ------------------------------------------------------------------ field wrapper
/** Label + counter + control + message. Returns the wrapper with .setError(msg) and .setCount(n). */
export function Field({ label, hint, error, required, className, limit, id, children, count }) {
  const counter = limit && count !== undefined ? h('span', { class: 'mb-1.5 shrink-0 text-[11px] tabular-nums', 'aria-live': 'polite' }) : null;
  const msg = h('p', { id: `${id}-msg`, class: 'mt-1.5 text-xs' });
  const hintText = [hint, limit ? (limit.min ? `${limit.min}–${limit.max.toLocaleString()} characters` : `Up to ${limit.max.toLocaleString()} characters`) : undefined].filter(Boolean).join(' · ');
  const wrap = h('div', { class: className },
    h('div', { class: 'flex items-baseline justify-between gap-3' }, h('label', { for: id, class: 'label' }, label, required && h('span', { class: 'ml-0.5 text-accent' }, '*')), counter),
    children, msg);
  wrap.setError = (e) => {
    msg.textContent = e || hintText;
    msg.className = cx('mt-1.5 text-xs', e ? 'text-accent' : 'text-fg-subtle');
    msg.hidden = !e && !hintText;
    wrap.querySelectorAll('input.input,textarea.input,button.input').forEach((x) => x.setAttribute('aria-invalid', e ? 'true' : 'false'));
  };
  wrap.setCount = (n) => {
    if (!counter) return;
    const warn = n > 0.9 * limit.max || (limit.min && n > 0 && n < limit.min);
    counter.textContent = `${n.toLocaleString()} / ${limit.max.toLocaleString()}`;
    counter.className = cx('mb-1.5 shrink-0 text-[11px] tabular-nums', warn ? 'text-warning' : 'text-fg-subtle');
  };
  wrap.setError(error);
  if (count !== undefined) wrap.setCount(count);
  return wrap;
}

export function TextInput({ value = '', onChange, placeholder, inputMode, ...f }) {
  const id = useId();
  const input = h('input', { id, class: 'input', value, placeholder, inputmode: inputMode, maxlength: f.limit ? f.limit.max + (value.length - value.trim().length) : undefined, 'aria-required': f.required ? 'true' : undefined, 'aria-describedby': `${id}-msg` });
  const wrap = Field({ ...f, id, count: f.limit ? value.trim().length : undefined, children: input });
  input.addEventListener('input', () => { if (f.limit) input.maxLength = f.limit.max + (input.value.length - input.value.trim().length); wrap.setCount(input.value.trim().length); onChange(input.value); });
  return wrap;
}
export function TextArea({ value = '', onChange, placeholder, rows = 3, ...f }) {
  const id = useId();
  const ta = h('textarea', { id, class: 'input resize-y leading-relaxed', rows, placeholder, maxlength: f.limit ? f.limit.max + (value.length - value.trim().length) : undefined, 'aria-describedby': `${id}-msg` });
  ta.value = value;
  const wrap = Field({ ...f, id, count: f.limit ? value.trim().length : undefined, children: ta });
  ta.addEventListener('input', () => { if (f.limit) ta.maxLength = f.limit.max + (ta.value.length - ta.value.trim().length); wrap.setCount(ta.value.trim().length); onChange(ta.value); });
  return wrap;
}
/** One item per line → string[] */
export function LinesArea({ value = [], onChange, placeholder, rows = 4, limit, hint, ...f }) {
  const each = limit ? (limit.min ? `${limit.min}–${limit.max} characters each` : `up to ${limit.max} characters each`) : '';
  return TextArea({ ...f, rows, placeholder, value: value.join('\n'), hint: [hint ?? 'One per line', each].filter(Boolean).join(' · '), onChange: (s) => onChange(s.split('\n').map((x) => x.trim()).filter(Boolean)) });
}

/** Free-text chips (Enter or comma adds). */
export function TagInput({ value = [], onChange, placeholder = 'Type and press Enter', maxLength, ...f }) {
  const id = useId();
  let tags = [...value];
  const box = h('div', { class: 'input flex min-h-[44px] flex-wrap items-center gap-1.5 py-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25' });
  const input = h('input', { id, class: 'min-w-[8rem] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-fg-subtle', maxlength: maxLength });
  const draw = () => {
    box.replaceChildren(...tags.map((t) => h('span', { class: 'inline-flex items-center gap-1 rounded-md bg-ink-750 py-0.5 pr-1 pl-2 text-xs' }, t,
      h('button', { type: 'button', class: 'rounded p-0.5 text-fg-subtle hover:text-fg', 'aria-label': `Remove ${t}`, onClick: () => { tags = tags.filter((x) => x !== t); onChange(tags); draw(); } }, icon('x', { size: 12 })))), input);
    input.placeholder = tags.length ? '' : placeholder;
  };
  const add = (v) => { const s = v.trim(); if (s && !tags.includes(s)) { tags = [...tags, s]; onChange(tags); } input.value = ''; draw(); input.focus(); };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input.value); }
    else if (e.key === 'Backspace' && !input.value && tags.length) { tags = tags.slice(0, -1); onChange(tags); draw(); input.focus(); }
  });
  input.addEventListener('blur', () => input.value && add(input.value));
  draw();
  return Field({ ...f, id, children: box });
}

// ------------------------------------------------------------------ dropdowns
function useOutside(root, close) {
  const onDown = (e) => { if (!root.contains(e.target)) close(); };
  document.addEventListener('mousedown', onDown);
  return () => document.removeEventListener('mousedown', onDown);
}
function filterOptions(options, query, allowCustom) {
  const q = query.trim().toLowerCase();
  const list = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const exact = options.some((o) => o.label.toLowerCase() === q);
  return [...list, ...(allowCustom && q && !exact ? [{ value: query.trim(), label: `Use “${query.trim()}”`, hint: 'Custom value' }] : [])];
}
function optionList(items, { isSelected, onPick, multi }) {
  if (!items.length) return h('ul', { role: 'listbox', class: 'max-h-64 overflow-y-auto py-1' }, h('li', { class: 'px-3 py-2 text-sm text-fg-subtle' }, 'No matches'));
  return h('ul', { role: 'listbox', 'aria-multiselectable': multi ? 'true' : undefined, class: 'max-h-64 overflow-y-auto py-1' }, items.map((o, i) => {
    const sel = isSelected(o.value);
    return h('li', { role: 'option', 'aria-selected': String(sel), 'data-index': i, tabindex: '-1', onMousedown: (e) => e.preventDefault(), onClick: () => onPick(o),
      class: cx('mx-1 flex cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm hover:bg-ink-750 hover:text-fg', sel ? 'text-fg' : 'text-fg-muted') },
      h('span', { class: 'flex min-w-0 items-center gap-2.5' },
        multi && h('span', { class: cx('grid h-4 w-4 shrink-0 place-items-center rounded border', sel ? 'border-accent bg-accent text-white' : 'border-ink-600') }, sel && icon('check', { size: 11 })),
        h('span', { class: 'truncate' }, o.label), o.hint && h('span', { class: 'shrink-0 text-xs text-fg-subtle' }, o.hint)),
      !multi && sel && icon('check', { size: 15, className: 'shrink-0 text-accent' }));
  }));
}
function keyNav(e, panel) {
  const opts = [...panel.querySelectorAll('[role=option]')];
  if (!opts.length) return;
  const cur = opts.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); opts[Math.min(opts.length - 1, cur + 1)].focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); (cur <= 0 ? null : opts[cur - 1])?.focus(); }
  else if ((e.key === 'Enter' || e.key === ' ') && cur >= 0) { e.preventDefault(); opts[cur].click(); }
}

/** Single select with optional search / custom values. */
export function Select({ value, onChange, options, searchable, allowCustom, placeholder = 'Select…', hideLabel, size, ...f }) {
  const id = useId();
  let current = value;
  let open = false;
  let unbind = () => {};
  const root = h('div', { class: cx('relative', f.className) });
  const valueText = h('span', { class: 'truncate' });
  const chevron = icon('chevronDown', { size: 16, className: 'shrink-0 text-fg-subtle transition' });
  const button = h('button', { type: 'button', class: cx('input flex items-center justify-between gap-2 text-left', size === 'sm' && 'py-2'), 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-labelledby': `${id}-label ${id}-value`, 'aria-describedby': `${id}-msg` }, valueText, chevron);
  valueText.id = `${id}-value`;
  const allOptions = () => (current && !options.some((o) => o.value === current) ? [{ value: current, label: current, hint: 'Saved value' }, ...options] : options);
  const drawValue = () => {
    const o = allOptions().find((x) => x.value === current);
    valueText.textContent = o ? o.label : placeholder;
    valueText.className = cx('truncate', !o && 'text-fg-subtle');
  };
  let panel;
  const close = () => { open = false; panel?.remove(); unbind(); button.setAttribute('aria-expanded', 'false'); button.classList.remove('border-accent', 'ring-2', 'ring-accent/25'); chevron.classList.remove('rotate-180', 'text-fg'); };
  const pick = (o) => { current = o.value; drawValue(); close(); onChange(o.value); button.focus(); };
  const openPanel = () => {
    open = true;
    button.setAttribute('aria-expanded', 'true'); button.classList.add('border-accent', 'ring-2', 'ring-accent/25'); chevron.classList.add('rotate-180', 'text-fg');
    let query = '';
    const listHost = h('div');
    const drawList = () => listHost.replaceChildren(optionList((searchable || allowCustom) ? filterOptions(allOptions(), query, allowCustom) : allOptions(), { isSelected: (v) => v === current, onPick: pick }));
    const search = (searchable || allowCustom) && h('input', { 'aria-label': `Search ${f.label}`, placeholder: allowCustom ? 'Search or type your own' : 'Search', class: 'w-full rounded-md bg-ink-800 px-2.5 py-1.5 text-sm outline-none placeholder:text-fg-subtle focus:ring-1 focus:ring-accent',
      onInput: (e) => { query = e.target.value; drawList(); },
      onKeydown: (e) => { if (e.key === 'Escape') { close(); button.focus(); } else if (e.key === 'ArrowDown') { e.preventDefault(); listHost.querySelector('[role=option]')?.focus(); } else if (e.key === 'Enter') { e.preventDefault(); listHost.querySelector('[role=option]')?.click(); } } });
    panel = h('div', { class: 'absolute z-40 mt-1.5 w-full min-w-[12rem] overflow-hidden rounded-xl border border-ink-700 bg-ink-850 shadow-2xl shadow-black/60', onKeydown: (e) => { if (e.key === 'Escape') { close(); button.focus(); } else keyNav(e, panel); } },
      search && h('div', { class: 'border-b border-ink-700 p-2' }, search), listHost);
    drawList();
    root.insertBefore(panel, root.lastChild);
    unbind = useOutside(root, close);
    if (search) search.focus(); else (listHost.querySelector('[aria-selected=true]') || listHost.querySelector('[role=option]'))?.focus();
  };
  button.addEventListener('click', () => (open ? close() : openPanel()));
  button.addEventListener('keydown', (e) => { if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPanel(); } });
  drawValue();
  const msg = h('p', { id: `${id}-msg`, class: f.error ? 'mt-1.5 text-xs text-accent' : 'mt-1.5 text-xs text-fg-subtle' }, f.error || f.hint || '');
  if (!f.error && !f.hint) msg.hidden = true;
  append(root, [h('span', { id: `${id}-label`, class: hideLabel ? 'sr-only' : 'label' }, f.label, f.required && !hideLabel && h('span', { class: 'ml-0.5 text-accent' }, '*')), button, msg]);
  root.setError = (e) => { msg.hidden = !e && !f.hint; msg.textContent = e || f.hint || ''; msg.className = cx('mt-1.5 text-xs', e ? 'text-accent' : 'text-fg-subtle'); button.setAttribute('aria-invalid', e ? 'true' : 'false'); };
  if (f.error) root.setError(f.error);
  return root;
}
export const FilterSelect = ({ label, value, onChange, options }) => Select({ label, hideLabel: true, value, onChange, options });

/** Multi select with chips, search and custom values. */
export function MultiSelect({ value = [], onChange, options, allowCustom = true, placeholder = 'Select…', ...f }) {
  const id = useId();
  let current = [...value];
  let open = false;
  let unbind = () => {};
  const opts = () => [...options.map((o) => ({ value: o, label: o })), ...current.filter((v) => !options.includes(v)).map((v) => ({ value: v, label: v, hint: 'Custom' }))];
  const root = h('div', { class: cx('relative', f.className) });
  const box = h('div', { class: 'input flex min-h-[44px] cursor-pointer flex-wrap items-center gap-1.5 py-1.5 pr-9' });
  const chevron = icon('chevronDown', { size: 16, className: 'pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-fg-subtle transition' });
  const boxWrap = h('div', { class: 'relative' }, box, chevron);
  let panel;
  let query = '';
  const toggleBtn = h('button', { type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-labelledby': `${id}-label`, class: 'min-w-[6rem] flex-1 py-1 text-left text-sm text-fg-subtle', onClick: (e) => { e.stopPropagation(); open ? close() : openPanel(); } });
  const drawBox = () => {
    box.replaceChildren(...current.map((v) => h('span', { class: 'inline-flex items-center gap-1 rounded-md bg-ink-750 py-0.5 pr-1 pl-2 text-xs text-fg' }, v,
      h('button', { type: 'button', class: 'rounded p-0.5 text-fg-subtle hover:text-fg', 'aria-label': `Remove ${v}`, onClick: (e) => { e.stopPropagation(); current = current.filter((x) => x !== v); onChange(current); drawBox(); if (open) drawList(); } }, icon('x', { size: 12 })))), toggleBtn);
    toggleBtn.textContent = current.length ? 'Add…' : placeholder;
  };
  const listHost = h('div');
  const drawList = () => listHost.replaceChildren(optionList(filterOptions(opts(), query, allowCustom), { multi: true, isSelected: (v) => current.includes(v), onPick: (o) => {
    current = current.includes(o.value) ? current.filter((x) => x !== o.value) : [...current, o.value];
    query = ''; if (searchEl) searchEl.value = ''; onChange(current); drawBox(); drawList(); searchEl?.focus();
  } }));
  let searchEl;
  const close = () => { open = false; panel?.remove(); unbind(); toggleBtn.setAttribute('aria-expanded', 'false'); box.classList.remove('border-accent', 'ring-2', 'ring-accent/25'); chevron.classList.remove('rotate-180', 'text-fg'); };
  const openPanel = () => {
    open = true; query = '';
    toggleBtn.setAttribute('aria-expanded', 'true'); box.classList.add('border-accent', 'ring-2', 'ring-accent/25'); chevron.classList.add('rotate-180', 'text-fg');
    searchEl = h('input', { 'aria-label': `Search ${f.label}`, placeholder: allowCustom ? 'Search or type your own' : 'Search', class: 'w-full rounded-md bg-ink-800 px-2.5 py-1.5 text-sm outline-none placeholder:text-fg-subtle focus:ring-1 focus:ring-accent',
      onInput: (e) => { query = e.target.value; drawList(); },
      onKeydown: (e) => {
        if (e.key === 'Escape') { close(); toggleBtn.focus(); }
        else if (e.key === 'Backspace' && !query && current.length) { current = current.slice(0, -1); onChange(current); drawBox(); drawList(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); listHost.querySelector('[role=option]')?.focus(); }
        else if (e.key === 'Enter') { e.preventDefault(); listHost.querySelector('[role=option]')?.click(); }
      } });
    panel = h('div', { class: 'absolute z-40 mt-1.5 w-full min-w-[12rem] overflow-hidden rounded-xl border border-ink-700 bg-ink-850 shadow-2xl shadow-black/60', onKeydown: (e) => { if (e.key === 'Escape') { close(); toggleBtn.focus(); } else if (e.target !== searchEl) keyNav(e, panel); } },
      h('div', { class: 'border-b border-ink-700 p-2' }, searchEl), listHost);
    drawList();
    root.insertBefore(panel, msg);
    unbind = useOutside(root, close);
    searchEl.focus();
  };
  box.addEventListener('click', () => !open && openPanel());
  drawBox();
  const msg = h('p', { id: `${id}-msg`, class: 'mt-1.5 text-xs text-fg-subtle' }, f.hint || '');
  if (!f.hint) msg.hidden = true;
  append(root, [h('span', { id: `${id}-label`, class: 'label' }, f.label, f.required && h('span', { class: 'ml-0.5 text-accent' }, '*')), boxWrap, msg]);
  root.setError = (e) => { msg.hidden = !e && !f.hint; msg.textContent = e || f.hint || ''; msg.className = cx('mt-1.5 text-xs', e ? 'text-accent' : 'text-fg-subtle'); box.setAttribute('aria-invalid', e ? 'true' : 'false'); box.classList.toggle('border-accent', !!e); };
  if (f.error) root.setError(f.error);
  return root;
}

/** Form section block (title + description + children). */
export const FormSection = ({ title, description }, ...children) => h('section', { class: 'space-y-5 border-t border-ink-700/60 pt-8 first:border-t-0 first:pt-0' },
  h('div', {}, h('h3', { class: 'text-lg' }, title), description && h('p', { class: 'mt-1 text-sm text-fg-subtle' }, description)), ...children);

/**
 * Repeater of item cards. `render(item, update)` returns the item's fields; `onStructure()` is
 * called after add/remove so the caller can re-render. Each card exposes data-item-id for error styling.
 */
export function Repeater({ label, description, items, onChange, create, addLabel, itemTitle, render, error }) {
  const fs = h('fieldset', { class: 'space-y-3' }, h('legend', { class: 'mb-1' }, h('span', { class: 'font-bold' }, label), description && h('span', { class: 'mt-1 block text-sm text-fg-subtle' }, description)));
  const errTop = h('p', { class: 'text-sm text-accent' });
  const emptyBox = h('p', { class: 'rounded-xl border border-dashed px-4 py-5 text-sm' });
  fs.setError = (e) => {
    errTop.hidden = !(items.length > 0 && e); errTop.textContent = e || '';
    emptyBox.hidden = items.length > 0; emptyBox.textContent = e || 'Nothing added yet.';
    emptyBox.className = cx('rounded-xl border border-dashed px-4 py-5 text-sm', e ? 'border-accent text-accent' : 'border-ink-700 text-fg-subtle');
  };
  fs.append(errTop, emptyBox);
  items.forEach((item, i) => {
    const title = h('span', {}, itemTitle(item, i));
    const card = h('div', { class: 'rounded-xl border border-ink-700 bg-ink-850/60 p-4', 'data-item-id': item.id },
      h('div', { class: 'mb-3 flex items-center justify-between gap-3' },
        h('span', { class: 'text-xs font-medium tracking-wide text-fg-subtle uppercase' }, String(i + 1).padStart(2, '0'), ' · ', title),
        h('button', { type: 'button', class: 'btn-ghost btn-sm px-2 hover:text-accent', 'aria-label': `Remove ${itemTitle(item, i)}`, onClick: () => onChange(items.filter((x) => x.id !== item.id)) }, icon('trash', { size: 15 }))),
      render(item, (patch) => { Object.assign(item, patch); title.textContent = itemTitle(item, i); onChange(items, { silent: true }); }));
    fs.append(card);
  });
  fs.append(h('button', { type: 'button', class: 'btn-secondary btn-sm', onClick: () => onChange([...items, create()]) }, icon('plus', { size: 14 }), ' ', addLabel));
  fs.setError(error);
  return fs;
}

export function fileToDataUrl(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
}
