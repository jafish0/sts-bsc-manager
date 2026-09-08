import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import ctacLogo from '../assets/UKCTAC_logoasuite_web__primary_tagline_color.png'
import ukLogo from '../assets/UK_Lockup-286.png'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'

// Set / reset password. Two ways in:
//
// 1. token_hash flow (the fix for Microsoft Safe Links, 2026-09-08). The email
//    templates link to /set-password?token_hash=…&type=invite|recovery. Loading
//    that URL consumes NOTHING — it is a plain SPA page load. The token is only
//    spent when the person submits a typed password: verifyOtp() then
//    updateUser() back to back. Mail security scanners fetch and fully render
//    emailed links, and they execute our JS (verified against Microsoft's
//    scanner, which loaded this page and called /auth/v1/user), but they cannot
//    invent a password and submit a form. Deliberately NOT a bare "Continue"
//    button, which a detonation sandbox could click. Do not move verifyOtp into
//    a useEffect — that recreates the bug one layer up.
//
// 2. Legacy hash-fragment flow (#access_token=…&type=invite). Supabase's
//    {{ .ConfirmationURL }} verifies on a GET the moment anything fetches it,
//    which is exactly what a scanner does — 19 seconds after send, before the
//    human saw the mail. Kept working for links already in flight; remove once
//    no live invites predate the template change.
export default function SetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tokenHash = searchParams.get('token_hash')
  const otpType = searchParams.get('type') // 'invite' | 'recovery' | 'signup' | 'email'
  const hasTokenHash = !!tokenHash && !!otpType

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [checking, setChecking] = useState(!hasTokenHash)
  // Set when verifyOtp fails on submit: the link was already used / expired.
  const [linkDead, setLinkDead] = useState(false)

  useEffect(() => {
    // token_hash flow: nothing to verify on load, by design. Show the form.
    if (hasTokenHash) return undefined

    // Legacy flow: Supabase auto-detects the hash token and creates a session;
    // wait for the auth state to settle.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
        setChecking(false)
      }
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
      setChecking(false)
    })
    return () => subscription.unsubscribe()
  }, [hasTokenHash])

  // "Accepted" means a human finished onboarding — stamped here on a
  // successful password submit, not on first page load (AuthContext used to,
  // and scanner sessions were marking invites accepted).
  const stampInviteAccepted = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return
    await supabase
      .from('user_profiles')
      .update({ invite_accepted_at: new Date().toISOString() })
      .eq('id', user.id)
      .is('invite_accepted_at', null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      if (hasTokenHash) {
        // Spend the token only now, with a real password in hand.
        const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType })
        if (otpError) {
          // Already used, expired, or tampered — show the actionable copy but
          // keep what they typed.
          setLinkDead(true)
          setLoading(false)
          return
        }
        // Don't let the token survive in history or a screenshot.
        window.history.replaceState(null, '', '/set-password')
      }

      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      await stampInviteAccepted()
      setSuccess(true)
      setTimeout(() => navigate('/admin'), 2000)
    } catch (err) {
      console.error('Password update error:', err)
      setError(err.message || 'Failed to set password')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    border: '2px solid var(--border)',
    borderRadius: '8px',
    fontSize: '1rem',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s'
  }

  if (checking) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-page)' }}>
        <div style={{ textAlign: 'center', color: NAVY, fontSize: '1.1rem' }}>Verifying your link...</div>
      </div>
    )
  }

  // Bad link: legacy flow with no session, or token_hash flow whose verifyOtp
  // failed on submit. Invite / recovery links are single-use, and Supabase
  // reports a consumed link the same way as an expired one — so this copy
  // covers both honestly instead of guessing.
  if ((!hasTokenHash && !sessionReady) || linkDead) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-page)' }}>
        <div style={{ maxWidth: '400px', textAlign: 'center', padding: '2rem' }}>
          <h2 style={{ color: NAVY }}>This link can't be used</h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.55 }}>
            Sign-in links work once and expire after a while, so this one may already have been used.
          </p>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            If you've set a password before, just <strong>sign in</strong>. Forgotten it, or never got to set one?
            Use <strong>Forgot password</strong> and we'll email you a fresh link.
          </p>
          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1rem' }}>
            <button
              onClick={() => navigate('/login')}
              style={{ padding: '0.75rem 1.5rem', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
            >
              Sign in
            </button>
            <button
              onClick={() => navigate('/login?reset=1')}
              style={{ padding: '0.75rem 1.5rem', background: 'white', color: NAVY, border: `2px solid ${NAVY}`, borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
            >
              Forgot password
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-page)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
        padding: '2.5rem',
        maxWidth: '440px',
        width: '100%'
      }}>
        {/* Logos */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <img src={ctacLogo} alt="CTAC" style={{ height: '36px' }} />
          <img src={ukLogo} alt="University of Kentucky" style={{ height: '30px' }} />
        </div>

        <h2 style={{ color: NAVY, margin: '0 0 0.25rem', fontSize: '1.5rem' }}>
          {otpType === 'recovery' ? 'Reset Your Password' : 'Set Your Password'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          {otpType === 'recovery'
            ? 'Choose a new password for your BSC Platform account.'
            : 'Welcome to the BSC Platform! Create a password to access your dashboard.'}
        </p>

        {success ? (
          <div style={{
            background: '#ecfdf5',
            border: '1px solid #10b981',
            borderRadius: '8px',
            padding: '1.25rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>&#10003;</div>
            <p style={{ color: '#065f46', fontWeight: '600', margin: '0 0 0.25rem' }}>
              Password set successfully!
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
              Redirecting to your dashboard...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
                autoComplete="new-password"
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = TEAL}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
                minLength={8}
                autoComplete="new-password"
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = TEAL}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            {error && (
              <div style={{
                background: '#fee2e2',
                border: '1px solid #ef4444',
                color: '#991b1b',
                padding: '0.75rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                fontSize: '0.9rem'
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.85rem',
                background: loading ? '#9ca3af' : `linear-gradient(135deg, ${TEAL} 0%, ${NAVY} 100%)`,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '1rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 12px rgba(0, 167, 157, 0.3)'
              }}
            >
              {loading ? 'Setting Password...' : 'Set Password & Continue'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
