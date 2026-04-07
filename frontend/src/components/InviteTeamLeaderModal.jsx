import { useState } from 'react'
import { supabase } from '../utils/supabase'

function InviteTeamLeaderModal({ teamId, teamName, onClose, onSuccess }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [sentEmail, setSentEmail] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!name.trim()) {
      setError('Name is required')
      setLoading(false)
      return
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address')
      setLoading(false)
      return
    }

    try {
      const { data, error: fnError } = await supabase.functions.invoke('invite-team-leader', {
        body: { email: email.trim(), name: name.trim(), team_id: teamId }
      })

      if (fnError) throw fnError
      if (data?.error) throw new Error(data.error)

      setSentEmail(email.trim())
      setSuccess(true)
      if (onSuccess) onSuccess()
    } catch (err) {
      console.error('Invite error:', err)
      setError(err.message || 'Failed to send invite')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '1rem',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box'
  }

  const labelStyle = {
    display: 'block',
    color: '#374151',
    fontSize: '0.9rem',
    fontWeight: '600',
    marginBottom: '0.5rem'
  }

  return (
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
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '2rem',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {success ? (
          <>
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>&#9993;</div>
              <h2 style={{ color: '#0E1F56', marginTop: 0, marginBottom: '0.5rem' }}>
                Invite Sent!
              </h2>
              <p style={{ color: '#6b7280', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
                An invitation email has been sent to <strong>{sentEmail}</strong>.
                They'll receive a link to set up their password and access the {teamName} dashboard.
              </p>
              <button
                onClick={onClose}
                style={{
                  background: 'linear-gradient(135deg, #00A79D 0%, #0E1F56 100%)',
                  color: 'white',
                  padding: '0.75rem 2rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.95rem'
                }}
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 style={{ color: '#0E1F56', marginTop: 0, marginBottom: '0.25rem' }}>
              Invite Team Leader
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Invite a team leader for <strong>{teamName}</strong>. They'll receive an email with a link to set up their account.
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Full Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Jane Smith"
                  required
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#00A79D'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Email Address *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g., jane.smith@agency.org"
                  required
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#00A79D'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <div style={{
                background: '#e0f2fe',
                border: '1px solid #0ea5e9',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.5rem'
              }}>
                <p style={{ color: '#0c4a6e', fontSize: '0.875rem', margin: 0, lineHeight: '1.5' }}>
                  <strong>What happens next:</strong><br/>
                  The team leader will receive an email invitation with a link to set their password.
                  Once they log in, they'll see their team's dashboard with assessment results and SMARTIE goals.
                </p>
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

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  style={{
                    background: '#e5e7eb',
                    color: '#374151',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '0.95rem',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: loading ? '#9ca3af' : 'linear-gradient(135deg, #00A79D 0%, #0E1F56 100%)',
                    color: 'white',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '0.95rem',
                    boxShadow: loading ? 'none' : '0 4px 12px rgba(0, 167, 157, 0.3)'
                  }}
                >
                  {loading ? 'Sending Invite...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default InviteTeamLeaderModal
