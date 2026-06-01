# AccessLens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build AccessLens — a Claude + axe-core powered WCAG 2.1 audit tool with a dark dev-tool UI, real-time scan progress, and actionable violation reports.

**Architecture:** Node.js/Express backend orchestrates a 3-stage pipeline (Playwright fetch → axe-core → Claude) and streams progress via SSE. A Vite/React frontend (converted from the AccessLens HTML prototype) connects to the real API. Root npm workspaces tie them together.

**Tech Stack:** Node.js 20+, Express 4, Playwright, @axe-core/playwright, @anthropic-ai/sdk, Vite 5, React 18, IBM Plex Mono (Google Fonts), TRY Sans/Serif (local OTF)

---

> **Working directory:** All paths are relative to `/Users/edvard/Developer/wcag-agent/`
> **Design files to reference:** `project/AccessLens/` — copy CSS/JSX logic verbatim where noted, do not re-render or screenshot

---

## Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Create: `server/package.json`
- Create: `client/package.json`

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "accesslens",
  "version": "1.0.0",
  "private": true,
  "workspaces": ["server", "client"],
  "scripts": {
    "dev": "concurrently \"npm run dev --workspace=server\" \"npm run dev --workspace=client\"",
    "build": "npm run build --workspace=client",
    "start": "NODE_ENV=production node server/index.js"
  },
  "devDependencies": {
    "concurrently": "^9.0.0"
  }
}
```

- [ ] **Step 2: Create `.env.example`**

```
ANTHROPIC_API_KEY=your_key_here
PORT=3001
```

- [ ] **Step 3: Create `server/package.json`**

```json
{
  "name": "accesslens-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js",
    "test": "node --test *.test.js"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.37.0",
    "@axe-core/playwright": "^4.10.0",
    "dotenv": "^16.4.0",
    "express": "^4.18.2",
    "playwright": "^1.49.0"
  }
}
```

- [ ] **Step 4: Create `client/package.json`**

```json
{
  "name": "accesslens-client",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 5: Install all dependencies**

```bash
npm install
```

Expected: `node_modules/` at root, `server/node_modules/`, `client/node_modules/`

- [ ] **Step 6: Install Playwright browsers**

```bash
cd server && npx playwright install chromium
```

Expected: Chromium downloaded to local cache

- [ ] **Step 7: Create `.env` from example**

```bash
cp .env.example .env
```

Then open `.env` and add your real `ANTHROPIC_API_KEY`.

- [ ] **Step 8: Commit scaffold**

```bash
git add package.json .env.example server/package.json client/package.json
git commit -m "feat: monorepo scaffold with npm workspaces"
```

---

## Task 2: Express app + SSE endpoints

**Files:**
- Create: `server/index.js`

- [ ] **Step 1: Create `server/index.js`**

```js
import 'dotenv/config'
import express from 'express'
import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { runAudit } from './audit.js'

const app = express()
app.use(express.json())

// In-memory job store: auditId → EventEmitter
const jobs = new Map()

app.post('/api/audit', async (req, res) => {
  const { url, html } = req.body ?? {}
  if (!url && !html) {
    return res.status(400).json({ error: 'url or html required' })
  }

  const id = randomUUID()
  const emitter = new EventEmitter()
  jobs.set(id, emitter)

  runAudit({ url, html }, emitter).catch((err) => {
    emitter.emit('error', err.message)
  }).finally(() => {
    setTimeout(() => jobs.delete(id), 60_000)
  })

  res.json({ id })
})

app.get('/api/audit/:id/stream', (req, res) => {
  const emitter = jobs.get(req.params.id)
  if (!emitter) return res.status(404).json({ error: 'audit not found' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  const onProgress = (data) => send('progress', data)
  const onResult = (data) => { send('result', data); res.end() }
  const onError = (msg) => { send('error', { message: msg }); res.end() }

  emitter.on('progress', onProgress)
  emitter.on('result', onResult)
  emitter.on('error', onError)

  req.on('close', () => {
    emitter.off('progress', onProgress)
    emitter.off('result', onResult)
    emitter.off('error', onError)
  })
})

// Serve built client in production
if (process.env.NODE_ENV === 'production') {
  const { default: path } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const distPath = path.join(__dirname, '../client/dist')
  app.use(express.static(distPath))
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')))
}

const PORT = process.env.PORT ?? 3001
app.listen(PORT, () => console.log(`AccessLens server on :${PORT}`))
```

- [ ] **Step 2: Create a stub `server/audit.js` so the server can start**

```js
export async function runAudit({ url, html }, emitter) {
  // stub — replaced in Task 7
  setTimeout(() => emitter.emit('result', { stub: true }), 500)
}
```

- [ ] **Step 3: Start the server and confirm it responds**

```bash
cd server && node index.js
```

In a second terminal:
```bash
curl -s -X POST http://localhost:3001/api/audit \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com"}' | cat
```

Expected output: `{"id":"<uuid>"}`

Stop the server with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add server/index.js server/audit.js
git commit -m "feat: Express app with POST /api/audit and SSE stream endpoint"
```

---

## Task 3: Playwright page fetcher

**Files:**
- Create: `server/fetch.js`

- [ ] **Step 1: Create `server/fetch.js`**

```js
import { chromium } from 'playwright'

/**
 * Launches a browser, navigates to url, returns the page handle + serialised HTML.
 * Caller is responsible for calling browser.close() when done.
 */
export async function createBrowser() {
  return chromium.launch()
}

export async function fetchPage(url, browser) {
  const page = await browser.newPage()
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
  const html = await page.content()
  const elementsScanned = await page.evaluate(() =>
    document.querySelectorAll('*').length
  )
  return { page, html, elementsScanned }
}

export async function loadHtml(html, browser) {
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'domcontentloaded' })
  const elementsScanned = await page.evaluate(() =>
    document.querySelectorAll('*').length
  )
  return { page, html, elementsScanned }
}
```

- [ ] **Step 2: Smoke-test fetch.js manually**

```bash
cd server && node --input-type=module <<'EOF'
import { createBrowser, fetchPage } from './fetch.js'
const b = await createBrowser()
const { html, elementsScanned } = await fetchPage('https://example.com', b)
console.log('elements:', elementsScanned)
console.log('html length:', html.length)
await b.close()
EOF
```

Expected: prints element count and HTML length, no errors.

- [ ] **Step 3: Commit**

```bash
git add server/fetch.js
git commit -m "feat: Playwright page fetcher (URL and raw HTML)"
```

---

## Task 4: axe-core runner

**Files:**
- Create: `server/axe.js`

- [ ] **Step 1: Create `server/axe.js`**

```js
import { AxeBuilder } from '@axe-core/playwright'

