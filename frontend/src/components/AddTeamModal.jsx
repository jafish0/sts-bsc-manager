import { useState } from 'react'
import { supabase } from '../utils/supabase'

function AddTeamModal({ collaborativeId, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    agency_name: '',
    team_name: '',
    primary_contact_name: '',
    primary_contact_email: '',
    estimated_staff_count: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const generateTeamCode = (agencyName) => {
    // Create a code from agency name + random string
    const prefix = agencyName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 6)
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `${prefix}-${random}`
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Validation
    if (!formData.agency_name.trim()) {
      setError('Agency name is required')
      setLoading(false)
      return
    }

    if (formData.primary_contact_email && !formData.primary_contact_email.includes('@')) {
      setError('Please enter a valid email address')
      setLoading(false)
      return
    }

    try {
      // Create team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert([{
          collaborative_id: collaborativeId,
          agency_name: formData.agency_name.trim(),
          team_name: formData.team_name.trim() || null,
          primary_contact_name: formData.primary_contact_name.trim() || null,
          primary_contact_email: formData.primary_contact_email.trim() || null,
          estimated_staff_count: formData.estimated_staff_count ? parseInt(formData.estimated_staff_count) : null
        }])
        .select()
        .single()

      if (teamError) throw teamError

      // Generate team codes for all timepoints
      const teamCode = generateTeamCode(formData.agency_name)
      
      const teamCodes = [
        {
          team_id: team.id,
          code: `${teamCode}-BASELINE`,
          timepoint: 'baseline',
          active: true
        },
        {
          team_id: team.id,
          code: `${teamCode}-ENDLINE`,
          timepoint: 'endline',
          active: true
        },
        {
          team_id: team.id,
          code: `${teamCode}-6MO`,
          timepoint: 'followup_6mo',
          active: true
        },
        {
          team_id: team.id,
          code: `${teamCode}-12MO`,
          timepoint: 'followup_12mo',
          active: true
        }
      ]

      const { error: codesError } = await supabase
        .from('team_codes')
        .insert(teamCodes)

      if (codesError) throw codesError

      console.log('Team and codes created successfully')
      onSuccess()
    } catch (err) {
      console.error('Error creating team:', err)
      setError(err.message || 'Failed to create team')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
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
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ color: '#0E1F56', marginTop: 0, marginBottom: '0.5rem' }}>
          Add Team to Collaborative
        </h2>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Add a new agency/team and automatically generate assessment codes for all timepoints
        </p>

        <form onSubmit={handleSubmit}>
          {/* Agency Name */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              color: '#374151',
              fontSize: '0.9rem',
              fontWeight: '600',
              marginBottom: '0.5rem'
            }}>
              Agency Name *
            </label>
            <input
              type="text"
              value={formData.agency_name}
              onChange={(e) => handleChange('agency_name', e.target.value)}
              placeholder="e.g., Child Protective Services - Region 5"
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

          {/* Team Name */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              color: '#374151',
              fontSize: '0.9rem',
              fontWeight: '600',
              marginBottom: '0.5rem'
            }}>
              Team Name (Optional)
            </label>
            <input
              type="text"
              value={formData.team_name}
              onChange={(e) => handleChange('team_name', e.target.value)}
              placeholder="e.g., STS Implementation Team"
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

          {/* Primary Contact Name */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              color: '#374151',
              fontSize: '0.9rem',
              fontWeight: '600',
              marginBottom: '0.5rem'
            }}>
              Primary Contact Name
            </label>
            <input
              type="text"
              value={formData.primary_contact_name}
              onChange={(e) => handleChange('primary_contact_name', e.target.value)}
              placeholder="e.g., Jane Smith"
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

          {/* Primary Contact Email */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              color: '#374151',
              fontSize: '0.9rem',
              fontWeight: '600',
              marginBottom: '0.5rem'
            }}>
              Primary Contact Email
            </label>
            <input
              type="email"
              value={formData.primary_contact_email}
              onChange={(e) => handleChange('primary_contact_email', e.target.value)}
              placeholder="e.g., jane.smith@agency.org"
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

          {/* Estimated Staff Count */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              color: '#374151',
              fontSize: '0.9rem',
              fontWeight: '600',
              marginBottom: '0.5rem'
            }}>
              Estimated Staff Count
            </label>
            <input
              type="number"
              min="1"
              value={formData.estimated_staff_count}
              onChange={(e) => handleChange('estimated_staff_count', e.target.value)}
              placeholder="e.g., 50"
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
            <p style={{ 
              color: '#6b7280', 
              fontSize: '0.85rem', 
              marginTop: '0.25rem',
              marginBottom: 0
            }}>
              Approximate number of staff who will complete assessments
            </p>
          </div>

          {/* Info Box */}
          <div style={{
            background: '#e0f2fe',
            border: '1px solid #0ea5e9',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <p style={{ 
              color: '#0c4a6e', 
              fontSize: '0.875rem', 
              margin: 0,
              lineHeight: '1.5'
            }}>
              <strong>📋 What happens next:</strong><br/>
              Four unique assessment codes will be generated automatically (Baseline, Endline, 6-Month, 12-Month). You can share these codes with the team when it's time for each assessment period.
            </p>
          </div>

          {/* Error Message */}
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

          {/* Actions */}
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
              {loading ? 'Adding Team...' : 'Add Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddTeamModal