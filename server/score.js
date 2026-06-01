const WCAG_AA_CRITERIA = 50

export function mergeAndScore(axeViolations, claudeViolations, { url, elementsScanned, durationMs }) {
  const violations = deduplicate(axeViolations, claudeViolations)
  const conformance = computeConformance(violations)
  const passed = Math.max(0, WCAG_AA_CRITERIA - violations.length)

  return {
    url: url ?? 'Pasted HTML snippet',
    scannedAt: new Date().toISOString(),
    elementsScanned,
    durationMs,
    conformance,
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

// WCAG conformance is pass/fail per level, not a numeric score.
// "AA" = no Level A or AA failures. "A" = no Level A failures but some AA.
// "Non-conformant" = at least one Level A failure.
function computeConformance(violations) {
  const hasLevelA = violations.some((v) => v.level === 'A' && v.severity === 'critical')
  const hasLevelAA = violations.some((v) => v.level === 'AA' && v.severity !== 'info')
  if (hasLevelA) return 'Non-conformant'
  if (hasLevelAA) return 'Level A'
  return 'Level AA'
}
