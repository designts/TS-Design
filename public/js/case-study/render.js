// Renders a case study document: hero → company profile → content sections → footer.
import { h, icon, cx, link, BrowserFrame } from '../ui.js';
import { brand } from '../store.js';
import { COMPANY, BRAND_COLORS as C, BRAND_FILES as F, LANES, caseStudyTypeShort } from '/shared/catalog.js';

const pad = (n) => String(n).padStart(2, '0');
const brandIcon = (name) => brand(`icons/${name}.svg`);
const clientLogo = (name) => brand(`clients/${name}.png`);

// ------------------------------------------------------------------ shared bits
function SectionHead({ index, section, aside }) {
  return h('div', { class: 'mb-10 flex flex-col gap-4 @4xl:flex-row @4xl:items-end @4xl:justify-between' },
    h('div', { class: 'max-w-3xl' },
      h('div', { class: 'mb-4 flex items-center gap-3 text-xs font-medium tracking-[0.18em] text-fg-subtle uppercase' }, h('span', { class: 'text-accent' }, pad(index)), h('span', { class: 'h-px w-8 bg-accent' }), section.eyebrow),
      h('h2', { class: 'text-3xl leading-[1.1] font-bold @xl:text-[2.6rem]' }, section.heading)),
    aside);
}
const Empty = (text) => h('div', { class: 'rounded-xl border border-dashed border-ink-600 px-5 py-8 text-center text-sm text-fg-subtle' }, icon('info', { className: 'mx-auto mb-2' }), text);
function SourceLink(id, ctx) {
  const p = id ? ctx.projects.get(id) : undefined;
  return p ? link(`/projects/${p.id}`, { class: 'inline-flex items-center gap-1 text-xs text-fg-subtle hover:text-fg', title: 'Open source project' }, icon('link', { size: 12 }), ' ', p.name) : null;
}
function Visual(item, ctx, className) {
  const a = item && item.assetId ? ctx.assets.get(item.assetId) : undefined;
  return BrowserFrame({ className, src: a && a.previewUrl, caption: a ? `${a.title}${a.caption ? ` — ${a.caption}` : ''}` : undefined });
}
const Bullets = (items, columns = 2) => h('ul', { class: cx('grid gap-x-10 gap-y-3', columns === 2 && '@xl:grid-cols-2') }, items.map((t) => h('li', { class: 'flex gap-3 text-[15px] text-fg-muted' }, h('span', { class: 'mt-[7px] h-2 w-2 shrink-0 rotate-45 bg-accent' }), t)));
function Sources(section, ctx) {
  const ids = [...new Set(section.items.map((i) => i.sourceProjectId).filter(Boolean))];
  return ids.length ? h('div', { class: 'mt-6 flex flex-wrap items-center gap-x-4 gap-y-1' }, h('span', { class: 'text-xs text-fg-subtle' }, 'Sources:'), ids.map((id) => SourceLink(id, ctx))) : null;
}
const Triangle = () => h('span', { class: 'h-0 w-0 border-y-[4px] border-l-[7px] border-y-transparent border-l-accent' });

