# Case Study Studio — TechStalwarts

A template-driven case study generator. Stakeholders **only provide information**; the app validates it and populates a copy of one of the two approved TechStalwarts Figma templates. Admins review, request changes, regenerate, approve and export.

```
Stakeholder enters data → validated against template capacity → Admin generates →
Figma plugin duplicates the master + populates the copy + exports PNG/PDF → Admin reviews → Approve
```

## Run

Requires Node 20+ (no `npm install` — zero dependencies).

```powershell
$env:ADMIN_PASSCODE = "choose-a-passcode"; npm start
```

Open http://localhost:4400. Sign in as **Stakeholder** (name + email) or **Admin** (also needs `ADMIN_PASSCODE`; the dev default is `admin-change-me`).

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | `4400` | HTTP port (the plugin manifest allows `http://localhost:4400`) |
| `ADMIN_PASSCODE` | `admin-change-me` | Required to sign in as Admin |
| `ADMIN_CAN_EDIT` | `true` | Whether admins may edit stakeholder content |
| `DATA_DIR` | `./data` | JSON database, uploads, exports, thumbnails |

Tests: `npm test` (mapping layer + full API workflow against a temporary data dir).

## Figma plugin setup (one-time, admin)

1. Open the template file **Case study New** in Figma desktop.
2. *Plugins → Development → Import plugin from manifest…* → `figma-plugin/manifest.json`.
3. Run **TechStalwarts Case Study Generator**, paste the server URL and the plugin token shown on *Admin → Templates*, press **Connect**.
4. **Sync templates** verifies every mapped layer and uploads thumbnails. **Process all** (or *Auto-process*) generates queued case studies.

## Why a plugin? (Figma capability findings)

The connected Figma MCP (figma-console, via the Desktop Bridge plugin) was inspected before building:

| Capability | Available | How it is used |
|---|---|---|
| Read files, frames, layers, components | ✅ | Template inspection; field schema derived from real layers |
| Duplicate frames | ✅ (`node.clone()`) | Every generation works on a copy on the **Generated Case Studies** page |
| Update text / component props / image fills | ✅ | Mixed-style text kept (e.g. the red “.” in headlines) |
| Update charts | ✅ | The deployment chart is native shapes; bars, totals, markers and axis are rebuilt |
| Export | ✅ (`exportAsync`) | PNG + PDF per frame for preview/approval |

**Limitation:** the MCP is a tool for an AI assistant, not an API the web app can call, and Figma's REST API cannot write to files. Population therefore runs in a small Figma plugin (same Plugin API the MCP uses) that pulls jobs from this server. An admin must have the template file open in Figma desktop with the plugin running; there is no headless generation.

## Templates and mapping

* `templates/project-specific.json`, `templates/staffing.json` — fields (form schema with character limits sized to the template boxes), sections, and **bindings** to real Figma node IDs taken from the file (e.g. `648:85` = staffing headline).
* `shared/compile.js` — the mapping layer: data + bindings → a list of operations (`text`, `tokens`, `props`, `image`, `fill`, `slots`, `chips`, `cards`, `logos`, `stackedBar`, `hide`).
* `shared/derive.js` — calculated values (initial/peak/final team, duration, period label) so slide numbers can't disagree with the chart.
* `figma-plugin/code.js` — executes the operations on the copy. Every master node ID is translated to the copy through a parallel tree walk; anything not inside the copy is refused, so the masters cannot be modified.

### Fields derived from the actual templates

The suggested field lists in the brief included items that the approved templates have **no place for**. Following “fields must be derived from the template; do not invent”, they are not collected:

* **Project-specific template** contains: header number + title, logo, one-line description, service pills, hero colour, two phone screens, solution headline + summary, highlights heading + up to 12 modules, tech-stack logos. It has *no* client overview, industry, business challenge, objectives, team composition, duration, business outcomes or final impact areas.
* **Staffing template** contains everything in its form. It has no separate *engagement model* or *engagement timeline* area (the reporting period and monthly chart cover timing).

To collect more information, add the area to the Figma template first, then add the field + binding.

### Changing the template

* Moved/duplicated file: *Admin → Templates → Update reference* (duplicated Figma files keep layer IDs, so mappings carry over), then Sync.
* A layer was replaced: *Review mappings* → edit that layer's node ID → Sync to verify.
* Structural changes (new areas): edit the template JSON bindings.

## Workflow & permissions

| Status | Stakeholder (owner) | Admin |
|---|---|---|
| Draft | edit, submit, delete | edit |
| Submitted | edit | edit, request changes, generate |
| Changes requested | edit, resubmit | edit |
| Generating | — | cancel |
| Ready for review | view preview | edit (marks preview stale), regenerate, request changes, approve (only if not stale) |
| Approved | view/download | reopen |

Admin-only field: project case-study number (required before generation).

## Known limitations

* Long text is limited by character counts sized to each text box; extreme glyph widths could still wrap differently than expected — check the preview.
* Per-slide PNG/PDF downloads (no merged multi-page PDF).
* Sign-in is a lightweight name/email + admin passcode suitable for an internal tool; put it behind SSO before wider use.
* JSON-file storage: single server instance.
