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
    const claudeRaw = await analyzeWithClaude(pageHtml, { mode, componentType })
    const claudeViolations = claudeRaw.map((v, i) => ({ ...v, id: `claude-${i}` }))
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