// ------------------------------------------------------------------ section layouts
function Overview(s, i, ctx) {
  const groups = ['Business function', 'Users & stakeholders', 'Key business process'].map((g) => ({ g, items: s.items.filter((x) => x.tag === g) })).filter((x) => x.items.length);
  const scope = s.items.filter((x) => x.tag === 'Our scope');
  const other = s.items.filter((x) => !x.tag || !['Business function', 'Users & stakeholders', 'Key business process', 'Our scope'].includes(x.tag));
  const empty = !s.intro && s.items.length === 0;
  return [SectionHead({ index: i, section: s }),
    empty ? Empty('No context recorded in the source projects. Add a description or business context.')
      : h('div', { class: 'grid gap-12 @4xl:grid-cols-2' },
        h('div', {}, s.intro && h('p', { class: 'text-lg leading-relaxed text-fg-muted' }, s.intro),
          [...scope, ...other].length > 0 && h('div', { class: 'mt-8 space-y-3' }, [...scope, ...other].map((x) => h('div', { class: 'rounded-xl border-l-2 border-accent bg-ink-850 px-5 py-4' },
            x.tag && h('div', { class: 'eyebrow mb-1 text-accent' }, x.tag), h('div', { class: 'font-bold' }, x.title), x.body && h('p', { class: 'mt-1 text-sm text-fg-muted' }, x.body))))),
        h('div', { class: 'space-y-8' }, groups.map(({ g, items }) => h('div', {}, h('div', { class: 'eyebrow mb-3' }, g),
          h('div', { class: 'flex flex-wrap gap-2' }, items.map((x) => h('span', { class: 'rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm' }, x.title))))))),
    Sources(s, ctx)];
}
function Challenges(s, i, ctx) {
  return [SectionHead({ index: i, section: s, aside: s.intro && h('p', { class: 'max-w-sm text-sm text-fg-muted' }, s.intro) }),
    s.items.length === 0 ? Empty('No challenges recorded in the source projects. Add them to the projects or write them here.')
      : h('ol', { class: 'space-y-3' }, s.items.map((x, n) => h('li', { class: 'grid gap-4 rounded-xl border border-ink-700/70 bg-ink-850/70 p-5 @3xl:grid-cols-[48px_1.4fr_1fr]' },
        h('span', { class: 'text-2xl font-bold text-accent' }, pad(n + 1)),
        h('div', {}, x.tag && h('div', { class: 'eyebrow mb-1' }, x.tag), h('div', { class: 'text-lg font-bold' }, x.title), x.body && h('p', { class: 'mt-1 text-sm text-fg-muted' }, x.body), h('div', { class: 'mt-2' }, SourceLink(x.sourceProjectId, ctx))),
        x.meta && h('div', { class: 'border-t border-ink-700/60 pt-3 @3xl:border-t-0 @3xl:border-l @3xl:pt-0 @3xl:pl-5' }, h('div', { class: 'eyebrow mb-1' }, 'Business implication'), h('p', { class: 'text-sm' }, x.meta)))))];
}
function ChallengeApproach(s, i, ctx) {
  const cols = [{ label: 'The challenge', items: s.items.filter((x) => x.tag !== 'Approach') }, { label: 'Our approach', items: s.items.filter((x) => x.tag === 'Approach') }];
  return [SectionHead({ index: i, section: s }),
    s.items.length === 0 ? Empty('No challenge or approach recorded in the source projects.')
      : h('div', { class: 'grid overflow-hidden rounded-2xl border border-ink-700/70 @3xl:grid-cols-2' }, cols.map((c, n) => h('div', { class: cx('space-y-8 p-6 @xl:p-8', n === 1 && 'border-t border-ink-700/70 bg-ink-850/50 @3xl:border-t-0 @3xl:border-l') },
        h('div', { class: 'flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-accent uppercase' }, Triangle(), c.label),
        c.items.length === 0 && h('p', { class: 'text-sm text-fg-subtle' }, 'Not recorded.'),
        c.items.map((x) => h('div', {}, x.title && h('div', { class: 'text-xl leading-snug font-bold' }, x.title),
          h('ol', { class: 'mt-4 space-y-3' }, (x.list || []).map((t, k) => h('li', { class: 'flex gap-3 text-[15px] text-fg-muted' }, h('span', { class: 'font-bold text-accent' }, pad(k + 1)), t))),
          h('div', { class: 'mt-3' }, SourceLink(x.sourceProjectId, ctx)))))))];
}
function Capabilities(s, i, ctx) {
  const tags = [...new Set(s.items.map((x) => x.tag).filter(Boolean))];
  return [SectionHead({ index: i, section: s, aside: tags.length > 0 && h('div', { class: 'flex flex-wrap gap-4 text-xs text-fg-subtle' }, tags.map((t, n) => h('span', { class: 'flex items-center gap-2' }, h('span', { class: cx('h-2 w-2 rounded-sm', n === 0 ? 'bg-accent' : n === 1 ? 'bg-fg-muted' : 'bg-ink-600') }), t))) }),
    s.items.length === 0 ? Empty('No capabilities recorded in the source projects.')
      : h('div', { class: 'grid gap-4 @xl:grid-cols-2 @6xl:grid-cols-3' }, s.items.map((x, n) => h('div', { class: 'flex flex-col rounded-xl border border-ink-700/70 bg-ink-850/70 p-5' },
        h('div', { class: 'mb-4 flex items-center gap-3' }, h('span', { class: cx('grid h-8 w-8 place-items-center rounded-lg border text-xs font-bold', tags.indexOf(x.tag || '') === 0 ? 'border-accent-line bg-accent-soft text-accent' : 'border-ink-600 text-fg') }, pad(n + 1)), x.tag && h('span', { class: 'eyebrow' }, x.tag)),
        h('div', { class: 'text-lg font-bold' }, x.title), x.body && h('p', { class: 'mt-2 text-sm text-fg-muted' }, x.body),
        h('dl', { class: 'mt-auto space-y-1.5 border-t border-ink-700/60 pt-4 text-xs' },
          x.meta && h('div', { class: 'grid grid-cols-[70px_1fr] gap-2' }, h('dt', { class: 'text-fg-subtle uppercase' }, 'Users'), h('dd', {}, x.meta)),
          (x.list || []).length > 0 && h('div', { class: 'grid grid-cols-[70px_1fr] gap-2' }, h('dt', { class: 'text-fg-subtle uppercase' }, 'Features'), h('dd', {}, x.list.join(' · '))),
          x.sourceProjectId && h('div', { class: 'grid grid-cols-[70px_1fr] gap-2' }, h('dt', { class: 'text-fg-subtle uppercase' }, 'Source'), h('dd', {}, SourceLink(x.sourceProjectId, ctx)))))))];
}
function Features(s, i, ctx) {
  const dt = (t) => h('dt', { class: 'mb-1 text-xs font-medium tracking-[0.14em] text-accent uppercase' }, t);
  return [SectionHead({ index: i, section: s }),
    s.items.length === 0 ? Empty('No features recorded in the source projects. Feature-specific projects carry the strongest material for this section.')
      : h('div', { class: 'space-y-16' }, s.items.map((x, n) => h('article', { class: 'grid gap-10 @4xl:grid-cols-2 @4xl:items-center' },
        h('div', { class: cx(n % 2 === 1 && '@4xl:order-2') },
          h('div', { class: 'eyebrow mb-3' }, 'Capability ', pad(n + 1), x.tag && ` · ${x.tag}`),
          h('h3', { class: 'text-2xl font-bold @xl:text-3xl' }, x.title),
          h('dl', { class: 'mt-6 space-y-5' },
            x.meta && h('div', {}, dt('Challenge addressed'), h('dd', { class: 'text-fg-muted' }, x.meta)),
            x.body && h('div', {}, dt('Solution delivered'), h('dd', { class: 'text-fg-muted' }, x.body)),
            (x.list || []).length > 0 && h('div', {}, dt('Key functionality'), h('dd', {}, h('ol', { class: 'space-y-2' }, x.list.map((t, k) => h('li', { class: 'flex items-start gap-3 text-sm' }, h('span', { class: 'grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-[10px] font-bold text-white' }, k + 1), t)))))),
          x.value && h('div', { class: 'mt-6 rounded-xl border border-ink-700/70 bg-ink-850 p-4' }, h('div', { class: 'eyebrow mb-1' }, 'Business benefit'), h('p', { class: 'text-sm' }, x.value)),
          h('div', { class: 'mt-3' }, SourceLink(x.sourceProjectId, ctx))),
        Visual(x, ctx))))];
}
function Solution(s, i, ctx) {
  const highlights = s.items.filter((x) => x.tag === 'Technical highlights');
  const rest = s.items.filter((x) => x.tag !== 'Technical highlights');
  return [SectionHead({ index: i, section: s }),
    !s.intro && s.items.length === 0 ? Empty('No solution summary or modules recorded in the source project.')
      : h('div', { class: 'space-y-10' },
        s.intro && h('p', { class: 'max-w-3xl text-lg leading-relaxed' }, s.intro),
        highlights.map((x) => h('div', {}, h('div', { class: 'mb-2 text-xs font-medium tracking-[0.2em] text-accent uppercase' }, 'Technical highlights'), h('div', { class: 'mb-4 text-lg font-bold' }, x.title), Bullets(x.list || []))),
        rest.length > 0 && h('div', { class: 'grid gap-4 @3xl:grid-cols-2' }, rest.map((x) => h('div', { class: 'rounded-xl border border-ink-700/70 bg-ink-850/70 p-5' },
          x.tag && h('div', { class: 'eyebrow mb-1' }, x.tag), h('div', { class: 'font-bold' }, x.title), x.body && h('p', { class: 'mt-1 text-sm text-fg-muted' }, x.body),
          (x.list || []).length > 0 && h('p', { class: 'mt-3 text-xs text-fg-subtle' }, x.list.join(' · ')), x.value && h('p', { class: 'mt-3 text-sm' }, x.value))))),
    Sources(s, ctx)];
}
const LANE_ORDER = ['user', 'system', 'external'];
function Workflows(s, i, ctx) {
  return [SectionHead({ index: i, section: s }),
    h('div', { class: 'space-y-12' }, s.items.map((x) => {
      const steps = x.steps || [];
      return h('div', {},
        h('div', { class: 'mb-5 flex flex-col gap-2 @xl:flex-row @xl:items-end @xl:justify-between' }, h('h3', { class: 'text-2xl font-bold' }, x.title), x.body && h('p', { class: 'max-w-md text-sm text-fg-muted' }, x.body)),
        steps.length > 0 && h('div', { class: 'overflow-x-auto rounded-xl border border-ink-700/70 bg-ink-850/40' },
          h('div', { class: 'grid min-w-[640px]', style: { gridTemplateColumns: `150px repeat(${steps.length}, minmax(120px, 1fr))` } }, LANE_ORDER.map((lane, l) => h('div', { class: 'contents' },
            h('div', { class: cx('flex flex-col justify-center border-ink-700/70 px-4 py-5', l > 0 && 'border-t') }, h('span', { class: 'text-[10px] tracking-[0.16em] text-fg-subtle uppercase' }, 'Lane ', pad(l + 1)), h('span', { class: 'text-xs font-bold' }, LANES[lane])),
            steps.map((st, k) => h('div', { class: cx('relative flex items-center border-l border-ink-700/40 px-2 py-4', l > 0 && 'border-t border-t-ink-700/70') },
              st.lane === lane && h('div', { class: cx('w-full rounded-lg border px-3 py-2.5 text-xs', st.kind === 'decision' ? 'border-accent bg-accent-soft' : st.kind === 'integration' ? 'border-dashed border-ink-500 bg-ink-800' : 'border-ink-600 bg-ink-800') },
                h('span', { class: 'block text-[10px] text-fg-subtle' }, 'Step ', pad(k + 1)), st.label))))))),
        h('dl', { class: 'mt-4 grid gap-3 @xl:grid-cols-3' }, [['Starting event', x.meta], ['Systems & departments involved', x.tag], ['Final output / business outcome', x.value]].map(([label, v]) => h('div', { class: cx('rounded-xl border p-4', label.startsWith('Final') ? 'border-accent-line bg-accent-soft/60' : 'border-ink-700/70 bg-ink-850/60') },
          h('dt', { class: 'eyebrow mb-1' }, label), h('dd', { class: 'text-sm' }, v || '—')))),
        h('div', { class: 'mt-2' }, SourceLink(x.sourceProjectId, ctx)));
    }))];
}
function Technology(s, i) {
  return [SectionHead({ index: i, section: s, aside: h('span', { class: 'text-xs text-fg-subtle' }, 'Confirmed technologies only') }),
    s.items.length === 0 ? Empty('No technologies recorded in the source projects.')
      : h('div', { class: 'grid gap-px overflow-hidden rounded-xl border border-ink-700/70 bg-ink-700/70 @xl:grid-cols-2 @4xl:grid-cols-3' }, s.items.map((x) => h('div', { class: 'bg-ink-900 p-5' },
        h('div', { class: 'eyebrow mb-3' }, x.title), h('div', { class: 'flex flex-wrap gap-2' }, (x.list || []).map((t) => h('span', { class: 'rounded-md border border-ink-600 bg-ink-850 px-2.5 py-1 text-sm' }, t))))))];
}
const EVIDENCE_STYLE = { Measured: 'border-success/50 text-success', Qualitative: 'border-ink-500 text-fg-muted', Expected: 'border-dashed border-accent/60 text-accent' };
function Impact(s, i, ctx) {
  return [SectionHead({ index: i, section: s, aside: h('div', { class: 'flex items-center gap-2 text-xs text-fg-subtle' }, 'Evidence:', Object.entries(EVIDENCE_STYLE).map(([k, c]) => h('span', { class: cx('rounded-full border px-2 py-0.5 text-[10px] tracking-wider uppercase', c) }, k))) }),
    s.intro && h('div', { class: 'mb-6 rounded-2xl bg-ink-800 p-6 @xl:p-8' }, h('div', { class: 'eyebrow mb-2 text-accent' }, 'Outcome summary'), h('p', { class: 'text-xl leading-snug' }, s.intro)),
    s.items.length === 0 ? Empty('No outcomes with supporting evidence are recorded in the source projects. Add measured, qualitative or expected outcomes to the projects, or write them here with their source.')
      : h('div', { class: 'grid gap-4 @xl:grid-cols-2 @6xl:grid-cols-4' }, s.items.map((x) => h('div', { class: 'flex flex-col rounded-xl border border-ink-700/70 bg-ink-850/70 p-5' },
        h('div', { class: 'flex items-start justify-between' }, h('span', { class: 'mt-2 h-0.5 w-7 bg-accent' }), x.tag && h('span', { class: cx('rounded-full border px-2 py-0.5 text-[10px] tracking-wider uppercase', EVIDENCE_STYLE[x.tag]) }, x.tag)),
        x.value ? h('div', { class: 'mt-4 text-4xl font-bold' }, x.value) : null,
        h('div', { class: cx('font-bold', x.value ? 'mt-1' : 'mt-4 text-lg') }, x.title),
        x.meta && h('p', { class: 'mt-3 text-xs text-fg-subtle' }, x.meta),
        h('div', { class: 'mt-auto pt-3' }, SourceLink(x.sourceProjectId, ctx)))))];
}
function BeforeAfter(s, i) {
  return [SectionHead({ index: i, section: s, aside: h('span', { class: 'text-xs text-fg-subtle' }, 'Only where supporting data exists') }),
    h('div', { class: 'overflow-x-auto rounded-xl border border-ink-700/70' }, h('table', { class: 'w-full min-w-[520px] text-left' },
      h('thead', { class: 'bg-ink-850 text-xs tracking-[0.14em] text-fg-subtle uppercase' }, h('tr', {}, h('th', { class: 'px-5 py-3 font-medium' }, 'Process'), h('th', { class: 'px-5 py-3 font-medium' }, 'Before'), h('th', { class: 'px-5 py-3 font-medium text-accent' }, 'After'))),
      h('tbody', { class: 'divide-y divide-ink-700/60' }, s.items.map((x) => h('tr', {}, h('td', { class: 'px-5 py-4 font-bold' }, x.title), h('td', { class: 'px-5 py-4 text-fg-subtle' }, x.body), h('td', { class: 'px-5 py-4' }, x.value))))))];
}
function Snapshot(s, i, ctx) {
  return [SectionHead({ index: i, section: s }),
    s.items.length === 0 ? Empty('No team size or duration recorded in the source projects.')
      : h('div', { class: 'grid overflow-hidden rounded-2xl bg-accent-strong @xl:grid-cols-3' }, s.items.map((x, n) => h('div', { class: cx('flex items-center gap-5 p-6 @xl:p-8', n > 0 && 'border-t border-white/15 @xl:border-t-0 @xl:border-l') },
        h('span', { class: 'text-5xl font-light text-white' }, x.value || '—'),
        h('div', {}, h('div', { class: 'font-bold text-white' }, x.title), h('div', { class: 'mt-0.5 text-xs text-white/75' }, x.body),
          x.sourceProjectId && ctx.projects.get(x.sourceProjectId) && h('div', { class: 'mt-1 text-[11px] text-white/60' }, ctx.projects.get(x.sourceProjectId).name)))))];
}
function Team(s, i) {
  return [SectionHead({ index: i, section: s }),
    s.items.length === 0 ? Empty('No roles or technologies recorded in the source projects.')
      : h('div', { class: 'grid gap-px overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-700/70 @3xl:grid-cols-2' }, s.items.map((x, n) => h('div', { class: 'bg-ink-900 p-6' },
        h('div', { class: 'mb-4 flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-accent uppercase' }, Triangle(), x.title),
        h('div', { class: 'flex flex-wrap gap-2' }, (x.list || []).map((t) => h('span', { class: cx('rounded-md px-3 py-1.5 text-sm', n === 0 ? 'border border-accent-line bg-accent-soft text-accent' : 'border border-ink-600 bg-ink-850') }, t))))))];
}
function DeploymentChart(series) {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, text) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text !== undefined) n.textContent = text; return n; };
  const totals = series.months.map((m) => m.engineering + m.qa + m.other);
  const max = Math.max(...totals, 1);
  const peak = totals.indexOf(Math.max(...totals));
  const colors = { engineering: 'var(--color-accent)', qa: '#d8848a', other: '#5b616b' };
  const bw = Math.min(48, 504 / series.months.length - 16);
  const x = (k) => 28 + (504 / series.months.length) * (k + 0.5) - bw / 2;
  const y = (v) => 192 - (v / max) * 164;
  const svg = el('svg', { viewBox: '0 0 560 220', class: 'w-full', role: 'img', 'aria-label': `Active resources per month for ${series.label}` });
  [0, 0.5, 1].forEach((f) => svg.append(el('line', { x1: 28, x2: 532, y1: y(max * f), y2: y(max * f), stroke: '#2a2f37', 'stroke-dasharray': '3 4' })));
  series.months.forEach((m, k) => {
    let acc = 0;
    const g = el('g', {});
    for (const key of ['engineering', 'qa', 'other']) {
      const v = m[key]; const top = y(acc + v);
      g.append(el('rect', { x: x(k), y: top, width: bw, height: Math.max(0, y(acc) - top), fill: colors[key], rx: 2 }));
      acc += v;
    }
    g.append(el('text', { x: x(k) + bw / 2, y: y(totals[k]) - 8, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: '#f4f5f7' }, totals[k]));
    if (k === peak) g.append(el('text', { x: x(k) + bw / 2, y: y(totals[k]) - 24, 'text-anchor': 'middle', 'font-size': 10, fill: '#e5383b' }, 'PEAK'));
    g.append(el('text', { x: x(k) + bw / 2, y: 212, 'text-anchor': 'middle', 'font-size': 11, fill: '#858d99' }, m.month));
    svg.append(g);
  });
  return h('figure', { class: 'rounded-xl border border-ink-700/70 bg-ink-850/60 p-5' },
    h('figcaption', { class: 'mb-3 flex flex-wrap items-center justify-between gap-3' }, h('span', { class: 'font-bold' }, series.label),
      h('span', { class: 'flex gap-4 text-xs text-fg-subtle' }, [['Engineering', colors.engineering], ['QA / Testing', colors.qa], ['Data / AI / Other', colors.other]].map(([l, c]) => h('span', { class: 'flex items-center gap-1.5' }, h('span', { class: 'h-2 w-2 rounded-sm', style: { background: c } }), l)))),
    svg);
}
function Deployment(s, i) {
  return [SectionHead({ index: i, section: s, aside: s.intro && h('p', { class: 'text-sm text-fg-muted' }, s.intro) }),
    h('div', { class: cx('grid gap-4', (s.deployment || []).length > 1 && '@4xl:grid-cols-2') }, (s.deployment || []).map(DeploymentChart)),
    h('p', { class: 'mt-3 text-xs text-fg-subtle' }, "Chart data comes from the source projects' monthly deployment records and is edited there.")];
}
function Engagements(s, i, ctx) {
  return [SectionHead({ index: i, section: s }),
    h('div', { class: 'grid gap-4 @3xl:grid-cols-2' }, s.items.map((x) => h('div', { class: 'rounded-xl border border-ink-700/70 bg-ink-850/70 p-6' },
      h('div', { class: 'flex items-center justify-between gap-3' }, x.tag && h('span', { class: 'eyebrow' }, x.tag), x.value && h('span', { class: 'rounded-md bg-accent-soft px-2 py-0.5 text-xs text-accent' }, x.value)),
      h('div', { class: 'mt-2 text-lg font-bold' }, x.title), x.meta && h('div', { class: 'text-xs text-fg-subtle' }, x.meta), x.body && h('p', { class: 'mt-3 text-sm text-fg-muted' }, x.body),
      h('div', { class: 'mt-3' }, SourceLink(x.sourceProjectId, ctx)))))];
}
function Summary(s, i) {
  return [SectionHead({ index: i, section: s }),
    s.intro && h('p', { class: 'mb-8 max-w-3xl text-lg leading-relaxed' }, s.intro),
    h('div', { class: 'grid gap-px overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-700/70 @3xl:grid-cols-2 @6xl:grid-cols-4' }, s.items.map((x) => h('div', { class: 'bg-ink-900 p-6' },
      h('div', { class: 'eyebrow mb-3 text-accent' }, x.title), x.body && h('p', { class: 'text-sm text-fg-muted' }, x.body),
      (x.list || []).length > 0 && h('ul', { class: 'space-y-2 text-sm' }, x.list.map((t) => h('li', { class: 'flex gap-2' }, h('span', { class: 'mt-2 h-1 w-1 shrink-0 rounded-full bg-accent' }), t))))))];
}
const Gallery = (s, i, ctx) => [SectionHead({ index: i, section: s }), h('div', { class: 'grid gap-6 @3xl:grid-cols-2' }, s.items.map((x) => Visual(x, ctx)))];

