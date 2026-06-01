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
    es.addEventListener('error', () => { es.close() })
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