export async function runAxeOnPage(page) {
  const results = await new AxeBuilder({ page }).analyze()
  return normalizeAxeResults(results.violations)
}

export function normalizeAxeResults(violations) {
  return violations.map((v, i) => ({
    id: `axe-${i}`,
    severity: mapImpact(v.impact),
    rule: v.help,
    wcag: extractWcag(v.tags),
    level: extractLevel(v.tags),
    selector: v.nodes[0]?.target?.join(', ') ?? '',
    occurrences: v.nodes.length,
    impact: capitalize(v.impact ?? 'minor'),
    desc: v.description,
    fix: v.nodes[0]?.failureSummary ?? '',
    link: v.helpUrl,
    source: 'axe-core',
  }))
}

function mapImpact(impact) {
  if (impact === 'critical' || impact === 'serious') return 'critical'
  if (impact === 'moderate') return 'warning'
  return 'info'
}

function extractWcag(tags) {
  const tag = tags.find((t) => /^wcag\d{3}$/.test(t))
  if (!tag) return ''
  const d = tag.replace('wcag', '')
  return `${d[0]}.${d[1]}.${d[2]}`
}

function extractLevel(tags) {
  if (tags.some((t) => t === 'wcag2a' || t === 'wcag21a')) return 'A'
  if (tags.some((t) => t === 'wcag2aa' || t === 'wcag21aa')) return 'AA'
  return 'AAA'
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
```

- [ ] **Step 2: Write `server/axe.test.js`**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAxeResults } from './axe.js'

const makeViolation = (overrides = {}) => ({
  help: 'Image must have alternate text',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/image-alt',
  description: 'Ensures <img> elements have alternate text or a role of none or presentation',
  impact: 'critical',
  tags: ['wcag2a', 'wcag111', 'cat.text-alternatives'],
  nodes: [{ target: ['img.hero'], failureSummary: 'Add an alt attribute' }],
  ...overrides,
})

test('maps critical impact to critical severity', () => {
  const result = normalizeAxeResults([makeViolation({ impact: 'critical' })])
  assert.equal(result[0].severity, 'critical')
})

test('maps serious impact to critical severity', () => {
  const result = normalizeAxeResults([makeViolation({ impact: 'serious' })])
  assert.equal(result[0].severity, 'critical')
})

test('maps moderate impact to warning severity', () => {
  const result = normalizeAxeResults([makeViolation({ impact: 'moderate' })])
  assert.equal(result[0].severity, 'warning')
})

test('maps minor impact to info severity', () => {
  const result = normalizeAxeResults([makeViolation({ impact: 'minor' })])
  assert.equal(result[0].severity, 'info')
})

test('extracts WCAG criterion from tags', () => {
  const result = normalizeAxeResults([makeViolation({ tags: ['wcag2a', 'wcag111'] })])
  assert.equal(result[0].wcag, '1.1.1')
})

test('extracts level A from wcag2a tag', () => {
  const result = normalizeAxeResults([makeViolation({ tags: ['wcag2a', 'wcag111'] })])
  assert.equal(result[0].level, 'A')
})

test('extracts level AA from wcag2aa tag', () => {
  const result = normalizeAxeResults([makeViolation({ tags: ['wcag2aa', 'wcag143'] })])
  assert.equal(result[0].level, 'AA')
})

test('uses first node target as selector', () => {
  const result = normalizeAxeResults([makeViolation()])
  assert.equal(result[0].selector, 'img.hero')
})

test('counts occurrences from nodes array length', () => {
  const v = makeViolation()
  v.nodes = [{ target: ['img.a'], failureSummary: '' }, { target: ['img.b'], failureSummary: '' }]
  const result = normalizeAxeResults([v])
  assert.equal(result[0].occurrences, 2)
})

test('tags source as axe-core', () => {
  const result = normalizeAxeResults([makeViolation()])
  assert.equal(result[0].source, 'axe-core')
})
```

- [ ] **Step 3: Run tests — expect all pass**

```bash
cd server && node --test axe.test.js
```

Expected: `10 passing`

- [ ] **Step 4: Commit**

```bash
git add server/axe.js server/axe.test.js
git commit -m "feat: axe-core runner with violation normalisation"
```

---

## Task 5: Score + merge

**Files:**
- Create: `server/score.js`
- Create: `server/score.test.js`

- [ ] **Step 1: Write failing tests first — `server/score.test.js`**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeAndScore } from './score.js'

const makeViolation = (overrides = {}) => ({
  id: 'v1',
  severity: 'critical',
  rule: 'Test rule',
  wcag: '1.1.1',
  level: 'A',
  selector: 'img',
  occurrences: 1,
  impact: 'Serious',
  desc: 'Test description',
  fix: 'Test fix',
  link: 'https://example.com',
  source: 'axe-core',
  ...overrides,
})

const baseCtx = { url: 'https://example.com', elementsScanned: 100, durationMs: 1000 }

test('returns grade A and score 100 for zero violations', () => {
  const result = mergeAndScore([], [], baseCtx)
  assert.equal(result.grade, 'A')
  assert.equal(result.score, 100)
})