const LAYOUTS = { overview: Overview, challenges: Challenges, challenge_approach: ChallengeApproach, capabilities: Capabilities, features: Features, solution: Solution, workflows: Workflows, technology: Technology, impact: Impact, before_after: BeforeAfter, snapshot: Snapshot, team: Team, deployment: Deployment, engagements: Engagements, summary: Summary, gallery: Gallery };

// ------------------------------------------------------------------ hero / company / footer
export function heroModel(cs, section, assets) {
  const items = (section && section.items) || [];
  const visualItem = items.find((x) => x.tag === 'visual' && x.assetId);
  return {
    pills: [...new Set([cs.domain, caseStudyTypeShort(cs.type)].filter(Boolean))],
    heading: (section && section.heading) || cs.title,
    intro: (section && section.intro) ?? '',
    facts: items.filter((x) => x.tag !== 'visual' && !(x.list || []).length && (x.body || '').trim()).map((x) => ({ label: x.title, value: x.body })),
    chips: items.flatMap((x) => x.list || []),
    visual: visualItem && visualItem.assetId ? assets.get(visualItem.assetId) : undefined,
  };
}
function Hero(cs, section, assets) {
  const m = heroModel(cs, section, assets);
  const withVisual = !!m.visual || cs.type !== 'staffing';
  return h('header', { class: 'relative isolate overflow-hidden bg-[#0b0c0f]', 'data-template': 'hero' },
    h('img', { src: brand(F.heroBackground), alt: '', 'aria-hidden': 'true', class: 'absolute inset-0 -z-10 h-full w-full object-cover opacity-45' }),
    h('div', { 'aria-hidden': 'true', class: 'absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(8,9,11,0.96)_0%,rgba(8,9,11,0.82)_48%,rgba(8,9,11,0.55)_100%)]' }),
    h('div', { class: 'px-6 py-10 @3xl:px-14 @3xl:py-14' },
      h('img', { src: brand(F.logoFullDark), alt: 'TechStalwarts — We Transform Ideas into Powerful Digital Experiences.', width: 252, height: 65, class: 'h-auto w-48 @3xl:w-60' }),
      h('div', { class: cx('mt-12 grid gap-10 @3xl:mt-16', withVisual && '@4xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] @4xl:items-center') },
        h('div', {},
          h('div', { class: 'flex flex-wrap gap-2' }, m.pills.map((p) => h('span', { class: 'rounded-full border border-[#3aa3c9]/70 bg-[#0f2a36]/70 px-4 py-1.5 text-base text-[#5cc3e8]' }, p))),
          h('h1', { class: 'mt-6 text-[2.4rem] leading-[1.08] font-bold text-white @3xl:text-[3.3rem]' }, m.heading, h('span', { style: { color: C.red } }, '.')),
          m.intro && h('p', { class: 'mt-5 max-w-xl text-lg leading-relaxed text-white/80' }, m.intro),
          m.chips.length > 0 && h('ul', { class: 'mt-6 flex flex-wrap gap-2' }, m.chips.map((c) => h('li', { class: 'rounded-full border border-white/25 px-3.5 py-1 text-sm text-white/85' }, c))),
          m.facts.length > 0 && h('dl', { class: cx('mt-10 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-white/15 pt-6', !withVisual && '@3xl:grid-cols-4') }, m.facts.map((f) => h('div', {},
            h('dt', { class: 'text-[11px] font-medium tracking-[0.16em] text-white/55 uppercase' }, f.label), h('dd', { class: 'mt-1.5 text-[15px] text-white' }, f.value))))),
        withVisual && h('figure', { class: 'overflow-hidden rounded-xl border border-white/15 bg-white/5 shadow-2xl shadow-black/60' },
          m.visual && m.visual.previewUrl ? h('img', { src: m.visual.previewUrl, alt: m.visual.caption || m.visual.title, class: 'aspect-[16/10] w-full object-cover' })
            : h('div', { class: 'grid aspect-[16/10] place-items-center bg-[radial-gradient(circle_at_30%_20%,rgba(198,39,39,0.25)_0%,transparent_60%)] px-6 text-center text-xs text-white/50' }, m.visual ? `Visual placeholder: ${m.visual.title}` : 'Add a screenshot to a source project to show it here'),
          m.visual && m.visual.caption && h('figcaption', { class: 'border-t border-white/10 px-3 py-2 text-xs text-white/60' }, m.visual.caption)))));
}

