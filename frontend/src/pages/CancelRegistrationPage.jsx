import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'

const NAVY = '#0E1F56'
const RED = '#991b1b'

// Public cancel page reached from the cancel link in confirmation emails.
// URL: /cancel-registration/:token
export default function CancelRegistrationPage() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reg, setReg] = useState(null)
  const [link, setLink] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [alreadyCancelled, setAlreadyCancelled] = useState(false)

  useEffect(() => {
    let cancelledLocal = false
    ;(async () => {
      const { data: r } = await supabase
        .from('event_registrations')
        .select('id, full_name, email, status, registration_link_id')
        .eq('cancel_token', token)
        .maybeSingle()
      if (cancelledLocal) return
      if (!r) { setError('This cancel link is invalid.'); setLoading(false); return }
      setReg(r)
      if (r.status === 'cancelled') setAlreadyCancelled(true)

      const { data: l } = await supabase
        .from('event_registration_links')
        .select('title, collaboratives(name)')
        .eq('id', r.registration_link_id)
        .maybeSingle()
      if (!cancelledLocal) {
        setLink(l)
        setLoading(false)
      }
    })()
    return () => { cancelledLocal = true }
  }, [token])

  const doCancel = async () => {
    setCancelling(true)
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-registration`
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel_token: token }),
      })
      const json = await resp.json()
      if (!resp.ok) { setError(json.error || `Cancel failed (HTTP ${resp.status})`); return }
      setCancelled(true)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setCancelling(false)
    }
  }

  if (loading) return <Shell>Loading…</Shell>
  if (error) return <Shell><p>{error}</p></Shell>

  if (cancelled || alreadyCancelled) {
    return (
      <Shell>
        <h2 style={{ color: NAVY, marginTop: 0 }}>Registration cancelled</h2>
        <p style={{ color: '#374151' }}>
          {alreadyCancelled
            ? <>Your registration for <strong>{link?.title}</strong> was already cancelled.</>
            : <>Your registration for <strong>{link?.title}</strong> has been cancelled. We sent a confirmation to <strong>{reg.email}</strong>.</>}
        </p>
        <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>
          You can re-register any time using the original registration link if you change your mind.
        </p>
      </Shell>
    )
  }

  return (
    <Shell>
      <h2 style={{ color: NAVY, marginTop: 0 }}>Cancel your registration?</h2>
      <p style={{ color: '#374151' }}>
        You're about to cancel <strong>{reg.full_name}</strong>'s registration for{' '}
        <strong>{link?.title}</strong>{link?.collaboratives?.name && <> ({link.collaboratives.name})</>}.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
        <button
          onClick={doCancel}
          disabled={cancelling}
          style={{
            background: RED, color: 'white', border: 'none',
            padding: '0.6rem 1.1rem', borderRadius: '6px',
            fontWeight: 600, cursor: cancelling ? 'wait' : 'pointer',
          }}
        >{cancelling ? 'Cancelling…' : 'Yes, cancel my registration'}</button>
        <button
          onClick={() => window.history.back()}
          style={{
            background: 'transparent', color: '#374151',
            border: '1px solid #d1d5db', padding: '0.6rem 1.1rem',
            borderRadius: '6px', cursor: 'pointer',
          }}
        >Never mind</button>
      </div>
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
