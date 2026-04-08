import { useState } from 'react'
import { supabase } from '../utils/supabase'

const EVENT_TYPES = [
  { value: 'learning_session', label: 'Learning Session', audience: 'all_teams' },
  { value: 'all_team_call', label: 'All-Team Call', audience: 'all_teams' },
  { value: 'senior_leader_call', label: 'Senior Leader Call', audience: 'senior_leaders' },
  { value: 'other', label: 'Other', audience: 'all_teams' }
]

const EMPTY_EVENT = {
  event_type: 'learning_session',
  title: '',
  event_date: '',
  start_time: '',
  end_time: '',
  location: 'Virtual',
  sequence_number: null
}

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
  const [bscEvents, setBscEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const addEvent = () => {
    // Auto-set title and sequence based on type counts
    const lsCount = bscEvents.filter(e => e.event_type === 'learning_session').length
    const newEvt = { ...EMPTY_EVENT, title: `Learning Session ${lsCount + 1}`, sequence_number: lsCount + 1 }
    setBscEvents(prev => [...prev, newEvt])
  }

  const updateEvent = (idx, field, value) => {
    setBscEvents(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], [field]: value }
      // Auto-set title and audience when type changes
      if (field === 'event_type') {
        const typeInfo = EVENT_TYPES.find(t => t.value === value)
        const countOfType = prev.filter((e, i) => i !== idx && e.event_type === value).length
        if (value === 'learning_session') {
          updated[idx].title = `Learning Session ${countOfType + 1}`
          updated[idx].sequence_number = countOfType + 1
        } else if (value === 'all_team_call') {
          updated[idx].title = `All-Team Call ${countOfType + 1}`
          updated[idx].sequence_number = countOfType + 1
        } else if (value === 'senior_leader_call') {
          updated[idx].title = `Senior Leader Call ${countOfType + 1}`
          updated[idx].sequence_number = countOfType + 1
        } else {
          updated[idx].sequence_number = null
        }
      }
      return updated
    })
  }

  const removeEvent = (idx) => {
    setBscEvents(prev => prev.filter((_, i) => i !== idx))
  }

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

      // Insert BSC events if any
      if (bscEvents.length > 0) {
        const eventsToInsert = bscEvents
          .filter(evt => evt.event_date) // only insert events with dates
          .map(evt => {
            const typeInfo = EVENT_TYPES.find(t => t.value === evt.event_type)
            return {
              collaborative_id: data.id,
              event_type: evt.event_type,
              title: evt.title || evt.event_type,
              event_date: evt.event_date,
              start_time: evt.start_time || null,
              end_time: evt.end_time || null,
              location: evt.location || null,
              audience: typeInfo?.audience || 'all_teams',
              sequence_number: evt.sequence_number
            }
          })

        if (eventsToInsert.length > 0) {
          const { error: eventsError } = await supabase
            .from('bsc_events')
            .insert(eventsToInsert)
          if (eventsError) console.error('Error inserting events:', eventsError)
        }
      }

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

          {/* BSC Events Schedule */}
          <div style={{
            background: '#f0fdf4',
            padding: '1.5rem',
            borderRadius: '8px',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ color: '#0E1F56', fontSize: '1rem', marginTop: 0, marginBottom: '0.5rem' }}>
              BSC Events Schedule (Optional)
            </h3>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Add Learning Sessions, All-Team Calls, and other key events
            </p>

            {bscEvents.map((evt, idx) => (
              <div key={idx} style={{
                background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px',
                padding: '1rem', marginBottom: '0.75rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>Event {idx + 1}</span>
                  <button type="button" onClick={() => removeEvent(idx)} style={{
                    background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer',
                    fontSize: '1.1rem', padding: '0', lineHeight: '1'
                  }}>×</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <select value={evt.event_type} onChange={(e) => updateEvent(idx, 'event_type', e.target.value)}
                    style={{ padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.85rem' }}>
                    {EVENT_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <input type="text" value={evt.title} onChange={(e) => updateEvent(idx, 'title', e.target.value)}
                    placeholder="Event title" style={{ padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.85rem' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem' }}>
                  <input type="date" value={evt.event_date} onChange={(e) => updateEvent(idx, 'event_date', e.target.value)}
                    style={{ padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.85rem' }} />
                  <input type="time" value={evt.start_time} onChange={(e) => updateEvent(idx, 'start_time', e.target.value)}
                    placeholder="Start" style={{ padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.85rem' }} />
                  <input type="time" value={evt.end_time} onChange={(e) => updateEvent(idx, 'end_time', e.target.value)}
                    placeholder="End" style={{ padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.85rem' }} />
                  <input type="text" value={evt.location} onChange={(e) => updateEvent(idx, 'location', e.target.value)}
                    placeholder="Location" style={{ padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.85rem' }} />
                </div>
              </div>
            ))}

            <button type="button" onClick={addEvent} style={{
              background: 'none', border: '1px dashed #00A79D', color: '#00A79D',
              borderRadius: '6px', padding: '0.5rem 1rem', cursor: 'pointer',
              fontSize: '0.85rem', fontWeight: '600', width: '100%'
            }}>+ Add Event</button>
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