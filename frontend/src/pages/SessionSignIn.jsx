import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'

const ROLE_OPTIONS = [
  { value: 'team_member', label: 'Team Member' },
  { value: 'agency_admin', label: 'Team Leader / Agency Admin' },
  { value: 'senior_leader', label: 'Senior Leader' },
  { value: 'other', label: 'Other' }
]

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
    role: 'team_member'
  })

  useEffect(() => {
    validateToken()
    // Check if already signed in for this session
    const storedId = sessionStorage.getItem(`attendance_${token}`)
    if (storedId) {
      setAttendanceId(storedId)
      setSignedIn(true)
    }
  }, [token])

  const validateToken = async () => {
    try {
      const { data: link, error: linkErr } = await supabase
        .from('session_links')
        .select('*, bsc_events(id, title, event_date, start_time, end_time, location, collaborative_id)')
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
    if (!form.name.trim() || !form.email.trim()) return
    setSubmitting(true)

    try {
      // Try to match by email in user_profiles
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, team_id, email')
        .ilike('email', form.email.trim())

      const matched = profiles && profiles.length > 0 ? profiles[0] : null

      // Insert attendance record
      const { data: attendance, error: attErr } = await supabase
        .from('session_attendance')
        .insert({
          session_link_id: sessionLink.id,
          bsc_event_id: eventInfo.id,
          collaborative_id: eventInfo.collaborative_id,
          attendee_name: form.name.trim(),
          attendee_email: form.email.trim().toLowerCase(),
          attendee_role: form.role,
          user_profile_id: matched?.id || null,
          team_id: matched?.team_id || null,
          is_matched: !!matched
        })
        .select()
        .single()

      if (attErr) throw attErr

      // If unmatched, create unmatched_attendees record
      if (!matched) {
        // Try to find a suggested team by email domain
        const domain = form.email.trim().split('@')[1]?.toLowerCase()
        let suggestedTeamId = null

        if (domain) {
          const { data: teamProfiles } = await supabase
            .from('user_profiles')
            .select('team_id, email')
            .not('team_id', 'is', null)

          if (teamProfiles) {
            // Get teams in this collaborative
            const { data: collabTeams } = await supabase
              .from('teams')
              .select('id')
              .eq('collaborative_id', eventInfo.collaborative_id)

            const collabTeamIds = new Set((collabTeams || []).map(t => t.id))
            const domainMatch = teamProfiles.find(p =>
              p.email?.toLowerCase().endsWith(`@${domain}`) && collabTeamIds.has(p.team_id)
            )
            if (domainMatch) suggestedTeamId = domainMatch.team_id
          }
        }

        await supabase
          .from('unmatched_attendees')
          .insert({
            session_attendance_id: attendance.id,
            collaborative_id: eventInfo.collaborative_id,
            attendee_name: form.name.trim(),
            attendee_email: form.email.trim().toLowerCase(),
            attendee_role: form.role,
            suggested_team_id: suggestedTeamId
          })
      }

      // Store attendance ID in sessionStorage
      sessionStorage.setItem(`attendance_${token}`, attendance.id)
      setAttendanceId(attendance.id)
      setSignedIn(true)
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
            padding: '1rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#166534'
          }}>
            When you're ready to leave the session, return to this page to complete the session evaluation and sign out.
          </div>
          <button
            onClick={() => navigate(`/session/${token}/eval`)}
            style={{
              display: 'block', width: '100%', padding: '0.85rem',
              background: TEAL, color: 'white', border: 'none',
              borderRadius: '0.5rem', fontSize: '1rem', fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Complete Evaluation & Sign Out
          </button>
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
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '0.35rem', fontSize: '0.9rem' }}>
              Role
            </label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              style={{
                width: '100%', padding: '0.65rem', border: '1px solid #d1d5db',
                borderRadius: '0.375rem', fontSize: '0.9rem', boxSizing: 'border-box'
              }}
            >
              {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
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