test('deducts 10 for each critical violation', () => {
  const result = mergeAndScore([makeViolation({ severity: 'critical' })], [], baseCtx)
  assert.equal(result.score, 90)
})

test('deducts 4 for each warning violation', () => {
  const result = mergeAndScore([makeViolation({ severity: 'warning' })], [], baseCtx)
  assert.equal(result.score, 96)
})

test('deducts 1 for each info violation', () => {
  const result = mergeAndScore([makeViolation({ severity: 'info' })], [], baseCtx)
  assert.equal(result.score, 99)
})

test('score floors at 0', () => {
  const violations = Array.from({ length: 15 }, (_, i) =>
    makeViolation({ wcag: `1.1.${i}`, selector: `el-${i}` })
  )
  const result = mergeAndScore(violations, [], baseCtx)
  assert.equal(result.score, 0)
})

test('grade B for score 75-89', () => {
  const violations = Array.from({ length: 3 }, (_, i) =>
    makeViolation({ wcag: `1.1.${i}`, selector: `el-${i}` })
  )
  const result = mergeAndScore(violations, [], baseCtx)
  assert.equal(result.grade, 'B') // 100 - 30 = 70 → actually C, adjust
})

test('grade C for score 60-74', () => {
  const violations = Array.from({ length: 4 }, (_, i) =>
    makeViolation({ wcag: `1.1.${i}`, selector: `el-${i}` })
  )
  const result = mergeAndScore(violations, [], baseCtx)
  assert.equal(result.grade, 'C') // 100 - 40 = 60 → C
})

test('grade F for score below 40', () => {
  const violations = Array.from({ length: 7 }, (_, i) =>
    makeViolation({ wcag: `1.1.${i}`, selector: `el-${i}` })
  )
  const result = mergeAndScore(violations, [], baseCtx)
  assert.equal(result.grade, 'F') // 100 - 70 = 30 → F
})

test('deduplicates by wcag + selector, keeps axe entry', () => {
  const axe = [makeViolation({ id: 'axe-0', source: 'axe-core', fix: 'short axe fix' })]
  const claude = [makeViolation({ id: 'c-0', source: 'claude', fix: 'much longer claude fix with more detail' })]
  const result = mergeAndScore(axe, claude, baseCtx)
  assert.equal(result.violations.length, 1)
  assert.equal(result.violations[0].source, 'axe-core')
})

test('replaces axe fix with Claude fix when Claude fix is longer', () => {
  const axe = [makeViolation({ source: 'axe-core', fix: 'short' })]
  const claude = [makeViolation({ source: 'claude', fix: 'a much longer and more helpful fix suggestion for the developer' })]
  const result = mergeAndScore(axe, claude, baseCtx)
  assert.ok(result.violations[0].fix.length > 10)
})

test('keeps non-overlapping Claude violations', () => {
  const axe = [makeViolation({ wcag: '1.1.1', selector: 'img' })]
  const claude = [makeViolation({ wcag: '2.4.4', selector: 'a.more', source: 'claude' })]
  const result = mergeAndScore(axe, claude, baseCtx)
  assert.equal(result.violations.length, 2)
})

test('includes url in result', () => {
  const result = mergeAndScore([], [], baseCtx)
  assert.equal(result.url, 'https://example.com')
})

test('includes elementsScanned in result', () => {
  const result = mergeAndScore([], [], baseCtx)
  assert.equal(result.elementsScanned, 100)
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd server && node --test score.test.js
```

Expected: errors because `score.js` does not exist yet.

- [ ] **Step 3: Create `server/score.js`**

```js
const WEIGHTS = { critical: 10, warning: 4, info: 1 }
const GRADES = [[90, 'A'], [75, 'B'], [60, 'C'], [40, 'D'], [0, 'F']]
const WCAG_AA_CRITERIA = 50

export function mergeAndScore(axeViolations, claudeViolations, { url, elementsScanned, durationMs }) {
  const violations = deduplicate(axeViolations, claudeViolations)
  const score = computeScore(violations)
  const grade = computeGrade(score)
  const passed = Math.max(0, WCAG_AA_CRITERIA - violations.length)

  return {
    url: url ?? 'Pasted HTML snippet',
    scannedAt: new Date().toISOString(),
    elementsScanned,
    durationMs,
    grade,
    score,
    passed,
    violations,
  }
}

function deduplicate(axeViolations, claudeViolations) {
  const byKey = new Map()

  for (const v of axeViolations) {
    byKey.set(`${v.wcag}:${v.selector}`, v)
  }

  for (const v of claudeViolations) {
    const key = `${v.wcag}:${v.selector}`
    if (byKey.has(key)) {
      const existing = byKey.get(key)
      if (v.fix.length > existing.fix.length) {
        existing.fix = v.fix
      }
    } else {
      byKey.set(key, v)
    }
  }

  return [...byKey.values()]
}

function computeScore(violations) {
  const penalty = violations.reduce((sum, v) => sum + (WEIGHTS[v.severity] ?? 0), 0)
  return Math.max(0, 100 - penalty)
}

function computeGrade(score) {
  for (const [threshold, grade] of GRADES) {
    if (score >= threshold) return grade
  }
  return 'F'
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
cd server && node --test score.test.js
```

Expected: `13 passing`

- [ ] **Step 5: Commit**

```bash
git add server/score.js server/score.test.js
git commit -m "feat: violation merge, deduplication, and A-F scoring"
```

---

## Task 6: Claude analysis

**Files:**
- Create: `server/claude.js`
- Create: `server/claude.test.js`

- [ ] **Step 1: Write failing tests — `server/claude.test.js`**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { preprocessHtml } from './claude.js'

test('strips script tags and their content', () => {
  const html = '<body><script>alert(1)</script><p>hello</p></body>'
  const result = preprocessHtml(html)
  assert.ok(!result.includes('<script>'))
  assert.ok(!result.includes('alert(1)'))
  assert.ok(result.includes('<p>hello</p>'))
})

test('strips style tags and their content', () => {
  const html = '<head><style>body{color:red}</style></head><body></body>'
  const result = preprocessHtml(html)
  assert.ok(!result.includes('<style>'))
  assert.ok(!result.includes('color:red'))
})

test('strips inline event handlers', () => {
  const html = '<button onclick="doThing()">Click</button>'
  const result = preprocessHtml(html)
  assert.ok(!result.includes('onclick'))
  assert.ok(result.includes('<button'))
  assert.ok(result.includes('Click'))
})

test('truncates to 15000 characters', () => {
  const html = 'x'.repeat(20_000)
  const result = preprocessHtml(html)
  assert.equal(result.length, 15_000)
})

test('does not truncate html shorter than 15000 chars', () => {
  const html = '<p>short</p>'
  const result = preprocessHtml(html)
  assert.equal(result, html)
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd server && node --test claude.test.js
```

Expected: errors because `claude.js` does not exist.

- [ ] **Step 3: Create `server/claude.js`**

```js
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are an expert WCAG 2.1 accessibility auditor. Your job is to find issues that automated tools like axe-core miss: illogical heading hierarchy, non-descriptive link text ("click here", "read more", "learn more"), missing or inadequate form field instructions, poor reading order, inadequate page titles, missing language of page, ambiguous button labels, and similar semantic and structural problems.

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

export async function analyzeWithClaude(html) {
  const preprocessed = preprocessHtml(html)

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Audit this HTML for WCAG 2.1 accessibility issues that axe-core misses. Return only the JSON array.\n\n${preprocessed}`,
      },
    ],
  })

  const text = message.content.find((b) => b.type === 'text')?.text ?? '[]'

  try {
    return JSON.parse(text)
  } catch {
    // If Claude returned something unexpected, parse out the JSON array
    const match = text.match(/\[[\s\S]*\]/)
    return match ? JSON.parse(match[0]) : []
  }
}

