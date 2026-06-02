import { useState, useEffect } from 'react'
import * as Ic from './components/Icons.jsx'
import InputScreen from './components/InputScreen.jsx'
import ScanScreen from './components/ScanScreen.jsx'
import ResultsScreen from './components/ResultsScreen.jsx'
import {
  useTweaks, TweaksPanel, TweakSection, TweakColor, TweakToggle, TweakRadio,
} from './components/TweaksPanel.jsx'

const TWEAK_DEFAULTS = { accent: '#FF4F00', grid: true, density: 'regular' }

function needLightInk(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55
}

export default function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS)
  const [phase, setPhase] = useState('input')        // 'input' | 'scan' | 'results'
  const [target, setTarget] = useState('')
  const [auditId, setAuditId] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [tweaksOpen, setTweaksOpen] = useState(false)
  // Re-run state
  const [lastPayload, setLastPayload] = useState(null)
  const [prevResult, setPrevResult] = useState(null)
  const [isRerunning, setIsRerunning] = useState(false)
  const [rerunAuditId, setRerunAuditId] = useState(null)
  // Edit & re-run: stores result to diff against after editing the snippet
  const [editRerunPrevResult, setEditRerunPrevResult] = useState(null)

  useEffect(() => {
    const r = document.documentElement
    r.style.setProperty('--accent', t.accent)
    r.style.setProperty('--accent-ink', needLightInk(t.accent) ? '#fff' : '#000')
  }, [t.accent])

  const copy = (text) => {
    try { navigator.clipboard?.writeText(text) } catch {}
    setToast(text.length > 42 ? 'Copied to clipboard' : 'Copied · ' + text)
    clearTimeout(window.__toastTimer)
    window.__toastTimer = setTimeout(() => setToast(null), 1700)
  }

  const startAudit = async (payload) => {
    const { url, html, mode = 'page', componentType = 'auto' } = payload
    const res = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(url ? { url, mode, componentType } : { html, mode, componentType }),
    })
    if (!res.ok) throw new Error(await res.text())
    const { id } = await res.json()
    return id
  }

  const run = async ({ display, url, html, mode, componentType }) => {
    setTarget(display)
    setError(null)
    const payload = { url, html, mode, componentType }
    try {
      const id = await startAudit(payload)
      setLastPayload(payload)
      setPrevResult(editRerunPrevResult)   // null on fresh run, saved result on edit-rerun
      setEditRerunPrevResult(null)
      setAuditId(id)
      setPhase('scan')
    } catch (err) {
      setError(err.message)
      setEditRerunPrevResult(null)
    }
  }

  const editAndRerun = () => {
    setEditRerunPrevResult(result)   // save current result for diff
    setPhase('input')                // go back to input with HTML pre-populated
  }

  const rerun = async () => {
    if (!lastPayload) return
    setError(null)
    try {
      const id = await startAudit(lastPayload)
      setPrevResult(result)
      setIsRerunning(true)
      setRerunAuditId(id)
    } catch (err) {
      setError(err.message)
      setIsRerunning(false)
    }
  }

  const handleResult = (data) => {
    setResult(data)
    setPhase('results')
  }

  const handleRerunDone = (data) => {
    setResult(data)
    setIsRerunning(false)
    setRerunAuditId(null)
  }

  const handleError = (msg) => {
    setError(msg)
    setPhase('input')
  }

  const reset = () => {
    setPhase('input')
    setResult(null)
    setAuditId(null)
    setError(null)
    setPrevResult(null)
    setIsRerunning(false)
    setRerunAuditId(null)
    setLastPayload(null)
    setEditRerunPrevResult(null)
  }

  return (
    <div className="app" data-density={t.density}
         style={{ backgroundImage: t.grid ? undefined : 'none' }}>
      <div className="topbar">
        <div className="brand">
          <span className="lens"><span className="dot"></span></span>
          <span className="mono-name">access<b style={{ color: 'var(--accent)' }}>lens</b></span>
          <span className="ver">v2.2</span>
        </div>
        <span className="spacer"></span>
        {phase === 'results' && (
          <a className="meta-link" href="https://www.w3.org/WAI/WCAG22/quickref/"
             target="_blank" rel="noopener">
            <Ic.Ext size={12} /> WCAG 2.2 quick reference
          </a>
        )}
        <button
          onClick={() => setTweaksOpen((o) => !o)}
          style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', padding: '0 6px', display: 'flex', alignItems: 'center' }}
          title="Tweaks"
        >
          <Ic.Sliders size={14} />
        </button>
      </div>

      {error && (
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px 24px' }}>
          <div style={{ background: 'var(--crit-dim)', border: '1px solid var(--crit)', borderRadius: 'var(--r-2)', padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--crit)' }}>
            {error}
          </div>
        </div>
      )}

      {phase === 'input' && <InputScreen onRun={run} initialPayload={editRerunPrevResult ? lastPayload : null} />}
      {phase === 'scan' && auditId && (
        <ScanScreen auditId={auditId} target={target} onDone={handleResult} onError={handleError} />
      )}
      {phase === 'results' && result && (
        <ResultsScreen
          data={result}
          prevResult={prevResult}
          isRerunning={isRerunning}
          rerunAuditId={rerunAuditId}
          target={target}
          onReset={reset}
          onCopy={copy}
          onRerun={rerun}
          onRerunDone={handleRerunDone}
          onEditAndRerun={editAndRerun}
        />
      )}

      {toast && (
        <div className="copied fade-in">
          <span className="d"><Ic.Check size={13} /></span>{toast}
        </div>
      )}

      <TweaksPanel open={tweaksOpen} onClose={() => setTweaksOpen(false)}>
        <TweakSection label="Accent" />
        <TweakColor label="Signal colour" value={t.accent}
          options={['#FF4F00', '#37E07A', '#FFC400', '#3DA9FC']}
          onChange={(v) => setTweak('accent', v)} />
        <TweakSection label="Surface" />
        <TweakToggle label="Background grid" value={t.grid} onChange={(v) => setTweak('grid', v)} />
        <TweakRadio label="Density" value={t.density} options={['compact', 'regular', 'comfy']}
          onChange={(v) => setTweak('density', v)} />
      </TweaksPanel>
    </div>
  )
}
