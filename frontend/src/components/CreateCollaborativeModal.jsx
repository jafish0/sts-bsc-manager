import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { PROGRAM_TYPE_COLORS, getProgramBranding } from '../config/programConfig'

// Build the locked, pre-populated event list for a given program type.
// Falls back to STS-BSC defaults if program has none defined.
function buildDefaultEvents(programType) {
  const branding = getProgramBranding(programType)
  const defaults = branding.defaultEvents || []
  return defaults.map(d => ({
    event_type: d.event_type,
    title: d.title,
    event_date: '',
    start_time: '',
    end_time: '',
    location: 'Virtual',
    sequence_number: d.sequence_number,
    locked: true,
  }))
}

const EVENT_TYPES = [
  { value: 'learning_session', label: 'Learning Session', audience: 'all_teams' },
  { value: 'all_team_call', label: 'All-Team Call', audience: 'all_teams' },
  { value: 'senior_leader_call', label: 'Senior Leader Call', audience: 'senior_leaders' },
  { value: 'other', label: 'Other', audience: 'all_teams' }
]

const inputStyle = {
  width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb',
  borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box'
}

// Helper: add days to a date string
function addDays(dateStr, days) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function CreateCollaborativeModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active',
    program_type: 'sts_bsc'
  })

  // Pre-populate the standard schedule for the selected program type.
  // Default events are sourced from each program's welcome packet / agenda — see programConfig.js.
  // Resets when program_type changes (see effect below).
  const [bscEvents, setBscEvents] = useState(() => buildDefaultEvents(formData.program_type))

  // Auto-computed assessment dates from LS3
  const [assessmentDates, setAssessmentDates] = useState({
    baseline_start_date: '', baseline_end_date: '',
    endline_start_date: '', endline_end_date: '',
    followup_6mo_start_date: '', followup_6mo_end_date: '',
    followup_12mo_start_date: '', followup_12mo_end_date: ''
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Reset event list to the program's defaults whenever program_type changes.
  useEffect(() => {
    setBscEvents(buildDefaultEvents(formData.program_type))
  }, [formData.program_type])

  // Helper: get first and last Learning Sessions by sequence_number (program-agnostic).
  const learningSessions = bscEvents
    .filter(e => e.event_type === 'learning_session')
    .slice()
    .sort((a, b) => (a.sequence_number || 0) - (b.sequence_number || 0))
  const firstLs = learningSessions[0]
  const lastLs = learningSessions[learningSessions.length - 1]

  // Auto-compute assessment dates when LS dates change.
  // Anchored to the first LS (baseline) and the last LS (endline + follow-ups).
  useEffect(() => {
    if (firstLs?.event_date) {
      // Baseline: 4 weeks before first LS through day before first LS
      setAssessmentDates(prev => ({
        ...prev,
        baseline_start_date: addDays(firstLs.event_date, -28),
        baseline_end_date: addDays(firstLs.event_date, -1)
      }))
    }

    if (lastLs?.event_date) {
      // Endline: 2 weeks after last LS through 6 weeks after
      const endlineStart = addDays(lastLs.event_date, 14)
      const endlineEnd = addDays(lastLs.event_date, 42)
      // 6mo follow-up: 6 months after last LS (180 days) ± 3 weeks
      const sixMoCenter = addDays(lastLs.event_date, 180)
      const sixMoStart = addDays(sixMoCenter, -21)
      const sixMoEnd = addDays(sixMoCenter, 21)
      // 12mo follow-up: 12 months after last LS (365 days) ± 3 weeks
      const twelveMoCenter = addDays(lastLs.event_date, 365)
      const twelveMoStart = addDays(twelveMoCenter, -21)
      const twelveMoEnd = addDays(twelveMoCenter, 21)

      setAssessmentDates(prev => ({
        ...prev,
        endline_start_date: endlineStart,
        endline_end_date: endlineEnd,
        followup_6mo_start_date: sixMoStart,
        followup_6mo_end_date: sixMoEnd,
        followup_12mo_start_date: twelveMoStart,
        followup_12mo_end_date: twelveMoEnd
      }))
    }
  }, [firstLs?.event_date, lastLs?.event_date])

  const addEvent = () => {
    const newEvt = {
      event_type: 'all_team_call',
      title: `All-Team Call ${bscEvents.filter(e => e.event_type === 'all_team_call').length + 1}`,
      event_date: '', start_time: '', end_time: '', location: 'Virtual',
      sequence_number: null, locked: false
    }
    setBscEvents(prev => [...prev, newEvt])
  }

  const updateEvent = (idx, field, value) => {
    setBscEvents(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], [field]: value }
      if (field === 'event_type' && !updated[idx].locked) {
        const countOfType = prev.filter((e, i) => i !== idx && e.event_type === value).length
        const typeLabel = EVENT_TYPES.find(t => t.value === value)?.label || value
        updated[idx].title = `${typeLabel} ${countOfType + 1}`
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

    if (!formData.name.trim()) {
      setError('Collaborative name is required')
      setLoading(false)
      return
    }

    // Validate first and last Learning Session dates are set
    if (!firstLs?.event_date || !lastLs?.event_date) {
      setError('Please set dates for the first and last Learning Sessions')
      setLoading(false)
      return
    }

    // Derive start/end from first LS and follow-up window
    const startDate = addDays(firstLs.event_date, -30) // 30 days before first LS
    const endDate = assessmentDates.followup_12mo_end_date || addDays(lastLs.event_date, 400)

    try {
      const { data, error: insertError } = await supabase
        .from('collaboratives')
        .insert([{
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          program_type: formData.program_type,
          start_date: startDate,
          end_date: endDate,
          baseline_start_date: assessmentDates.baseline_start_date || null,
          baseline_end_date: assessmentDates.baseline_end_date || null,
          endline_start_date: assessmentDates.endline_start_date || null,
          endline_end_date: assessmentDates.endline_end_date || null,
          followup_6mo_start_date: assessmentDates.followup_6mo_start_date || null,
          followup_6mo_end_date: assessmentDates.followup_6mo_end_date || null,
          followup_12mo_start_date: assessmentDates.followup_12mo_start_date || null,
          followup_12mo_end_date: assessmentDates.followup_12mo_end_date || null,
          status: formData.status
        }])
        .select()
        .single()

      if (insertError) throw insertError

      // Insert BSC events
      const eventsToInsert = bscEvents
        .filter(evt => evt.event_date)
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

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '2rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white', borderRadius: '12px', padding: '2rem',
          maxWidth: '750px', width: '100%', maxHeight: '90vh', overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ color: '#0E1F56', marginTop: 0, marginBottom: '0.5rem' }}>
          Create New Collaborative
        </h2>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Set up a new breakthrough series collaborative with Learning Sessions and assessment windows
        </p>

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', color: '#374151', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.4rem' }}>
              Collaborative Name *
            </label>
            <input type="text" value={formData.name} onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Fall 2025 Child Welfare BSC" required
              style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
              onFocus={(e) => e.target.style.borderColor = '#00A79D'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
          </div>

          {/* Program Type */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', color: '#374151', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.4rem' }}>
              Program Type *
            </label>
            <select
              value={formData.program_type}
              onChange={(e) => handleChange('program_type', e.target.value)}
              style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' }}
            >
              {Object.entries(PROGRAM_TYPE_COLORS).map(([key, pt]) => (
                <option key={key} value={key}>{pt.label}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', color: '#374151', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.4rem' }}>
              Description
            </label>
            <textarea value={formData.description} onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Brief description of this collaborative..." rows={2}
              style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', transition: 'border-color 0.2s' }}
              onFocus={(e) => e.target.style.borderColor = '#00A79D'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
          </div>

          {/* BSC Schedule — Required, moved up */}
          <div style={{ background: '#f0fdf4', padding: '1.25rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid #bbf7d0' }}>
            <h3 style={{ color: '#0E1F56', fontSize: '1rem', marginTop: 0, marginBottom: '0.25rem' }}>
              BSC Schedule *
            </h3>
            <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '1rem' }}>
              Default schedule pre-populated from the program's standard agenda. Set dates for at least the first and last Learning Sessions — assessment windows are auto-calculated from those. Other dates (calls, intermediate sessions) are optional; leave blank to skip.
            </p>

            {bscEvents.map((evt, idx) => (
              <div key={idx} style={{
                background: 'white', border: evt.locked ? '2px solid #00A79D30' : '1px solid #e5e7eb',
                borderRadius: '8px', padding: '0.75rem', marginBottom: '0.5rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', color: evt.locked ? '#00A79D' : '#374151' }}>
                    {evt.title}
                  </span>
                  <button type="button" onClick={() => removeEvent(idx)} title="Remove this event" style={{
                    background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer',
                    fontSize: '1.1rem', padding: '0', lineHeight: '1'
                  }}>×</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: evt.locked ? '1fr 1fr 1fr' : '1fr 1fr 1fr 1fr 1fr', gap: '0.4rem' }}>
                  {!evt.locked && (
                    <select value={evt.event_type} onChange={(e) => updateEvent(idx, 'event_type', e.target.value)} style={inputStyle}>
                      {EVENT_TYPES.filter(t => t.value !== 'learning_session').map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  )}
                  <input type="date" value={evt.event_date} onChange={(e) => updateEvent(idx, 'event_date', e.target.value)}
                    style={{ ...inputStyle, borderColor: evt.locked && !evt.event_date ? '#f59e0b' : '#e5e7eb' }} />
                  <input type="time" value={evt.start_time} onChange={(e) => updateEvent(idx, 'start_time', e.target.value)}
                    style={inputStyle} placeholder="Start" />
                  <input type="time" value={evt.end_time} onChange={(e) => updateEvent(idx, 'end_time', e.target.value)}
                    style={inputStyle} placeholder="End" />
                  {!evt.locked && (
                    <input type="text" value={evt.location} onChange={(e) => updateEvent(idx, 'location', e.target.value)}
                      style={inputStyle} placeholder="Location" />
                  )}
                </div>
              </div>
            ))}

            <button type="button" onClick={addEvent} style={{
              background: 'none', border: '1px dashed #00A79D', color: '#00A79D',
              borderRadius: '6px', padding: '0.4rem 1rem', cursor: 'pointer',
              fontSize: '0.8rem', fontWeight: '600', width: '100%', marginTop: '0.25rem'
            }}>+ Add Additional Event</button>
          </div>

          {/* Assessment Timepoints — Auto-calculated */}
          <div style={{ background: '#f9fafb', padding: '1.25rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid #e5e7eb' }}>
            <h3 style={{ color: '#0E1F56', fontSize: '1rem', marginTop: 0, marginBottom: '0.25rem' }}>
              Assessment Windows
            </h3>
            <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
              Auto-calculated from Learning Session dates. You can adjust if needed.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
              <div style={{ fontWeight: '600', color: '#374151' }}>Timepoint</div>
              <div style={{ fontWeight: '600', color: '#374151' }}>Opens</div>
              <div style={{ fontWeight: '600', color: '#374151' }}>Closes</div>

              <div style={{ color: '#374151' }}>Baseline</div>
              <input type="date" value={assessmentDates.baseline_start_date}
                onChange={(e) => setAssessmentDates(prev => ({ ...prev, baseline_start_date: e.target.value }))}
                style={inputStyle} />
              <input type="date" value={assessmentDates.baseline_end_date}
                onChange={(e) => setAssessmentDates(prev => ({ ...prev, baseline_end_date: e.target.value }))}
                style={inputStyle} />

              <div style={{ color: '#374151' }}>Endline</div>
              <input type="date" value={assessmentDates.endline_start_date}
                onChange={(e) => setAssessmentDates(prev => ({ ...prev, endline_start_date: e.target.value }))}
                style={inputStyle} />
              <input type="date" value={assessmentDates.endline_end_date}
                onChange={(e) => setAssessmentDates(prev => ({ ...prev, endline_end_date: e.target.value }))}
                style={inputStyle} />

              <div style={{ color: '#374151' }}>6-Month</div>
              <input type="date" value={assessmentDates.followup_6mo_start_date}
                onChange={(e) => setAssessmentDates(prev => ({ ...prev, followup_6mo_start_date: e.target.value }))}
                style={inputStyle} />
              <input type="date" value={assessmentDates.followup_6mo_end_date}
                onChange={(e) => setAssessmentDates(prev => ({ ...prev, followup_6mo_end_date: e.target.value }))}
                style={inputStyle} />

              <div style={{ color: '#374151' }}>12-Month</div>
              <input type="date" value={assessmentDates.followup_12mo_start_date}
                onChange={(e) => setAssessmentDates(prev => ({ ...prev, followup_12mo_start_date: e.target.value }))}
                style={inputStyle} />
              <input type="date" value={assessmentDates.followup_12mo_end_date}
                onChange={(e) => setAssessmentDates(prev => ({ ...prev, followup_12mo_end_date: e.target.value }))}
                style={inputStyle} />
            </div>

            {!firstLs?.event_date && (
              <p style={{ color: '#f59e0b', fontSize: '0.75rem', marginTop: '0.5rem', marginBottom: 0 }}>
                Set Learning Session dates above to auto-calculate assessment windows.
              </p>
            )}
          </div>

          {/* Status */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', color: '#374151', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.4rem' }}>Status</label>
            <select value={formData.status} onChange={(e) => handleChange('status', e.target.value)}
              style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box', cursor: 'pointer' }}>
              <option value="active">Active</option>
              <option value="upcoming">Upcoming</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: '#fee2e2', border: '1px solid #ef4444', color: '#991b1b', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} disabled={loading}
              style={{ background: '#e5e7eb', color: '#374151', padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.95rem', opacity: loading ? 0.6 : 1 }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              style={{ background: loading ? '#9ca3af' : 'linear-gradient(135deg, #00A79D 0%, #0E1F56 100%)', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.95rem', boxShadow: loading ? 'none' : '0 4px 12px rgba(0, 167, 157, 0.3)' }}>
              {loading ? 'Creating...' : 'Create Collaborative'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateCollaborativeModal
