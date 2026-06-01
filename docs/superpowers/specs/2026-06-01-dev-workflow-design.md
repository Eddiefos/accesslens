# AccessLens Dev Workflow — Design Spec
_2026-06-01_

## Overview

Improve the AccessLens web UI for the development workflow. Developers use the tool while building — pasting components to check before committing, auditing local dev servers, then re-running after fixes and sharing results in PRs or Slack. The UI keeps its current visual identity but restructures the input experience around a Page / Component mode toggle, adds an inline re-run comparison, and adds one-click export.

---

## What changes

Three areas of the app are modified. Everything else stays the same.

---

## 1. Input screen — Mode toggle

### Mode toggle

A **Page | Component** segmented toggle lives inside the console shell topbar, replacing nothing — it sits where the traffic-light dots are, to the right of them. The choice is persisted in `localStorage` under the key `accesslens-mode` and restored on page load.

### Page mode

Page mode is the existing experience with two additions:

- The "Paste HTML" tab is renamed to **"Full page HTML"** to distinguish it clearly from component pasting.
- The URL tab gains a **localhost quick-access row** below the input field. It shows up to 5 recently audited localhost paths (e.g. `:3000`, `:3000/checkout`, `:5173`). Stored in `localStorage` under `accesslens-recent-urls`. After each successful URL audit, the audited URL is prepended to the list and deduplicated.

### Component mode

Component mode replaces the tabbed interface with a single view:

- **Context chips** row: `Auto · Form · Nav · Modal · Card · Button`. Default is `Auto`. Selecting a chip sets the `componentType` sent to the server. `Auto` detects automatically (see below).
- **Paste area** with line-number gutter — same as the existing HTML textarea. Accepts HTML or JSX (no parsing needed; both are sent as text to the server).
- No URL input in component mode — only paste is supported.

**Auto-detection:** When `componentType` is `Auto`, the server checks whether the submitted text contains `<html` or `<body` tags. If it does, it's treated as a full page (page-level Claude prompt). Otherwise it's treated as a component.

---

## 2. Backend — Component-aware Claude prompt

### Request changes

`POST /api/audit` now accepts two additional optional fields:

```json
{
  "url": "...",
  "html": "...",
  "mode": "page" | "component",
  "componentType": "auto" | "form" | "nav" | "modal" | "card" | "button"
}
```

`mode` and `componentType` are passed through `runAudit` → `analyzeWithClaude`.

### Claude prompt branching (`server/claude.js`)

`analyzeWithClaude(html, { mode, componentType })` selects one of two system prompts:

**Page prompt** (current — unchanged)

**Component prompt** — a modified version of the system prompt that:
- Suppresses document-level WCAG checks: page title (2.4.2), html lang attribute (3.1.1), skip link (2.4.1), main landmark, page structure landmarks.
- Adds component-type context when provided: `"This is an isolated <form> component. Focus on form-specific accessibility: label associations, error identification, required field marking, input instructions."`
- Component types map to WCAG focus areas:
  - `form` → 1.3.1, 3.3.1, 3.3.2, 4.1.3
  - `nav` → 2.4.4, 2.4.6, 4.1.2
  - `modal` → 4.1.2, 2.1.2, 1.3.1
  - `card` → 1.1.1, 2.4.4, 1.3.1
  - `button` → 4.1.2, 2.4.6

### Files changed (backend)

- `server/index.js` — extract `mode` and `componentType` from request body, pass to `runAudit`
- `server/audit.js` — pass `mode` and `componentType` to `analyzeWithClaude`
- `server/claude.js` — `analyzeWithClaude(html, opts)` with `opts.mode` and `opts.componentType`; component prompt branch

---

## 3. Results screen — Re-run comparison

### Re-run flow

`App.jsx` gains two new state fields: `prevResult` and `isRerunning`.

App.jsx stores the last submitted payload as `lastPayload: { url?, html?, mode, componentType }` — set whenever a new audit starts. This is what Re-run resubmits.

