import { h, link, icon, cx, navigate } from './ui.js';
import { load, brand, store } from './store.js';
import { DashboardPage } from './pages/dashboard.js';
import { ProjectsPage } from './pages/projects.js';
import { ProjectFormPage } from './pages/project-form.js';
import { ProjectDetailPage } from './pages/project-detail.js';
import { CaseStudiesPage } from './pages/case-studies.js';
import { AssemblePage } from './pages/assemble.js';
import { EditorPage } from './pages/editor.js';
import { PrintPage } from './pages/print.js';

const NAV = [{ href: '/', label: 'Dashboard', icon: 'grid' }, { href: '/projects', label: 'Projects', icon: 'folder' }, { href: '/case-studies', label: 'Case Studies', icon: 'layers' }];
const app = document.getElementById('app');
let mobileOpen = false;

const Logo = () => link('/', { 'aria-label': 'TechStalwarts Case Study Builder, go to dashboard', class: 'inline-flex rounded-md py-1' },
  h('img', { src: brand('techstalwarts-logo-dark.svg'), alt: 'TechStalwarts', width: 229, height: 41, class: 'h-auto w-[176px] max-w-full' }));

function sidebar(path) {
  const active = (href) => (href === '/' ? path === '/' : path.startsWith(href));
  return h('div', { class: 'flex h-full flex-col gap-8 px-5 py-6' },
    Logo(),
    h('nav', { 'aria-label': 'Main', class: 'space-y-1' }, NAV.map((n) => {
      const on = active(n.href);
      return link(n.href, { 'aria-current': on ? 'page' : undefined, class: cx('relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition', on ? 'bg-ink-800 text-fg' : 'text-fg-muted hover:bg-ink-850 hover:text-fg') },
        on && h('span', { class: 'absolute inset-y-2 left-0 w-0.5 rounded bg-accent' }), icon(n.icon, { className: on ? 'text-accent' : '' }), n.label);
    })),
    h('div', { class: 'space-y-2' },
      h('div', { class: 'eyebrow px-3' }, 'Create'),
      link('/projects/new', { class: 'btn-secondary w-full justify-start' }, icon('plus'), ' New project'),
      link('/case-studies/new', { class: 'btn-primary w-full justify-start' }, icon('sparkle'), ' Assemble case study')),
    h('div', { class: 'mt-auto rounded-xl border border-ink-700/70 bg-ink-850 p-4 text-xs leading-relaxed text-fg-subtle' },
      h('div', { class: 'mb-1 font-medium text-fg-muted' }, 'Prototype'),
      'Sample data on first run. Changes are saved on this server.'));
}

function shell(path, content) {
  const mobile = mobileOpen && h('div', { class: 'fixed inset-0 z-40 lg:hidden', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Navigation' },
    h('div', { class: 'absolute inset-0 bg-black/60', onClick: () => { mobileOpen = false; route(); } }),
    h('div', { class: 'absolute inset-y-0 left-0 w-72 border-r border-ink-700 bg-ink-900' },
      h('button', { class: 'btn-ghost absolute top-5 right-3 px-2', 'aria-label': 'Close navigation', onClick: () => { mobileOpen = false; route(); } }, icon('x')), sidebar(path)));
  return h('div', { class: 'min-h-screen lg:pl-64' },
    h('aside', { class: 'no-print fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-ink-700/60 bg-ink-900 lg:block' }, sidebar(path)),
    h('header', { class: 'no-print sticky top-0 z-30 flex items-center justify-between border-b border-ink-700/60 bg-ink-900/95 px-4 py-3 backdrop-blur lg:hidden' },
      Logo(), h('button', { class: 'btn-ghost px-2.5', 'aria-label': 'Open navigation', 'aria-expanded': String(mobileOpen), onClick: () => { mobileOpen = true; route(); } }, icon('menu'))),
    mobile,
    h('main', { class: 'mx-auto max-w-[1360px] px-4 py-8 sm:px-8 lg:px-12 lg:py-10' }, content));
}

const ROUTES = [
  [/^\/$/, DashboardPage],
  [/^\/projects$/, ProjectsPage],
  [/^\/projects\/new$/, (p, q) => ProjectFormPage({ query: q })],
  [/^\/projects\/([^/]+)\/edit$/, (m, q) => ProjectFormPage({ id: m[1], query: q })],
  [/^\/projects\/([^/]+)$/, (m) => ProjectDetailPage(m[1])],
  [/^\/case-studies$/, CaseStudiesPage],
  [/^\/case-studies\/new$/, (m, q) => AssemblePage(q)],
  [/^\/case-studies\/([^/]+)\/print$/, (m) => PrintPage('caseStudy', m[1]), true],
  [/^\/projects\/([^/]+)\/print$/, (m) => PrintPage('project', m[1]), true],
  [/^\/case-studies\/([^/]+)$/, (m) => EditorPage(m[1])],
];

let lastPath = null;
export function route() {
  window.__beforeNavigate = null;
  window.__dirty = false;
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const query = new URLSearchParams(location.search);
  if (path !== lastPath) mobileOpen = false;
  for (const [re, page, bare] of ROUTES) {
    const m = re.exec(path);
    if (!m) continue;
    let content;
    try { content = page(m, query); } catch (e) { console.error(e); content = h('div', { class: 'surface px-6 py-14 text-center' }, h('h3', { class: 'text-lg' }, 'Something went wrong'), h('p', { class: 'mt-2 text-sm text-fg-muted' }, e.message)); }
    app.replaceChildren(bare ? content : shell(path, content));
    if (path !== lastPath) window.scrollTo(0, 0);
    lastPath = path;
    return;
  }
  app.replaceChildren(shell(path, h('div', { class: 'surface px-6 py-14 text-center' }, h('h3', { class: 'text-lg' }, 'Page not found'), h('div', { class: 'mt-6' }, link('/', { class: 'btn-secondary' }, 'Go to dashboard')))));
}

window.addEventListener('popstate', route);
window.addEventListener('app:navigate', route);
window.addEventListener('beforeunload', (e) => { if (window.__dirty) { e.preventDefault(); e.returnValue = ''; } });

app.append(h('div', { class: 'grid min-h-screen place-items-center text-sm text-fg-subtle' }, 'Loading…'));
load().then(route).catch((e) => { app.replaceChildren(h('div', { class: 'grid min-h-screen place-items-center text-sm text-accent' }, `Could not load data: ${e.message}`)); });
export { navigate, store };
