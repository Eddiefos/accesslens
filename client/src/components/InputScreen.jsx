import { useState } from 'react'
import * as Ic from './Icons.jsx'
import { EXAMPLES } from '../data.js'

export default function InputScreen({ onRun }) {
  const [tab, setTab] = useState('url')
  const [url, setUrl] = useState('')
  const [html, setHtml] = useState('')
  const [focus, setFocus] = useState(false)

  const filled = tab === 'url' ? url.trim().length > 0 : html.trim().length > 0

  const run = () => {
    if (!filled) return
    if (tab === 'url') {
      onRun({ display: `https://${url}`, url: `https://${url}` })
    } else {
      onRun({ display: 'Pasted HTML snippet', html })
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
        <div className="console-head">
          <div className="tracffic"><i></i><i></i><i></i></div>
          <div className="tabs">
            <button className={'tab' + (tab === 'url' ? ' active' : '')} onClick={() => setTab('url')}>
              <span className="glyph"><Ic.Link size={14} /></span> Enter URL
            </button>
            <button className={'tab' + (tab === 'html' ? ' active' : '')} onClick={() => setTab('html')}>
              <span className="glyph"><Ic.Code size={14} /></span> Paste HTML
            </button>
          </div>
        </div>

        <div className="console-body">
          {tab === 'url' ? (
            <div className={'field-url' + (focus ? ' focus' : '')}>
              <span className="scheme">https://</span>
              <input
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value.replace(/^https?:\/\//, ''))}
                onFocus={() => setFocus(true)}
                onBlur={() => setFocus(false)}
                placeholder="acme-store.no/checkout"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>
          ) : (
            <div className="field-html">
              <div className="gutter">
                {Array.from({ length: lineCount }, (_, i) => <div key={i}>{i + 1}</div>)}
              </div>
              <textarea
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                placeholder={'<section class="hero">\n  <img src="/banner.jpg">\n  <button class="cta"><svg/></button>\n</section>'}
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

      {tab === 'url' && (
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
