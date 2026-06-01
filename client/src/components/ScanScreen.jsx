import { useState, useEffect } from 'react'
import * as Ic from './Icons.jsx'

const STEP_LABELS = [
  'Fetching & parsing DOM',
  'Running axe-core scan',
  'Claude semantic analysis',
]

export default function ScanScreen({ auditId, target, onDone, onError }) {
  const [steps, setSteps] = useState(
    STEP_LABELS.map((label, i) => ({ step: i + 1, label, status: 'pending' }))
  )
  const [pct, setPct] = useState(0)

  useEffect(() => {
    const es = new EventSource(`/api/audit/${auditId}/stream`)

    es.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data)
      setSteps((prev) =>
        prev.map((s) => (s.step === data.step ? { ...s, ...data } : s))
      )
      const doneCount = data.step + (data.status === 'done' ? 0 : -1)
      setPct(Math.round((doneCount / STEP_LABELS.length) * 100))
    })

    es.addEventListener('result', (e) => {
      setPct(100)
      es.close()
      setTimeout(() => onDone(JSON.parse(e.data)), 480)
    })

    es.addEventListener('error', (e) => {
      es.close()
      const msg = e.data ? JSON.parse(e.data).message : 'Audit failed'
      onError(msg)
    })

    return () => es.close()
  }, [auditId])

  return (
    <div className="scan-wrap fade-in">
      <div className="scan-target">
        <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)', display: 'inline-block' }}></span>
        {' '}auditing <b>{target}</b>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h2 className="scan-headline">Running audit…</h2>
        <span className="scan-pct">{pct}%</span>
      </div>
      <div className="scan-bar"><i style={{ width: pct + '%' }}></i></div>
      <div className="scan-log">
        {steps.map((s) => (
          <div key={s.step} className={'ln ' + (s.status === 'done' ? 'done' : s.status === 'active' ? 'active' : '')}>
            <span className="st">
              {s.status === 'done' ? <Ic.Check size={13} /> : s.status === 'active' ? '▸' : '·'}
            </span>
            <span>{s.label}</span>
            {s.status === 'done' && s.count && <span className="ct">{s.count}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
