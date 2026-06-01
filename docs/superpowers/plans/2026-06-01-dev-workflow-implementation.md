# AccessLens Dev Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Page/Component mode toggle, localhost URL history, component-aware Claude prompting, inline re-run comparison, and PR/Slack export to the AccessLens web UI.

**Architecture:** Six tasks, backend-first. Task 1 adds component-mode prompting to the server. Tasks 2–3 rebuild InputScreen with the mode toggle and component mode. Task 4 wires mode + re-run state through App.jsx. Tasks 5–6 add diff display and export to ResultsScreen. All changes evolve existing files in place.

**Tech Stack:** React 18, Vite, Express, Node.js test runner, localStorage for persistence.

---

> **Working directory:** `/Users/edvard/Developer/wcag-agent/`
> **Run server tests from:** `server/`
> **Run client build check from:** `client/`

---

## Task 1: Backend — component-aware Claude prompting

**Files:**
- Modify: `server/claude.js`
- Modify: `server/audit.js`
- Modify: `server/index.js`
- Modify: `server/claude.test.js`

- [ ] **Step 1: Add `resolveMode` tests to `server/claude.test.js`**

Append these tests after the existing ones:

```js
import { resolveMode } from './claude.js'

test('resolveMode returns page when mode is page regardless of content', () => {
  assert.equal(resolveMode('<form></form>', 'page', 'auto'), 'page')
})

test('resolveMode returns component when mode is component with explicit type', () => {
  assert.equal(resolveMode('<html><body></body></html>', 'component', 'form'), 'component')
})

test('resolveMode auto-detects page from html tag', () => {
  assert.equal(resolveMode('<html><body><p>hi</p></body></html>', 'component', 'auto'), 'page')
})

test('resolveMode auto-detects page from body tag', () => {
  assert.equal(resolveMode('<body><p>hi</p></body>', 'component', 'auto'), 'page')
})

test('resolveMode auto-detects component when no html/body tags', () => {
  assert.equal(resolveMode('<form><input /></form>', 'component', 'auto'), 'component')
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd /Users/edvard/Developer/wcag-agent/server && node --test claude.test.js
```

Expected: `resolveMode is not a function` errors on the new tests.

- [ ] **Step 3: Replace `server/claude.js` with component-prompt support**

```js
import Anthropic from '@anthropic-ai/sdk'

let _client = null
const getClient = () => _client ??= new Anthropic()

const PAGE_SYSTEM_PROMPT = `You are an expert WCAG 2.1 accessibility auditor. Your job is to find issues that automated tools like axe-core miss: illogical heading hierarchy, non-descriptive link text ("click here", "read more", "learn more"), missing or inadequate form field instructions, poor reading order, inadequate page titles, missing language of page, ambiguous button labels, and similar semantic and structural problems.

Do NOT flag: missing alt text, colour contrast failures, invalid ARIA attributes, missing form labels — axe-core handles these reliably.

Return ONLY a valid JSON array. No prose, no explanation, no markdown code fences. If you find no issues, return an empty array [].

Each element must have exactly these fields:
{
  "rule": "Human-readable rule name, e.g. Link purpose (in context)",
  "wcag": "Criterion number, e.g. 2.4.4",
  "level": "A" | "AA" | "AAA",
  "severity": "critical" | "warning" | "info",
  "selector": "CSS selector identifying the element(s)",
  "occurrences": <integer>,
  "impact": "Serious" | "Moderate" | "Minor",
  "desc": "One or two sentences explaining the problem and why it matters for users with disabilities.",
  "fix": "Concrete fix instruction. May include HTML examples wrapped in <code> tags.",
  "source": "claude"
}

Severity mapping: Level A failures → critical, Level AA → warning, best-practice or AAA → info.`

const COMPONENT_SYSTEM_PROMPT = `You are an expert WCAG 2.1 accessibility auditor reviewing an isolated UI component — not a full page document. Focus only on component-level accessibility issues.

Do NOT flag any of the following document-level concerns — they do not apply to isolated components:
- Missing page title (WCAG 2.4.2)
- Missing or incorrect html lang attribute (WCAG 3.1.1)
- Missing skip navigation link (WCAG 2.4.1)
- Missing main landmark or landmark structure

Do NOT flag: missing alt text, colour contrast failures, invalid ARIA attributes, missing form labels — axe-core handles these reliably.

Return ONLY a valid JSON array. No prose, no explanation, no markdown code fences. If you find no issues, return an empty array [].

Each element must have exactly these fields:
{
  "rule": "Human-readable rule name, e.g. Link purpose (in context)",
  "wcag": "Criterion number, e.g. 2.4.4",
  "level": "A" | "AA" | "AAA",
  "severity": "critical" | "warning" | "info",
  "selector": "CSS selector identifying the element(s)",
  "occurrences": <integer>,
  "impact": "Serious" | "Moderate" | "Minor",
  "desc": "One or two sentences explaining the problem and why it matters for users with disabilities.",
  "fix": "Concrete fix instruction. May include HTML examples wrapped in <code> tags.",
  "source": "claude"
}

