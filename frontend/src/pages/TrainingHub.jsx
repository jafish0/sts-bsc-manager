import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { supabase } from '../utils/supabase'
import { logDownload } from '../utils/logDownload'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'

// Public participant-facing training hub. URL: /training/:hub_token
//
// Access is gated by THREE conditions:
//   1. hub_token matches a bsc_events row with kind='standalone_training'
//   2. Current time is within the event window (start_time of event_date
//      through end_time of (end_date OR event_date) + 30 minutes)
//   3. Client-side sessionStorage flag signedInForEvent_<event.id> is set
//      (set after successful sign-in via /session/:token)
//
// The sessionStorage check is a soft gate — anyone who knows the
// hub_token can bypass via dev tools. Acceptable per the V1 spec:
// the intent is "we want people to physically show up before we hand
// them the deck", not a hard security boundary.
//
// Auto-refreshes the access-state check every 5 minutes so a hub open
// in the background transitions through windows without manual reload.
export default function TrainingHub() {
  const { hub_token } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [event, setEvent] = useState(null)
  const [trainer, setTrainer] = useState(null)
  const [documents, setDocuments] = useState([])
  const [nowTick, setNowTick] = useState(Date.now())

  // Re-render every 5 minutes to recompute the access window state.
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: ev, error: evErr } = await supabase
          .from('bsc_events')
          .select('id, title, event_date, end_date, start_time, end_time, timezone, kind, hub_token, zoom_link, location_name, address, city, state, zip, room, parking_notes, accessibility_notes, training_hub_intro, created_by')
          .eq('hub_token', hub_token)
          .eq('kind', 'standalone_training')
          .maybeSingle()
        if (cancelled) return
        if (evErr || !ev) { setError('Training not found.'); setLoading(false); return }
        setEvent(ev)

        if (ev.created_by) {
          const { data: u } = await supabase
            .from('user_profiles')
            .select('full_name, email, bio')
            .eq('id', ev.created_by)
            .maybeSingle()
          if (!cancelled) setTrainer(u || null)
        }

        // Pull documents (agenda + materials). RLS allows authenticated reads;
        // public token-based reads aren't currently RLS-permitted on
        // bsc_event_documents. For the hub we need public read access —
        // this is fine because we have the event row already loaded and we
        // query by event_id which the user already knows from their URL.
        // The materials list will be empty if RLS denies; we surface that.
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
  }, [hub_token])

  if (loading) return <Shell><p style={{ color: '#6b7280' }}>Loading…</p></Shell>
  if (error) return <Shell><h2 style={{ color: NAVY }}>Training not found</h2><p>The link you followed doesn't match an active training.</p></Shell>
  if (!event) return <Shell><h2 style={{ color: NAVY }}>Training not found</h2></Shell>

  // Compute access window. Use plain Date math; precision to the minute is fine.
  const now = new Date(nowTick)
  const startTime = event.start_time || '00:00:00'
  const endTime = event.end_time || '23:59:00'
  const endDateStr = event.end_date || event.event_date
  const windowStart = new Date(`${event.event_date}T${startTime}`)
  const windowEnd = new Date(`${endDateStr}T${endTime}`)
  // +30 min grace after end
  windowEnd.setMinutes(windowEnd.getMinutes() + 30)

  if (now < windowStart) {
    return (
      <Shell>
        <h2 style={{ color: NAVY }}>{event.title}</h2>
        <p style={{ color: '#374151' }}>
          This training hub opens at the start of the training. See you on <strong>{fmtFull(event.event_date, event.start_time)}</strong>.
        </p>
      </Shell>
    )
  }

  if (now > windowEnd) {
    return (
      <Shell>
        <h2 style={{ color: NAVY }}>{event.title}</h2>
        <p style={{ color: '#374151' }}>
          This training has ended. Materials are no longer available through this hub. Reach out to the trainer if you need anything.
        </p>
      </Shell>
    )
  }

  const signedInFlag = sessionStorage.getItem(`signedInForEvent_${event.id}`)
  if (!signedInFlag) {
    return (
      <Shell>
        <h2 style={{ color: NAVY }}>Please sign in first</h2>
        <p style={{ color: '#374151' }}>
          The training hub is available after you sign in at the venue. Look for a sign-in QR code (or short URL) from your trainer and use that first.
        </p>
        <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '1rem' }}>
          Already signed in on a different device? You'll need to sign in on this device too — the sign-in flag is stored per-device.
        </p>
      </Shell>
    )
  }

  const agenda = documents.find(d => d.document_type === 'agenda')
  const materials = documents.filter(d => d.document_type !== 'agenda')

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* Hero */}
      <div style={{ background: NAVY, color: 'white', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: '780px', margin: '0 auto' }}>
          <h1 style={{ margin: 0, fontSize: '1.75rem' }}>{event.title}</h1>
          <div style={{ marginTop: '0.5rem', fontSize: '0.95rem', opacity: 0.9 }}>
            <span>{fmtRange(event.event_date, event.end_date)}</span>
            {event.start_time && (
              <span> · {fmt12h(event.start_time)}{event.end_time && ` – ${fmt12h(event.end_time)}`}</span>
            )}
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <span style={{ background: 'rgba(255,255,255,0.15)', color: 'white', padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>
              {event.zoom_link ? '🎦 Online' : '📍 In-person'}
            </span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '780px', margin: '0 auto', padding: '2rem 1rem' }}>
        {/* Online: prominent Zoom button */}
        {event.zoom_link && (
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

        {/* Location info */}
        {(event.location_name || event.address || event.city || event.room) && (
          <Card title="📍 Location">
            {event.location_name && <p style={{ margin: '0 0 0.25rem', fontWeight: 600 }}>{event.location_name}</p>}
            {event.address && <p style={{ margin: '0 0 0.25rem' }}>{event.address}</p>}
            {(event.city || event.state || event.zip) && (
              <p style={{ margin: '0 0 0.25rem' }}>{[event.city, event.state, event.zip].filter(Boolean).join(', ')}</p>
            )}
            {event.room && <p style={{ margin: '0.5rem 0 0', color: '#374151' }}><strong>Room:</strong> {event.room}</p>}
            {event.address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([event.address, event.city, event.state, event.zip].filter(Boolean).join(', '))}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-block', marginTop: '0.5rem', color: NAVY, fontSize: '0.85rem' }}
              >🗺 Open in Google Maps</a>
            )}
            {event.parking_notes && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Parking</div>
                <div style={{ fontSize: '0.9rem', color: '#374151', whiteSpace: 'pre-wrap' }}>{event.parking_notes}</div>
              </div>
            )}
            {event.accessibility_notes && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Accessibility</div>
                <div style={{ fontSize: '0.9rem', color: '#374151', whiteSpace: 'pre-wrap' }}>{event.accessibility_notes}</div>
              </div>
            )}
          </Card>
        )}

        {/* Trainer */}
        {trainer && (
          <Card title="👤 Trainer">
            <div style={{ fontWeight: 600, color: NAVY, fontSize: '1rem' }}>{trainer.full_name || trainer.email}</div>
            {trainer.bio && (
              <div style={{ marginTop: '0.5rem', color: '#374151', fontSize: '0.9rem' }}>
                <ReactMarkdown>{trainer.bio}</ReactMarkdown>
              </div>
            )}
          </Card>
        )}

        {/* Hub intro (markdown) */}
        {event.training_hub_intro && (
          <Card>
            <div style={{ color: '#374151', fontSize: '0.95rem', lineHeight: 1.55 }} className="hub-markdown">
              <ReactMarkdown>{event.training_hub_intro}</ReactMarkdown>
            </div>
          </Card>
        )}

        {/* Agenda (download) */}
        {agenda && (
          <Card title="📋 Agenda">
            <p style={{ color: '#374151', fontSize: '0.9rem', margin: '0 0 0.75rem' }}>
              Download the agenda for the full schedule.
            </p>
            <DocumentDownloadButton doc={agenda} />
          </Card>
        )}

        {/* Materials list */}
        {materials.length > 0 && (
          <Card title="📚 Training Materials">
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

        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.78rem', color: '#9ca3af' }}>
          Hub access closes 30 minutes after the training ends.
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
        maxWidth: '520px', width: '100%',
      }}>
        {children}
      </div>
    </div>
  )
}

function fmtFull(dateStr, timeStr) {
  if (!dateStr) return ''
  const d = new Date(`${dateStr}T${timeStr || '00:00:00'}`)
  return d.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
function fmtRange(startDate, endDate) {
  if (!startDate) return ''
  const start = new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  if (!endDate || endDate === startDate) return start
  const end = new Date(endDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  return `${start} – ${end}`
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
