import { useState } from 'react'
import { supabase } from '../utils/supabase'

function CreateCollaborativeModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    baseline_start_date: '',
    baseline_end_date: '',
    endline_start_date: '',
    endline_end_date: '',
    followup_6mo_start_date: '',
    followup_6mo_end_date: '',
    followup_12mo_start_date: '',
    followup_12mo_end_date: '',
    status: 'active'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Validation
    if (!formData.name.trim()) {
      setError('Collaborative name is required')
      setLoading(false)
      return
    }

    if (!formData.start_date || !formData.end_date) {
      setError('Start and end dates are required')
      setLoading(false)
      return
    }

    if (new Date(formData.end_date) <= new Date(formData.start_date)) {
      setError('End date must be after start date')
      setLoading(false)
      return
    }

    try {
      const { data, error: insertError } = await supabase
        .from('collaboratives')
        .insert([{
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          start_date: formData.start_date,
          end_date: formData.end_date,
          baseline_start_date: formData.baseline_start_date || null,
          baseline_end_date: formData.baseline_end_date || null,
          endline_start_date: formData.endline_start_date || null,
          endline_end_date: formData.endline_end_date || null,
          followup_6mo_start_date: formData.followup_6mo_start_date || null,
          followup_6mo_end_date: formData.followup_6mo_end_date || null,
          followup_12mo_start_date: formData.followup_12mo_start_date || null,
          followup_12mo_end_date: formData.followup_12mo_end_date || null,
          status: formData.status
        }])
        .select()
        .single()

      if (insertError) throw insertError

      console.log('Collaborative created:', data)
      onSuccess()
    } catch (err) {
      console.error('Error creating collaborative:', err)
      setError(err.message || 'Failed to create collaborative')
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
          maxWidth: '700px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ color: '#0E1F56', marginTop: 0, marginBottom: '0.5rem' }}>
          Create New Collaborative
        </h2>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Set up a new breakthrough series collaborative program with assessment timepoints
        </p>

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              color: '#374151',
              fontSize: '0.9rem',
              fontWeight: '600',
              marginBottom: '0.5rem'
            }}>
              Collaborative Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Fall 2025 Child Welfare BSC"
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

          {/* Description */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              color: '#374151',
              fontSize: '0.9rem',
              fontWeight: '600',
              marginBottom: '0.5rem'
            }}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Brief description of this collaborative..."
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '1rem',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
              onFocus={(e) => e.target.style.borderColor = '#00A79D'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          {/* Overall Date Range */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '1rem',
            marginBottom: '1.5rem' 
          }}>
            <div>
              <label style={{
                display: 'block',
                color: '#374151',
                fontSize: '0.9rem',
                fontWeight: '600',
                marginBottom: '0.5rem'
              }}>
                Overall Start Date *
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => handleChange('start_date', e.target.value)}
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

            <div>
              <label style={{
                display: 'block',
                color: '#374151',
                fontSize: '0.9rem',
                fontWeight: '600',
                marginBottom: '0.5rem'
              }}>
                Overall End Date *
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => handleChange('end_date', e.target.value)}
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
          </div>

          {/* Assessment Timepoints Section */}
          <div style={{
            background: '#f9fafb',
            padding: '1.5rem',
            borderRadius: '8px',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ 
              color: '#0E1F56', 
              fontSize: '1rem', 
              marginTop: 0,
              marginBottom: '1rem'
            }}>
              Assessment Timepoints (Optional)
            </h3>
            <p style={{ 
              color: '#6b7280', 
              fontSize: '0.85rem', 
              marginBottom: '1rem'
            }}>
              Define when teams can complete assessments at each timepoint
            </p>

            {/* Baseline */}
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ color: '#374151', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                Baseline Assessment
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <input
                  type="date"
                  value={formData.baseline_start_date}
                  onChange={(e) => handleChange('baseline_start_date', e.target.value)}
                  placeholder="Start"
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
                <input
                  type="date"
                  value={formData.baseline_end_date}
                  onChange={(e) => handleChange('baseline_end_date', e.target.value)}
                  placeholder="End"
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Endline */}
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ color: '#374151', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                Endline Assessment
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <input
                  type="date"
                  value={formData.endline_start_date}
                  onChange={(e) => handleChange('endline_start_date', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
                <input
                  type="date"
                  value={formData.endline_end_date}
                  onChange={(e) => handleChange('endline_end_date', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* 6-Month Follow-up */}
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ color: '#374151', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                6-Month Follow-up
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <input
                  type="date"
                  value={formData.followup_6mo_start_date}
                  onChange={(e) => handleChange('followup_6mo_start_date', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
                <input
                  type="date"
                  value={formData.followup_6mo_end_date}
                  onChange={(e) => handleChange('followup_6mo_end_date', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* 12-Month Follow-up */}
            <div>
              <h4 style={{ color: '#374151', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                12-Month Follow-up
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <input
                  type="date"
                  value={formData.followup_12mo_start_date}
                  onChange={(e) => handleChange('followup_12mo_start_date', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
                <input
                  type="date"
                  value={formData.followup_12mo_end_date}
                  onChange={(e) => handleChange('followup_12mo_end_date', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Status */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              color: '#374151',
              fontSize: '0.9rem',
              fontWeight: '600',
              marginBottom: '0.5rem'
            }}>
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '1rem',
                boxSizing: 'border-box',
                cursor: 'pointer'
              }}
            >
              <option value="active">Active</option>
              <option value="upcoming">Upcoming</option>
              <option value="completed">Completed</option>
            </select>
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
              {loading ? 'Creating...' : 'Create Collaborative'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateCollaborativeModal