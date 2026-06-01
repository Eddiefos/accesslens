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
          <span className="grade" style={{
            fontSize: data.conformance === 'Non-conformant' ? 28 : 38,
            lineHeight: 1,
            color: data.conformance === 'Level AA' ? 'var(--pass)'
              : data.conformance === 'Level A' ? 'var(--warn)'
              : 'var(--crit)',
          }}>
            {data.conformance === 'Non-conformant' ? 'Non-\nconformant' : data.conformance}
          </span>
          <span className="num">
            <span className="lbl" style={{marginTop: 6}}>WCAG 2.1 conformance</span>
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
