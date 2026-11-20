# Case Study Builder — TechStalwarts

Capture each project once as a reusable record, then assemble one or more projects into **domain / feature**, **project-specific** or **staffing** case studies. Rebuilt to match the reference prototype at case-study-builder-teal.vercel.app, with server-side persistence added.

## Run

Node 20+, no `npm install` needed.

```powershell
npm start
```

Open http://localhost:4400. The first run seeds the same sample library as the reference (7 projects, 4 case studies). Data is stored in `data/db.json`; uploaded images in `data/assets/`. `POST /api/reset` restores the sample library.

Tests: `npm test`

## Deploy to Vercel

Vercel has no permanent disk, so on Vercel the app stores data in **Upstash Redis** and uploaded images in **Vercel Blob** (both have free tiers).

1. In Vercel: **Add New → Project**, import the GitHub repository. Settings come from `vercel.json` (no framework, build `node scripts/vercel-build.mjs`, output `public`). Deploy.
2. In the project's **Storage** tab: add **Upstash for Redis** (Marketplace) and **Blob**, and connect both to the project. This sets `KV_REST_API_URL` / `KV_REST_API_TOKEN` and `BLOB_READ_WRITE_TOKEN`.
3. In **Settings → Environment Variables**, add `APP_PASSWORD` (site password; any username).
4. **Redeploy** so the new variables apply. The first request seeds the sample library into Redis.

On Vercel, image uploads are limited to 3 MB (Vercel's request size limit). Without Redis connected, the API responds with "No database configured".

## Deploy to Render

1. Push this repository to GitHub (private is fine).
2. In Render: **New + → Blueprint**, pick the repository. `render.yaml` creates a Node web service (Starter plan) with a 1 GB persistent disk at `/var/data`.
3. When asked for `APP_PASSWORD`, enter a shared password. Visitors sign in with any username and that password. Leave it empty only for a private network.
4. Deploys run on every push to `main`. Data on the disk survives deploys and restarts.

Environment: `PORT` (set by Render), `DATA_DIR` (disk path), `APP_PASSWORD` (optional site password), `BRAND_BASE_URL` (fallback image host).

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