function BrandHeading(text, color = C.ink) {
  return h('h2', { class: 'flex items-center gap-4 text-[1.9rem] leading-none font-bold tracking-tight @3xl:text-[2.6rem]', style: { color } },
    h('img', { src: brand(F.marker), alt: '', width: 30, height: 35, class: 'h-7 w-auto @3xl:h-[34px]' }), h('span', {}, text, h('span', { style: { color: C.red } }, '.')));
}
function ClientGrid(title, items, showNames, columns) {
  return h('div', { class: 'space-y-4' }, h('h3', { class: 'text-[1.25rem] font-bold text-[#353c48]' }, title, h('span', { style: { color: C.red } }, '-')),
    h('ul', { class: cx('grid gap-3', columns) }, items.map((c) => h('li', { class: 'flex h-[110px] flex-col items-center justify-center gap-1.5 rounded-[5px] border border-[#c2c4c8] px-4 text-center' },
      h('img', { src: clientLogo(c.logo), alt: c.name, class: 'h-11 w-auto max-w-[180px] object-contain' }), showNames && h('span', { class: 'text-[11px] leading-tight font-bold text-black' }, c.name)))));
}
export function CompanyProfile() {
  const { about, workWith, expertise, clients } = COMPANY;
  return h('section', { 'aria-label': 'About TechStalwarts', class: 'bg-[#fafafa] text-[#3a424f]', 'data-template': 'company' },
    h('div', { class: 'space-y-10 px-6 py-12 @3xl:px-14 @3xl:py-16' },
      h('div', { class: 'space-y-7' }, BrandHeading(about.heading),
        h('div', { class: 'grid gap-8 @4xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] @4xl:items-center' },
          h('div', { class: 'grid grid-cols-2 gap-x-6 gap-y-4 text-lg leading-tight font-bold text-[#2d2d2d] @3xl:text-[1.3rem]' }, about.pillars.map((p) => h('p', {}, p.lead, h('span', { style: { color: C.red } }, p.accent), p.rest))),
          h('p', { class: 'text-base leading-relaxed @3xl:text-[1.15rem]' }, about.body))),
      h('div', { class: 'grid gap-8 @4xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] @4xl:items-center' },
        h('img', { src: brand(about.photo), alt: 'The TechStalwarts team', width: 1032, height: 662, class: 'w-full rounded-md border-4 border-white object-cover shadow-sm' }),
        h('div', { class: 'space-y-8' },
          h('dl', { class: 'grid grid-cols-2 gap-x-6 gap-y-6 @xl:grid-cols-3' }, about.stats.map((st) => h('div', {}, h('dt', { class: 'sr-only' }, st.label),
            h('dd', { class: 'text-[1.6rem] leading-none font-bold', style: { color: C.red } }, st.value), h('dd', { class: 'mt-2 max-w-[11rem] text-[0.95rem] leading-snug' }, st.label)))),
          h('div', { class: 'flex flex-wrap items-center gap-x-8 gap-y-3' }, h('span', { class: 'text-[1.4rem] font-bold' }, 'Presence:'),
            about.presence.map((p) => h('span', { class: 'flex items-center gap-3 text-[1.05rem] font-bold' }, h('img', { src: brand(p.flag), alt: '', width: 54, height: 36, class: 'h-9 w-[54px] object-cover' }), p.label)))))),
    h('div', { class: 'space-y-7 px-6 pb-14 @3xl:px-14' }, BrandHeading(workWith.heading, '#2d2d2d'),
      h('div', { class: 'grid gap-1.5 @xl:grid-cols-2 @5xl:grid-cols-4' }, workWith.columns.map((col) => {
        const card = h('div', { class: 'flex min-h-[15rem] flex-col gap-3 rounded-[5px] p-6 text-[#ebeced]', style: { background: col.card.tone === 'red' ? C.red : C.slate } },
          h('h3', { class: 'text-[1.6rem] leading-tight font-bold text-white' }, col.card.title), h('hr', { class: 'border-white/40' }),
          h('p', { class: 'text-[0.85rem] leading-relaxed font-medium' }, col.card.body.map((b) => h('span', { class: b.strong ? 'font-black' : undefined }, b.text))),
          col.card.note && h('p', { class: 'text-[0.7rem] leading-relaxed' }, col.card.note));
        const photo = h('img', { src: brand(col.photo), alt: '', width: 600, height: 530, class: 'h-60 w-full rounded-[5px] object-cover @5xl:h-full @5xl:min-h-[15rem]' });
        return h('div', { class: 'grid gap-1.5 @5xl:grid-rows-2' }, col.photoFirst ? [photo, card] : [card, photo]);
      }))),
    h('div', { class: 'space-y-7 bg-white px-6 py-14 @3xl:px-14' }, BrandHeading(expertise.heading, '#171717'),
      h('p', { class: 'text-[1.05rem] leading-relaxed @3xl:text-[1.15rem]' }, expertise.body),
      h('ul', { class: 'grid grid-cols-2 border-t border-l border-[#c4c4c4] @4xl:grid-cols-4' }, expertise.items.map((x) => h('li', { class: 'flex min-h-[10rem] flex-col items-center justify-center gap-5 border-r border-b border-[#c4c4c4] bg-white px-4 py-6 text-center' },
        h('img', { src: brandIcon(x.icon), alt: '', width: 39, height: 39, class: 'h-[39px] w-[39px]' }), h('span', { class: 'max-w-[14rem] text-[1.05rem] leading-snug font-bold text-[#171717] @3xl:text-[1.2rem]' }, x.label))))),
    h('div', { class: 'space-y-8 bg-white px-6 pb-14 @3xl:px-14' },
      h('div', { class: 'flex flex-wrap items-center justify-between gap-6' }, BrandHeading(clients.heading, '#2d2d2d'),
        h('div', { class: 'flex items-center gap-6' }, h('span', { class: 'w-20 text-sm leading-tight font-bold' }, 'Clients based in'),
          h('ul', { class: 'flex gap-6 @xl:gap-9' }, clients.basedIn.map((b) => h('li', { class: 'flex flex-col items-center gap-1 text-xs font-bold' }, h('img', { src: brand(b.flag), alt: '', width: 37, height: 27, class: 'h-[27px] w-[37px] object-cover' }), b.label))))),
      ClientGrid('Government', clients.government, true, '@xl:grid-cols-2 @4xl:grid-cols-4'),
      ClientGrid('Private', clients.private, false, 'grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-5')));
}
export function ClosingFooter() {
  const f = COMPANY.footer;
  return h('footer', { 'aria-label': 'Contact TechStalwarts', class: 'relative overflow-hidden text-white', style: { background: C.red }, 'data-template': 'footer' },
    h('div', { 'aria-hidden': 'true', class: 'pointer-events-none absolute -top-24 -left-20 h-72 w-80 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.12),transparent)]' }),
    h('div', { class: 'relative grid gap-10 px-6 py-12 @3xl:px-14 @3xl:py-16 @4xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] @4xl:items-center' },
      h('div', { class: 'space-y-6' },
        h('img', { src: brand(F.logoFullWhite), alt: 'TechStalwarts', width: 252, height: 65, class: 'h-auto w-56' }),
        h('h2', { class: 'text-[2.6rem] leading-none font-bold tracking-tight @3xl:text-[3.2rem]' }, f.heading),
        h('img', { src: brand(f.map), alt: 'World map marking TechStalwarts offices in Saudi Arabia, the UAE and India', width: 985, height: 485, class: 'w-full max-w-xl' }),
        h('div', { class: 'space-y-2' }, h('p', { class: 'text-sm font-bold' }, f.internationalOffices.label),
          h('ul', { class: 'flex flex-wrap gap-x-5 gap-y-2' }, f.internationalOffices.items.map((o) => h('li', { class: 'flex items-center gap-2 text-sm font-bold' }, h('img', { src: brand(o.flag), alt: '', width: 27, height: 15, class: 'h-[15px] w-[27px] rounded-[2px] object-cover' }), o.label))))),
      h('div', { class: 'space-y-6' },
        f.offices.map((o) => h('div', { class: 'space-y-1.5' }, h('p', { class: 'flex items-center gap-2.5 text-[0.95rem] font-bold' }, h('img', { src: brandIcon(o.icon), alt: '', width: 19, height: 19, class: 'h-[19px] w-[19px]' }), o.label),
          h('p', { class: 'text-sm leading-relaxed text-white/90' }, o.address))),
        h('div', { class: 'grid gap-5 rounded-lg p-5 @xl:grid-cols-3', style: { background: C.redDark } }, f.contacts.map((c) => h('div', { class: 'space-y-1.5' },
          h('img', { src: brandIcon(c.icon), alt: '', width: 14, height: 14, class: 'h-3.5 w-3.5' }), c.lines.map((l) => h('p', { class: 'text-sm break-all' }, l))))))));
}