Severity mapping: Level A failures → critical, Level AA → warning, best-practice or AAA → info.`

const COMPONENT_TYPE_HINTS = {
  form: 'This is a form component. Focus on: label associations for all inputs (1.3.1), error identification (3.3.1), required field marking, input instructions (3.3.2), accessible names for inputs (4.1.2).',
  nav: 'This is a navigation component. Focus on: link purpose in context (2.4.4), descriptive link text (2.4.6), accessible name for the nav landmark (1.3.1).',
  modal: 'This is a modal or dialog component. Focus on: accessible name for the dialog (4.1.2), focus management context (2.1.2), content structure within the dialog (1.3.1).',
  card: 'This is a card or list item component. Focus on: image alternative text in context (1.1.1), link purpose within the card (2.4.4), heading structure (1.3.1).',
  button: 'This is a button or interactive control. Focus on: accessible name (4.1.2), descriptive label quality (2.4.6), role and state exposure (4.1.2).',
}

export function resolveMode(html, mode, componentType) {
  if (mode === 'page') return 'page'
  if (componentType && componentType !== 'auto') return 'component'
  return /<html[\s>]/i.test(html) || /<body[\s>]/i.test(html) ? 'page' : 'component'
}

export async function analyzeWithClaude(html, { mode = 'page', componentType = 'auto' } = {}) {
  const preprocessed = preprocessHtml(html)
  const resolved = resolveMode(html, mode, componentType)
  const systemPrompt = resolved === 'component' ? COMPONENT_SYSTEM_PROMPT : PAGE_SYSTEM_PROMPT
  const typeHint = resolved === 'component' && COMPONENT_TYPE_HINTS[componentType]
    ? `\n\n${COMPONENT_TYPE_HINTS[componentType]}`
    : ''

  const message = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content: `Audit this HTML for WCAG 2.1 accessibility issues that axe-core misses. Return only the JSON array.${typeHint}\n\n${preprocessed}`,
    }],
  })

  const text = message.content.find((b) => b.type === 'text')?.text ?? '[]'
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\[[\s\S]*\]/)
    return match ? JSON.parse(match[0]) : []
  }
}

export function preprocessHtml(html) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\s+on\w+=(?:"[^"]*"|'[^']*'|\S+)/g, '')
    .slice(0, 15_000)
}
```

- [ ] **Step 4: Update `server/audit.js` to accept and pass mode/componentType**

```js
import { createBrowser, fetchPage, loadHtml } from './fetch.js'
import { runAxeOnPage } from './axe.js'
import { analyzeWithClaude } from './claude.js'
import { mergeAndScore } from './score.js'

const STEPS = [
  { step: 1, label: 'Fetching & parsing DOM' },
  { step: 2, label: 'Running axe-core scan' },
  { step: 3, label: 'Claude semantic analysis' },
]

export async function runAudit({ url, html, mode = 'page', componentType = 'auto' }, emitter) {
  const browser = await createBrowser()
  const startTime = performance.now()

  try {
    emitter.emit('progress', { ...STEPS[0], status: 'active' })
    const { page, html: pageHtml, elementsScanned } = url
      ? await fetchPage(url, browser)
      : await loadHtml(html, browser)
    emitter.emit('progress', { ...STEPS[0], status: 'done', count: `${elementsScanned} nodes` })

    emitter.emit('progress', { ...STEPS[1], status: 'active' })
    const axeViolations = await runAxeOnPage(page)
    emitter.emit('progress', { ...STEPS[1], status: 'done', count: `${axeViolations.length} issues` })

    emitter.emit('progress', { ...STEPS[2], status: 'active' })
    const claudeRaw = await analyzeWithClaude(pageHtml, { mode, componentType })
    const claudeViolations = claudeRaw.map((v, i) => ({ ...v, id: `claude-${i}` }))
    emitter.emit('progress', { ...STEPS[2], status: 'done', count: `${claudeViolations.length} issues` })

    const durationMs = Math.round(performance.now() - startTime)
    const result = mergeAndScore(axeViolations, claudeViolations, { url, elementsScanned, durationMs })
    emitter.emit('result', result)
  } finally {
    await browser.close()
  }
}
```

- [ ] **Step 5: Update `server/index.js` to extract mode/componentType from request body**

Change the `app.post('/api/audit', ...)` handler — replace only this line:

```js
// OLD:
const { url, html } = req.body ?? {}

// NEW:
const { url, html, mode = 'page', componentType = 'auto' } = req.body ?? {}
```

And update the `runAudit` call:

```js
// OLD:
runAudit({ url, html }, emitter).catch(...)

// NEW:
runAudit({ url, html, mode, componentType }, emitter).catch(...)
```

- [ ] **Step 6: Run all server tests — expect all pass**

```bash
cd /Users/edvard/Developer/wcag-agent/server && node --test axe.test.js score.test.js claude.test.js
```

Expected: 29 passing (24 existing + 5 new resolveMode tests).

- [ ] **Step 7: Commit**

```bash
cd /Users/edvard/Developer/wcag-agent
git add server/claude.js server/audit.js server/index.js server/claude.test.js
git commit -m "feat: component-mode Claude prompt — suppresses document-level checks for component auditing"
```

---

## Task 2: InputScreen — mode toggle, page mode improvements, CSS

**Files:**
- Modify: `client/src/styles.css`
- Modify: `client/src/components/InputScreen.jsx`

- [ ] **Step 1: Add new CSS classes to the end of `client/src/styles.css`**

