import { useState } from 'react'

// Collapsible agenda banner shown on event detail and team dashboards.
// Default collapsed; click to expand. Always exposes a Download button.
//
// Props:
//   agenda:   bsc_event_documents row with document_type === 'agenda'
//             (must include file_name and storage_path)
//   onDownload(agenda): generate signed URL + open
//   onDelete(agenda):   optional; only passed for admins
//   eventTitle/eventDate: optional context for dashboards listing multiple events
export default function AgendaBanner({ agenda, onDownload, onDelete, eventTitle, eventDate }) {
  const [open, setOpen] = useState(false)
  if (!agenda) return null
  return (
    <section style={{
      marginBottom: '1rem',
      background: '#fff7ed', border: '1px solid #fed7aa',
      borderRadius: '0.5rem', overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'transparent', border: 'none', padding: '0.75rem 1rem',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.2rem' }}>📋</span>
          <div>
            <div style={{ fontWeight: 700, color: '#9a3412', fontSize: '0.95rem' }}>
              {eventTitle ? `Agenda — ${eventTitle}` : 'Session Agenda'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#9a3412', opacity: 0.75 }}>
              {agenda.file_name}
              {eventDate && ` · ${eventDate}`}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#9a3412' }}>{open ? 'Hide' : 'Show'}</span>
          <span
            style={{
              display: 'inline-block',
              transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s',
              color: '#9a3412',
            }}
          >▶</span>
        </div>
      </button>
      {open && (
        <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid #fed7aa' }}>
          <div style={{ fontSize: '0.85rem', color: '#9a3412', margin: '0.75rem 0' }}>
            Download the agenda to view the full schedule for this session.
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onDownload(agenda) }}
              style={{
                background: '#9a3412', color: 'white', border: 'none',
                padding: '0.4rem 0.85rem', borderRadius: '6px',
                cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
              }}
            >Download agenda</button>
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(agenda) }}
                style={{
                  background: 'transparent', color: '#9a3412',
                  border: '1px solid #9a3412',
                  padding: '0.4rem 0.85rem', borderRadius: '6px',
                  cursor: 'pointer', fontSize: '0.85rem',
                }}
              >Remove agenda</button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
