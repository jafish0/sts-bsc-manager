import { useState } from 'react'
import { COLORS, cardStyle, cardHeaderStyle } from '../utils/constants'

// Accordion wrapper for dashboard/detail sections (Leah's feedback: a long
// page is overwhelming — let each section fold away). The navy banner header
// is the toggle; `count` renders a small pill so a collapsed section still
// says how much is inside it.
//
// Extracted from TrainerDashboard on 2026-09-09 so CollaborativeDetail's BSC
// Events section can reuse it instead of growing a second collapsible.
//
// Props added for that reuse:
//   storageKey — when set, the open/closed state is remembered in
//                localStorage under that key (wrapped in try/catch: private
//                browsing and blocked storage throw). Key it per user AND per
//                thing (e.g. `bsc_events_open:<userId>:<collabId>`).
//   actions    — optional node rendered in the header row OUTSIDE the toggle
//                button (a button inside a button is invalid HTML), e.g. an
//                "+ Add Event" control that should work while collapsed.
function readStored(key, fallback) {
  if (!key) return fallback
  try {
    const raw = localStorage.getItem(key)
    if (raw === '1') return true
    if (raw === '0') return false
  } catch { /* storage unavailable — fall through */ }
  return fallback
}

export default function CollapsibleCard({ title, subtitle, count, defaultOpen = true, storageKey, actions, children }) {
  const [open, setOpen] = useState(() => readStored(storageKey, defaultOpen))
  const toggle = () => {
    setOpen(o => {
      const next = !o
      if (storageKey) {
        try { localStorage.setItem(storageKey, next ? '1' : '0') } catch { /* ignore */ }
      }
      return next
    })
  }
  return (
    <section style={{ ...cardStyle, marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <button
          onClick={toggle}
          aria-expanded={open}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0,
            background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left',
          }}
        >
          <div style={{ ...cardHeaderStyle, marginBottom: 0, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span>{title}</span>
            {count != null && (
              <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '999px', padding: '0.05rem 0.5rem', fontSize: '0.75rem' }}>{count}</span>
            )}
            {subtitle && <span style={{ fontWeight: 400, fontSize: '0.78rem', opacity: 0.85 }}>{subtitle}</span>}
          </div>
          <span style={{ color: COLORS.navy, fontSize: '1.1rem', flexShrink: 0 }}>{open ? '▾' : '▸'}</span>
        </button>
        {actions && <div style={{ flexShrink: 0 }}>{actions}</div>}
      </div>
      {open && <div style={{ marginTop: '1rem' }}>{children}</div>}
    </section>
  )
}
