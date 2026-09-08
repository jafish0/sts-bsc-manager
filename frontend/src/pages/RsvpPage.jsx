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
//
// ASYMMETRIC by design (Josh's constraint: one-click RSVP from the email
// stays). Mail security scanners fetch and render emailed links and run the
// JS before the human sees the mail (verified 2026-09-08 against Microsoft's
// scanner), so anything the load effect writes, a scanner can write:
//   - ?status=attending  -> still auto-applied on load. A false "attending" is
//     visible in the roster and self-correcting.
//   - ?status=not_attending -> renders a confirmation and writes only on the
//     click. A false decline would have SILENCED every future reminder to
//     that person for the rest of the cycle (send-event-reminder skips
//     declines) — the same invisible lockout as a scanner-triggered
//     unsubscribe, reached by a different route.
// Every write from a human click also stamps confirmed_at (responded_at is
// owned by a DB trigger that fires on ANY status change, auto-apply included,
// so it cannot carry this meaning); the reminder function now suppresses only
// declines that carry confirmed_at.
export default function RsvpPage() {
  const { token } = useParams()
  const [searchParams] = useSearchParams()
  const requestedStatus = searchParams.get('status')
  // True when the email link asked to decline but we are waiting for the click.
  const [pendingDecline, setPendingDecline] = useState(false)

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

        // One-click ATTENDING from the email persists on load (kept on purpose).
        // NOTE: rsvp_id, not id — the RPC names it rsvp_id, and passing the
        // wrong key sends `undefined` into .eq() which Postgres rejects with
        // 'invalid input syntax for type uuid'. This is the one-click path the
        // email buttons use, so it is the one that must not break.
        if (requestedStatus === 'attending') {
          if (r.status !== 'attending') {
            await persist('attending', r.rsvp_id, { fromEmailLink: true })
          }
        } else if (requestedStatus === 'not_attending' && r.status !== 'not_attending') {
          // Decline needs a human click — see the note at the top of the file.
          setPendingDecline(true)
        }
      } catch (err) {
        if (!cancelled) { setError(err.message || String(err)); setLoading(false) }
      }
    }
    load()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // confirmed_at marks a status a HUMAN chose on this page (a click). The
  // email-link auto-apply deliberately leaves it null, so a decline can never
  // suppress reminders unless someone actually clicked.
  const persist = async (status, rsvpId, { fromEmailLink = false } = {}) => {
    setSaving(true)
    const patch = fromEmailLink ? { status } : { status, confirmed_at: new Date().toISOString() }
    const { data, error: err } = await supabase
      .from('event_rsvps')
      .update(patch)
      .eq('id', rsvpId || rsvp?.id)
      .select('status')
    setSaving(false)
    if (err || !data || data.length === 0) { setError(err?.message || 'Could not save your response.'); return }
    setSavedStatus(status)
    setPendingDecline(false)
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

      {pendingDecline && (
        <Banner color={RED}>
          You're about to mark yourself as <strong>unable to attend</strong>. Confirm below — we'll stop
          sending you reminders for this session once you do.
        </Banner>
      )}
      {!pendingDecline && savedStatus === 'attending' && (
        <Banner color={GREEN}>You're marked as <strong>attending</strong>. Thanks! Not coming after all? Use the button below.</Banner>
      )}
      {!pendingDecline && savedStatus === 'not_attending' && (
        <Banner color={RED}>You're marked as <strong>not attending</strong>. We'll miss you — change your mind with the button below.</Banner>
      )}
      {!pendingDecline && savedStatus === 'no_response' && (
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
            background: pendingDecline ? RED : '#fee2e2', color: pendingDecline ? 'white' : RED, border: 'none',
            padding: '0.6rem 1rem', borderRadius: '6px',
            fontWeight: 600, cursor: saving ? 'wait' : 'pointer',
            opacity: savedStatus === 'not_attending' ? 0.6 : 1,
          }}
        >{pendingDecline ? "✕ Yes, I can't attend" : "✕ Can't attend"}</button>
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
