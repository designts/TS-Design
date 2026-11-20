# Case Study Builder — TechStalwarts

Capture each project once as a reusable record, then assemble one or more projects into **domain / feature**, **project-specific** or **staffing** case studies. Rebuilt to match the reference prototype at case-study-builder-teal.vercel.app, with server-side persistence added.

## Run

Node 20+, no `npm install` needed.

```powershell
npm start
```

Open http://localhost:4400. The first run seeds the same sample library as the reference (7 projects, 4 case studies). Data is stored in `data/db.json`; uploaded images in `data/assets/`. `POST /api/reset` restores the sample library.

Tests: `npm test`

## What's in it

| Area | Route | Notes |
|---|---|---|
| Dashboard | `/` | Hero, quick search, totals, recent projects / case studies |
| Projects library | `/projects` | Search + domain / type / status filters, open / edit / duplicate / PDF / delete |
| Create / edit project | `/projects/new`, `/projects/:id/edit` | Adaptive form: 7 steps (6 for staffing) by project type; per-step error counts; draft vs completed validation |
| Project record | `/projects/:id` | Full record, linked case studies, "Use in a new case study" |
| Case studies library | `/case-studies` | Cards with type, status, sources, sections |
| Assemble | `/case-studies/new` | Steps A–D: type → source projects → review → generate draft |
| Editor | `/case-studies/:id` | Rename, reorder / hide optional sections, edit section text and content blocks, live preview, mark completed |
| PDF | `…/print` | Print-ready view; opens the browser print dialog ("Save as PDF") |

Case studies are generated from project fields only (no AI). Each case study keeps its own copy of the content; later project edits don't change it, and deleting a project leaves its case studies intact.

## Code map

- `shared/catalog.js` — option lists, labels, fixed TechStalwarts company profile
- `shared/project.js` — project shape, character limits, form steps, validation
- `shared/generate.js` — projects → case study sections (per type)
- `shared/seed.js` — sample library
- `server/server.js` — JSON API + static files (zero dependencies)
- `public/js/` — SPA (plain ES modules + Tailwind v4 browser build): `pages/*`, `case-study/render.js` (hero, company profile, 16 section layouts, footer), `ui.js` (components)

## Differences from the reference

- **Persistence**: data is saved on the server (the reference resets on refresh).
- **PDF**: produced via the browser's print dialog (Save as PDF) instead of a client-side PDF library. Enable "Background graphics".
- **Brand imagery** (logos, photos, flags, client logos, icons — 49 files) is stored locally in `public/brand/`, copied from the reference deployment. If that folder is removed, the app falls back to loading the files from the reference site (`BRAND_BASE_URL` overrides that location).
- **Styling** uses the Tailwind v4 browser build from jsDelivr, so the UI needs internet access to style correctly.

## Previous version

The earlier Figma-template generator (two fixed templates populated through a Figma plugin) is kept unchanged in `legacy/figma-template-generator/`.
