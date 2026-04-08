import { useState } from 'react'
import { supabase } from '../utils/supabase'
import { COLORS } from '../utils/constants'

function InviteTeamMemberModal({ teamId, teamName, onClose, onSuccess }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [agencyRole, setAgencyRole] = useState('')
  const [isSeniorLeader, setIsSeniorLeader] = useState(false)
  const [accessLevel, setAccessLevel] = useState('team_member')
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
        body: {
          email: email.trim(),
          name: name.trim(),
          team_id: teamId,
          role: accessLevel,
          agency_role: agencyRole.trim() || null,
          is_senior_leader: isSeniorLeader
        }
      })

      // The edge function returns JSON with an error field on non-2xx
      if (fnError) {
        // Try to parse the response body for a better error message
        if (fnError.context?.body) {
          try {
            const body = await fnError.context.json()
            throw new Error(body.error || fnError.message)
          } catch (parseErr) {
            if (parseErr.message && parseErr.message !== fnError.message) throw parseErr
          }
        }
        throw fnError
      }
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
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>&#9993;</div>
            <h2 style={{ color: COLORS.navy, marginTop: 0, marginBottom: '0.5rem' }}>
              Invite Sent!
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
              An invitation email has been sent to <strong>{sentEmail}</strong>.
              They'll receive a link to set up their password and access the {teamName} dashboard.
            </p>
            <button
              onClick={onClose}
              style={{
                background: `linear-gradient(135deg, ${COLORS.teal} 0%, ${COLORS.navy} 100%)`,
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
        ) : (
          <>
            <h2 style={{ color: COLORS.navy, marginTop: 0, marginBottom: '0.25rem' }}>
              Invite Team Member
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Add a team member to <strong>{teamName}</strong>. They'll receive an email with a link to set up their account.
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Full Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Jane Smith"
                  required
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = COLORS.teal}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Email Address *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g., jane.smith@agency.org"
                  required
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = COLORS.teal}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Agency Role</label>
                <input
                  type="text"
                  value={agencyRole}
                  onChange={(e) => setAgencyRole(e.target.value)}
                  placeholder="e.g., Case Manager, Therapist, Supervisor"
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = COLORS.teal}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              {/* Senior Leader checkbox */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
                  onClick={() => setIsSeniorLeader(!isSeniorLeader)}
                >
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '4px',
                    border: `2px solid ${isSeniorLeader ? COLORS.teal : '#d1d5db'}`,
                    background: isSeniorLeader ? COLORS.teal : 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    flexShrink: 0
                  }}>
                    {isSeniorLeader && (
                      <span style={{ color: 'white', fontSize: '0.75rem', fontWeight: '700' }}>&#10003;</span>
                    )}
                  </div>
                  <div>
                    <span style={{ color: '#374151', fontSize: '0.9rem', fontWeight: '600' }}>Senior Leader</span>
                    <p style={{ margin: '0.1rem 0 0', color: '#9ca3af', fontSize: '0.8rem' }}>
                      Check if this person is a senior leader at the organization
                    </p>
                  </div>
                </label>
              </div>

              {/* Access Level dropdown */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Access Level *</label>
                <select
                  value={accessLevel}
                  onChange={(e) => setAccessLevel(e.target.value)}
                  style={{
                    ...inputStyle,
                    cursor: 'pointer',
                    appearance: 'auto'
                  }}
                  onFocus={(e) => e.target.style.borderColor = COLORS.teal}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                >
                  <option value="team_member">Team Member — View Only</option>
                  <option value="agency_admin">Team Admin — Full Access</option>
                </select>
                <div style={{
                  marginTop: '0.5rem',
                  padding: '0.6rem 0.75rem',
                  background: accessLevel === 'team_member' ? '#f0fdf4' : '#eff6ff',
                  border: `1px solid ${accessLevel === 'team_member' ? '#bbf7d0' : '#bfdbfe'}`,
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  color: accessLevel === 'team_member' ? '#166534' : '#1e40af',
                  lineHeight: '1.4'
                }}>
                  {accessLevel === 'team_member' ? (
                    <>
                      <strong>View Only:</strong> Can view the team dashboard, assessment results, data visualizations, resources, and participate in the community forum. Cannot edit SMARTIE goals, checklists, or team settings.
                    </>
                  ) : (
                    <>
                      <strong>Full Access:</strong> Can view and edit everything — SMARTIE goals, checklists, team settings, and invite other team members. Same access as the primary team leader.
                    </>
                  )}
                </div>
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
                  They will receive an email invitation with a link to set their password.
                  Once they log in, they'll have access to the team dashboard{accessLevel === 'agency_admin' ? ' with full editing capabilities' : ' in view-only mode'}.
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
                    background: loading ? '#9ca3af' : `linear-gradient(135deg, ${COLORS.teal} 0%, ${COLORS.navy} 100%)`,
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

export default InviteTeamMemberModal