```css
/* ============================================================
   DEV WORKFLOW ADDITIONS
   ============================================================ */

/* Mode toggle (Page | Component) inside console-head */
.mode-toggle{display:flex;gap:2px;background:var(--ink-0);border:1px solid var(--line);border-radius:var(--r-1);padding:2px;margin-left:auto}
.mode-btn{font-family:var(--font-mono);font-size:12px;color:var(--fg-3);padding:4px 12px;border-radius:var(--r-1);display:flex;align-items:center;gap:5px;transition:color 140ms var(--ease),background 140ms var(--ease)}
.mode-btn.active{background:var(--ink-2);color:var(--fg)}

/* Secondary tab bar shown in page mode */
.console-tabs-bar{display:flex;padding:0 14px;border-bottom:1px solid var(--line);background:var(--ink-1)}

/* Recent localhost URL pills */
.recent-urls{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.recent-url{font-family:var(--font-mono);font-size:12px;color:var(--fg-3);background:var(--ink-2);border:1px solid var(--line);border-radius:var(--r-1);padding:3px 10px;display:flex;align-items:center;gap:6px;transition:all 140ms var(--ease)}
.recent-url:hover{color:var(--fg-2);border-color:var(--line-2)}
.recent-url .arr{color:var(--accent)}

/* Component type context chips */
.context-chips{display:flex;gap:6px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid var(--line)}
.context-chip{font-family:var(--font-mono);font-size:12px;color:var(--fg-3);background:var(--ink-2);border:1px solid var(--line);border-radius:var(--r-full);padding:4px 12px;transition:all 140ms var(--ease)}
.context-chip:hover{color:var(--fg-2);border-color:var(--line-2)}
.context-chip.active{color:var(--accent);border-color:var(--accent);background:var(--accent-dim)}

/* Rerun bar shown during inline re-run */
.rerun-bar{display:flex;align-items:center;gap:10px;padding:8px 18px;background:var(--ink-1);border-bottom:1px solid var(--line);font-family:var(--font-mono);font-size:12px;color:var(--fg-3)}
.rerun-spinner{width:12px;height:12px;border:1.5px solid var(--line-2);border-top-color:var(--accent);border-radius:var(--r-full);animation:spin .7s linear infinite;flex-shrink:0}
@keyframes spin{to{transform:rotate(360deg)}}

/* Diff badges on violation cards */
.diff-tag{font-family:var(--font-mono);font-size:10px;padding:1px 7px;border-radius:var(--r-full);flex-shrink:0}
.diff-tag.new{background:var(--crit-dim);color:var(--crit)}
.diff-tag.fixed{background:var(--pass-dim);color:var(--pass)}
.diff-tag.unchanged{color:var(--fg-3)}
.vcard.s-fixed::before{background:var(--pass)}
.vcard.s-fixed .vtitle{text-decoration:line-through;color:var(--fg-3)}

/* Diff summary line in summary banner */
.diff-summary{display:flex;gap:12px;font-family:var(--font-mono);font-size:11px}
.diff-summary .ds-fixed{color:var(--pass)}
.diff-summary .ds-new{color:var(--crit)}
.diff-summary .ds-unchanged{color:var(--fg-3)}

/* Export dropdown */
.export-wrap{position:relative}
.export-dropdown{position:absolute;top:calc(100% + 6px);right:0;background:var(--ink-2);border:1px solid var(--line-2);border-radius:var(--r-2);padding:6px;z-index:50;min-width:210px;box-shadow:0 12px 40px rgba(0,0,0,.5)}
.export-opt{display:flex;align-items:flex-start;gap:10px;padding:8px 10px;border-radius:var(--r-1);font-family:var(--font-mono);font-size:12px;color:var(--fg-2);transition:all 140ms var(--ease);text-align:left;width:100%;background:none;border:none}
.export-opt:hover{background:var(--ink-3);color:var(--fg)}
.export-opt .opt-icon{color:var(--fg-3);flex-shrink:0;margin-top:1px}
.export-opt .opt-sub{display:block;font-size:10px;color:var(--fg-3);margin-top:2px}
```

- [ ] **Step 2: Replace `client/src/components/InputScreen.jsx` with mode-toggle + page mode version**

