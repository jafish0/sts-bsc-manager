import { useState, useEffect } from 'react'
import { COLORS } from '../utils/constants'
import { supabase } from '../utils/supabase'

const emptyForm = {
  title: '',
  framework_domain: '',
  smartie_goal_id: '',
  aim: '',
  measure: '',
  change_ideas: '',
  plan_first_test: '',
  plan_prediction: '',
  plan_steps: '',
  plan_data_collection: ''
}

export default function PdsaCycleForm({ cycle, onSave, onCancel, saving, teamId, initialGoalId, initialDomain, domains = [] }) {
  const [form, setForm] = useState(() => {
    const base = { ...emptyForm }
    if (initialDomain) base.framework_domain = initialDomain
    if (initialGoalId) base.smartie_goal_id = initialGoalId
    return base
  })
  const [goals, setGoals] = useState([])
  const [strategies, setStrategies] = useState([])
  const [showStrategies, setShowStrategies] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState(null)

  useEffect(() => {
    if (cycle) {
      setForm({
        title: cycle.title || '',
        framework_domain: cycle.framework_domain || '',
        smartie_goal_id: cycle.smartie_goal_id || '',
        aim: cycle.aim || '',
        measure: cycle.measure || '',
        change_ideas: cycle.change_ideas || '',
        plan_first_test: cycle.plan_first_test || '',
        plan_prediction: cycle.plan_prediction || '',
        plan_steps: cycle.plan_steps || '',
        plan_data_collection: cycle.plan_data_collection || ''
      })
    } else {
      const base = { ...emptyForm }
      if (initialDomain) base.framework_domain = initialDomain
      if (initialGoalId) base.smartie_goal_id = initialGoalId
      setForm(base)
    }
  }, [cycle])

  // Load team's SMARTIE goals
  useEffect(() => {
    if (teamId) {
      supabase
        .from('smartie_goals')
        .select('id, goal_title, framework_domain, strategic, status')
        .eq('team_id', teamId)
        .in('status', ['active', 'completed'])
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          setGoals(data || [])
          // If initialGoalId, find and set it
          if (initialGoalId && data) {
            const g = data.find(g => g.id === initialGoalId)
            if (g) {
              setSelectedGoal(g)
              if (!cycle && g.framework_domain) {
                setForm(prev => ({ ...prev, framework_domain: g.framework_domain }))
              }
            }
          }
        })
    }
  }, [teamId])

  // Load strategies when domain changes
  useEffect(() => {
    if (form.framework_domain && form.framework_domain !== 'other') {
      supabase
        .from('pdsa_strategies')
        .select('id, strategy_text, source')
        .eq('framework_domain', form.framework_domain)
        .then(({ data }) => setStrategies(data || []))
    } else {
      setStrategies([])
    }
  }, [form.framework_domain])

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleGoalChange = (goalId) => {
    handleChange('smartie_goal_id', goalId)
    if (goalId) {
      const g = goals.find(g => g.id === goalId)
      setSelectedGoal(g || null)
      if (g?.framework_domain) {
        handleChange('framework_domain', g.framework_domain)
      }
    } else {
      setSelectedGoal(null)
    }
  }

  const handleUseStrategy = (text) => {
    const current = form.change_ideas
    const newVal = current ? `${current}\n• ${text}` : `• ${text}`
    handleChange('change_ideas', newVal)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const data = { ...form }
    if (!data.smartie_goal_id) data.smartie_goal_id = null
    onSave(data)
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

  const sectionStyle = {
    marginBottom: '1rem',
    padding: '1rem',
    background: '#f9fafb',
    borderRadius: '8px',
    borderLeft: `3px solid ${COLORS.teal}`
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Title & Domain */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <label style={labelStyle}>Cycle Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => handleChange('title', e.target.value)}
            required
            placeholder="What are you testing?"
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

      {/* Link to SMARTIE Goal */}
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Link to SMARTIE Goal (optional)</label>
        <select
          value={form.smartie_goal_id}
          onChange={(e) => handleGoalChange(e.target.value)}
          style={inputStyle}
        >
          <option value="">None</option>
          {goals.map(g => (
            <option key={g.id} value={g.id}>
              {g.goal_title} ({g.status})
            </option>
          ))}
        </select>
      </div>

      {/* Selected goal summary */}
      {selectedGoal && (
        <div style={{
          marginBottom: '1.25rem',
          padding: '0.75rem 1rem',
          background: '#f0fdfa',
          borderLeft: `4px solid ${COLORS.teal}`,
          borderRadius: '0 6px 6px 0'
        }}>
          <div style={{ fontWeight: '600', color: COLORS.navy, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
            {selectedGoal.goal_title}
          </div>
          {selectedGoal.framework_domain && (
            <span style={{
              fontSize: '0.7rem',
              background: `${COLORS.teal}15`,
              color: COLORS.teal,
              padding: '0.15rem 0.5rem',
              borderRadius: '9999px',
              fontWeight: '600'
            }}>
              {domains.find(d => d.value === selectedGoal.framework_domain)?.label || selectedGoal.framework_domain}
            </span>
          )}
          {selectedGoal.strategic && (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {selectedGoal.strategic}
            </p>
          )}
        </div>
      )}

      {/* Three Fundamental Questions */}
      <h3 style={{ color: COLORS.navy, fontSize: '1.1rem', marginBottom: '1rem', borderBottom: `2px solid ${COLORS.teal}`, paddingBottom: '0.5rem' }}>
        Three Fundamental Questions
      </h3>

      <div style={sectionStyle}>
        <label style={labelStyle}>What are we trying to accomplish? (Aim)</label>
        <div style={helpStyle}>Describe the specific improvement you want to see.</div>
        <textarea
          value={form.aim}
          onChange={(e) => handleChange('aim', e.target.value)}
          style={textareaStyle}
          onFocus={(e) => e.target.style.borderColor = COLORS.teal}
          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
        />
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>How will we know a change is an improvement? (Measure)</label>
        <div style={helpStyle}>What data or observations will indicate success?</div>
        <textarea
          value={form.measure}
          onChange={(e) => handleChange('measure', e.target.value)}
          style={textareaStyle}
          onFocus={(e) => e.target.style.borderColor = COLORS.teal}
          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
        />
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>What changes can we make that will result in improvement? (Change Ideas)</label>
        <div style={helpStyle}>List ideas for changes to test.</div>
        <textarea
          value={form.change_ideas}
          onChange={(e) => handleChange('change_ideas', e.target.value)}
          style={textareaStyle}
          onFocus={(e) => e.target.style.borderColor = COLORS.teal}
          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
        />
      </div>

      {/* Strategy Ideas */}
      {strategies.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <button
            type="button"
            onClick={() => setShowStrategies(!showStrategies)}
            style={{
              background: 'none',
              border: `1px solid ${COLORS.teal}`,
              color: COLORS.teal,
              padding: '0.4rem 1rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: '600'
            }}
          >
            {showStrategies ? 'Hide' : 'Show'} Strategy Ideas ({strategies.length})
          </button>
          {showStrategies && (
            <div style={{
              marginTop: '0.75rem',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              {strategies.map(s => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.6rem 0.75rem',
                    borderBottom: '1px solid var(--border)',
                    fontSize: '0.85rem',
                    gap: '0.5rem'
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{s.strategy_text}</span>
                  <button
                    type="button"
                    onClick={() => handleUseStrategy(s.strategy_text)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: COLORS.teal,
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      whiteSpace: 'nowrap',
                      padding: '0.2rem 0.5rem'
                    }}
                  >
                    Use as inspiration →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PLAN Section */}
      <h3 style={{ color: COLORS.navy, fontSize: '1.1rem', marginBottom: '1rem', borderBottom: `2px solid ${COLORS.navy}`, paddingBottom: '0.5rem' }}>
        PLAN
      </h3>

      <div style={sectionStyle}>
        <label style={labelStyle}>What is the first (or next) test of change?</label>
        <div style={helpStyle}>Describe the specific change you will test.</div>
        <textarea
          value={form.plan_first_test}
          onChange={(e) => handleChange('plan_first_test', e.target.value)}
          style={textareaStyle}
          onFocus={(e) => e.target.style.borderColor = COLORS.teal}
          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
        />
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>What do you predict will happen?</label>
        <div style={helpStyle}>State your hypothesis about the outcome.</div>
        <textarea
          value={form.plan_prediction}
          onChange={(e) => handleChange('plan_prediction', e.target.value)}
          style={textareaStyle}
          onFocus={(e) => e.target.style.borderColor = COLORS.teal}
          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
        />
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>Steps to execute the test</label>
        <div style={helpStyle}>Who will do what, when?</div>
        <textarea
          value={form.plan_steps}
          onChange={(e) => handleChange('plan_steps', e.target.value)}
          style={textareaStyle}
          onFocus={(e) => e.target.style.borderColor = COLORS.teal}
          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
        />
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>How will you collect data?</label>
        <div style={helpStyle}>What will you measure or observe to evaluate the test?</div>
        <textarea
          value={form.plan_data_collection}
          onChange={(e) => handleChange('plan_data_collection', e.target.value)}
          style={textareaStyle}
          onFocus={(e) => e.target.style.borderColor = COLORS.teal}
          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
        />
      </div>

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
          {saving ? 'Saving...' : (cycle ? 'Update Cycle' : 'Create Cycle')}
        </button>
      </div>
    </form>
  )
}
