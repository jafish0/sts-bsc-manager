import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'
const GREEN = '#16a34a'
const RED = '#991b1b'

// Public RSVP confirmation page reached from one-click email links.
// URL: /rsvp/:token?status=attending|not_attending
// If a status query param is present, immediately persist it; otherwise show
// buttons so the user can pick.
export default function RsvpPage() {
  const { token } = useParams()
  const [searchParams] = useSearchParams()
  const requestedStatus = searchParams.get('status')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rsvp, setRsvp] = useState(null)        // event_rsvps row
  const [event, setEvent] = useState(null)      // joined event metadata
  const [savedStatus, setSavedStatus] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const { data: r, error: rErr } = await supabase
          .from('event_rsvps')
          .select('id, status, event_id, email, bsc_events(id, title, event_date, start_time, end_time, location, zoom_link, collaboratives(name))')
          .eq('rsvp_token', token)
          .maybeSingle()
        if (cancelled) return
        if (rErr || !r) { setError('This RSVP link is invalid or has expired.'); setLoading(false); return }
        setRsvp(r)
        setEvent(r.bsc_events)
        setSavedStatus(r.status)
        setLoading(false)

        // If the email link carried a status, persist it now.
        if (requestedStatus && (requestedStatus === 'attending' || requestedStatus === 'not_attending')) {
          if (r.status !== requestedStatus) {
            await persist(requestedStatus, r.id)
          }
        }
      } catch (err) {
        if (!cancelled) { setError(err.message || String(err)); setLoading(false) }
      }
    }
    load()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const persist = async (status, rsvpId) => {
    setSaving(true)
    const { error: err } = await supabase
      .from('event_rsvps')
      .update({ status })
      .eq('id', rsvpId || rsvp?.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setSavedStatus(status)
  }

  if (loading) return <CenterShell>Loading…</CenterShell>
  if (error) return <CenterShell>{error}</CenterShell>

  return (
    <CenterShell>
      <h2 style={{ color: NAVY, margin: '0 0 0.25rem' }}>{event?.title}</h2>
      <div style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '0.9rem' }}>
        {event?.collaboratives?.name}
      </div>
      <div style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>
        <strong>{new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</strong>
        {event?.start_time && (<> · {event.start_time.slice(0,5)}</>)}
        {event?.location && (<> · {event.location}</>)}
      </div>
      {event?.zoom_link && (
        <a href={event.zoom_link} target="_blank" rel="noopener noreferrer" style={{
          display: 'inline-block', background: '#2563eb', color: 'white',
          textDecoration: 'none', padding: '0.5rem 1rem',
          borderRadius: '6px', marginBottom: '1rem', fontWeight: 600,
        }}>🎦 Join Zoom</a>
      )}

      {savedStatus === 'attending' && (
        <Banner color={GREEN}>You're marked as <strong>attending</strong>. Thanks!</Banner>
      )}
      {savedStatus === 'not_attending' && (
        <Banner color={RED}>You're marked as <strong>not attending</strong>. We'll miss you.</Banner>
      )}
      {savedStatus === 'no_response' && (
        <Banner color="#6b7280">Let us know if you'll be there:</Banner>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
        <button
          disabled={saving || savedStatus === 'attending'}
          onClick={() => persist('attending')}
          style={{
            background: GREEN, color: 'white', border: 'none',
            padding: '0.6rem 1rem', borderRadius: '6px',
            fontWeight: 600, cursor: saving ? 'wait' : 'pointer',
            opacity: savedStatus === 'attending' ? 0.6 : 1,
          }}
        >✓ I plan to attend</button>
        <button
          disabled={saving || savedStatus === 'not_attending'}
          onClick={() => persist('not_attending')}
          style={{
            background: '#fee2e2', color: RED, border: 'none',
            padding: '0.6rem 1rem', borderRadius: '6px',
            fontWeight: 600, cursor: saving ? 'wait' : 'pointer',
            opacity: savedStatus === 'not_attending' ? 0.6 : 1,
          }}
        >✕ Can't attend</button>
      </div>

      <div style={{ marginTop: '1.5rem', fontSize: '0.78rem', color: '#9ca3af' }}>
        You can reopen this link any time to change your response.
      </div>
    </CenterShell>
  )
}

function CenterShell({ children }) {
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

function Banner({ color, children }) {
  return (
    <div style={{
      background: `${color}1a`, color, padding: '0.5rem 0.75rem',
      borderRadius: '6px', fontSize: '0.9rem', marginTop: '0.5rem',
    }}>{children}</div>
  )
}
