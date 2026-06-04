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

const MODEL_IDS = {
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5-20251001',
}

export async function analyzeWithClaude(html, { mode = 'page', componentType = 'auto', model = 'sonnet' } = {}) {
  const preprocessed = preprocessHtml(html)
  const resolved = resolveMode(html, mode, componentType)
  const systemPrompt = resolved === 'component' ? COMPONENT_SYSTEM_PROMPT : PAGE_SYSTEM_PROMPT
  const typeHint = resolved === 'component' && COMPONENT_TYPE_HINTS[componentType]
    ? `\n\n${COMPONENT_TYPE_HINTS[componentType]}`
    : ''

  const request = {
    model: MODEL_IDS[model] ?? MODEL_IDS.sonnet,
    max_tokens: 4096,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content: `Audit this HTML for WCAG 2.1 accessibility issues that axe-core misses. Return only the JSON array.${typeHint}\n\n${preprocessed}`,
    }],
  }

  let message
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      message = await getClient().messages.create(request)
      break
    } catch (err) {
      const isOverloaded = err?.status === 529 || err?.error?.type === 'overloaded_error'
      if (isOverloaded && attempt < 2) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 8_000))
        continue
      }
      throw err
    }
  }

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
