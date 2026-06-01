# AccessLens

A Claude + axe-core powered WCAG 2.1 accessibility audit tool. Enter a URL or paste HTML to get structured violation reports with actionable fix suggestions.

## Setup

1. Clone the repo and install dependencies:
   ```bash
   npm install
   cd server && npx playwright install chromium && cd ..
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
- 1.4.12 — Text spacing
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
