import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { logDownload } from '../utils/logDownload'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'

// Participant-facing session materials for a COLLABORATIVE session.
// URL: /session/:token/materials — landed on after signing in via
// /session/:token (the SessionSignIn page redirects here for non-standalone
// events; standalone trainings use /training/:hub_token instead).
//
// Access gate (soft, mirrors the training hub):
//   1. token matches an ACTIVE, unexpired session_links row
//      (the link is auto-closed 30 min after the event ends by the
//       close-expired-sessions pg_cron job — so "active link" == "in window")
//   2. sessionStorage flag signedInForEvent_<event.id> is set (per-device,
//      set on successful sign-in; bypassable via dev tools — that's fine,
//      the intent is "show up before you get the deck", not hard security)
//
// Documents are read from bsc_event_documents (a scoped public-read RLS
// policy permits anon reads while the session link is active) and downloaded
// via signed URLs from the publicly-readable event-documents bucket.
export default function SessionMaterials() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [closed, setClosed] = useState(false)
  const [event, setEvent] = useState(null)
  const [documents, setDocuments] = useState([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: link, error: linkErr } = await supabase
          .from('session_links')
          .select('*, bsc_events(id, title, event_date, start_time, end_time, location, collaborative_id, zoom_link)')
          .eq('token', token)
          .single()

        if (cancelled) return
        if (linkErr || !link) { setError('This session link is invalid.'); setLoading(false); return }

        const ev = link.bsc_events
        setEvent(ev)

        // Closed / expired link → materials window is over.
        if (!link.is_active || (link.expires_at && new Date(link.expires_at) < new Date())) {
          setClosed(true)
          setLoading(false)
          return
        }

        const { data: docs } = await supabase
          .from('bsc_event_documents')
          .select('id, file_name, file_size, mime_type, storage_path, document_type, created_at')
          .eq('event_id', ev.id)
          .order('created_at', { ascending: false })
        if (!cancelled) setDocuments(docs || [])
      } catch (err) {
        if (!cancelled) setError(err.message || String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [token])

  if (loading) return <Shell><p style={{ color: '#6b7280' }}>Loading…</p></Shell>
  if (error) return <Shell><h2 style={{ color: NAVY }}>Session Unavailable</h2><p style={{ color: '#6b7280' }}>{error}</p></Shell>

  if (closed) {
    return (
      <Shell>
        <h2 style={{ color: NAVY }}>{event?.title || 'Session'}</h2>
        <p style={{ color: '#374151' }}>
          This session has ended and its materials are no longer available here. Reach out to your trainer if you still need anything.
        </p>
      </Shell>
    )
  }

  // Soft per-device gate — must have signed in on this device.
  const signedInFlag = event && sessionStorage.getItem(`signedInForEvent_${event.id}`)
  if (!signedInFlag) {
    return (
      <Shell>
        <h2 style={{ color: NAVY }}>Please sign in first</h2>
        <p style={{ color: '#374151' }}>
          Session materials are available after you sign in. Use the sign-in QR code or link from your trainer, then you'll be brought here automatically.
        </p>
        <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '1rem' }}>
          Already signed in on a different device? You'll need to sign in on this device too — the sign-in flag is stored per-device.
        </p>
      </Shell>
    )
  }

  const agenda = documents.find(d => d.document_type === 'agenda')
  const materials = documents.filter(d => d.document_type !== 'agenda')
  const hasAnything = agenda || materials.length > 0 || event?.zoom_link

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* Hero / confirmation */}
      <div style={{ background: NAVY, color: 'white', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.85, marginBottom: '0.35rem' }}>✅ You're signed in</div>
          <h1 style={{ margin: 0, fontSize: '1.6rem' }}>{event?.title}</h1>
          <div style={{ marginTop: '0.5rem', fontSize: '0.95rem', opacity: 0.9 }}>
            {event?.event_date && new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            {event?.start_time && ` · ${fmt12h(event.start_time)}`}
            {event?.end_time && ` – ${fmt12h(event.end_time)}`}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 1rem' }}>
        {/* Zoom (if an online session) */}
        {event?.zoom_link && (
          <a
            href={event.zoom_link}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block', background: '#2563eb', color: 'white',
              padding: '1rem 1.25rem', borderRadius: '0.5rem',
              textDecoration: 'none', fontWeight: 700, fontSize: '1.05rem',
              textAlign: 'center', marginBottom: '1.5rem',
            }}
          >🎦 Join Zoom</a>
        )}

        {agenda && (
          <Card title="📋 Agenda">
            <p style={{ color: '#374151', fontSize: '0.9rem', margin: '0 0 0.75rem' }}>
              Download the agenda for the full schedule.
            </p>
            <DocumentDownloadButton doc={agenda} />
          </Card>
        )}

        {materials.length > 0 && (
          <Card title="📚 Session Materials">
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {materials.map(d => (
                <li key={d.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
                  padding: '0.5rem 0', borderTop: '1px solid #e5e7eb',
                }}>
                  <div>
                    <div style={{ fontWeight: 500, color: '#1f2937', fontSize: '0.95rem' }}>📄 {d.file_name}</div>
                    {d.file_size && <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{fmtBytes(d.file_size)}</div>}
                  </div>
                  <DocumentDownloadButton doc={d} />
                </li>
              ))}
            </ul>
          </Card>
        )}

        {!hasAnything && (
          <Card>
            <p style={{ color: '#374151', margin: 0 }}>
              No materials have been posted for this session yet. Check back during the session — your trainer may add them.
            </p>
          </Card>
        )}

        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.78rem', color: '#9ca3af' }}>
          Materials are available while this session is open.
        </div>
      </div>
    </div>
  )
}

function DocumentDownloadButton({ doc }) {
  const [downloading, setDownloading] = useState(false)
  const click = async () => {
    setDownloading(true)
    try {
      const { data, error } = await supabase.storage
        .from('event-documents')
        .createSignedUrl(doc.storage_path, 3600)
      if (error) throw error
      logDownload({ documentId: doc.id }) // anon — userId stays null
      window.open(data.signedUrl, '_blank')
    } catch (err) {
      alert('Could not generate download link. Reach out to your trainer if this keeps happening.')
    } finally {
      setDownloading(false)
    }
  }
  return (
    <button
      onClick={click}
      disabled={downloading}
      style={{
        background: TEAL, color: 'white', border: 'none',
        padding: '0.4rem 0.85rem', borderRadius: '6px',
        cursor: downloading ? 'wait' : 'pointer', fontSize: '0.85rem', fontWeight: 600,
      }}
    >{downloading ? 'Loading…' : 'Download'}</button>
  )
}

function Card({ title, children }) {
  return (
    <section style={{
      background: 'white', borderRadius: '0.75rem',
      padding: '1.25rem', marginBottom: '1rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      {title && <h3 style={{ margin: '0 0 0.75rem', color: NAVY, fontSize: '1.05rem' }}>{title}</h3>}
      {children}
    </section>
  )
}

function Shell({ children }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f9fafb', padding: '1rem',
    }}>
      <div style={{
        background: 'white', borderRadius: '0.75rem', padding: '2rem',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        maxWidth: '520px', width: '100%', textAlign: 'center',
      }}>
        {children}
      </div>
    </div>
  )
}

function fmt12h(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hh = parseInt(h, 10)
  const ampm = hh >= 12 ? 'pm' : 'am'
  const dh = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh
  return m === '00' ? `${dh}${ampm}` : `${dh}:${m}${ampm}`
}
function fmtBytes(n) {
  if (n == null) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
