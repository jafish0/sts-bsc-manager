import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'

export default function SessionSignIn() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [sessionLink, setSessionLink] = useState(null)
  const [eventInfo, setEventInfo] = useState(null)
  const [error, setError] = useState(null)
  const [signedIn, setSignedIn] = useState(false)
  const [attendanceId, setAttendanceId] = useState(null)

  const [form, setForm] = useState({
    name: '',
    email: '',
    emailConfirm: '',
    agency: '',
    role: ''
  })

  // Compared case-insensitively and trimmed, since the address is stored
  // lowercased anyway — flagging "Josh@x.org" vs "josh@x.org" as a mismatch would
  // be a false alarm. Only shown once they've started the second field, so the
  // error doesn't appear while they're still typing the first character.
  const emailMismatch =
    form.emailConfirm.trim().length > 0 &&
    form.email.trim().toLowerCase() !== form.emailConfirm.trim().toLowerCase()

  useEffect(() => {
    validateToken()
    // Check if already signed in for this session
    const storedId = sessionStorage.getItem(`attendance_${token}`)
    if (storedId) {
      setAttendanceId(storedId)
      setSignedIn(true)
    }
  }, [token])

  // Post-sign-in routing: once signed in (fresh or restored from storage) and
  // the event is loaded, send the participant to their materials. Standalone
  // trainings use the training hub; collaborative sessions use the in-app
  // session-materials view. We no longer bounce anyone to /login — participants
  // don't have app accounts, and the materials view is the useful destination
  // for demo and real collaboratives alike.
  // A standalone training with the hub switched off has nowhere useful to send
  // anyone — materials are handed out in the room — so the confirmation screen
  // below is the destination. Sending them to the hub anyway showed "this hub
  // opens at the start of the training", which is confusing when no hub is coming.
  const hubOff = eventInfo?.kind === 'standalone_training' && eventInfo?.hub_enabled === false

  useEffect(() => {
    if (!signedIn || !eventInfo) return
    if (hubOff) return
    if (eventInfo.kind === 'standalone_training' && eventInfo.hub_token) {
      navigate(`/training/${eventInfo.hub_token}`, { replace: true })
    } else {
      navigate(`/session/${token}/materials`, { replace: true })
    }
  }, [signedIn, eventInfo, token, navigate, hubOff])

  const validateToken = async () => {
    try {
      const { data: link, error: linkErr } = await supabase
        .from('session_links')
        .select('*, bsc_events(id, title, event_date, start_time, end_time, location, collaborative_id, kind, hub_token, hub_enabled)')
        .eq('token', token)
        .single()

      if (linkErr || !link) {
        setError('This session link is invalid.')
        return
      }

      if (!link.is_active) {
        setError('This session has been closed.')
        return
      }

      if (new Date(link.expires_at) < new Date()) {
        setError('This session link has expired.')
        return
      }

      setSessionLink(link)
      setEventInfo(link.bsc_events)
    } catch (err) {
      console.error('Token validation error:', err)
      setError('Unable to validate session link.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.agency.trim()) return
    // Belt and braces alongside the disabled button: a mismatched address would
    // make sign-out unreachable for this person, so never let it through.
    if (form.email.trim().toLowerCase() !== form.emailConfirm.trim().toLowerCase()) return
    setSubmitting(true)

    try {
      // Use server-side RPC to handle sign-in (email matching, attendance, unmatched tracking)
      const { data: attendanceId, error: rpcErr } = await supabase.rpc('sign_in_to_session', {
        p_session_link_id: sessionLink.id,
        p_bsc_event_id: eventInfo.id,
        p_collaborative_id: eventInfo.collaborative_id,
        p_attendee_name: form.name.trim(),
        p_attendee_email: form.email.trim(),
        p_attendee_role: form.role || null,
        p_attendee_agency: form.agency.trim() || null
      })

      if (rpcErr) throw rpcErr

      // Store attendance ID + the per-device gate flag for the materials view /
      // training hub BEFORE marking signed in, so the redirect effect's
      // destination sees the flag the moment it fires. (Soft gate — the flag is
      // per-device and bypassable via dev tools, but it's enough to keep casual
      // visitors out of the materials before they actually show up and sign in.)
      sessionStorage.setItem(`attendance_${token}`, attendanceId)
      sessionStorage.setItem(`signedInForEvent_${eventInfo.id}`, 'true')
      // Remembered in localStorage, NOT sessionStorage, purely to prefill the
      // sign-out form. sessionStorage is scoped per TAB, and with QR codes each
      // scan opens a new tab — so a same-device attendee still arrived at
      // sign-out with nothing remembered. localStorage survives that.
      // It only prefills a field the attendee confirms; it never signs anyone out
      // on its own.
      try {
        localStorage.setItem(`attendeeEmail_${token}`, form.email.trim().toLowerCase())
      } catch { /* private browsing — the field just starts empty */ }
      setAttendanceId(attendanceId)
      setSignedIn(true)

      // QR check-in linkage now happens inside the sign_in_to_session RPC,
      // atomically with the attendance insert. It used to be attempted here
      // with a PostgREST embed that could never resolve (there's no FK between
      // event_registrations and event_registration_link_events), and the error
      // was discarded — so no registration was ever actually checked in.
      // It also can't live in the browser any more: anon has no access to
      // event_registrations (it holds registrant PII + cancel tokens).

    } catch (err) {
      console.error('Sign-in error:', err)
      alert('Error signing in: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f9fafb' }}>
        <div style={{ textAlign: 'center', color: NAVY, fontSize: '1.1rem' }}>Loading session...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ background: 'white', borderRadius: '0.75rem', padding: '2.5rem', maxWidth: '500px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>&#9888;&#65039;</div>
          <h2 style={{ color: NAVY, marginBottom: '0.5rem' }}>Session Unavailable</h2>
          <p style={{ color: '#6b7280', fontSize: '0.95rem' }}>{error}</p>
        </div>
      </div>
    )
  }

  // Signed in. Normally a brief interstitial before the redirect effect routes to
  // the materials view (collaborative) or training hub (standalone) — but when the
  // hub is switched off this IS the final screen, so it must read as a complete
  // thank-you rather than promising materials that aren't coming.
  if (signedIn) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ background: 'white', borderRadius: '0.75rem', padding: '2.5rem', maxWidth: '550px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>&#9989;</div>
          <h2 style={{ color: NAVY, marginBottom: '0.5rem' }}>
            {hubOff ? 'Thanks for signing in!' : "You're Signed In!"}
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
            <strong>{eventInfo?.title}</strong>
          </p>
          <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
            {hubOff
              ? 'Your attendance has been recorded. Your trainer will hand out the materials — enjoy the training. You can close this window.'
              : 'Loading your session materials…'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: '0.75rem', padding: '2.5rem', maxWidth: '500px', width: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        {/* Session Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ background: NAVY, color: 'white', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Session Sign-In</h2>
          </div>
          <h3 style={{ color: NAVY, margin: '0 0 0.25rem', fontSize: '1.15rem' }}>{eventInfo?.title}</h3>
          <p style={{ color: '#6b7280', margin: 0, fontSize: '0.9rem' }}>
            {eventInfo?.event_date && new Date(eventInfo.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            {eventInfo?.start_time && ` at ${eventInfo.start_time.slice(0, 5)}`}
          </p>
        </div>

        {/* Sign-In Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '0.35rem', fontSize: '0.9rem' }}>
              Full Name <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Your full name"
              style={{
                width: '100%', padding: '0.65rem', border: '1px solid #d1d5db',
                borderRadius: '0.375rem', fontSize: '0.9rem', boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '0.35rem', fontSize: '0.9rem' }}>
              Email <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="your.email@example.com"
              style={{
                width: '100%', padding: '0.65rem', border: '1px solid #d1d5db',
                borderRadius: '0.375rem', fontSize: '0.9rem', boxSizing: 'border-box'
              }}
            />
          </div>
          {/* Confirm email. This matters more than a usual double-entry field:
              sign-out and CEU credit are matched on this address, so a typo here
              leaves someone unable to sign out at all and quietly costs them
              credit — and there's no way to correct it later without an admin. */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '0.35rem', fontSize: '0.9rem' }}>
              Confirm email <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="email"
              required
              value={form.emailConfirm}
              onChange={(e) => setForm({ ...form, emailConfirm: e.target.value })}
              onPaste={(e) => e.preventDefault()}
              placeholder="Re-type your email"
              style={{
                width: '100%', padding: '0.65rem',
                border: `1px solid ${emailMismatch ? '#DC2626' : '#d1d5db'}`,
                borderRadius: '0.375rem', fontSize: '0.9rem', boxSizing: 'border-box'
              }}
            />
            {emailMismatch && (
              <p style={{ color: '#DC2626', fontSize: '0.8rem', margin: '0.3rem 0 0' }}>
                The two email addresses don&apos;t match.
              </p>
            )}
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '0.35rem', fontSize: '0.9rem' }}>
              Agency <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="text"
              required
              value={form.agency}
              onChange={(e) => setForm({ ...form, agency: e.target.value })}
              placeholder="Your organization or agency"
              style={{
                width: '100%', padding: '0.65rem', border: '1px solid #d1d5db',
                borderRadius: '0.375rem', fontSize: '0.9rem', boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '0.35rem', fontSize: '0.9rem' }}>
              Role / Job Title
            </label>
            <input
              type="text"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              placeholder="e.g., Case Worker, Therapist, Supervisor"
              style={{
                width: '100%', padding: '0.65rem', border: '1px solid #d1d5db',
                borderRadius: '0.375rem', fontSize: '0.9rem', boxSizing: 'border-box'
              }}
            />
          </div>
          <button
            type="submit"
            disabled={submitting || emailMismatch}
            style={{
              width: '100%', padding: '0.85rem',
              background: (submitting || emailMismatch) ? '#9ca3af' : TEAL,
              color: 'white', border: 'none', borderRadius: '0.5rem',
              fontSize: '1rem', fontWeight: '600',
              cursor: (submitting || emailMismatch) ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
