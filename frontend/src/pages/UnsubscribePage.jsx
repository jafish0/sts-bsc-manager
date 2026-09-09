import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { APP_NAME } from '../utils/constants'

const NAVY = '#0E1F56'

// Public unsubscribe page reached via the link at the bottom of every
// notification email.  URL: /unsubscribe/:token
//
// Page load is a READ. The unsubscribe write happens only on the button click:
// mail security scanners fetch and fully render emailed links (and run the JS)
// before the human sees the mail — verified 2026-09-08 against Microsoft's
// scanner — so a write in the load effect silently unsubscribed whoever the
// scanner happened to render. CancelRegistrationPage is the reference shape.
export default function UnsubscribePage() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [profile, setProfile] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Look up only, through a token-scoped SECURITY DEFINER RPC. No write
      // here — see the note above. (Reading user_profiles directly never worked
      // for a logged-out recipient: anon has no SELECT policy on that table, so
      // every emailed unsubscribe link rendered "This link is invalid.")
      const { data, error: pErr } = await supabase.rpc('unsubscribe_lookup', { p_token: token })
      if (cancelled) return
      const p = Array.isArray(data) ? data[0] : data
      if (pErr || !p) { setError('This link is invalid.'); setLoading(false); return }
      setProfile({ full_name: p.full_name, unsubscribed: p.unsubscribed })
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [token])

  // Both writes happen only on a button click, via the token-scoped RPC.
  const setUnsubscribed = async (value) => {
    if (!profile) return
    setSaving(true)
    const { data: status, error: err } = await supabase.rpc('unsubscribe_set', { p_token: token, p_unsubscribe: value })
    setSaving(false)
    if (err || status === 'invalid_token') { setError(err?.message || 'Could not update your preference.'); return }
    setProfile(prev => ({ ...prev, unsubscribed: value }))
  }
  const unsubscribe = () => setUnsubscribed(true)
  const resubscribe = () => setUnsubscribed(false)

  if (loading) return <Shell>Loading…</Shell>
  if (error) return <Shell><p>{error}</p></Shell>

  const unsubscribed = !!profile?.unsubscribed
  return (
    <Shell>
      <h2 style={{ color: NAVY, marginTop: 0 }}>Email Notifications</h2>
      <p style={{ color: '#374151' }}>
        Hi <strong>{profile.full_name || 'there'}</strong>,
      </p>
      {unsubscribed ? (
        <>
          <p style={{ color: '#374151' }}>
            You've been unsubscribed from all {APP_NAME} notifications.
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
        <>
          <p style={{ color: '#374151' }}>
            You're currently subscribed to {APP_NAME} notifications — event reminders, RSVP requests,
            and other automated emails. Account-level emails like password resets are unaffected either way.
          </p>
          <button
            onClick={unsubscribe}
            disabled={saving}
            style={{
              background: '#991b1b', color: 'white', border: 'none',
              padding: '0.6rem 1rem', borderRadius: '6px',
              fontWeight: 600, cursor: saving ? 'wait' : 'pointer',
            }}
          >{saving ? 'Saving…' : 'Unsubscribe me'}</button>
        </>
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
