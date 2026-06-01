import Anthropic from '@anthropic-ai/sdk'

let _client = null
const getClient = () => _client ??= new Anthropic()

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

  const message = await getClient().messages.create({
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
    .replace(/\s+on\w+=(?:"[^"]*"|'[^']*'|\S+)/g, '')
    .slice(0, 15_000)
}
