/* AccessLens — main app: input → scan → results + Tweaks */
const { useState: useStateA, useEffect: useEffectA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#FF4F00",
  "grid": true,
  "density": "regular"
}/*EDITMODE-END*/;

function App() {
  const Ic = window.Ic;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [phase, setPhase] = useStateA("input");   // input | scan | results
  const [target, setTarget] = useStateA("");
  const [toast, setToast] = useStateA(null);

  // drive theme from tweaks
  useEffectA(() => {
    const r = document.documentElement;
    r.style.setProperty("--accent", t.accent);
    // dark accents need light ink; bright ones need dark ink
    const ink = needLightInk(t.accent) ? "#fff" : "#000";
    r.style.setProperty("--accent-ink", ink);
  }, [t.accent]);

  const copy = (text) => {
    try { navigator.clipboard && navigator.clipboard.writeText(text); } catch (e) {}
    setToast(text.length > 42 ? "Copied to clipboard" : ("Copied · " + text));
    clearTimeout(window.__t);
    window.__t = setTimeout(() => setToast(null), 1700);
  };

  const run = (tgt) => { setTarget(tgt); setPhase("scan"); };

  return (
    <div className="app" data-density={t.density} style={{
      backgroundImage: t.grid ? undefined : "none"
    }}>
      <div className="topbar">
        <div className="brand">
          <span className="lens"><span className="dot"></span></span>
          <span className="mono-name">access<b style={{color:"var(--accent)"}}>lens</b></span>
          <span className="ver">v2.2</span>
        </div>
        <span className="spacer"></span>
        {phase === "results" && (
          <a className="meta-link" href="https://www.w3.org/WAI/WCAG22/quickref/" target="_blank" rel="noopener">
            <Ic.Ext size={12}/> WCAG 2.2 quick reference
          </a>
        )}
      </div>

      {phase === "input" && <InputScreen onRun={run} />}
      {phase === "scan" && <ScanScreen target={target} onDone={() => setPhase("results")} />}
      {phase === "results" && <ResultsScreen data={window.AUDIT} target={target} onReset={() => setPhase("input")} onCopy={copy} />}

      {toast && <div className="copied fade-in"><span className="d"><Ic.Check size={13}/></span>{toast}</div>}

      <TweaksPanel>
        <TweakSection label="Accent" />
        <TweakColor label="Signal colour" value={t.accent}
          options={["#FF4F00", "#37E07A", "#FFC400", "#3DA9FC"]}
          onChange={(v)=>setTweak("accent", v)} />
        <TweakSection label="Surface" />
        <TweakToggle label="Background grid" value={t.grid} onChange={(v)=>setTweak("grid", v)} />
        <TweakRadio label="Density" value={t.density} options={["compact","regular","comfy"]}
          onChange={(v)=>setTweak("density", v)} />
      </TweaksPanel>
    </div>
  );
}

function needLightInk(hex) {
  const h = hex.replace("#","");
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  const L = (0.299*r + 0.587*g + 0.114*b) / 255;
  return L < 0.55;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
