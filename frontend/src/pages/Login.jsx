import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import ctacLogo from '../assets/UKCTAC_logoasuite_web__primary_tagline_color.png'
import ukLogo from '../assets/UK_Lockup-286.png'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setResetError('')
    if (!resetEmail.trim() || !resetEmail.includes('@')) {
      setResetError('Please enter a valid email address')
      return
    }
    setResetLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: window.location.origin + '/set-password',
      })
      if (error) throw error
      setResetSent(true)
    } catch (err) {
      setResetError(err.message || 'Failed to send reset email')
    } finally {
      setResetLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error } = await signIn(email, password)

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      // Navigate to dashboard after successful login
      navigate('/admin')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0E1F56 0%, #00A79D 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '3rem 2.5rem',
        maxWidth: '450px',
        width: '100%',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img 
            src={ctacLogo} 
            alt="Center on Trauma and Children" 
            style={{ maxWidth: '240px', width: '100%', height: 'auto', marginBottom: '1rem' }}
          />
          <h1 style={{ color: '#0E1F56', fontSize: '1.75rem', marginBottom: '0.5rem' }}>
            Admin Portal
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.95rem' }}>
            STS Breakthrough Series Collaborative Manager
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              color: '#374151',
              fontSize: '0.9rem',
              fontWeight: '600',
              marginBottom: '0.5rem'
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '1rem',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#00A79D'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              color: '#374151',
              fontSize: '0.9rem',
              fontWeight: '600',
              marginBottom: '0.5rem'
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '1rem',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#00A79D'}
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
              marginBottom: '1.5rem',
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
              background: loading ? '#9ca3af' : 'linear-gradient(135deg, #00A79D 0%, #0E1F56 100%)',
              color: 'white',
              padding: '0.875rem',
              borderRadius: '8px',
              border: 'none',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'transform 0.2s',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(0, 167, 157, 0.3)'
            }}
            onMouseEnter={(e) => {
              if (!loading) e.target.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)'
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={() => { setShowForgotPassword(true); setResetEmail(email); setResetSent(false); setResetError('') }}
              style={{
                background: 'none',
                border: 'none',
                color: '#00A79D',
                cursor: 'pointer',
                fontSize: '0.875rem',
                textDecoration: 'underline'
              }}
            >
              Forgot your password?
            </button>
          </div>
        </form>

        <div style={{
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '2px solid #e5e7eb',
          textAlign: 'center'
        }}>
          <img 
            src={ukLogo} 
            alt="University of Kentucky" 
            style={{ maxWidth: '200px', width: '100%', height: 'auto' }}
          />
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '2rem'
          }}
          onClick={() => setShowForgotPassword(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '420px',
              width: '100%'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {resetSent ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>&#9993;</div>
                <h3 style={{ color: '#0E1F56', margin: '0 0 0.5rem' }}>Check Your Email</h3>
                <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  If an account exists for <strong>{resetEmail}</strong>, you'll receive a password reset link shortly.
                </p>
                <button
                  onClick={() => setShowForgotPassword(false)}
                  style={{
                    padding: '0.6rem 1.5rem',
                    background: '#00A79D',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <>
                <h3 style={{ color: '#0E1F56', margin: '0 0 0.5rem' }}>Reset Password</h3>
                <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                  Enter your email and we'll send you a link to reset your password.
                </p>
                <form onSubmit={handleForgotPassword}>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                      marginBottom: '1rem'
                    }}
                  />
                  {resetError && (
                    <div style={{
                      background: '#fee2e2',
                      border: '1px solid #ef4444',
                      color: '#991b1b',
                      padding: '0.5rem',
                      borderRadius: '8px',
                      marginBottom: '1rem',
                      fontSize: '0.85rem'
                    }}>
                      {resetError}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(false)}
                      style={{
                        padding: '0.6rem 1.25rem',
                        background: '#e5e7eb',
                        color: '#374151',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      style={{
                        padding: '0.6rem 1.25rem',
                        background: resetLoading ? '#9ca3af' : '#00A79D',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: resetLoading ? 'not-allowed' : 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      {resetLoading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Login