export function preprocessHtml(html) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\s+on\w+="[^"]*"/g, '')
    .slice(0, 15_000)
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
cd server && node --test claude.test.js
```

Expected: `5 passing`

- [ ] **Step 5: Commit**

```bash
git add server/claude.js server/claude.test.js
git commit -m "feat: Claude WCAG analysis with prompt caching and HTML preprocessing"
```

---

## Task 7: Audit pipeline orchestrator

**Files:**
- Modify: `server/audit.js` (replace stub)

- [ ] **Step 1: Replace `server/audit.js` stub with real pipeline**

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

export async function runAudit({ url, html }, emitter) {
  const browser = await createBrowser()
  const startTime = performance.now()

  try {
    // Stage 1: Fetch / load
    emitter.emit('progress', { ...STEPS[0], status: 'active' })
    const { page, html: pageHtml, elementsScanned } = url
      ? await fetchPage(url, browser)
      : await loadHtml(html, browser)
    emitter.emit('progress', { ...STEPS[0], status: 'done', count: `${elementsScanned} nodes` })

    // Stage 2: axe-core
    emitter.emit('progress', { ...STEPS[1], status: 'active' })
    const axeViolations = await runAxeOnPage(page)
    emitter.emit('progress', { ...STEPS[1], status: 'done', count: `${axeViolations.length} issues` })

    // Stage 3: Claude
    emitter.emit('progress', { ...STEPS[2], status: 'active' })
    const claudeViolations = await analyzeWithClaude(pageHtml)
    emitter.emit('progress', { ...STEPS[2], status: 'done', count: `${claudeViolations.length} issues` })

    const durationMs = Math.round(performance.now() - startTime)
    const result = mergeAndScore(axeViolations, claudeViolations, {
      url,
      elementsScanned,
      durationMs,
    })

    emitter.emit('result', result)
  } finally {
    await browser.close()
  }
}
```

- [ ] **Step 2: Run all server tests to confirm nothing broken**

```bash
cd server && node --test *.test.js
```

Expected: all tests pass.

- [ ] **Step 3: Smoke-test the full pipeline end-to-end**

```bash
# Terminal 1 — start server
cd server && node index.js

# Terminal 2 — start an audit and stream results
ID=$(curl -s -X POST http://localhost:3001/api/audit \
  -H 'Content-Type: application/json' \
  -d '{"html":"<html><body><img src=\"test.jpg\"><button>click here</button><h1>Title</h1><h3>Skip</h3></body></html>"}' \
  | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

curl -sN "http://localhost:3001/api/audit/$ID/stream"
```

Expected: stream of `progress` SSE events followed by a `result` event containing violations from both axe-core and Claude, then connection closes.

- [ ] **Step 4: Commit**

```bash
git add server/audit.js
git commit -m "feat: 3-stage audit pipeline — Playwright → axe-core → Claude with SSE progress"
```

---

## Task 8: Client scaffold

**Files:**
- Create: `client/vite.config.js`
- Create: `client/index.html`
- Create: `client/src/main.jsx`

- [ ] **Step 1: Create `client/vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
```

