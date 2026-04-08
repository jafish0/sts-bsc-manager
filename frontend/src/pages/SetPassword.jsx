import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import ctacLogo from '../assets/UKCTAC_logoasuite_web__primary_tagline_color.png'
import ukLogo from '../assets/UK_Lockup-286.png'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'

export default function SetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Supabase auto-detects the token from the URL hash and creates a session
    // We just need to wait for the auth state to settle
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
        setChecking(false)
      }
    })

    // Also check if there's already a session (e.g., token was already processed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true)
      }
      setChecking(false)
    })

    return () => subscription.unsubscribe()
  }, [])

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
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
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

  if (!sessionReady) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-page)' }}>
        <div style={{ maxWidth: '400px', textAlign: 'center', padding: '2rem' }}>
          <h2 style={{ color: NAVY }}>Invalid or Expired Link</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            This link may have expired or already been used. Please request a new invite or use the "Forgot Password" option on the login page.
          </p>
          <button
            onClick={() => navigate('/login')}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              background: TEAL,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Go to Login
          </button>
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
          Set Your Password
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Welcome to the STS-BSC Manager! Create a password to access your team dashboard.
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
