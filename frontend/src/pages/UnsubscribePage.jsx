import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'

const NAVY = '#0E1F56'

// Public unsubscribe page reached via the link at the bottom of every
// notification email.  URL: /unsubscribe/:token
//
// Sets user_profiles.notifications_unsubscribed_at = NOW() (and lets the user
// undo by clicking "Resubscribe me" right after).
export default function UnsubscribePage() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [profile, setProfile] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Read by token, then immediately stamp unsubscribed_at if not already set.
      const { data: p, error: pErr } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, notifications_unsubscribed_at')
        .eq('unsubscribe_token', token)
        .maybeSingle()
      if (cancelled) return
      if (pErr || !p) { setError('This link is invalid.'); setLoading(false); return }
      setProfile(p)
      setLoading(false)

      if (!p.notifications_unsubscribed_at) {
        const { data: updated } = await supabase
          .from('user_profiles')
          .update({ notifications_unsubscribed_at: new Date().toISOString() })
          .eq('id', p.id)
          .select('notifications_unsubscribed_at')
          .single()
        if (!cancelled && updated) {
          setProfile(prev => ({ ...prev, notifications_unsubscribed_at: updated.notifications_unsubscribed_at }))
        }
      }
    })()
    return () => { cancelled = true }
  }, [token])

  const resubscribe = async () => {
    if (!profile) return
    setSaving(true)
    const { error: err } = await supabase
      .from('user_profiles')
      .update({ notifications_unsubscribed_at: null })
      .eq('id', profile.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setProfile(prev => ({ ...prev, notifications_unsubscribed_at: null }))
  }

  if (loading) return <Shell>Loading…</Shell>
  if (error) return <Shell><p>{error}</p></Shell>

  const unsubscribed = !!profile?.notifications_unsubscribed_at
  return (
    <Shell>
      <h2 style={{ color: NAVY, marginTop: 0 }}>Email Notifications</h2>
      <p style={{ color: '#374151' }}>
        Hi <strong>{profile.full_name || profile.email}</strong>,
      </p>
      {unsubscribed ? (
        <>
          <p style={{ color: '#374151' }}>
            You've been unsubscribed from all CTAC BSC Manager notifications.
            You won't receive event reminders, RSVP requests, or other automated emails.
            (Account-level emails like password resets are unaffected.)
          </p>
          <button
            onClick={resubscribe}
            disabled={saving}
            style={{
              background: NAVY, color: 'white', border: 'none',
              padding: '0.6rem 1rem', borderRadius: '6px',
              fontWeight: 600, cursor: saving ? 'wait' : 'pointer',
            }}
          >Resubscribe me</button>
        </>
      ) : (
        <p style={{ color: '#374151' }}>You're currently subscribed to notifications.</p>
      )}
    </Shell>
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
