/* AccessLens — mock WCAG audit dataset
   Realistic WCAG 2.2 violations. Token highlighting is pre-segmented:
   each code line is an array of {t:tokenType, v:value}. */

window.AUDIT = {
  url: "https://acme-store.no/checkout",
  scannedAt: "2026-06-01 14:32",
  elementsScanned: 1284,
  durationMs: 2400,
  grade: "C",
  score: 68,
  passed: 41,
  violations: [
    {
      id: "v1",
      severity: "critical",
      rule: "Non-text content",
      wcag: "1.1.1",
      level: "A",
      selector: "img.hero-banner",
      occurrences: 3,
      impact: "Serious",
      code: [
        [{t:"punc",v:"<"},{t:"tag",v:"img"},{t:"attr",v:" class"},{t:"punc",v:"="},{t:"str",v:'"hero-banner"'},{t:"attr",v:" src"},{t:"punc",v:"="},{t:"str",v:'"/img/sale.jpg"'},{t:"bad",v:" [missing alt]"},{t:"punc",v:">"}]
      ],
      desc: "Three images convey meaning but have no text alternative. Screen readers announce only the file name or nothing at all.",
      fix: "Add a descriptive <code>alt</code> attribute that conveys the image's purpose, e.g. <code>alt=\"Summer sale — up to 40% off\"</code>. For purely decorative images, use <code>alt=\"\"</code> so they are skipped.",
      link: "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html"
    },
    {
      id: "v2",
      severity: "critical",
      rule: "Contrast (minimum)",
      wcag: "1.4.3",
      level: "AA",
      selector: "p.price-note",
      occurrences: 7,
      impact: "Serious",
      code: [
        [{t:"comment",v:"/* computed contrast ratio: 2.1:1 — needs ≥ 4.5:1 */"}],
        [{t:"tag",v:".price-note"},{t:"punc",v:" { "},{t:"attr",v:"color"},{t:"punc",v:": "},{t:"bad",v:"#9a9a9a"},{t:"punc",v:"; "},{t:"attr",v:"background"},{t:"punc",v:": "},{t:"str",v:"#ffffff"},{t:"punc",v:"; }"}]
      ],
      desc: "Body text at 2.1:1 against white falls well below the 4.5:1 minimum. Low-vision users cannot reliably read it.",
      fix: "Darken the text to at least <code>#767676</code> (4.54:1) — or better, <code>#595959</code> for AAA. Run the pairing through a contrast checker after changing.",
      link: "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"
    },
    {
      id: "v3",
      severity: "critical",
      rule: "Name, role, value",
      wcag: "4.1.2",
      level: "A",
      selector: "button.icon-cart",
      occurrences: 2,
      impact: "Serious",
      code: [
        [{t:"punc",v:"<"},{t:"tag",v:"button"},{t:"attr",v:" class"},{t:"punc",v:"="},{t:"str",v:'"icon-cart"'},{t:"bad",v:" [no accessible name]"},{t:"punc",v:">"}],
        [{t:"punc",v:"  <"},{t:"tag",v:"svg"},{t:"attr",v:" aria-hidden"},{t:"punc",v:"="},{t:"str",v:'"true"'},{t:"punc",v:"></"},{t:"tag",v:"svg"},{t:"punc",v:">"}],
        [{t:"punc",v:"</"},{t:"tag",v:"button"},{t:"punc",v:">"}]
      ],
      desc: "An icon-only button has no text and no label, so assistive tech announces it as just \"button\" with no purpose.",
      fix: "Add <code>aria-label=\"View cart\"</code> to the button, or include visually-hidden text inside it. Keep the <code>aria-hidden</code> on the decorative SVG.",
      link: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"
    },
    {
      id: "v4",
      severity: "warning",
      rule: "Labels or instructions",
      wcag: "3.3.2",
      level: "A",
      selector: "input#email",
      occurrences: 1,
      impact: "Moderate",
      code: [
        [{t:"punc",v:"<"},{t:"tag",v:"input"},{t:"attr",v:" type"},{t:"punc",v:"="},{t:"str",v:'"email"'},{t:"attr",v:" id"},{t:"punc",v:"="},{t:"str",v:'"email"'},{t:"attr",v:" placeholder"},{t:"punc",v:"="},{t:"str",v:'"Email"'},{t:"bad",v:" [no label]"},{t:"punc",v:">"}]
      ],
      desc: "A placeholder is not a label — it disappears on focus and isn't reliably announced. The field has no programmatic name.",
      fix: "Add a <code>&lt;label for=\"email\"&gt;</code> tied to the input. A placeholder may stay as supplementary hint text, but it cannot replace the label.",
      link: "https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html"
    },
    {
      id: "v5",
      severity: "warning",
      rule: "Link purpose (in context)",
      wcag: "2.4.4",
      level: "A",
      selector: "a.more-link",
      occurrences: 4,
      impact: "Moderate",
      code: [
        [{t:"punc",v:"<"},{t:"tag",v:"a"},{t:"attr",v:" href"},{t:"punc",v:"="},{t:"str",v:'"/terms"'},{t:"punc",v:">"},{t:"bad",v:"click here"},{t:"punc",v:"</"},{t:"tag",v:"a"},{t:"punc",v:">"}]
      ],
      desc: "Generic link text like \"click here\" gives no destination when links are read out of context, which is how many screen-reader users navigate.",
      fix: "Write self-describing link text, e.g. <code>Read the terms of service</code>. Avoid \"click here\", \"more\", and \"read more\" on their own.",
      link: "https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html"
    },
    {
      id: "v6",
      severity: "warning",
      rule: "Info and relationships",
      wcag: "1.3.1",
      level: "A",
      selector: "h1 + h3",
      occurrences: 1,
      impact: "Moderate",
      code: [
        [{t:"punc",v:"<"},{t:"tag",v:"h1"},{t:"punc",v:">"},{t:"str",v:"Checkout"},{t:"punc",v:"</"},{t:"tag",v:"h1"},{t:"punc",v:">"}],
        [{t:"punc",v:"<"},{t:"tag",v:"h3"},{t:"bad",v:" [skips h2]"},{t:"punc",v:">"},{t:"str",v:"Shipping"},{t:"punc",v:"</"},{t:"tag",v:"h3"},{t:"punc",v:">"}]
      ],
      desc: "The heading order jumps from h1 to h3. Screen-reader users rely on a logical outline to understand and navigate page structure.",
      fix: "Use heading levels sequentially — change the <code>&lt;h3&gt;</code> to <code>&lt;h2&gt;</code>. Style with CSS if you need it to look smaller.",
      link: "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"
    },
    {
      id: "v7",
      severity: "info",
      rule: "Focus visible",
      wcag: "2.4.7",
      level: "AA",
      selector: "a, button { outline: none }",
      occurrences: 1,
      impact: "Minor",
      code: [
        [{t:"tag",v:"a"},{t:"punc",v:", "},{t:"tag",v:"button"},{t:"punc",v:" { "},{t:"attr",v:"outline"},{t:"punc",v:": "},{t:"bad",v:"none"},{t:"punc",v:"; }"}]
      ],
      desc: "A global rule removes focus outlines. Keyboard users lose all indication of where they are on the page.",
      fix: "Remove the blanket <code>outline: none</code>, or replace it with a visible custom <code>:focus-visible</code> style that meets 3:1 contrast against its background.",
      link: "https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html"
    },
    {
      id: "v8",
      severity: "info",
      rule: "Page titled",
      wcag: "2.4.2",
      level: "A",
      selector: "title",
      occurrences: 1,
      impact: "Minor",
      code: [
        [{t:"punc",v:"<"},{t:"tag",v:"title"},{t:"punc",v:">"},{t:"bad",v:"Untitled document"},{t:"punc",v:"</"},{t:"tag",v:"title"},{t:"punc",v:">"}]
      ],
      desc: "The page title is the default placeholder. Titles are the first thing announced and label the browser tab and bookmarks.",
      fix: "Set a descriptive, unique <code>&lt;title&gt;</code> such as <code>Checkout — Acme Store</code>.",
      link: "https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html"
    }
  ]
};

// example targets shown on the input screen
window.EXAMPLES = [
  "acme-store.no/checkout",
  "blog.example.com/post/42",
  "docs.internal/login"
];
