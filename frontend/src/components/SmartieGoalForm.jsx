import { useState, useEffect } from 'react'
import { COLORS } from '../utils/constants'
import { getProgramBranding } from '../config/programConfig'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' }
]

const emptyForm = {
  goal_title: '',
  framework_domain: '',
  rationale: '',
  strategic: '',
  measurable: '',
  ambitious: '',
  realistic: '',
  time_bound: '',
  inclusive: '',
  equitable: '',
  status: 'active',
  progress_notes: '',
  target_date: ''
}

export default function SmartieGoalForm({ goal, onSave, onCancel, saving, initialDomain, domains = [], programType }) {
  const branding = getProgramBranding(programType)
  const goalFields = branding.goalFields || []
  const goalLabel = branding.goalLabel || 'SMARTIE Goal'

  const [form, setForm] = useState(() => initialDomain ? { ...emptyForm, framework_domain: initialDomain } : emptyForm)

  useEffect(() => {
    if (goal) {
      setForm({
        goal_title: goal.goal_title || '',
        framework_domain: goal.framework_domain || '',
        rationale: goal.rationale || '',
        strategic: goal.strategic || '',
        measurable: goal.measurable || '',
        ambitious: goal.ambitious || '',
        realistic: goal.realistic || '',
        time_bound: goal.time_bound || '',
        inclusive: goal.inclusive || '',
        equitable: goal.equitable || '',
        status: goal.status || 'active',
        progress_notes: goal.progress_notes || '',
        target_date: goal.target_date || ''
      })
    } else {
      setForm(emptyForm)
    }
  }, [goal])

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(form)
  }

  const labelStyle = {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: COLORS.navy,
    marginBottom: '0.35rem'
  }

  const helpStyle = {
    fontSize: '0.75rem',
    color: '#6b7280',
    marginBottom: '0.35rem',
    fontStyle: 'italic'
  }

  const inputStyle = {
    width: '100%',
    padding: '0.6rem',
    border: '2px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '0.9rem',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s'
  }

  const textareaStyle = {
    ...inputStyle,
    minHeight: '80px',
    resize: 'vertical',
    fontFamily: 'inherit'
  }

  const fieldGroupStyle = {
    marginBottom: '1.25rem'
  }

  const smartieFieldStyle = {
    marginBottom: '1rem',
    padding: '1rem',
    background: '#f9fafb',
    borderRadius: '8px',
    borderLeft: `3px solid ${COLORS.teal}`
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Goal Title & Domain */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <label style={labelStyle}>Goal Title *</label>
          <input
            type="text"
            value={form.goal_title}
            onChange={(e) => handleChange('goal_title', e.target.value)}
            required
            placeholder="Enter your goal..."
            style={inputStyle}
            onFocus={(e) => e.target.style.borderColor = COLORS.teal}
            onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
          />
        </div>
        <div>
          <label style={labelStyle}>Framework Domain</label>
          <select
            value={form.framework_domain}
            onChange={(e) => handleChange('framework_domain', e.target.value)}
            style={inputStyle}
          >
            <option value="">Select a domain...</option>
            {domains.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {/* Rationale */}
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Why is this a goal for your team?</label>
        <textarea
          value={form.rationale}
          onChange={(e) => handleChange('rationale', e.target.value)}
          placeholder="Explain why this goal is important for your team based on your assessment results..."
          style={textareaStyle}
          onFocus={(e) => e.target.style.borderColor = COLORS.teal}
          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
        />
      </div>

      {/* Dynamic Goal Fields (SMARTIE or SMART based on program) */}
      <h3 style={{ color: COLORS.navy, fontSize: '1.1rem', marginBottom: '1rem', borderBottom: `2px solid ${COLORS.teal}`, paddingBottom: '0.5rem' }}>
        {goalLabel} Components
      </h3>

      {goalFields.map((field) => (
        <div key={field.key} style={smartieFieldStyle}>
          <label style={labelStyle}>{field.letter} — {field.label}</label>
          <div style={helpStyle}>{field.help}</div>
          <textarea
            value={form[field.key] || ''}
            onChange={(e) => handleChange(field.key, e.target.value)}
            style={textareaStyle}
            onFocus={(e) => e.target.style.borderColor = COLORS.teal}
            onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
          />
          {field.key === 'time_bound' && (
            <div style={{ marginTop: '0.5rem' }}>
              <label style={{ ...labelStyle, fontSize: '0.8rem' }}>Target Date</label>
              <input
                type="date"
                value={form.target_date}
                onChange={(e) => handleChange('target_date', e.target.value)}
                style={{ ...inputStyle, width: 'auto' }}
              />
            </div>
          )}
        </div>
      ))}

      {/* Status & Progress (shown when editing existing goal) */}
      {goal && (
        <div style={{ marginBottom: '1.25rem', padding: '1rem', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fcd34d' }}>
          <h3 style={{ color: COLORS.navy, fontSize: '1rem', marginBottom: '0.75rem' }}>Progress Update</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={labelStyle}>Status</label>
              <select
                value={form.status}
                onChange={(e) => handleChange('status', e.target.value)}
                style={inputStyle}
              >
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Progress Notes</label>
            <textarea
              value={form.progress_notes}
              onChange={(e) => handleChange('progress_notes', e.target.value)}
              placeholder="Add notes about progress, updates, or changes..."
              style={textareaStyle}
              onFocus={(e) => e.target.style.borderColor = COLORS.teal}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '2px solid #e5e7eb' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '0.6rem 1.5rem',
            background: 'white',
            border: '2px solid #d1d5db',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '500'
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: '0.6rem 1.5rem',
            background: saving ? '#9ca3af' : COLORS.teal,
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '0.9rem',
            fontWeight: '600'
          }}
        >
          {saving ? 'Saving...' : (goal ? 'Update Goal' : 'Create Goal')}
        </button>
      </div>
    </form>
  )
}