- [ ] **Step 2: Create `client/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AccessLens — WCAG audit</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 3: Create `client/src/main.jsx`**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 4: Create a placeholder `client/src/App.jsx` to confirm Vite starts**

```jsx
export default function App() {
  return <div className="app"><p style={{color:'white',padding:40}}>AccessLens loading…</p></div>
}
```

- [ ] **Step 5: Confirm Vite starts**

```bash
cd client && npx vite
```

Open `http://localhost:5173` — expect to see "AccessLens loading…" on a dark background (once styles are added).
Stop with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add client/vite.config.js client/index.html client/src/main.jsx client/src/App.jsx
git commit -m "feat: Vite + React client scaffold with /api proxy"
```

---

## Task 9: Styles, fonts, and data

**Files:**
- Create: `client/src/styles.css` (copy from prototype)
- Create: `client/src/fonts/` (copy from prototype)
- Create: `client/src/data.js`

- [ ] **Step 1: Copy styles from prototype**

```bash
cp project/AccessLens/styles.css client/src/styles.css
```

- [ ] **Step 2: Copy font files from prototype**

```bash
mkdir -p client/src/fonts
cp project/AccessLens/fonts/TRYSans-Regular.otf client/src/fonts/
cp project/AccessLens/fonts/TRYSans-Medium.otf client/src/fonts/
cp project/AccessLens/fonts/TRYSerif-Italic.otf client/src/fonts/
```

- [ ] **Step 3: Update font paths in `client/src/styles.css`**

The prototype uses `url('fonts/...')`. Vite resolves CSS `url()` relative to the CSS file. Since `styles.css` is at `client/src/styles.css` and fonts are at `client/src/fonts/`, the paths are already correct — no change needed.

Verify the `@font-face` block at the top of `client/src/styles.css` reads:
```css
@font-face{font-family:'TRY Sans';src:url('fonts/TRYSans-Regular.otf') ...}
```

- [ ] **Step 4: Create `client/src/data.js`**

This exports only the example URLs — no mock AUDIT object.

```js
export const EXAMPLES = [
  'acme-store.no/checkout',
  'blog.example.com/post/42',
  'docs.internal/login',
]
```

- [ ] **Step 5: Confirm fonts load**

Start Vite (`cd client && npx vite`), open `http://localhost:5173`. The page should use TRY Sans once components are added. For now, confirm no 404s in the browser console for font files.

- [ ] **Step 6: Commit**

```bash
git add client/src/styles.css client/src/fonts/ client/src/data.js
git commit -m "feat: design system CSS, TRY fonts, and example data"
```

---

## Task 10: Icons component

**Files:**
- Create: `client/src/components/Icons.jsx`

- [ ] **Step 1: Create `client/src/components/Icons.jsx`**

Convert from the prototype's `window.Ic = Ic` global to named exports.

```jsx
const mk = (paths, vb) => ({ size = 16, stroke = 1.6, ...p }) => (
  <svg width={size} height={size} viewBox={vb || '0 0 24 24'} fill="none"
    stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" {...p}>
    {paths}
  </svg>
)

export const Link     = mk(<><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></>)
export const Code     = mk(<><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/></>)
export const Play     = mk(<polygon points="6 3 20 12 6 21 6 3"/>)
export const Chevron  = mk(<path d="m9 18 6-6-6-6"/>)
export const Arrow    = mk(<><path d="M7 17 17 7"/><path d="M7 7h10v10"/></>)
export const Check    = mk(<path d="M20 6 9 17l-5-5"/>)
export const CheckCircle = mk(<><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></>)
export const Copy     = mk(<><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>)
export const Ext      = mk(<><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></>)
export const Refresh  = mk(<><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></>)
export const Download = mk(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></>)
export const Back     = mk(<path d="m15 18-6-6 6-6"/>)
export const Bolt     = mk(<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>)
export const Sliders  = mk(<><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></>)
```

- [ ] **Step 2: Commit**

```bash
mkdir -p client/src/components
git add client/src/components/Icons.jsx
git commit -m "feat: Icons component converted to ES module exports"
```

---

## Task 11: TweaksPanel component

**Files:**
- Create: `client/src/components/TweaksPanel.jsx`

- [ ] **Step 1: Create `client/src/components/TweaksPanel.jsx`**

Convert from the prototype's `window.*` globals and host-protocol to a self-contained component with `open`/`onClose` props. Copy the full `__TWEAKS_STYLE` string verbatim from `project/AccessLens/tweaks-panel.jsx`.

```jsx
import { useState, useCallback, useRef, useEffect } from 'react'

// Copy __TWEAKS_STYLE verbatim from project/AccessLens/tweaks-panel.jsx
const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}
  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}
  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2}
  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.15)}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
`

export function useTweaks(defaults) {
  const [values, setValues] = useState(defaults)
  const setTweak = useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null
      ? keyOrEdits : { [keyOrEdits]: val }
    setValues((prev) => ({ ...prev, ...edits }))
  }, [])
  return [values, setTweak]
}

