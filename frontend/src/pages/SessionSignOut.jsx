import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'

export default function SessionSignOut() {
  const { token } = useParams()
  const [searchParams] = useSearchParams()
  // The evaluation page redirects here with ?evaluated=1 so that, on a device
  // that has no stored sign-in, we can still credit the evaluation the attendee
  // genuinely just submitted.
  const justEvaluated = searchParams.get('evaluated') === '1'
  const [loading, setLoading] = useState(true)
  const [eventTitle, setEventTitle] = useState('')
  const [error, setError] = useState(null)
  // Set when this device has no record of a sign-in, so we must ask who they are
  // instead of showing a confirmation we haven't earned.
  const [needEmail, setNeedEmail] = useState(false)
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [lookupError, setLookupError] = useState(null)

  useEffect(() => {
    completeSignOut()
  }, [token])

  const completeSignOut = async () => {
    try {
      // Get event title for display
      const { data: link } = await supabase
        .from('session_links')
        .select('is_active, bsc_events(title)')
        .eq('token', token)
        .single()

      setEventTitle(link?.bsc_events?.title || 'this session')

      // If the session has been closed (auto-close at end_time + 30 min, or
      // manually by an admin), the cron job has already stamped signed_out_at
      // for everyone still open. Show a friendly thank-you instead of writing.
      if (link && link.is_active === false) {
        sessionStorage.removeItem(`attendance_${token}`)
        return
      }

      // ALWAYS confirm the email rather than signing out silently from remembered
      // state. Josh's call, and his same-device test proved the point: the
      // automatic path keyed off sessionStorage, which is scoped per TAB, so
      // scanning the evaluation QR (a new tab) already lost it. With QR codes that
      // is the normal case, not the edge case — so "automatic" would have failed
      // for most attendees while asking only some of them, which is impossible to
      // give a room one clear instruction about.
      //
      // One screen for everyone. Prefilled from localStorage when this device
      // remembers the address, so it is usually a single tap.
      let remembered = ''
      try {
        remembered = localStorage.getItem(`attendeeEmail_${token}`) || ''
      } catch { /* private browsing */ }
      setEmail(remembered)
      setNeedEmail(true)
    } catch (err) {
      console.error('Sign-out error:', err)
      setError('There was an issue completing your sign-out, but your evaluation has been recorded.')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSignOut = async (e) => {
    e.preventDefault()
    const addr = email.trim()
    if (!addr) return
    setSubmitting(true); setLookupError(null)
    try {
      // RPC, not a direct update: anon has no SELECT on session_attendance, so
      // the row can only be found server-side. Returns a status string only.
      const { data: status, error: rpcErr } = await supabase.rpc('sign_out_by_email', {
        p_token: token,
        p_email: addr,
        p_mark_eval: justEvaluated,
      })
      if (rpcErr) throw rpcErr

      if (status === 'no_match') {
        setLookupError("We couldn't find a sign-in for that email at this training. Check the address, or ask the trainer to sign you out.")
      } else if (status === 'invalid_link') {
        setLookupError('This sign-out link is not valid.')
      } else {
        // 'signed_out' or 'already_signed_out' — both mean they're recorded.
        // Clear the remembered address now they're done, so a shared or reused
        // phone doesn't prefill the previous person's email.
        try {
          sessionStorage.removeItem(`attendance_${token}`)
          localStorage.removeItem(`attendeeEmail_${token}`)
        } catch { /* private browsing */ }
        setNeedEmail(false)
      }
    } catch (err) {
      setLookupError(err.message || String(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f9fafb' }}>
        <div style={{ color: NAVY, fontSize: '1.1rem' }}>Signing out...</div>
      </div>
    )
  }

  // Nothing on this device identifies them, so ask rather than claim success.
  if (needEmail) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
        <div style={{ background: 'white', borderRadius: '0.75rem', padding: '2rem', maxWidth: '480px', width: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: NAVY, margin: '0 0 0.5rem', fontSize: '1.25rem' }}>One last step</h2>
          <p style={{ color: '#4b5563', fontSize: '0.9rem', margin: '0 0 0.25rem' }}>
            {justEvaluated
              ? <>Your evaluation has been submitted — thank you. It stays anonymous.</>
              : <>Let&apos;s get you signed out of <strong>{eventTitle}</strong>.</>}
          </p>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 1rem' }}>
            Please enter the email you signed in with, so we can record your attendance.
          </p>
          <form onSubmit={handleEmailSignOut}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@agency.org"
              autoComplete="email"
              required
              style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '1rem', boxSizing: 'border-box' }}
            />
            {lookupError && (
              <p style={{ color: '#b91c1c', fontSize: '0.82rem', margin: '0.5rem 0 0' }}>{lookupError}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              style={{ marginTop: '0.9rem', width: '100%', background: TEAL, color: 'white', border: 'none', padding: '0.7rem', borderRadius: '6px', fontSize: '1rem', fontWeight: 600, cursor: submitting ? 'wait' : 'pointer' }}
            >{submitting ? 'Signing out…' : 'Complete sign-out'}</button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{
        background: 'white', borderRadius: '0.75rem', padding: '2.5rem',
        maxWidth: '550px', textAlign: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>&#128075;</div>
        <h2 style={{ color: NAVY, marginBottom: '0.5rem' }}>You've Been Signed Out</h2>
        <p style={{ color: '#6b7280', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
          Thank you for attending <strong>{eventTitle}</strong>!
        </p>
        <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
          Your evaluation has been submitted and your attendance has been recorded. You may close this window.
        </p>
        {error && (
          <p style={{ color: '#D97706', fontSize: '0.85rem', marginTop: '1rem' }}>{error}</p>
        )}
      </div>
    </div>
  )
}
