import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import { COLORS, cardStyle, cardHeaderStyle, timeAgo } from '../utils/constants'
import SmartieGoalForm from '../components/SmartieGoalForm'

const DOMAIN_LABELS = {
  resilience: 'Resilience Building',
  safety: 'Sense of Safety',
  policies: 'Organizational Policies',
  leadership: 'Practices of Leaders',
  routine: 'Routine Practices',
  evaluation: 'Evaluation & Monitoring',
  other: 'Other'
}

const STATUS_COLORS = {
  active: { bg: '#dbeafe', text: '#1e40af', label: 'Active' },
  completed: { bg: '#dcfce7', text: '#166534', label: 'Completed' },
  archived: { bg: '#f3f4f6', text: '#6b7280', label: 'Archived' }
}

export default function SmartieGoals() {
  const { teamId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [goals, setGoals] = useState([])
  const [team, setTeam] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [expandedGoal, setExpandedGoal] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [cyclesByGoal, setCyclesByGoal] = useState({})

  // Auto-open form if ?domain= param is present (from recommendations)
  const prefillDomain = searchParams.get('domain')
  useEffect(() => {
    if (prefillDomain && !showForm) {
      setEditingGoal(null)
      setShowForm(true)
    }
  }, [prefillDomain])

  useEffect(() => {
    loadData()
  }, [teamId])

  const loadData = async () => {
    try {
      setLoading(true)

      // Load team info
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('id, team_name, agency_name, collaborative_id, collaboratives (name)')
        .eq('id', teamId)
        .single()

      if (teamError) throw teamError
      setTeam(teamData)

      // Load user profile to check role
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role, team_id')
          .eq('id', user.id)
          .single()
        setUserProfile(profile)
      }

      // Load goals
      await loadGoals()

      // Load PDSA cycles linked to goals
      const { data: cycles } = await supabase
        .from('pdsa_cycles')
        .select('id, title, status, cycle_number, smartie_goal_id, created_at')
        .eq('team_id', teamId)
        .not('smartie_goal_id', 'is', null)
        .order('cycle_number', { ascending: true })

      const grouped = {}
      ;(cycles || []).forEach(c => {
        if (!grouped[c.smartie_goal_id]) grouped[c.smartie_goal_id] = []
        grouped[c.smartie_goal_id].push(c)
      })
      setCyclesByGoal(grouped)
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadGoals = async () => {
    const { data, error } = await supabase
      .from('smartie_goals')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading goals:', error)
      return
    }
    setGoals(data || [])
  }

  const handleSave = async (formData) => {
    setSaving(true)
    try {
      if (editingGoal) {
        // Update existing goal
        const updates = { ...formData }
        if (formData.status === 'completed' && !editingGoal.completed_at) {
          updates.completed_at = new Date().toISOString()
        } else if (formData.status !== 'completed') {
          updates.completed_at = null
        }

        const { error } = await supabase
          .from('smartie_goals')
          .update(updates)
          .eq('id', editingGoal.id)

        if (error) throw error
      } else {
        // Create new goal
        const { error } = await supabase
          .from('smartie_goals')
          .insert({
            ...formData,
            team_id: teamId,
            created_by: user?.id
          })

        if (error) throw error
      }

      await loadGoals()
      setShowForm(false)
      setEditingGoal(null)
    } catch (err) {
      console.error('Error saving goal:', err)
      alert('Error saving goal: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (goalId) => {
    if (!confirm('Are you sure you want to delete this goal? This cannot be undone.')) return

    const { error } = await supabase
      .from('smartie_goals')
      .delete()
      .eq('id', goalId)

    if (error) {
      console.error('Error deleting goal:', error)
      alert('Error deleting goal')
      return
    }

    await loadGoals()
    if (expandedGoal === goalId) setExpandedGoal(null)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const canEdit = userProfile?.role === 'super_admin' ||
    (userProfile?.team_id === teamId && ['agency_admin', 'team_leader'].includes(userProfile?.role))

  const isSuperAdmin = userProfile?.role === 'super_admin'

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', color: COLORS.navy, fontSize: '1.25rem' }}>Loading goals...</div>
      </div>
    )
  }

  if (!team) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: COLORS.red }}>Team Not Found</h2>
        <button onClick={() => navigate(-1)} style={{ padding: '0.5rem 1rem', background: COLORS.navy, color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}>
          Go Back
        </button>
      </div>
    )
  }

  const activeGoals = goals.filter(g => g.status === 'active')
  const completedGoals = goals.filter(g => g.status === 'completed')
  const archivedGoals = goals.filter(g => g.status === 'archived')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      {/* Header */}
      <div style={{ background: COLORS.navy, color: 'white', padding: '1rem 2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>
              Back
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.4rem' }}>SMARTIE Goals</h1>
              <p style={{ margin: '0.2rem 0 0', opacity: 0.8, fontSize: '0.85rem' }}>
                {team.agency_name} — {team.collaboratives?.name}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {canEdit && !showForm && (
              <button
                onClick={() => { setEditingGoal(null); setShowForm(true) }}
                style={{ padding: '0.5rem 1rem', background: COLORS.teal, color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}
              >
                + New Goal
              </button>
            )}
            <button onClick={handleSignOut} style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '500' }}>
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>
        {/* Intro text */}
        <div style={{ ...cardStyle, marginBottom: '1.5rem', borderLeft: `4px solid ${COLORS.teal}` }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            Use this worksheet to identify goals based on your STSI-OA assessment results. We encourage each goal to address a different domain from the assessment. You do not need to complete every field — use it as a guide to frame your thinking, discussion, and planning.
          </p>
        </div>

        {/* Goal Form (when creating/editing) */}
        {showForm && (
          <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
            <div style={cardHeaderStyle}>
              {editingGoal ? 'Edit Goal' : 'Create New SMARTIE Goal'}
            </div>
            <SmartieGoalForm
              goal={editingGoal}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditingGoal(null) }}
              saving={saving}
              initialDomain={!editingGoal ? prefillDomain : undefined}
            />
          </div>
        )}

        {/* Goals List */}
        {!showForm && goals.length === 0 && (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎯</div>
            <h2 style={{ color: COLORS.navy, marginBottom: '0.5rem' }}>No Goals Yet</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Get started by creating your first SMARTIE goal based on your STSI-OA assessment results.
            </p>
            {canEdit && (
              <button
                onClick={() => { setEditingGoal(null); setShowForm(true) }}
                style={{ padding: '0.75rem 2rem', background: COLORS.teal, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '1rem' }}
              >
                Create First Goal
              </button>
            )}
          </div>
        )}

        {/* Active Goals */}
        {activeGoals.length > 0 && !showForm && (
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: COLORS.navy, fontSize: '1.2rem', marginBottom: '1rem' }}>
              Active Goals ({activeGoals.length})
            </h2>
            {activeGoals.map(goal => renderGoalCard(goal))}
          </div>
        )}

        {/* Completed Goals */}
        {completedGoals.length > 0 && !showForm && (
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#166534', fontSize: '1.1rem', marginBottom: '1rem' }}>
              Completed ({completedGoals.length})
            </h2>
            {completedGoals.map(goal => renderGoalCard(goal))}
          </div>
        )}

        {/* Archived Goals */}
        {archivedGoals.length > 0 && !showForm && (
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '1rem' }}>
              Archived ({archivedGoals.length})
            </h2>
            {archivedGoals.map(goal => renderGoalCard(goal))}
          </div>
        )}
      </div>
    </div>
  )

  function renderGoalCard(goal) {
    const isExpanded = expandedGoal === goal.id
    const statusInfo = STATUS_COLORS[goal.status]

    return (
      <div
        key={goal.id}
        style={{
          ...cardStyle,
          marginBottom: '1rem',
          borderLeft: `4px solid ${goal.status === 'completed' ? COLORS.green : goal.status === 'archived' ? '#9ca3af' : COLORS.teal}`,
          cursor: 'pointer',
          transition: 'box-shadow 0.2s'
        }}
        onClick={() => setExpandedGoal(isExpanded ? null : goal.id)}
      >
        {/* Card Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, color: COLORS.navy, fontSize: '1.05rem' }}>{goal.goal_title}</h3>
              <span style={{
                padding: '0.15rem 0.5rem',
                borderRadius: '9999px',
                fontSize: '0.7rem',
                fontWeight: '600',
                background: statusInfo.bg,
                color: statusInfo.text
              }}>
                {statusInfo.label}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {goal.stsioa_domain && <span>{DOMAIN_LABELS[goal.stsioa_domain]}</span>}
              {goal.target_date && <span>Target: {new Date(goal.target_date).toLocaleDateString()}</span>}
              <span>Created {new Date(goal.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          <span style={{ fontSize: '1.2rem', color: 'var(--text-faint)', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
            ▼
          </span>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            {goal.rationale && (
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ fontSize: '0.85rem', color: COLORS.navy }}>Why this goal:</strong>
                <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{goal.rationale}</p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {renderSmartieField('S — Strategic', goal.strategic)}
              {renderSmartieField('M — Measurable', goal.measurable)}
              {renderSmartieField('A — Ambitious', goal.ambitious)}
              {renderSmartieField('R — Realistic', goal.realistic)}
              {renderSmartieField('T — Time-bound', goal.time_bound)}
              {renderSmartieField('I — Inclusive', goal.inclusive)}
              {renderSmartieField('E — Equitable', goal.equitable)}
            </div>

            {goal.progress_notes && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fffbeb', borderRadius: '6px', border: '1px solid #fcd34d' }}>
                <strong style={{ fontSize: '0.85rem', color: '#92400e' }}>Progress Notes:</strong>
                <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{goal.progress_notes}</p>
              </div>
            )}

            {goal.completed_at && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#166534' }}>
                Completed on {new Date(goal.completed_at).toLocaleDateString()}
              </div>
            )}

            {/* PDSA Cycles */}
            {(() => {
              const goalCycles = cyclesByGoal[goal.id] || []
              const PDSA_STATUS = {
                plan: { bg: '#dbeafe', text: '#1e40af' },
                do: { bg: '#fef3c7', text: '#92400e' },
                study: { bg: '#ede9fe', text: '#5b21b6' },
                act: { bg: '#ccfbf1', text: '#0f766e' },
                completed: { bg: '#dcfce7', text: '#166534' },
                abandoned: { bg: '#f3f4f6', text: '#6b7280' }
              }
              return (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.85rem', color: COLORS.navy }}>
                      🔄 PDSA Cycles {goalCycles.length > 0 && <span style={{ fontSize: '0.75rem', color: COLORS.teal }}>({goalCycles.length})</span>}
                    </strong>
                    {canEdit && (
                      <button
                        onClick={() => navigate(`/admin/pdsa/${teamId}?goalId=${goal.id}&domain=${goal.stsioa_domain || ''}`)}
                        style={{
                          background: 'none',
                          border: `1px solid ${COLORS.teal}`,
                          color: COLORS.teal,
                          padding: '0.2rem 0.6rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: '600'
                        }}
                      >
                        + Start a PDSA for this Goal
                      </button>
                    )}
                  </div>
                  {goalCycles.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {goalCycles.map(c => {
                        const st = PDSA_STATUS[c.status] || PDSA_STATUS.plan
                        return (
                          <div
                            key={c.id}
                            onClick={() => navigate(`/admin/pdsa/${teamId}`)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '0.35rem 0.5rem',
                              background: 'var(--bg-card-alt)',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.8rem'
                            }}
                          >
                            <span style={{ color: 'var(--text-faint)', fontWeight: '600' }}>#{c.cycle_number}</span>
                            <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{c.title}</span>
                            <span style={{
                              padding: '0.1rem 0.35rem',
                              borderRadius: '9999px',
                              fontSize: '0.65rem',
                              fontWeight: '600',
                              background: st.bg,
                              color: st.text,
                              textTransform: 'capitalize'
                            }}>
                              {c.status}
                            </span>
                          </div>
                        )
                      })}
                      <button
                        onClick={() => navigate(`/admin/pdsa/${teamId}`)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: COLORS.teal,
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          textDecoration: 'underline',
                          padding: '0.2rem 0',
                          textAlign: 'left'
                        }}
                      >
                        View All Cycles →
                      </button>
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-faint)' }}>No PDSA cycles yet</p>
                  )}
                </div>
              )
            })()}

            {/* Action Buttons */}
            {canEdit && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={() => { setEditingGoal(goal); setShowForm(true) }}
                  style={{ padding: '0.4rem 1rem', background: COLORS.navy, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500' }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(goal.id)}
                  style={{ padding: '0.4rem 1rem', background: 'white', color: COLORS.red, border: `1px solid ${COLORS.red}`, borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500' }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  function renderSmartieField(label, value) {
    if (!value) return null
    return (
      <div style={{ padding: '0.5rem', background: 'var(--bg-card-alt)', borderRadius: '4px' }}>
        <strong style={{ fontSize: '0.75rem', color: COLORS.teal }}>{label}</strong>
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{value}</p>
      </div>
    )
  }
}
