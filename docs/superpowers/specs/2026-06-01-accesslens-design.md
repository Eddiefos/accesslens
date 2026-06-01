# AccessLens — Design Spec
_2026-06-01_

## Overview

AccessLens is a Claude-powered WCAG 2.1 accessibility audit tool. It accepts a URL or raw HTML snippet, runs a two-engine analysis (axe-core for deterministic checks + Claude for semantic/structural judgment), and returns a structured violation report with actionable fix suggestions. The UI is a dark dev-tool interface (the AccessLens design) with three screens: input, animated scan progress, and results.

The primary audience is internal colleagues evaluating the prototype before committing to a deployed version. It must work locally (`npm run dev`) and be deployable (Vercel/Railway or a single Node.js server).

---

## Architecture

Two processes, one monorepo with npm workspaces:

```
accesslens/
├── package.json          # root workspace
├── .env.example          # ANTHROPIC_API_KEY, PORT
├── README.md
├── server/               # Node.js + Express backend
└── client/               # Vite + React frontend
```

In development, Vite proxies `/api/*` to Express on port 3001. In production, Express serves the built `client/dist/` as static files and handles all routes.

---

## Backend (`server/`)

### File structure

```
server/
├── package.json
├── index.js        # Express app — POST /api/audit, GET /api/audit/:id/stream
├── audit.js        # Orchestrates the 3-stage pipeline, emits SSE progress events
├── fetch.js        # Playwright: URL → serialised DOM + styles
├── axe.js          # axe-core runner — works on live Playwright page or jsdom (HTML input)
├── claude.js       # Anthropic SDK call + structured WCAG prompt
└── score.js        # Merge axe + Claude findings, deduplicate, compute grade
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/audit` | Accepts `{ url?: string, html?: string }`. Starts audit, returns `{ id }`. |
| `GET` | `/api/audit/:id/stream` | SSE stream. Emits `progress` events during scan, then a final `result` event with the full JSON report. |

### Audit pipeline (3 stages, sequential)

**Stage 1 — Fetch & extract**
- URL input: Playwright launches headless Chromium, navigates to the page, waits for network idle, serialises the DOM (`document.documentElement.outerHTML`) and inlines critical computed styles.
- HTML input: used directly; a lightweight jsdom instance is created for axe-core.
- Emits SSE progress: `{ step: 1, label: "Fetching & parsing DOM", status: "done" }`

**Stage 2 — axe-core scan**
- For URL input: `@axe-core/playwright` runs axe in the live browser context — catches contrast failures, missing alt text, invalid ARIA, missing labels, etc.
- For HTML input: axe-core runs against jsdom.
- Violations are normalised to the shared violation schema (see Data Shapes).
- Each violation tagged `source: "axe-core"`.
- Emits SSE progress: `{ step: 2, label: "Running axe-core scan", status: "done" }`

**Stage 3 — Claude analysis**
- HTML is preprocessed before sending to Claude:
  - `<script>` and `<style>` tags stripped
  - Inline event handlers removed
  - Deeply repeated identical subtrees collapsed to a single representative + count note
  - Truncated to ~15 000 chars if needed, with a note about what was omitted
- Claude receives a system prompt establishing it as a WCAG 2.1 expert, and a user message with the preprocessed HTML.
- Claude is instructed to return only valid JSON — an array of violation objects.
- Claude focuses on issues axe-core misses: heading hierarchy, link purpose, reading order, form instructions, cognitive accessibility, meaningful page title.
- Each violation tagged `source: "claude"`.
- Emits SSE progress: `{ step: 3, label: "Claude semantic analysis", status: "done" }`

**Merge & score (`score.js`)**
- Combine axe + Claude arrays.
- Deduplicate: if an axe violation and a Claude violation match on `wcag` criterion + `selector`, keep the axe entry (more precise element reference) and attach Claude's `fix` text if richer.
- Compute score: start at 100, subtract per violation: critical −10, warning −4, info −1. Floor at 0.
- Assign grade: 90–100 → A, 75–89 → B, 60–74 → C, 40–59 → D, 0–39 → F.
- Count `passed`: total WCAG 2.1 AA criteria checked minus violation count.
- Return final `AuditResult` object.