```jsx
import { useState, useEffect } from 'react'
import * as Ic from './Icons.jsx'
import { EXAMPLES } from '../data.js'

const RECENT_KEY = 'accesslens-recent-urls'
const MODE_KEY = 'accesslens-mode'
const MAX_RECENT = 5

function loadRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') } catch { return [] }
}

function saveRecent(url, prev) {
  const next = [url, ...prev.filter(u => u !== url)].slice(0, MAX_RECENT)
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch {}
  return next
}

export default function InputScreen({ onRun }) {
  const [mode, setMode] = useState(() => localStorage.getItem(MODE_KEY) ?? 'page')
  const [tab, setTab] = useState('url')
  const [url, setUrl] = useState('')
  const [html, setHtml] = useState('')
  const [focus, setFocus] = useState(false)
  const [recentUrls, setRecentUrls] = useState(loadRecent)

  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode)
  }, [mode])

  const filled = mode === 'component'
    ? html.trim().length > 0
    : tab === 'url' ? url.trim().length > 0 : html.trim().length > 0

  const run = () => {
    if (!filled) return
    if (mode === 'page' && tab === 'url') {
      const full = `https://${url}`
      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        setRecentUrls(prev => saveRecent(full, prev))
      }
      onRun({ display: full, url: full, mode: 'page', componentType: 'auto' })
    } else if (mode === 'page' && tab === 'html') {
      onRun({ display: 'Pasted full-page HTML', html, mode: 'page', componentType: 'auto' })
    } else {
      onRun({ display: 'Component snippet', html, mode: 'component', componentType: 'auto' })
    }
  }

  const onKey = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run()
  }

  const lineCount = Math.max(8, html.split('\n').length)

  return (
    <div className="input-wrap fade-in">
      <div className="hero-kicker">
        <span className="bar"></span>
        <span className="kicker">WCAG 2.2 · automated audit</span>
      </div>
      <div className="hero">
        <h1>See what your page<br />says to <span className="serif-em">everyone</span>.</h1>
        <p className="lede">Paste a URL or a chunk of markup. AccessLens parses the DOM,
          runs it against the WCAG success criteria, and hands you back diagnostics you can act on.</p>
      </div>

      <div className="console" onKeyDown={onKey}>
        {/* Primary: mode toggle */}
        <div className="console-head">
          <div className="tracffic"><i></i><i></i><i></i></div>
          <div className="mode-toggle">
            <button className={'mode-btn' + (mode === 'page' ? ' active' : '')} onClick={() => setMode('page')}>
              <Ic.Link size={12} /> Page
            </button>
            <button className={'mode-btn' + (mode === 'component' ? ' active' : '')} onClick={() => setMode('component')}>
              <Ic.Code size={12} /> Component
            </button>
          </div>
        </div>

        {/* Secondary: tabs row (page mode only) */}
        {mode === 'page' && (
          <div className="console-tabs-bar">
            <div className="tabs">
              <button className={'tab' + (tab === 'url' ? ' active' : '')} onClick={() => setTab('url')}>
                <span className="glyph"><Ic.Link size={14} /></span> URL
              </button>
              <button className={'tab' + (tab === 'html' ? ' active' : '')} onClick={() => setTab('html')}>
                <span className="glyph"><Ic.Code size={14} /></span> Full page HTML
              </button>
            </div>
          </div>
        )}

        <div className="console-body">
          {mode === 'page' && tab === 'url' && (
            <div className={'field-url' + (focus ? ' focus' : '')}>
              <span className="scheme">https://</span>
              <input
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value.replace(/^https?:\/\//, ''))}
                onFocus={() => setFocus(true)}
                onBlur={() => setFocus(false)}
                placeholder="localhost:3000/checkout"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>
          )}
          {(mode === 'component' || (mode === 'page' && tab === 'html')) && (
            <div className="field-html">
              <div className="gutter">
                {Array.from({ length: lineCount }, (_, i) => <div key={i}>{i + 1}</div>)}
              </div>
              <textarea
                autoFocus={mode === 'component'}
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                placeholder={mode === 'component'
                  ? '<form>\n  <input placeholder="Email" />\n  <button>Submit</button>\n</form>'
                  : '<html>\n  <head><title>…</title></head>\n  <body>…</body>\n</html>'}
                spellCheck={false}
              />
            </div>
          )}
        </div>

        <div className="console-foot">
          <span className="hint"><kbd>⌘</kbd><kbd>↵</kbd> to run</span>
          <span className="spacer"></span>
          <button className="btn btn-primary" disabled={!filled} onClick={run}>
            <Ic.Play size={14} /> Run audit
          </button>
        </div>
      </div>

      <div className="standards">
        <span className="chip"><span className="led"></span><b>WCAG 2.2</b> · Level A &amp; AA</span>
        <span className="chip"><span className="led"></span>89 success criteria</span>
        <span className="chip"><span className="led"></span>DOM + computed styles</span>
      </div>

      {/* Recent localhost URLs (page + URL tab only) */}
      {mode === 'page' && tab === 'url' && recentUrls.length > 0 && (
        <div className="examples">
          <div className="lbl">Recent local</div>
          <div className="recent-urls">
            {recentUrls.map(u => (
              <button key={u} className="recent-url"
                onClick={() => setUrl(u.replace(/^https?:\/\//, ''))}>
                <span className="arr">↳</span>{u.replace('https://', '')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sample targets (page + URL tab, no recent urls yet) */}
      {mode === 'page' && tab === 'url' && recentUrls.length === 0 && (
        <div className="examples">
          <div className="lbl">Try a sample target</div>
          <div className="row">
            {EXAMPLES.map((ex) => (
              <button key={ex} className="ex" onClick={() => setUrl(ex)}>
                <span className="arr">↳</span> {ex}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Confirm Vite builds without errors**

```bash
cd /Users/edvard/Developer/wcag-agent/client && npx vite build 2>&1 | tail -5
```

Expected: build succeeds, no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/edvard/Developer/wcag-agent
git add client/src/styles.css client/src/components/InputScreen.jsx
git commit -m "feat: InputScreen mode toggle, page/component modes, localhost URL history"
```

---

## Task 3: InputScreen — component mode context chips

**Files:**
- Modify: `client/src/components/InputScreen.jsx`

- [ ] **Step 1: Add `componentType` state and context chips to `InputScreen`**

Add `componentType` state after the other state declarations:

```jsx
const [componentType, setComponentType] = useState('auto')
```

Update the `run()` function — replace the `mode === 'component'` branch:

```jsx
} else {
  onRun({ display: 'Component snippet', html, mode: 'component', componentType })
}
```

Add context chips to the component mode render. Insert this block right before the closing `</div>` of the component-mode `field-html` div, as a sibling to `console-body` — specifically, add it between `console-tabs-bar` (absent in component mode) and `console-body`:

In the JSX, after the `{mode === 'page' && <div className="console-tabs-bar">...}` block and before `<div className="console-body">`, add:

```jsx
{mode === 'component' && (
  <div className="context-chips">
    {['auto', 'form', 'nav', 'modal', 'card', 'button'].map(type => (
      <button
        key={type}
        className={'context-chip' + (componentType === type ? ' active' : '')}
        onClick={() => setComponentType(type)}
      >
        {type === 'auto' ? 'Auto-detect' : type.charAt(0).toUpperCase() + type.slice(1)}
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 2: Confirm Vite builds without errors**

```bash
cd /Users/edvard/Developer/wcag-agent/client && npx vite build 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /Users/edvard/Developer/wcag-agent
git add client/src/components/InputScreen.jsx
git commit -m "feat: component mode context chips (Form, Nav, Modal, Card, Button)"
```

---

## Task 4: App.jsx — wire mode/componentType, lastPayload, re-run state

**Files:**
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Replace `client/src/App.jsx` with re-run support**

```jsx
import { useState, useEffect } from 'react'
import * as Ic from './components/Icons.jsx'
import InputScreen from './components/InputScreen.jsx'
import ScanScreen from './components/ScanScreen.jsx'
import ResultsScreen from './components/ResultsScreen.jsx'
import {
  useTweaks, TweaksPanel, TweakSection, TweakColor, TweakToggle, TweakRadio,
} from './components/TweaksPanel.jsx'

const TWEAK_DEFAULTS = { accent: '#FF4F00', grid: true, density: 'regular' }

function needLightInk(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55
}

export default function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS)
  const [phase, setPhase] = useState('input')        // 'input' | 'scan' | 'results'
  const [target, setTarget] = useState('')
  const [auditId, setAuditId] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [tweaksOpen, setTweaksOpen] = useState(false)
  // Re-run state
  const [lastPayload, setLastPayload] = useState(null)
  const [prevResult, setPrevResult] = useState(null)
  const [isRerunning, setIsRerunning] = useState(false)
  const [rerunAuditId, setRerunAuditId] = useState(null)

  useEffect(() => {
    const r = document.documentElement
    r.style.setProperty('--accent', t.accent)
    r.style.setProperty('--accent-ink', needLightInk(t.accent) ? '#fff' : '#000')
  }, [t.accent])

  const copy = (text) => {
    try { navigator.clipboard?.writeText(text) } catch {}
    setToast(text.length > 42 ? 'Copied to clipboard' : 'Copied · ' + text)
    clearTimeout(window.__toastTimer)
    window.__toastTimer = setTimeout(() => setToast(null), 1700)
  }

  const startAudit = async (payload) => {
    const { url, html, mode = 'page', componentType = 'auto' } = payload
    const res = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(url ? { url, mode, componentType } : { html, mode, componentType }),
    })
    if (!res.ok) throw new Error(await res.text())
    const { id } = await res.json()
    return id
  }

  const run = async ({ display, url, html, mode, componentType }) => {
    setTarget(display)
    setError(null)
    const payload = { url, html, mode, componentType }
    try {
      const id = await startAudit(payload)
      setLastPayload(payload)
      setPrevResult(null)
      setAuditId(id)
      setPhase('scan')
    } catch (err) {
      setError(err.message)
    }
  }

  const rerun = async () => {
    if (!lastPayload) return
    setError(null)
    try {
      const id = await startAudit(lastPayload)
      setPrevResult(result)
      setIsRerunning(true)
      setRerunAuditId(id)
    } catch (err) {
      setError(err.message)
      setIsRerunning(false)
    }
  }

  const handleResult = (data) => {
    setResult(data)
    setPhase('results')
  }

  const handleRerunDone = (data) => {
    setResult(data)
    setIsRerunning(false)
    setRerunAuditId(null)
  }

  const handleError = (msg) => {
    setError(msg)
    setPhase('input')
  }

  const reset = () => {
    setPhase('input')
    setResult(null)
    setAuditId(null)
    setError(null)
    setPrevResult(null)
    setIsRerunning(false)
    setRerunAuditId(null)
    setLastPayload(null)
  }

  return (
    <div className="app" data-density={t.density}
         style={{ backgroundImage: t.grid ? undefined : 'none' }}>
      <div className="topbar">
        <div className="brand">
          <span className="lens"><span className="dot"></span></span>
          <span className="mono-name">access<b style={{ color: 'var(--accent)' }}>lens</b></span>
          <span className="ver">v2.2</span>
        </div>
        <span className="spacer"></span>
        {phase === 'results' && (
          <a className="meta-link" href="https://www.w3.org/WAI/WCAG22/quickref/"
             target="_blank" rel="noopener">
            <Ic.Ext size={12} /> WCAG 2.2 quick reference
          </a>
        )}
        <button
          onClick={() => setTweaksOpen((o) => !o)}
          style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', padding: '0 6px', display: 'flex', alignItems: 'center' }}
          title="Tweaks"
        >
          <Ic.Sliders size={14} />
        </button>
      </div>

      {error && (
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px 24px' }}>
          <div style={{ background: 'var(--crit-dim)', border: '1px solid var(--crit)', borderRadius: 'var(--r-2)', padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--crit)' }}>
            {error}
          </div>
        </div>
      )}

      {phase === 'input' && <InputScreen onRun={run} />}
      {phase === 'scan' && auditId && (
        <ScanScreen auditId={auditId} target={target} onDone={handleResult} onError={handleError} />
      )}
      {phase === 'results' && result && (
        <ResultsScreen
          data={result}
          prevResult={prevResult}
          isRerunning={isRerunning}
          rerunAuditId={rerunAuditId}
          target={target}
          onReset={reset}
          onCopy={copy}
          onRerun={rerun}
          onRerunDone={handleRerunDone}
        />
      )}

      {toast && (
        <div className="copied fade-in">
          <span className="d"><Ic.Check size={13} /></span>{toast}
        </div>
      )}

      <TweaksPanel open={tweaksOpen} onClose={() => setTweaksOpen(false)}>
        <TweakSection label="Accent" />
        <TweakColor label="Signal colour" value={t.accent}
          options={['#FF4F00', '#37E07A', '#FFC400', '#3DA9FC']}
          onChange={(v) => setTweak('accent', v)} />
        <TweakSection label="Surface" />
        <TweakToggle label="Background grid" value={t.grid} onChange={(v) => setTweak('grid', v)} />
        <TweakRadio label="Density" value={t.density} options={['compact', 'regular', 'comfy']}
          onChange={(v) => setTweak('density', v)} />
      </TweaksPanel>
    </div>
  )
}
```

- [ ] **Step 2: Confirm Vite builds without errors**

```bash
cd /Users/edvard/Developer/wcag-agent/client && npx vite build 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /Users/edvard/Developer/wcag-agent
git add client/src/App.jsx
git commit -m "feat: App.jsx wires mode/componentType through run(), adds re-run state management"
```

---

## Task 5: ResultsScreen — diff display + rerun bar

**Files:**
- Modify: `client/src/components/ResultsScreen.jsx`

The diff key is `${v.wcag}:${v.selector}` — same key used by `score.js` for deduplication.

- [ ] **Step 1: Replace `client/src/components/ResultsScreen.jsx`**

```jsx
import { useState, useMemo, useEffect } from 'react'
import * as Ic from './Icons.jsx'

const SEV_ORDER = { critical: 0, warning: 1, info: 2 }
const DIFF_ORDER = { new: 0, unchanged: 1, fixed: 2 }

function diffKey(v) { return `${v.wcag}:${v.selector}` }

function computeDiff(data, prevResult) {
  if (!prevResult) return { active: data.violations.map(v => ({ ...v, diffStatus: null })), fixed: [] }

  const prevKeys = new Set(prevResult.violations.map(diffKey))
  const currKeys = new Set(data.violations.map(diffKey))

  const active = data.violations.map(v => ({
    ...v,
    diffStatus: prevKeys.has(diffKey(v)) ? 'unchanged' : 'new',
  }))

  const fixed = prevResult.violations
    .filter(v => !currKeys.has(diffKey(v)))
    .map(v => ({ ...v, diffStatus: 'fixed', severity: 'fixed' }))

  return { active, fixed }
}

function CodeBlock({ lines, onCopy }) {
  const plain = lines.map((ln) => ln.map((t) => t.v).join('')).join('\n')
  return (
    <div className="code-block">
      <div className="cb-head">
        <Ic.Code size={12} />
        <span className="tag">offending element</span>
        <span className="spacer"></span>
        <button className="copy" onClick={() => onCopy(plain)}><Ic.Copy size={12} /> copy</button>
      </div>
      <pre><code>{lines.map((ln, i) => (
        <div key={i}>{ln.map((tk, j) => <span key={j} className={'tok-' + tk.t}>{tk.v}</span>)}</div>
      ))}</code></pre>
    </div>
  )
}

function SelectorBlock({ selector, onCopy }) {
  return (
    <div className="code-block">
      <div className="cb-head">
        <Ic.Code size={12} />
        <span className="tag">selector</span>
        <span className="spacer"></span>
        <button className="copy" onClick={() => onCopy(selector)}><Ic.Copy size={12} /> copy</button>
      </div>
      <pre><code><span className="tok-tag">{selector}</span></code></pre>
    </div>
  )
}

function ViolationCard({ v, open, onToggle, onCopy }) {
  const isFixed = v.diffStatus === 'fixed'
  return (
    <div className={'vcard s-' + (isFixed ? 'fixed' : v.severity) + (open && !isFixed ? ' open' : '')}>
      <button className="vhead" onClick={isFixed ? undefined : onToggle}
              style={isFixed ? { cursor: 'default' } : undefined}>
        <span className="sev-badge"><span className="d"></span>{isFixed ? 'resolved' : v.severity}</span>
        <span className="vmain">
          <span className="vtitle">
            {v.rule}
            {!isFixed && v.occurrences > 1 && <span className="occ">×{v.occurrences}</span>}
          </span>
          <span className="vsel"><b>{v.selector}</b></span>
        </span>
        <span className="wcag">
          <span className="ref">{v.wcag}</span>
          <span className="lvl">{v.level}</span>
        </span>
        {v.diffStatus === 'new' && <span className="diff-tag new">★ New</span>}
        {v.diffStatus === 'fixed' && <span className="diff-tag fixed">✓ Fixed</span>}
        {!isFixed && <span className="chev"><Ic.Chevron size={16} /></span>}
      </button>
      {!isFixed && (
        <div className="vbody">
          <div className="inner">
            <div className="pad">
              <p style={{ margin: '14px 0 0', color: 'var(--fg-2)', fontSize: 15, lineHeight: 1.6, maxWidth: '68ch' }}>
                {v.desc}
              </p>
              {v.code
                ? <CodeBlock lines={v.code} onCopy={onCopy} />
                : <SelectorBlock selector={v.selector} onCopy={onCopy} />}
              <div className="fix">
                <span className="ico"><Ic.Check size={13} /></span>
                <div className="ftxt">
                  <div className="flbl">Recommended fix</div>
                  <p dangerouslySetInnerHTML={{ __html: v.fix }}></p>
                </div>
              </div>
              <div className="vfoot">
                {v.link && (
                  <a href={v.link} target="_blank" rel="noopener">
                    <Ic.Ext size={13} /> Understanding {v.wcag}
                  </a>
                )}
                <span className="spacer"></span>
                <span className="impact">impact: <b>{v.impact}</b></span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', marginLeft: 12 }}>
                  via {v.source}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ResultsScreen({ data, prevResult, isRerunning, rerunAuditId, target, onReset, onCopy, onRerun, onRerunDone }) {
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('severity')
  const [openIds, setOpenIds] = useState(() => new Set([data.violations[0]?.id].filter(Boolean)))
  const [exportOpen, setExportOpen] = useState(false)

  // Connect to rerun SSE stream
  useEffect(() => {
    if (!rerunAuditId) return
    const es = new EventSource(`/api/audit/${rerunAuditId}/stream`)
    es.addEventListener('result', (e) => { es.close(); onRerunDone(JSON.parse(e.data)) })
    es.addEventListener('error', (e) => { es.close() })
    return () => es.close()
  }, [rerunAuditId])

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportOpen) return
    const close = () => setExportOpen(false)
    setTimeout(() => document.addEventListener('click', close), 0)
    return () => document.removeEventListener('click', close)
  }, [exportOpen])

  const { active, fixed } = useMemo(() => computeDiff(data, prevResult), [data, prevResult])

  const diffCounts = useMemo(() => {
    if (!prevResult) return null
    return {
      fixed: fixed.length,
      newCount: active.filter(v => v.diffStatus === 'new').length,
      unchanged: active.filter(v => v.diffStatus === 'unchanged').length,
    }
  }, [active, fixed, prevResult])

  const counts = useMemo(() => {
    const c = { critical: 0, warning: 0, info: 0 }
    data.violations.forEach((v) => { if (c[v.severity] !== undefined) c[v.severity]++ })
    return c
  }, [data])

  const shown = useMemo(() => {
    let list = active.filter((v) => filter === 'all' || v.severity === filter)
    list = [...list].sort((a, b) => {
      if (prevResult) {
        const da = DIFF_ORDER[a.diffStatus] ?? 1, db = DIFF_ORDER[b.diffStatus] ?? 1
        if (da !== db) return da - db
      }
      return sort === 'severity' ? SEV_ORDER[a.severity] - SEV_ORDER[b.severity]
        : sort === 'wcag' ? a.wcag.localeCompare(b.wcag, undefined, { numeric: true })
        : b.occurrences - a.occurrences
    })
    return [...list, ...(filter === 'all' ? fixed : [])]
  }, [active, fixed, filter, sort, prevResult])

  const toggle = (id) => setOpenIds((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const total = data.violations.length

  return (
    <div className="results fade-in">
      <div className="result-target">
        <button className="back" onClick={onReset}><Ic.Back size={14} /> new audit</button>
        <span className="url"><span className="led"></span>{target}</span>
        <span className="spacer"></span>
        <button className="btn btn-ghost" style={{ padding: '9px 16px', fontSize: 13 }}
                onClick={onRerun} disabled={isRerunning}>
          <Ic.Refresh size={13} /> {isRerunning ? 'Running…' : 'Re-run'}
        </button>
        <div className="export-wrap">
          <button className="btn btn-ghost" style={{ padding: '9px 16px', fontSize: 13 }}
                  onClick={(e) => { e.stopPropagation(); setExportOpen(o => !o) }}>
            <Ic.Download size={13} /> Export ▾
          </button>
          {exportOpen && (
            <div className="export-dropdown" onClick={e => e.stopPropagation()}>
              <button className="export-opt" onClick={() => { onCopy(formatMarkdown(data, target)); setExportOpen(false) }}>
                <Ic.Code size={13} className="opt-icon" />
                <div>PR Markdown<span className="opt-sub">Checkbox list for PR descriptions</span></div>
              </button>
              <button className="export-opt" onClick={() => { onCopy(formatSlack(data, target)); setExportOpen(false) }}>
                <Ic.Copy size={13} className="opt-icon" />
                <div>Slack summary<span className="opt-sub">Short plain-text for Slack / Linear</span></div>
              </button>
            </div>
          )}
        </div>
      </div>

      {isRerunning && (
        <div className="rerun-bar">
          <div className="rerun-spinner"></div>
          Re-running audit — results will update when complete
          <span className="spacer"></span>
          <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>Previous results shown</span>
        </div>
      )}

      <div className="summary">
        <div className="score">
          <span className="grade" style={{
            fontSize: data.conformance === 'Non-conformant' ? 24 : 36,
            lineHeight: 1,
            color: data.conformance === 'Level AA' ? 'var(--pass)'
              : data.conformance === 'Level A' ? 'var(--warn)'
              : 'var(--crit)',
          }}>
            {data.conformance}
          </span>
          <span className="num">
            <span className="lbl" style={{ marginTop: 6 }}>WCAG 2.1 conformance</span>
          </span>
        </div>
        <div className="vr"></div>
        <div className="summary-right">
          <div className="headline">
            {total} issues found across <em>{data.elementsScanned.toLocaleString()}</em> elements
          </div>
          <div className="sev-counts">
            <span className="sev-pill is-crit"><span className="d"></span><b>{counts.critical}</b> critical</span>
            <span className="sev-pill is-warn"><span className="d"></span><b>{counts.warning}</b> warning</span>
            <span className="sev-pill is-info"><span className="d"></span><b>{counts.info}</b> info</span>
            <span className="sev-pill is-pass"><span className="d"></span><b>{data.passed}</b> passed</span>
          </div>
          {diffCounts && (
            <div className="diff-summary">
              <span className="ds-fixed">✓ {diffCounts.fixed} fixed</span>
              <span className="ds-new">★ {diffCounts.newCount} new</span>
              <span className="ds-unchanged">· {diffCounts.unchanged} unchanged</span>
            </div>
          )}
        </div>
      </div>

      <div className="res-toolbar">
        <div className="grp">
          {[
            { k: 'all', l: 'All', n: total },
            { k: 'critical', l: 'Critical', n: counts.critical, d: 'var(--crit)' },
            { k: 'warning', l: 'Warning', n: counts.warning, d: 'var(--warn)' },
            { k: 'info', l: 'Info', n: counts.info, d: 'var(--info)' },
          ].map((f) => (
            <button key={f.k} className={'filter-btn' + (filter === f.k ? ' active' : '')} onClick={() => setFilter(f.k)}>
              {f.d && <span className="d" style={{ background: f.d }}></span>}
              {f.l} <span className="n">{f.n}</span>
            </button>
          ))}
        </div>
        <span className="spacer"></span>
        <label className="sort-sel">
          sort
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="severity">by severity</option>
            <option value="wcag">by WCAG ref</option>
            <option value="occurrences">by occurrences</option>
          </select>
        </label>
      </div>

      <div className="vlist stagger">
        {shown.length === 0 ? (
          <div className="empty">
            <div className="big"><Ic.CheckCircle size={34} /></div>
            No {filter} issues. Nice.
          </div>
        ) : shown.map((v, i) => (
          <div key={v.id} style={{ animationDelay: (i * 45) + 'ms' }}>
            <ViolationCard v={v} open={openIds.has(v.id)} onToggle={() => toggle(v.id)} onCopy={onCopy} />
          </div>
        ))}
      </div>
    </div>
  )
}

function formatMarkdown(data, target) {
  const sev = { critical: 'Critical', warning: 'Warning', info: 'Info' }
  const levelACount = data.violations.filter(v => v.level === 'A' && v.severity === 'critical').length
  const suffix = levelACount > 0 ? ` (${levelACount} Level A failure${levelACount > 1 ? 's' : ''})` : ''
  const lines = [
    `## Accessibility audit — ${target}`,
    `**Conformance:** ${data.conformance}${suffix}`,
    '',
    ...data.violations.map(v =>
      `- [ ] **[${sev[v.severity] ?? v.severity}]** ${v.rule} · WCAG ${v.wcag} · \`${v.selector}\``
    ),
  ]
  return lines.join('\n')
}

function formatSlack(data, target) {
  const counts = { critical: 0, warning: 0, info: 0 }
  data.violations.forEach(v => { if (counts[v.severity] !== undefined) counts[v.severity]++ })
  const top = data.violations.slice(0, 3).map(v => `${v.rule} (${v.wcag})`).join(', ')
  return [
    `AccessLens · ${target}`,
    `${data.conformance} · ${counts.critical} critical, ${counts.warning} warnings, ${counts.info} info`,
    top ? `Top issues: ${top}` : 'No issues found',
  ].join('\n')
}
```

- [ ] **Step 2: Confirm Vite builds without errors**

```bash
cd /Users/edvard/Developer/wcag-agent/client && npx vite build 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /Users/edvard/Developer/wcag-agent
git add client/src/components/ResultsScreen.jsx
git commit -m "feat: ResultsScreen diff comparison, rerun bar, export dropdown (PR Markdown + Slack)"
```

---

## Task 6: Smoke test + push

- [ ] **Step 1: Run all server tests**

```bash
cd /Users/edvard/Developer/wcag-agent/server && node --test axe.test.js score.test.js claude.test.js
```

Expected: 29 passing.

- [ ] **Step 2: Start both server and client**

```bash
cd /Users/edvard/Developer/wcag-agent && npm run dev
```

- [ ] **Step 3: Test component mode**

Open `http://localhost:5173`. Click **Component** in the mode toggle. Confirm:
- Context chips appear (Auto-detect, Form, Nav, Modal, Card, Button)
- No URL tab visible
- Paste `<form><input placeholder="Email" /><button>Submit</button></form>` and run audit
- Verify results appear and do NOT include "missing page title" or "missing html lang attribute" violations

- [ ] **Step 4: Test page mode + localhost history**

Click **Page** in the mode toggle. Enter `localhost:3000`. Run audit (will likely error — that's fine). Confirm the URL appears in the "Recent local" section on the next visit to the input screen.

- [ ] **Step 5: Test re-run comparison**

Run any audit (use the test HTML from the original smoke test). When results appear, click **Re-run**. Confirm:
- The rerun bar appears at the top of the results screen
- Results update after the audit completes
- The diff summary line appears in the summary banner

- [ ] **Step 6: Test export**

Click **Export ▾**. Confirm the dropdown opens with "PR Markdown" and "Slack summary". Click one — confirm the toast appears.

- [ ] **Step 7: Push to GitHub**

```bash
cd /Users/edvard/Developer/wcag-agent && git push
```

---

## Self-review

**Spec coverage:**
- ✅ Mode toggle (Page | Component) in console-head — Task 2
- ✅ Mode persisted in localStorage — Task 2
- ✅ Page mode: URL tab + Full page HTML tab — Task 2
- ✅ Localhost quick-access pills — Task 2
- ✅ Recent URLs in localStorage (max 5, localhost only) — Task 2
- ✅ Component mode: context chips — Task 3
- ✅ componentType passed in onRun payload — Task 3
- ✅ Backend accepts mode + componentType — Task 1
- ✅ Component prompt suppresses document-level checks — Task 1
- ✅ Component type hints in user message — Task 1
- ✅ resolveMode auto-detects full page from html/body tags — Task 1
- ✅ App.jsx lastPayload, prevResult, isRerunning, rerunAuditId — Task 4
- ✅ Re-run stays on results screen (phase stays 'results') — Task 4
- ✅ Rerun bar with spinner — Task 5
- ✅ Diff computation: new/unchanged/fixed — Task 5
- ✅ Fixed violations shown below active, strikethrough — Task 5
- ✅ Diff summary line (✓ N fixed · ★ N new · N unchanged) — Task 5
- ✅ Export dropdown with PR Markdown + Slack summary — Task 5
- ✅ All CSS additions in styles.css — Task 2

**Type consistency:**
- `onRun({ display, url?, html?, mode, componentType })` — defined Task 2, consumed Task 4 ✅
- `onRerun()` — defined Task 4, rendered Task 4, passed to ResultsScreen Task 5 ✅
- `onRerunDone(data)` — defined Task 4, called by ResultsScreen Task 5 ✅
- `rerunAuditId` — set in Task 4, consumed as prop in Task 5 ✅
- `diffKey(v)` = `${v.wcag}:${v.selector}` — consistent with score.js deduplication key ✅
- `v.diffStatus: 'new' | 'unchanged' | 'fixed' | null` — set in computeDiff Task 5, read in ViolationCard Task 5 ✅
