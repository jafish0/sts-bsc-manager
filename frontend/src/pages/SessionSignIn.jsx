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
    agency: '',
    role: ''
  })

  // Demo collaboratives suppress the post-sign-in redirect to staff login
  // (participants have no app accounts). Fetched via a narrow SECURITY
  // DEFINER RPC so anon visitors learn only this one boolean — replaces the
  // old DEMO_COLLABORATIVE_ID hardcode.
  const [isDemoCollaborative, setIsDemoCollaborative] = useState(false)
  useEffect(() => {
    if (!eventInfo?.id) return
    let cancelled = false
    supabase.rpc('event_collab_is_demo', { p_event_id: eventInfo.id })
      .then(({ data }) => { if (!cancelled) setIsDemoCollaborative(!!data) })
      .catch(() => { /* default false — normal redirect behavior */ })
    return () => { cancelled = true }
  }, [eventInfo?.id])

  useEffect(() => {
    validateToken()
    // Check if already signed in for this session
    const storedId = sessionStorage.getItem(`attendance_${token}`)
    if (storedId) {
      setAttendanceId(storedId)
      setSignedIn(true)
    }
  }, [token])

  // Auto-redirect to login after sign-in — skipped for the demo collaborative
  // because demo participants don't have app accounts and the redirect just
  // dumps them on a confusing login screen.
  useEffect(() => {
    if (signedIn && !isDemoCollaborative) {
      const timer = setTimeout(() => {
        navigate('/login')
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [signedIn, navigate, isDemoCollaborative])

  const validateToken = async () => {
    try {
      const { data: link, error: linkErr } = await supabase
        .from('session_links')
        .select('*, bsc_events(id, title, event_date, start_time, end_time, location, collaborative_id, kind, hub_token)')
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

      // Store attendance ID in sessionStorage
      sessionStorage.setItem(`attendance_${token}`, attendanceId)
      setAttendanceId(attendanceId)
      setSignedIn(true)

      // QR check-in linkage: if this email matches a registration covering
      // this event, mark them checked_in and link to the new attendance row.
      try {
        const lowerEmail = form.email.trim().toLowerCase()
        const { data: matchingRegs } = await supabase
          .from('event_registrations')
          .select('id, status, registration_link_id, event_registration_link_events!inner(event_id)')
          .ilike('email', lowerEmail)
          .eq('event_registration_link_events.event_id', eventInfo.id)
          .neq('status', 'cancelled')
        const reg = (matchingRegs || [])[0]
        if (reg) {
          await supabase
            .from('event_registrations')
            .update({
              status: 'checked_in',
              checked_in_at: new Date().toISOString(),
              session_attendance_id: attendanceId,
            })
            .eq('id', reg.id)
        }
      } catch (linkErr) {
        // Non-fatal — sign-in already succeeded; registration linkage is bonus.
        console.warn('Could not link registration to attendance:', linkErr)
      }

      // Standalone training: set the hub gate flag and redirect to the hub.
      // Soft gate — the sessionStorage flag is per-device and bypassable via
      // dev tools, but it's enough to prevent casual material access before
      // a participant actually shows up.
      if (eventInfo?.kind === 'standalone_training' && eventInfo?.hub_token) {
        sessionStorage.setItem(`signedInForEvent_${eventInfo.id}`, 'true')
        navigate(`/training/${eventInfo.hub_token}`)
        return
      }
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

  if (signedIn) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ background: 'white', borderRadius: '0.75rem', padding: '2.5rem', maxWidth: '550px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>&#9989;</div>
          <h2 style={{ color: NAVY, marginBottom: '0.5rem' }}>You're Signed In!</h2>
          <p style={{ color: '#6b7280', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
            <strong>{eventInfo?.title}</strong>
          </p>
          <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            {eventInfo?.event_date && new Date(eventInfo.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          <div style={{
            background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '0.5rem',
            padding: '1rem', marginBottom: isDemoCollaborative ? 0 : '1.5rem', fontSize: '0.85rem', color: '#166534'
          }}>
            {isDemoCollaborative
              ? 'Thank you! Your attendance has been recorded.'
              : 'Thank you! Your attendance has been recorded. Redirecting you to sign in...'}
          </div>
          {!isDemoCollaborative && (
            <button
              onClick={() => navigate('/login')}
              style={{
                display: 'block', width: '100%', padding: '0.85rem',
                background: TEAL, color: 'white', border: 'none',
                borderRadius: '0.5rem', fontSize: '1rem', fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Go to Dashboard Sign-In
            </button>
          )}
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
            disabled={submitting}
            style={{
              width: '100%', padding: '0.85rem',
              background: submitting ? '#9ca3af' : TEAL,
              color: 'white', border: 'none', borderRadius: '0.5rem',
              fontSize: '1rem', fontWeight: '600',
              cursor: submitting ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
