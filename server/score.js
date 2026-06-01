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
