import { useState } from 'react'
import * as Ic from './components/Icons.jsx'
import InputScreen from './components/InputScreen.jsx'
import ScanScreen from './components/ScanScreen.jsx'
import ResultsScreen from './components/ResultsScreen.jsx'
import { useTweaks, TweaksPanel, TweakSection, TweakRadio } from './components/TweaksPanel.jsx'

const TWEAK_DEFAULTS = { model: 'sonnet' }

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
      body: JSON.stringify(
        url ? { url, mode, componentType, model: t.model }
            : { html, mode, componentType, model: t.model }
      ),
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
      setPrevResult(editRerunPrevResult)
      setEditRerunPrevResult(null)
      setAuditId(id)
      setPhase('scan')
    } catch (err) {
      setError(err.message)
      setEditRerunPrevResult(null)
    }
  }

  const editAndRerun = () => {
    setEditRerunPrevResult(result)
    setPhase('input')
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

  const handleResult = (data) => { setResult(data); setPhase('results') }
  const handleRerunDone = (data) => { setResult(data); setIsRerunning(false); setRerunAuditId(null) }
  const handleError = (msg) => { setError(msg); setPhase('input') }

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
    <div className="app">
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
        <TweakSection label="Claude model" />
        <TweakRadio
          label="Analysis depth"
          value={t.model}
          options={[
            { value: 'sonnet', label: 'Thorough' },
            { value: 'haiku', label: 'Fast' },
          ]}
          onChange={(v) => setTweak('model', v)}
        />
      </TweaksPanel>
    </div>
  )
}
