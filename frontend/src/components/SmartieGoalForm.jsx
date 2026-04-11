import { useState, useEffect } from 'react'
import { COLORS, DOMAIN_OPTIONS } from '../utils/constants'

const GOAL_DOMAIN_OPTIONS = [
  { value: '', label: 'Select a domain...' },
  ...DOMAIN_OPTIONS,
  { value: 'other', label: 'Other' }
]

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

export default function SmartieGoalForm({ goal, onSave, onCancel, saving, initialDomain }) {
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
          <label style={labelStyle}>STSI-OA Domain</label>
          <select
            value={form.framework_domain}
            onChange={(e) => handleChange('framework_domain', e.target.value)}
            style={inputStyle}
          >
            {GOAL_DOMAIN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Rationale */}
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Why is this a goal for your team?</label>
        <textarea
          value={form.rationale}
          onChange={(e) => handleChange('rationale', e.target.value)}
          placeholder="Explain why this goal is important for your team based on your STSI-OA results..."
          style={textareaStyle}
          onFocus={(e) => e.target.style.borderColor = COLORS.teal}
          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
        />
      </div>

      {/* SMARTIE Fields */}
      <h3 style={{ color: COLORS.navy, fontSize: '1.1rem', marginBottom: '1rem', borderBottom: `2px solid ${COLORS.teal}`, paddingBottom: '0.5rem' }}>
        SMARTIE Components
      </h3>

      <div style={smartieFieldStyle}>
        <label style={labelStyle}>S — Strategic</label>
        <div style={helpStyle}>What do you hope you will accomplish?</div>
        <textarea
          value={form.strategic}
          onChange={(e) => handleChange('strategic', e.target.value)}
          style={textareaStyle}
          onFocus={(e) => e.target.style.borderColor = COLORS.teal}
          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
        />
      </div>

      <div style={smartieFieldStyle}>
        <label style={labelStyle}>M — Measurable</label>
        <div style={helpStyle}>How will you know if you are successful in achieving this goal? Include numbers or defined qualities so you know whether the goal has been met.</div>
        <textarea
          value={form.measurable}
          onChange={(e) => handleChange('measurable', e.target.value)}
          style={textareaStyle}
          onFocus={(e) => e.target.style.borderColor = COLORS.teal}
          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
        />
      </div>

      <div style={smartieFieldStyle}>
        <label style={labelStyle}>A — Ambitious</label>
        <div style={helpStyle}>In what ways is this goal a stretch? What challenges do you anticipate?</div>
        <textarea
          value={form.ambitious}
          onChange={(e) => handleChange('ambitious', e.target.value)}
          style={textareaStyle}
          onFocus={(e) => e.target.style.borderColor = COLORS.teal}
          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
        />
      </div>

      <div style={smartieFieldStyle}>
        <label style={labelStyle}>R — Realistic</label>
        <div style={helpStyle}>Where are your opportunities? How will it be possible to achieve?</div>
        <textarea
          value={form.realistic}
          onChange={(e) => handleChange('realistic', e.target.value)}
          style={textareaStyle}
          onFocus={(e) => e.target.style.borderColor = COLORS.teal}
          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
        />
      </div>

      <div style={smartieFieldStyle}>
        <label style={labelStyle}>T — Time-bound</label>
        <div style={helpStyle}>What is your timeline and deadline for achieving this goal?</div>
        <textarea
          value={form.time_bound}
          onChange={(e) => handleChange('time_bound', e.target.value)}
          style={textareaStyle}
          onFocus={(e) => e.target.style.borderColor = COLORS.teal}
          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
        />
        <div style={{ marginTop: '0.5rem' }}>
          <label style={{ ...labelStyle, fontSize: '0.8rem' }}>Target Date</label>
          <input
            type="date"
            value={form.target_date}
            onChange={(e) => handleChange('target_date', e.target.value)}
            style={{ ...inputStyle, width: 'auto' }}
          />
        </div>
      </div>

      <div style={smartieFieldStyle}>
        <label style={labelStyle}>I — Inclusive</label>
        <div style={helpStyle}>In what ways will this goal bring people who are often excluded into processes, activities, and decision/policy-making in a way that shares power?</div>
        <textarea
          value={form.inclusive}
          onChange={(e) => handleChange('inclusive', e.target.value)}
          style={textareaStyle}
          onFocus={(e) => e.target.style.borderColor = COLORS.teal}
          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
        />
      </div>

      <div style={smartieFieldStyle}>
        <label style={labelStyle}>E — Equitable</label>
        <div style={helpStyle}>In what ways will this goal address fairness or justice to address systemic injustice, inequity, or oppression?</div>
        <textarea
          value={form.equitable}
          onChange={(e) => handleChange('equitable', e.target.value)}
          style={textareaStyle}
          onFocus={(e) => e.target.style.borderColor = COLORS.teal}
          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
        />
      </div>

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