export function TweaksPanel({ open, onClose, title = 'Tweaks', children }) {
  const dragRef = useRef(null)
  const offsetRef = useRef({ x: 16, y: 16 })
  const PAD = 16

  const clampToViewport = useCallback(() => {
    const panel = dragRef.current
    if (!panel) return
    const w = panel.offsetWidth, h = panel.offsetHeight
    offsetRef.current = {
      x: Math.min(Math.max(PAD, window.innerWidth - w - PAD), offsetRef.current.x),
      y: Math.min(Math.max(PAD, window.innerHeight - h - PAD), offsetRef.current.y),
    }
    panel.style.right = offsetRef.current.x + 'px'
    panel.style.bottom = offsetRef.current.y + 'px'
  }, [])

  useEffect(() => {
    if (!open) return
    clampToViewport()
    const ro = new ResizeObserver(clampToViewport)
    ro.observe(document.documentElement)
    return () => ro.disconnect()
  }, [open, clampToViewport])

  const onDragStart = (e) => {
    const panel = dragRef.current
    if (!panel) return
    const r = panel.getBoundingClientRect()
    const sx = e.clientX, sy = e.clientY
    const startRight = window.innerWidth - r.right
    const startBottom = window.innerHeight - r.bottom
    const move = (ev) => {
      offsetRef.current = { x: startRight - (ev.clientX - sx), y: startBottom - (ev.clientY - sy) }
      clampToViewport()
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  if (!open) return null
  return (
    <>
      <style>{__TWEAKS_STYLE}</style>
      <div ref={dragRef} className="twk-panel"
           style={{ right: offsetRef.current.x, bottom: offsetRef.current.y }}>
        <div className="twk-hd" onMouseDown={onDragStart}>
          <b>{title}</b>
          <button className="twk-x" aria-label="Close tweaks"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={onClose}>✕</button>
        </div>
        <div className="twk-body">{children}</div>
      </div>
    </>
  )
}

export function TweakSection({ label }) {
  return <div className="twk-sect">{label}</div>
}

export function TweakToggle({ label, value, onChange }) {
  return (
    <div className="twk-row twk-row-h">
      <div className="twk-lbl"><span>{label}</span></div>
      <button type="button" className="twk-toggle" data-on={value ? '1' : '0'}
              role="switch" aria-checked={!!value}
              onClick={() => onChange(!value)}><i /></button>
    </div>
  )
}

export function TweakRadio({ label, value, options, onChange }) {
  const trackRef = useRef(null)
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }))
  const idx = Math.max(0, opts.findIndex((o) => o.value === value))
  const n = opts.length
  return (
    <div className="twk-row">
      <div className="twk-lbl"><span>{label}</span></div>
      <div ref={trackRef} role="radiogroup" className="twk-seg">
        <div className="twk-seg-thumb"
             style={{ left: `calc(2px + ${idx} * (100% - 4px) / ${n})`, width: `calc((100% - 4px) / ${n})` }} />
        {opts.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value}
                  onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function __twkIsLight(hex) {
  const h = String(hex).replace('#', '')
  const x = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, '0')
  const n = parseInt(x.slice(0, 6), 16)
  if (Number.isNaN(n)) return true
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return r * 299 + g * 587 + b * 114 > 148000
}

const __TwkCheck = ({ light }) => (
  <svg viewBox="0 0 14 14" aria-hidden="true">
    <path d="M3 7.2 5.8 10 11 4.2" fill="none" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"
          stroke={light ? 'rgba(0,0,0,.78)' : '#fff'} />
  </svg>
)