### Claude prompt strategy

**System prompt (abbreviated):**
> You are an expert WCAG 2.1 accessibility auditor. Your job is to find accessibility issues in HTML that automated tools miss: illogical heading order, non-descriptive link text, missing form instructions, poor reading order, inadequate page titles, and similar semantic/structural problems. Do not flag issues that axe-core reliably catches (contrast ratios, missing alt attributes, invalid ARIA). Return ONLY a valid JSON array of violation objects — no prose, no markdown fences.

**Violation object schema Claude must return:**
```json
{
  "rule": "Link purpose (in context)",
  "wcag": "2.4.4",
  "level": "A",
  "severity": "warning",
  "selector": "a.read-more",
  "occurrences": 3,
  "desc": "...",
  "fix": "...",
  "source": "claude"
}
```

---

## Frontend (`client/`)

### File structure

```
client/
├── package.json
├── vite.config.js          # /api proxy to :3001 in dev
├── index.html
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── styles.css           # AccessLens design system (verbatim from prototype)
    ├── data.js              # EXAMPLES array only (no mock AUDIT data)
    ├── fonts/               # TRY Sans + TRY Serif OTF files
    └── components/
        ├── Icons.jsx
        ├── InputScreen.jsx
        ├── ScanScreen.jsx   # reads real SSE progress events
        ├── ResultsScreen.jsx
        └── TweaksPanel.jsx  # accent / grid / density tweaks
```

### Key changes from prototype

- **No mock data** — `window.AUDIT` is removed; results come from the SSE stream.
- **ScanScreen** connects to `GET /api/audit/:id/stream` and maps SSE `progress` events to the animated step list. The progress bar advances with each step.
- **ResultsScreen** receives the `result` SSE event and renders the real violation data.
- **TweaksPanel** is triggered by a Sliders icon button in the topbar (no host protocol needed).
- All `window.*` globals replaced with ES module imports.

---

## Data Shapes

### AuditResult (final SSE `result` payload)

```ts
{
  url: string,
  scannedAt: string,           // ISO timestamp
  elementsScanned: number,
  durationMs: number,
  grade: "A" | "B" | "C" | "D" | "F",
  score: number,               // 0–100
  passed: number,
  violations: Violation[]
}
```

### Violation

```ts
{
  id: string,
  severity: "critical" | "warning" | "info",
  rule: string,
  wcag: string,                // e.g. "1.1.1"
  level: "A" | "AA" | "AAA",
  selector: string,
  occurrences: number,
  impact: "Serious" | "Moderate" | "Minor",
  desc: string,
  fix: string,                 // may contain HTML (<code> tags)
  link: string,                // WCAG understanding doc URL
  source: "axe-core" | "claude",
  code?: TokenLine[]           // optional syntax-highlighted code (axe provides this)
}
```

---

## Deployment

- **Local dev**: `npm run dev` at root starts both server (nodemon) and client (vite) via `concurrently`.
- **Production build**: `npm run build` builds `client/dist/`; `npm start` runs Express which serves it.
- **Deploy target**: Any Node.js host (Railway, Fly.io, Render). Needs `ANTHROPIC_API_KEY` env var. Playwright requires a compatible Chromium install — use the official Playwright Docker base image or set `PLAYWRIGHT_BROWSERS_PATH`.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude |
| `PORT` | No | Express port (default: 3001) |
| `NODE_ENV` | No | `production` to serve static files |

---

## README outline

1. Setup (clone, `npm install`, copy `.env.example → .env`, add API key)
2. Running locally (`npm run dev`)
3. Prompting strategy — what Claude is asked to find and why
4. WCAG rules covered — axe-core list + Claude's semantic checklist
5. Limitations (dynamic JS-heavy SPAs may not fully render; Claude output is non-deterministic)
6. Deployment guide

---

## Limitations & known constraints

- Playwright cannot audit pages behind authentication or with heavy client-side rendering that requires user interaction.
- Claude's violation list is non-deterministic — results may vary between runs for the same page.
- The `code` token-highlighted field in the UI is populated for axe-core findings; Claude findings show a plain selector fallback.
- Large pages (>200KB HTML) are truncated before being sent to Claude.
