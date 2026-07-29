import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'
const GREEN = '#16a34a'
const RED = '#991b1b'

// '14:30:00' -> '2:30 PM'. Matches the reminder email, which now shows 12-hour
// times; the page previously showed a bare 24-hour "14:30".
function fmt12h(t) {
  if (!t) return ''
  const [hRaw, mRaw] = String(t).split(':')
  let h = Number(hRaw)
  if (!Number.isFinite(h)) return ''
  const m = (mRaw ?? '00').padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${m} ${ampm}`
}

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
        // Read through a SECURITY DEFINER RPC rather than embedding bsc_events.
        // The embed silently returned NULL for any event without an ACTIVE
        // session_link — anon's only SELECT path on bsc_events — which is every
        // future session. `event` then came back null and the render crashed on
        // event.event_date, so the RSVP buttons in every reminder email led to a
        // blank page. Same pattern as validate_team_code / lookup-registration:
        // one token-scoped lookup, no broadening of anon's table access.
        const { data, error: rErr } = await supabase
          .rpc('lookup_rsvp', { p_token: token })
        if (cancelled) return
        const r = Array.isArray(data) ? data[0] : data
        if (rErr || !r) { setError('This RSVP link is invalid or has expired.'); setLoading(false); return }
        if (!r.event_id) { setError('The session for this RSVP link no longer exists.'); setLoading(false); return }
        setRsvp({ id: r.rsvp_id, status: r.status, email: r.email, event_id: r.event_id })
        setEvent({
          id: r.event_id,
          title: r.event_title,
          event_date: r.event_date,
          start_time: r.start_time,
          end_time: r.end_time,
          location: r.location,
          zoom_link: r.zoom_link,
          collaboratives: { name: r.collaborative_name },
        })
        setSavedStatus(r.status)
        setLoading(false)

        // If the email link carried a status, persist it now.
        // NOTE: rsvp_id, not id — the RPC names it rsvp_id, and passing the
        // wrong key sends `undefined` into .eq() which Postgres rejects with
        // 'invalid input syntax for type uuid'. This is the one-click path the
        // email buttons use, so it is the one that must not break.
        if (requestedStatus && (requestedStatus === 'attending' || requestedStatus === 'not_attending')) {
          if (r.status !== requestedStatus) {
            await persist(requestedStatus, r.rsvp_id)
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
      {/* Optional-chained and year-bearing. This line used to read
          event.event_date unguarded, so a null event was a white screen rather
          than a degraded page. */}
      <div style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>
        {event?.event_date && (
          <strong>{new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>
        )}
        {event?.start_time && (<> · {fmt12h(event.start_time)}{event?.end_time && <> to {fmt12h(event.end_time)}</>}</>)}
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