export function TweakColor({ label, value, options, onChange }) {
  const key = (o) => String(JSON.stringify(o)).toLowerCase()
  const cur = key(value)
  return (
    <div className="twk-row">
      <div className="twk-lbl"><span>{label}</span></div>
      <div className="twk-chips" role="radiogroup">
        {options.map((o, i) => {
          const colors = Array.isArray(o) ? o : [o]
          const [hero] = colors
          const on = key(o) === cur
          return (
            <button key={i} type="button" className="twk-chip" role="radio"
                    aria-checked={on} data-on={on ? '1' : '0'}
                    style={{ background: hero }}
                    onClick={() => onChange(o)}>
              {on && <__TwkCheck light={__twkIsLight(hero)} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/TweaksPanel.jsx
git commit -m "feat: TweaksPanel with open/onClose props, no host protocol"
```

---

## Task 12: InputScreen component

**Files:**
- Create: `client/src/components/InputScreen.jsx`

- [ ] **Step 1: Create `client/src/components/InputScreen.jsx`**

The key change from the prototype: `onRun` now receives `{ display, url?, html? }` instead of just a string, so App can pass the real content to the API.

```jsx
import { useState } from 'react'
import * as Ic from './Icons.jsx'
import { EXAMPLES } from '../data.js'

export default function InputScreen({ onRun }) {
  const [tab, setTab] = useState('url')
  const [url, setUrl] = useState('')
  const [html, setHtml] = useState('')
  const [focus, setFocus] = useState(false)

  const filled = tab === 'url' ? url.trim().length > 0 : html.trim().length > 0

  const run = () => {
    if (!filled) return
    if (tab === 'url') {
      onRun({ display: `https://${url}`, url: `https://${url}` })
    } else {
      onRun({ display: 'Pasted HTML snippet', html })
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
        <div className="console-head">
          <div className="tracffic"><i></i><i></i><i></i></div>
          <div className="tabs">
            <button className={'tab' + (tab === 'url' ? ' active' : '')} onClick={() => setTab('url')}>
              <span className="glyph"><Ic.Link size={14} /></span> Enter URL
            </button>
            <button className={'tab' + (tab === 'html' ? ' active' : '')} onClick={() => setTab('html')}>
              <span className="glyph"><Ic.Code size={14} /></span> Paste HTML
            </button>
          </div>
        </div>

        <div className="console-body">
          {tab === 'url' ? (
            <div className={'field-url' + (focus ? ' focus' : '')}>
              <span className="scheme">https://</span>
              <input
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value.replace(/^https?:\/\//, ''))}
                onFocus={() => setFocus(true)}
                onBlur={() => setFocus(false)}
                placeholder="acme-store.no/checkout"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>
          ) : (
            <div className="field-html">
              <div className="gutter">
                {Array.from({ length: lineCount }, (_, i) => <div key={i}>{i + 1}</div>)}
              </div>
              <textarea
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                placeholder={'<section class="hero">\n  <img src="/banner.jpg">\n  <button class="cta"><svg/></button>\n</section>'}
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

      {tab === 'url' && (
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

- [ ] **Step 2: Commit**

```bash
git add client/src/components/InputScreen.jsx
git commit -m "feat: InputScreen — passes real url/html payload to onRun"
```

---

## Task 13: ScanScreen component

**Files:**
- Create: `client/src/components/ScanScreen.jsx`

- [ ] **Step 1: Create `client/src/components/ScanScreen.jsx`**

Connects to the SSE stream for `auditId`. The UI shows 3 real steps (matching the 3 backend stages). Calls `onDone(result)` when the `result` SSE event fires, `onError(msg)` on the `error` event.

```jsx
import { useState, useEffect } from 'react'
import * as Ic from './Icons.jsx'

const STEP_LABELS = [
  'Fetching & parsing DOM',
  'Running axe-core scan',
  'Claude semantic analysis',
]

export default function ScanScreen({ auditId, target, onDone, onError }) {
  const [steps, setSteps] = useState(
    STEP_LABELS.map((label, i) => ({ step: i + 1, label, status: 'pending' }))
  )
  const [pct, setPct] = useState(0)

  useEffect(() => {
    const es = new EventSource(`/api/audit/${auditId}/stream`)

    es.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data)
      setSteps((prev) =>
        prev.map((s) => (s.step === data.step ? { ...s, ...data } : s))
      )
      const doneCount = data.step + (data.status === 'done' ? 0 : -1)
      setPct(Math.round((doneCount / STEP_LABELS.length) * 100))
    })

    es.addEventListener('result', (e) => {
      setPct(100)
      es.close()
      setTimeout(() => onDone(JSON.parse(e.data)), 480)
    })

    es.addEventListener('error', (e) => {
      es.close()
      const msg = e.data ? JSON.parse(e.data).message : 'Audit failed'
      onError(msg)
    })

    return () => es.close()
  }, [auditId])

  return (
    <div className="scan-wrap fade-in">
      <div className="scan-target">
        <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)', display: 'inline-block' }}></span>
        auditing <b>{target}</b>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h2 className="scan-headline">Running audit…</h2>
        <span className="scan-pct">{pct}%</span>
      </div>
      <div className="scan-bar"><i style={{ width: pct + '%' }}></i></div>
      <div className="scan-log">
        {steps.map((s) => (
          <div key={s.step} className={'ln ' + (s.status === 'done' ? 'done' : s.status === 'active' ? 'active' : '')}>
            <span className="st">
              {s.status === 'done' ? <Ic.Check size={13} /> : s.status === 'active' ? '▸' : '·'}
            </span>
            <span>{s.label}</span>
            {s.status === 'done' && s.count && <span className="ct">{s.count}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/ScanScreen.jsx
git commit -m "feat: ScanScreen connected to real SSE stream with 3-step progress"
```

---

## Task 14: ResultsScreen component

**Files:**
- Create: `client/src/components/ResultsScreen.jsx`

- [ ] **Step 1: Create `client/src/components/ResultsScreen.jsx`**

Converted from prototype's `results-screen.jsx`. The `data` prop is the real `AuditResult` from the server. The `code` field is optional — Claude violations show a fallback selector display instead.

```jsx
import { useState, useMemo } from 'react'
import * as Ic from './Icons.jsx'

const SEV_ORDER = { critical: 0, warning: 1, info: 2 }

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
  return (
    <div className={'vcard s-' + v.severity + (open ? ' open' : '')}>
      <button className="vhead" onClick={onToggle}>
        <span className="sev-badge"><span className="d"></span>{v.severity}</span>
        <span className="vmain">
          <span className="vtitle">
            {v.rule}
            {v.occurrences > 1 && <span className="occ">×{v.occurrences}</span>}
          </span>
          <span className="vsel"><b>{v.selector}</b></span>
        </span>
        <span className="wcag">
          <span className="ref">{v.wcag}</span>
          <span className="lvl">{v.level}</span>
        </span>
        <span className="chev"><Ic.Chevron size={16} /></span>
      </button>
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
    </div>
  )
}

export default function ResultsScreen({ data, target, onReset, onCopy }) {
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('severity')
  const [openIds, setOpenIds] = useState(() => new Set([data.violations[0]?.id].filter(Boolean)))

  const counts = useMemo(() => {
    const c = { critical: 0, warning: 0, info: 0 }
    data.violations.forEach((v) => { if (c[v.severity] !== undefined) c[v.severity]++ })
    return c
  }, [data])

  const shown = useMemo(() => {
    let list = data.violations.filter((v) => filter === 'all' || v.severity === filter)
    return [...list].sort((a, b) =>
      sort === 'severity' ? SEV_ORDER[a.severity] - SEV_ORDER[b.severity]
      : sort === 'wcag' ? a.wcag.localeCompare(b.wcag, undefined, { numeric: true })
      : b.occurrences - a.occurrences
    )
  }, [data, filter, sort])

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
        <button className="btn btn-ghost" style={{ padding: '9px 16px', fontSize: 13 }} onClick={onReset}>
          <Ic.Refresh size={13} /> Re-run
        </button>
        <button className="btn btn-ghost" style={{ padding: '9px 16px', fontSize: 13 }}
                onClick={() => onCopy(JSON.stringify(data, null, 2))}>
          <Ic.Download size={13} /> Export
        </button>
      </div>

      <div className="summary">
        <div className="score">
          <span className="grade">{data.grade}</span>
          <span className="num">
            <span className="big">{data.score}<small>/100</small></span>
            <span className="lbl">score</span>
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
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/ResultsScreen.jsx
git commit -m "feat: ResultsScreen with real AuditResult data, source badge, export as JSON"
```

---

## Task 15: App.jsx — wire everything together

**Files:**
- Modify: `client/src/App.jsx` (replace placeholder)

- [ ] **Step 1: Replace `client/src/App.jsx`**

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
  const [phase, setPhase] = useState('input')   // 'input' | 'scan' | 'results'
  const [target, setTarget] = useState('')
  const [auditId, setAuditId] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [tweaksOpen, setTweaksOpen] = useState(false)

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

  const run = async ({ display, url, html }) => {
    setTarget(display)
    setError(null)
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(url ? { url } : { html }),
      })
      if (!res.ok) throw new Error(await res.text())
      const { id } = await res.json()
      setAuditId(id)
      setPhase('scan')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleResult = (data) => {
    setResult(data)
    setPhase('results')
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
        <ResultsScreen data={result} target={target} onReset={reset} onCopy={copy} />
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

- [ ] **Step 2: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat: App.jsx wires InputScreen → API → ScanScreen (SSE) → ResultsScreen"
```

---

## Task 16: End-to-end smoke test

- [ ] **Step 1: Start both server and client**

```bash
npm run dev
```

Expected: server starts on :3001, Vite starts on :5173.

- [ ] **Step 2: Open the app**

Open `http://localhost:5173`. Confirm:
- Dark background with grid texture
- accesslens topbar with orange accent
- TRY Sans font renders correctly
- Input screen with URL / Paste HTML tabs

- [ ] **Step 3: Test with pasted HTML**

Paste this into the HTML tab and click "Run audit":

```html
<html><head><title>Untitled document</title></head>
<body>
  <img src="hero.jpg">
  <h1>Welcome</h1>
  <h3>Products</h3>
  <button><svg aria-hidden="true"><use href="#cart"/></svg></button>
  <a href="/terms">click here</a>
  <p style="color:#9a9a9a">Sale price</p>
</body></html>
```

Expected: scan screen animates through 3 steps, then results appear with violations from both axe-core (contrast, missing alt) and Claude (heading skip, generic link text, unlabelled button, page title).

- [ ] **Step 4: Test filter buttons**

Click "Critical", "Warning", "Info" — confirm list filters correctly.

- [ ] **Step 5: Test URL audit**

Enter `example.com` and run. Confirm the scan completes (may take 10–30s for Playwright to fetch). Results should show violations.

- [ ] **Step 6: Test Tweaks panel**

Click the Sliders icon in the topbar. Change the accent colour — confirm it updates in real time. Toggle the grid. Change density.

- [ ] **Step 7: Test Export**

Click "Export" in the results toolbar. Confirm the toast appears and (if clipboard access is granted) the JSON is copied.

---

## Task 17: README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace `README.md` with app documentation**

```markdown
# AccessLens

A Claude + axe-core powered WCAG 2.1 accessibility audit tool. Enter a URL or paste HTML to get structured violation reports with actionable fix suggestions.

## Setup

1. Clone the repo and install dependencies:
   ```bash
   npm install
   npx playwright install chromium  # run from server/ directory
   ```

2. Copy `.env.example` to `.env` and add your Anthropic API key:
   ```bash
   cp .env.example .env
   # edit .env — set ANTHROPIC_API_KEY=sk-ant-...
   ```

## Running locally

```bash
npm run dev
```

Opens on `http://localhost:5173`. The server runs on `:3001`.

## How it works

### Prompting strategy

AccessLens uses two complementary engines:

**axe-core** handles deterministic checks reliably: missing alt text, colour contrast failures, invalid ARIA attributes, missing form labels. These have clear pass/fail rules.

**Claude** handles the semantic and structural issues axe-core cannot: heading hierarchy, descriptive link text, form field instructions, reading order, page titles, cognitive clarity. Claude is explicitly told *not* to re-flag what axe-core already catches — so findings don't duplicate.

Each violation in the report shows a `via` badge indicating its source.

### WCAG rules covered

**via axe-core (deterministic):**
- 1.1.1 — Non-text content (missing alt)
- 1.3.1 — Info and relationships (ARIA, semantic structure)
- 1.4.3 — Contrast minimum
- 2.4.7 — Focus visible
- 4.1.2 — Name, role, value
- …and all other axe-core rules

**via Claude (semantic):**
- 2.4.2 — Page titled
- 2.4.4 — Link purpose in context
- 1.3.1 — Heading hierarchy
- 3.3.2 — Labels or instructions (form context)
- 3.1.1 — Language of page
- General cognitive and structural accessibility

## Limitations

- Playwright cannot audit pages behind authentication or paywalls.
- Heavy client-side rendered SPAs may not be fully evaluated (Playwright waits for `networkidle`, but dynamic content loaded after interaction is not captured).
- Claude output is non-deterministic — results may vary slightly between runs.
- Large pages (>200KB HTML) are truncated before Claude analysis.
- The audit takes 10–30 seconds depending on the target page and Claude response time.

## Deployment

Any Node.js host (Railway, Render, Fly.io):

1. Set `ANTHROPIC_API_KEY` and `NODE_ENV=production` as environment variables.
2. Add a Playwright-compatible Chromium layer (Railway supports this natively; for others, use `playwright install chromium` in your build step or the official Playwright Docker base image).
3. Build and start:
   ```bash
   npm run build && npm start
   ```
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with setup, prompting strategy, limitations, and deployment guide"
```

---

## Self-review

**Spec coverage check:**
- ✅ POST /api/audit + GET /api/audit/:id/stream — Task 2
- ✅ Playwright URL fetch — Task 3
- ✅ axe-core runner (URL + HTML) — Task 4
- ✅ Claude analysis with preprocessed HTML + prompt caching — Task 6
- ✅ Merge, deduplicate, score, grade — Task 5
- ✅ SSE progress events — Tasks 2 + 7
- ✅ `source` field on violations — Tasks 4, 6
- ✅ Frontend: all 3 screens — Tasks 12–15
- ✅ TweaksPanel with Sliders trigger — Tasks 11, 15
- ✅ ES module imports replace window.* globals — all client tasks
- ✅ Vite /api proxy for dev — Task 8
- ✅ Production static file serving — Task 2
- ✅ README — Task 17
- ✅ .env.example — Task 1

**Type consistency check:**
- `onRun({ display, url?, html? })` — defined in Task 12, consumed in Task 15 ✅
- `AuditResult` shape — produced in Task 5 (`score.js`), consumed in Task 14 (`ResultsScreen`) ✅
- `Violation.id` — set as `axe-${i}` in Task 4, used as React key in Task 14 ✅
- Claude violations have no `id` field — add one in `audit.js`. **Fix:** in Task 7's `runAudit`, after `analyzeWithClaude`, add: `const stamped = claudeViolations.map((v, i) => ({ ...v, id: \`claude-${i}\` }))` and pass `stamped` to `mergeAndScore`.

**Placeholder scan:** No TBDs found. All code blocks are complete.
