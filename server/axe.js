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
  const tag = tags.find((t) => /^wcag\d{3,4}$/.test(t))
  if (!tag) return ''
  const d = tag.replace('wcag', '')
  if (d.length === 3) return `${d[0]}.${d[1]}.${d[2]}`
  return `${d[0]}.${d[1]}.${d[2]}.${d[3]}`
}

function extractLevel(tags) {
  if (tags.some((t) => t === 'wcag2a' || t === 'wcag21a')) return 'A'
  if (tags.some((t) => t === 'wcag2aa' || t === 'wcag21aa')) return 'AA'
  return 'AAA'
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