When "Re-run" is clicked:
1. `isRerunning = true`, `prevResult = result` (current result is saved)
2. `lastPayload` is resubmitted to `POST /api/audit`, returns a new `rerunAuditId`
3. `rerunAuditId` is passed as a prop to `ResultsScreen`, which opens an `EventSource` for it
3. The SSE stream connects. **The results screen stays visible** — no navigation to the scan screen.
4. A slim inline progress bar (`mock-rerun-bar`) appears at the top of the results screen showing "Re-running audit — results will update when complete" with a spinner. The Re-run button is disabled.
5. When the `result` SSE event arrives: `isRerunning = false`, `result = newResult`. The diff is computed and shown.

### Diff computation

Violations are matched by the key `${v.wcag}:${v.selector}` (same deduplication key used in `score.js`).

For each violation in the new result: if a matching violation exists in `prevResult` → `diffStatus: 'unchanged'`. If no match → `diffStatus: 'new'`.

For each violation in `prevResult` not found in the new result → added to the displayed list with `diffStatus: 'fixed'`.

### Diff display

**Summary banner:** gains a diff line below the sev-counts when `prevResult` is set:
```
✓ N fixed  ·  ★ N new  ·  N unchanged
```
Colours: fixed = `--pass`, new = `--crit`, unchanged = `--fg-3`.

**Violation list order** when diff is active:
1. New violations (badge: `★ New`, orange)
2. Unchanged violations (no badge change)
3. Fixed violations (badge: `✓ Fixed`, green; title struck through; collapsed — `open` state is false by default)

**No diff active** (first run): all violations render as today.

### Files changed (results)

- `client/src/App.jsx` — `prevResult`, `isRerunning`, `lastPayload`, `rerunAuditId` state; re-run submission keeps `phase = 'results'` (no navigation to scan screen); passes `prevResult`, `isRerunning`, `rerunAuditId` to `ResultsScreen`
- `client/src/components/ResultsScreen.jsx` — inline rerun bar, diff badge on `ViolationCard`, diff summary line in summary banner, list sorting by diff status

---

## 4. Results screen — Export

### Export button

The existing "Export" button in the results toolbar is replaced with an **Export ▾** button that opens a small dropdown panel below it. The dropdown has two options:

**PR Markdown** — copies this format to clipboard:
```markdown
## Accessibility audit — [url or "Component audit"]
**Conformance:** [conformance level] ([N] Level A failures)

- [ ] **[Critical]** [rule] · WCAG [wcag] · `[selector]`
- [ ] **[Warning]** [rule] · WCAG [wcag] · `[selector]`
```
Fixed violations (if a diff is active) are omitted. Resolved violations are not listed.

**Slack summary** — copies this format to clipboard:
```
AccessLens · [url or "Component audit"]
[conformance] · [N] critical, [N] warnings, [N] info
Top issues: [rule 1] ([wcag 1]), [rule 2] ([wcag 2]), [rule 3] ([wcag 3])
```

Both options close the dropdown and trigger the existing clipboard toast (`copy()` in `App.jsx`).

### Files changed (export)

- `client/src/components/ResultsScreen.jsx` — export dropdown component, markdown/slack formatters, `onCopy` calls

---

## Data flow summary

```
InputScreen
  mode toggle → App state (persisted in localStorage)
  localhost pills → built from localStorage recent-urls
  context chips → App state

App.jsx
  POST /api/audit { url?, html?, mode, componentType }
  prevResult state for diff
  isRerunning state

server/index.js → audit.js → claude.js
  componentType + mode → prompt selection

ResultsScreen
  props: data, prevResult, isRerunning, target, onReset, onCopy
  renders diff badges, export dropdown, rerun bar
```

---

## What is NOT changing

- The scan screen (3-step SSE progress) — not shown during re-run, only on first audit
- The tweaks panel (accent colour, grid, density)
- The violation card expand/collapse behaviour
- The filter buttons (All / Critical / Warning / Info)
- The sort select
- Conformance level display in summary banner
- All server pipeline logic (fetch, axe, score)