function Content(ctx) {
  const sections = ctx.caseStudy.sections.filter((s) => s.kind !== 'hero' && !s.hidden);
  const sources = ctx.caseStudy.sourceProjectIds.map((id) => ctx.projects.get(id)).filter(Boolean);
  const missing = ctx.caseStudy.sourceProjectIds.length - sources.length;
  return h('div', { class: 'bg-ink-900 px-6 @3xl:px-14', 'data-template': 'content' },
    h('div', { class: 'divide-y divide-ink-700/50' }, sections.map((s, n) => h('section', { id: `section-${s.id}`, class: 'scroll-mt-40 py-16' }, (LAYOUTS[s.kind] || (() => []))(s, n + 1, ctx)))),
    h('div', { class: 'border-t border-ink-700/60 py-8' }, h('div', { class: 'eyebrow mb-3' }, 'Source project references'),
      h('ul', { class: 'grid gap-2 @xl:grid-cols-2' },
        sources.map((p) => h('li', {}, link(`/projects/${p.id}`, { class: 'flex items-center gap-2 text-sm text-fg-muted hover:text-fg' }, icon('link', { size: 14, className: 'text-accent' }), ' ', p.name, ' ', h('span', { class: 'text-fg-subtle' }, '· ', p.domain)))),
        missing > 0 && h('li', { class: 'text-sm text-fg-subtle' }, missing === 1 ? '1 source project has since been deleted; its content is kept' : `${missing} source projects have since been deleted; their content is kept`, ' in this case study.'))));
}

/** Full case study document. ctx = { caseStudy, projects: Map, assets: Map } */
export function CaseStudyDocument(ctx) {
  const hero = ctx.caseStudy.sections.find((s) => s.kind === 'hero');
  return h('div', { class: '@container overflow-hidden rounded-3xl border border-ink-700/70' },
    h('div', { id: hero ? `section-${hero.id}` : undefined, class: 'scroll-mt-40' }, Hero(ctx.caseStudy, hero, ctx.assets)),
    h('div', { id: 'section-company', class: 'scroll-mt-40' }, CompanyProfile()),
    Content(ctx),
    h('div', { id: 'section-footer', class: 'scroll-mt-40' }, ClosingFooter()));
}

export function buildContext(caseStudy, projects) {
  return { caseStudy, projects: new Map(projects.map((p) => [p.id, p])), assets: new Map(projects.flatMap((p) => p.assets.map((a) => [a.id, a]))) };
}
