const mk = (paths, vb) => ({ size = 16, stroke = 1.6, ...p }) => (
  <svg width={size} height={size} viewBox={vb || '0 0 24 24'} fill="none"
    stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" {...p}>
    {paths}
  </svg>
)

export const Link     = mk(<><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></>)
export const Code     = mk(<><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/></>)
export const Play     = mk(<polygon points="6 3 20 12 6 21 6 3"/>)
export const Chevron  = mk(<path d="m9 18 6-6-6-6"/>)
export const Arrow    = mk(<><path d="M7 17 17 7"/><path d="M7 7h10v10"/></>)
export const Check    = mk(<path d="M20 6 9 17l-5-5"/>)
export const CheckCircle = mk(<><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></>)
export const Copy     = mk(<><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>)
export const Ext      = mk(<><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></>)
export const Refresh  = mk(<><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></>)
export const Download = mk(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></>)
export const Back     = mk(<path d="m15 18-6-6 6-6"/>)
export const Bolt     = mk(<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>)
export const Sliders  = mk(<><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></>)
