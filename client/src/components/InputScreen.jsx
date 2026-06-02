import { useState, useEffect } from 'react'
import * as Ic from './Icons.jsx'
import { EXAMPLES } from '../data.js'

const RECENT_KEY = 'accesslens-recent-urls'
const MODE_KEY = 'accesslens-mode'
const MAX_RECENT = 5

function loadRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') } catch { return [] }
}

function saveRecent(url, prev) {
  const next = [url, ...prev.filter(u => u !== url)].slice(0, MAX_RECENT)
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch {}
  return next
}

export default function InputScreen({ onRun, initialPayload }) {
  const [mode, setMode] = useState(() => initialPayload?.mode ?? localStorage.getItem(MODE_KEY) ?? 'page')
  const [tab, setTab] = useState(() => initialPayload?.url ? 'url' : 'html')
  const [url, setUrl] = useState(() => initialPayload?.url?.replace(/^https?:\/\//, '') ?? '')
  const [html, setHtml] = useState(() => initialPayload?.html ?? '')
  const [focus, setFocus] = useState(false)
  const [componentType, setComponentType] = useState(() => initialPayload?.componentType ?? 'auto')
  const [recentUrls, setRecentUrls] = useState(loadRecent)

  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode)
  }, [mode])

  const filled = mode === 'component'
    ? html.trim().length > 0
    : tab === 'url' ? url.trim().length > 0 : html.trim().length > 0

  const run = () => {
    if (!filled) return
    if (mode === 'page' && tab === 'url') {
      const full = `https://${url}`
      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        setRecentUrls(prev => saveRecent(full, prev))
      }
      onRun({ display: full, url: full, mode: 'page', componentType: 'auto' })
    } else if (mode === 'page' && tab === 'html') {
      onRun({ display: 'Pasted full-page HTML', html, mode: 'page', componentType: 'auto' })
    } else {
      onRun({ display: 'Component snippet', html, mode: 'component', componentType })
    }
  }

  const onKey = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run()
  }

  const lineCount = Math.max(8, html.split('\n').length)

  return (
    <div className="input-wrap fade-in">
      <div className="hero-kicker">
        <span className="bar"></span>
        <span className="kicker">WCAG 2.2 · automated audit</span>
      </div>
      <div className="hero">
        <h1>See what your page<br />says to <span className="serif-em">everyone</span>.</h1>
        <p className="lede">Paste a URL or a chunk of markup. AccessLens parses the DOM,
          runs it against the WCAG success criteria, and hands you back diagnostics you can act on.</p>
      </div>

      <div className="console" onKeyDown={onKey}>
        {/* Primary: mode toggle */}
        <div className="console-head">
          <div className="tracffic"><i></i><i></i><i></i></div>
          <div className="mode-toggle">
            <button className={'mode-btn' + (mode === 'page' ? ' active' : '')} onClick={() => setMode('page')}>
              <Ic.Link size={12} /> Page
            </button>
            <button className={'mode-btn' + (mode === 'component' ? ' active' : '')} onClick={() => setMode('component')}>
              <Ic.Code size={12} /> Component
            </button>
          </div>
        </div>

        {/* Secondary: tabs row (page mode only) */}
        {mode === 'page' && (
          <div className="console-tabs-bar">
            <div className="tabs">
              <button className={'tab' + (tab === 'url' ? ' active' : '')} onClick={() => setTab('url')}>
                <span className="glyph"><Ic.Link size={14} /></span> URL
              </button>
              <button className={'tab' + (tab === 'html' ? ' active' : '')} onClick={() => setTab('html')}>
                <span className="glyph"><Ic.Code size={14} /></span> Full page HTML
              </button>
            </div>
          </div>
        )}

        {/* Context chips (component mode only) */}
        {mode === 'component' && (
          <div className="context-chips">
            {['auto', 'form', 'nav', 'modal', 'card', 'button'].map(type => (
              <button
                key={type}
                className={'context-chip' + (componentType === type ? ' active' : '')}
                onClick={() => setComponentType(type)}
              >
                {type === 'auto' ? 'Auto-detect' : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        )}

        <div className="console-body">
          {mode === 'page' && tab === 'url' && (
            <div className={'field-url' + (focus ? ' focus' : '')}>
              <span className="scheme">https://</span>
              <input
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value.replace(/^https?:\/\//, ''))}
                onFocus={() => setFocus(true)}
                onBlur={() => setFocus(false)}
                placeholder="localhost:3000/checkout"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>
          )}
          {(mode === 'component' || (mode === 'page' && tab === 'html')) && (
            <div className="field-html">
              <div className="gutter">
                {Array.from({ length: lineCount }, (_, i) => <div key={i}>{i + 1}</div>)}
              </div>
              <textarea
                autoFocus={mode === 'component'}
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                placeholder={mode === 'component'
                  ? '<form>\n  <input placeholder="Email" />\n  <button>Submit</button>\n</form>'
                  : '<html>\n  <head><title>…</title></head>\n  <body>…</body>\n</html>'}
                spellCheck={false}
              />
            </div>
          )}
        </div>

        <div className="console-foot">
          <span className="hint"><kbd>⌘</kbd><kbd>↵</kbd> to run</span>
          <span className="spacer"></span>
          <button className="btn btn-primary" disabled={!filled} onClick={run}>
            <Ic.Play size={14} /> Run audit
          </button>
        </div>
      </div>

      <div className="standards">
        <span className="chip"><span className="led"></span><b>WCAG 2.2</b> · Level A &amp; AA</span>
        <span className="chip"><span className="led"></span>89 success criteria</span>
        <span className="chip"><span className="led"></span>DOM + computed styles</span>
      </div>

      {/* Recent localhost URLs (page + URL tab only) */}
      {mode === 'page' && tab === 'url' && recentUrls.length > 0 && (
        <div className="examples">
          <div className="lbl">Recent local</div>
          <div className="recent-urls">
            {recentUrls.map(u => (
              <button key={u} className="recent-url"
                onClick={() => setUrl(u.replace(/^https?:\/\//, ''))}>
                <span className="arr">↳</span>{u.replace('https://', '')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sample targets (page + URL tab, no recent urls yet) */}
      {mode === 'page' && tab === 'url' && recentUrls.length === 0 && (
        <div className="examples">
          <div className="lbl">Try a sample target</div>
          <div className="row">
            {EXAMPLES.map((ex) => (
              <button key={ex} className="ex" onClick={() => setUrl(ex)}>
                <span className="arr">↳</span> {ex}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
