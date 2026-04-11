import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import { COLORS, cardStyle, cardHeaderStyle, timeAgo } from '../utils/constants'
import { useProgramDomains } from '../hooks/useProgramDomains'
import { getProgramBranding } from '../config/programConfig'
import PdsaCycleForm from '../components/PdsaCycleForm'

const STATUS_CONFIG = {
  plan: { bg: '#dbeafe', text: '#1e40af', label: 'Plan' },
  do: { bg: '#fef3c7', text: '#92400e', label: 'Do' },
  study: { bg: '#ede9fe', text: '#5b21b6', label: 'Study' },
  act: { bg: '#ccfbf1', text: '#0f766e', label: 'Act' },
  completed: { bg: '#dcfce7', text: '#166534', label: 'Completed' },
  abandoned: { bg: '#f3f4f6', text: '#6b7280', label: 'Abandoned' }
}

const PHASE_ORDER = ['plan', 'do', 'study', 'act']
const PHASE_LABELS = { plan: 'Plan', do: 'Do', study: 'Study', act: 'Act' }

export default function PdsaCycles() {
  const { teamId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [cycles, setCycles] = useState([])
  const [team, setTeam] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingCycle, setEditingCycle] = useState(null)
  const [saving, setSaving] = useState(false)
  const [expandedCycle, setExpandedCycle] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [filter, setFilter] = useState('all')
  const [linkedGoalName, setLinkedGoalName] = useState(null)
  const [queuedCycles, setQueuedCycles] = useState([])
  const [showQueued, setShowQueued] = useState(false)
  const [reviewIndex, setReviewIndex] = useState(0)

  const { domains, domainLabels } = useProgramDomains(team?.collaboratives?.program_type)
  const programBranding = getProgramBranding(team?.collaboratives?.program_type)
  const prefillGoalId = searchParams.get('goalId')
  const prefillDomain = searchParams.get('domain')

  useEffect(() => {
    if (prefillGoalId && !showForm) {
      setEditingCycle(null)
      setShowForm(true)
    }
  }, [prefillGoalId])

  // Load linked goal name for banner
  useEffect(() => {
    if (prefillGoalId) {
      supabase
        .from('smartie_goals')
        .select('goal_title')
        .eq('id', prefillGoalId)
        .single()
        .then(({ data }) => {
          if (data) setLinkedGoalName(data.goal_title)
        })
    }
  }, [prefillGoalId])

  useEffect(() => {
    loadData()
  }, [teamId])

  const loadData = async () => {
    try {
      setLoading(true)

      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('id, team_name, agency_name, collaborative_id, collaboratives (name, program_type)')
        .eq('id', teamId)
        .single()

      if (teamError) throw teamError
      setTeam(teamData)

      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role, team_id')
          .eq('id', user.id)
          .single()
        setUserProfile(profile)
      }

      await loadCycles()

      // Load pending queued actions from STS-PAT
      const { data: queued } = await supabase
        .from('sts_pat_queued_actions')
        .select('*, sts_pat_assessments(completed_at)')
        .eq('team_id', teamId)
        .eq('action_type', 'pdsa_cycle')
        .eq('status', 'pending')
        .order('created_at')
      setQueuedCycles(queued || [])
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadCycles = async () => {
    const { data, error } = await supabase
      .from('pdsa_cycles')
      .select('*, smartie_goals (goal_title, framework_domain)')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading cycles:', error)
      return
    }
    setCycles(data || [])
  }

  const handleSave = async (formData) => {
    setSaving(true)
    try {
      if (editingCycle) {
        const { error } = await supabase
          .from('pdsa_cycles')
          .update({ ...formData, updated_at: new Date().toISOString() })
          .eq('id', editingCycle.id)
        if (error) throw error
      } else {
        // Get next cycle number
        const { data: maxRow } = await supabase
          .from('pdsa_cycles')
          .select('cycle_number')
          .eq('team_id', teamId)
          .order('cycle_number', { ascending: false })
          .limit(1)

        const nextNum = (maxRow && maxRow.length > 0 ? maxRow[0].cycle_number : 0) + 1

        const { error } = await supabase
          .from('pdsa_cycles')
          .insert({
            ...formData,
            team_id: teamId,
            cycle_number: nextNum,
            created_by: user?.id
          })
        if (error) throw error
      }

      await loadCycles()
      setShowForm(false)
      setEditingCycle(null)
    } catch (err) {
      console.error('Error saving cycle:', err)
      alert('Error saving cycle: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAdvancePhase = async (cycle) => {
    const currentIdx = PHASE_ORDER.indexOf(cycle.status)
    if (currentIdx < 0 || currentIdx >= PHASE_ORDER.length - 1) return

    const nextStatus = PHASE_ORDER[currentIdx + 1]
    const { error } = await supabase
      .from('pdsa_cycles')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', cycle.id)

    if (error) {
      console.error('Error advancing phase:', error)
      return
    }
    await loadCycles()
  }

  const handleComplete = async (cycle) => {
    const { error } = await supabase
      .from('pdsa_cycles')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', cycle.id)
    if (!error) await loadCycles()
  }

  const handleAbandon = async (cycle) => {
    if (!confirm('Are you sure you want to abandon this PDSA cycle?')) return
    const { error } = await supabase
      .from('pdsa_cycles')
      .update({ status: 'abandoned', updated_at: new Date().toISOString() })
      .eq('id', cycle.id)
    if (!error) await loadCycles()
  }

  const handleInlineUpdate = async (cycleId, field, value) => {
    const { error } = await supabase
      .from('pdsa_cycles')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', cycleId)
    if (!error) await loadCycles()
  }

  const handleDelete = async (cycleId) => {
    if (!confirm('Are you sure you want to delete this PDSA cycle? This cannot be undone.')) return
    const { error } = await supabase
      .from('pdsa_cycles')
      .delete()
      .eq('id', cycleId)
    if (!error) {
      await loadCycles()
      if (expandedCycle === cycleId) setExpandedCycle(null)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const canEdit = userProfile?.role === 'super_admin' ||
    (userProfile?.team_id === teamId && ['agency_admin', 'team_leader'].includes(userProfile?.role))

  // Filter cycles
  const filteredCycles = cycles.filter(c => {
    if (filter === 'all') return true
    if (filter === 'active') return ['plan', 'do', 'study', 'act'].includes(c.status)
    return c.status === filter
  })

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', color: COLORS.navy, fontSize: '1.25rem' }}>Loading PDSA cycles...</div>
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
              <h1 style={{ margin: 0, fontSize: '1.4rem' }}>PDSA Cycles</h1>
              <p style={{ margin: '0.2rem 0 0', opacity: 0.8, fontSize: '0.85rem' }}>
                {team.agency_name} — {team.collaboratives?.name}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {canEdit && !showForm && (
              <button
                onClick={() => { setEditingCycle(null); setShowForm(true) }}
                style={{ padding: '0.5rem 1rem', background: COLORS.teal, color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}
              >
                + New PDSA Cycle
              </button>
            )}
            <button onClick={handleSignOut} style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '500' }}>
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>
        {/* STS-PAT queued actions banner */}
        {programBranding.hasStsPat && queuedCycles.length > 0 && !showQueued && (
          <div style={{ ...cardStyle, marginBottom: '1.5rem', borderLeft: `4px solid ${COLORS.amber}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
              You have <strong>{queuedCycles.length}</strong> new PDSA cycle{queuedCycles.length > 1 ? 's' : ''} from your STS-PAT assessment
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => { setShowQueued(true); setReviewIndex(0) }} style={{ padding: '0.4rem 0.75rem', background: COLORS.teal, color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}>Review & Confirm</button>
              <button onClick={async () => { for (const q of queuedCycles) { await supabase.from('sts_pat_queued_actions').update({ status: 'dismissed', resolved_at: new Date().toISOString() }).eq('id', q.id) } setQueuedCycles([]) }} style={{ padding: '0.4rem 0.75rem', background: 'none', border: '1px solid var(--border-light)', color: 'var(--text-muted)', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.85rem' }}>Dismiss All</button>
            </div>
          </div>
        )}

        {programBranding.hasStsPat && showQueued && queuedCycles.length > 0 && reviewIndex < queuedCycles.length && (
          <div style={{ ...cardStyle, marginBottom: '1.5rem', borderLeft: `4px solid ${COLORS.amber}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.9rem' }}>STS-PAT Action Item {reviewIndex + 1} of {queuedCycles.length}</span>
              <button onClick={() => setShowQueued(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Close</button>
            </div>
            <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <strong>Q{queuedCycles[reviewIndex].question_number}:</strong> {queuedCycles[reviewIndex].question_text}
            </p>
            <p style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Rating: {queuedCycles[reviewIndex].rating}/5{queuedCycles[reviewIndex].notes && ` · Notes: ${queuedCycles[reviewIndex].notes}`}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={async () => {
                  const q = queuedCycles[reviewIndex]
                  setEditingCycle(null)
                  setShowForm(true)
                  setShowQueued(false)
                  await supabase.from('sts_pat_queued_actions').update({ status: 'confirmed', resolved_at: new Date().toISOString() }).eq('id', q.id)
                  setQueuedCycles(prev => prev.filter((_, i) => i !== reviewIndex))
                }}
                style={{ padding: '0.4rem 0.75rem', background: COLORS.teal, color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}
              >
                Create Cycle from This
              </button>
              <button
                onClick={async () => {
                  const q = queuedCycles[reviewIndex]
                  await supabase.from('sts_pat_queued_actions').update({ status: 'dismissed', resolved_at: new Date().toISOString() }).eq('id', q.id)
                  const remaining = queuedCycles.filter((_, i) => i !== reviewIndex)
                  setQueuedCycles(remaining)
                  if (remaining.length === 0 || reviewIndex >= remaining.length) setShowQueued(false)
                }}
                style={{ padding: '0.4rem 0.75rem', background: 'none', border: '1px solid var(--border-light)', color: 'var(--text-muted)', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Linked goal banner */}
        {prefillGoalId && linkedGoalName && showForm && (
          <div style={{
            ...cardStyle,
            marginBottom: '1rem',
            borderLeft: `4px solid ${COLORS.teal}`,
            background: '#f0fdfa',
            padding: '0.75rem 1rem',
            fontSize: '0.9rem'
          }}>
            Creating a PDSA cycle linked to: <strong>{linkedGoalName}</strong>
          </div>
        )}

        {/* Intro */}
        <div style={{ ...cardStyle, marginBottom: '1.5rem', borderLeft: `4px solid ${COLORS.teal}` }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            Use Plan-Do-Study-Act cycles to test small changes and learn what works for your team. Each cycle starts with a question, tests a change, studies the results, and decides next steps.
          </p>
        </div>

        {/* Form */}
        {showForm && (
          <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
            <div style={cardHeaderStyle}>
              {editingCycle ? 'Edit PDSA Cycle' : 'Create New PDSA Cycle'}
            </div>
            <PdsaCycleForm
              cycle={editingCycle}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditingCycle(null) }}
              saving={saving}
              teamId={teamId}
              initialGoalId={!editingCycle ? prefillGoalId : undefined}
              initialDomain={!editingCycle ? prefillDomain : undefined}
              domains={domains}
            />
          </div>
        )}

        {/* Filter tabs */}
        {!showForm && cycles.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {[
              { key: 'all', label: 'All' },
              { key: 'active', label: 'Active' },
              { key: 'completed', label: 'Completed' },
              { key: 'abandoned', label: 'Abandoned' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                style={{
                  padding: '0.4rem 1rem',
                  background: filter === tab.key ? COLORS.navy : 'var(--bg-card)',
                  color: filter === tab.key ? 'white' : 'var(--text-secondary)',
                  border: `1px solid ${filter === tab.key ? COLORS.navy : 'var(--border)'}`,
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: '600'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!showForm && cycles.length === 0 && (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔄</div>
            <h2 style={{ color: COLORS.navy, marginBottom: '0.5rem' }}>No PDSA Cycles Yet</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Start your first Plan-Do-Study-Act cycle to test improvement strategies for your team.
            </p>
            {canEdit && (
              <button
                onClick={() => { setEditingCycle(null); setShowForm(true) }}
                style={{ padding: '0.75rem 2rem', background: COLORS.teal, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '1rem' }}
              >
                Start First Cycle
              </button>
            )}
          </div>
        )}

        {/* Cycle cards */}
        {!showForm && filteredCycles.map(cycle => renderCycleCard(cycle))}
      </div>
    </div>
  )

  function renderCycleCard(cycle) {
    const isExpanded = expandedCycle === cycle.id
    const statusInfo = STATUS_CONFIG[cycle.status]
    const currentPhaseIdx = PHASE_ORDER.indexOf(cycle.status)

    return (
      <div
        key={cycle.id}
        style={{
          ...cardStyle,
          marginBottom: '1rem',
          borderLeft: `4px solid ${cycle.status === 'completed' ? COLORS.green : cycle.status === 'abandoned' ? '#9ca3af' : COLORS.teal}`,
          cursor: 'pointer',
          transition: 'box-shadow 0.2s'
        }}
        onClick={() => setExpandedCycle(isExpanded ? null : cycle.id)}
      >
        {/* Card header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)' }}>#{cycle.cycle_number}</span>
              <h3 style={{ margin: 0, color: COLORS.navy, fontSize: '1.05rem' }}>{cycle.title}</h3>
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
              {cycle.framework_domain && (
                <span style={{
                  padding: '0.15rem 0.5rem',
                  borderRadius: '9999px',
                  fontSize: '0.65rem',
                  fontWeight: '600',
                  background: `${COLORS.teal}15`,
                  color: COLORS.teal
                }}>
                  {domainLabels[cycle.framework_domain] || cycle.framework_domain}
                </span>
              )}
            </div>

            {/* Phase stepper */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '0.5rem' }}>
              {PHASE_ORDER.map((phase, idx) => {
                const isPast = currentPhaseIdx > idx
                const isCurrent = currentPhaseIdx === idx
                const isDone = cycle.status === 'completed'
                return (
                  <div key={phase} style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{
                      width: isCurrent ? '22px' : '16px',
                      height: isCurrent ? '22px' : '16px',
                      borderRadius: '50%',
                      background: isDone || isPast ? COLORS.navy : isCurrent ? COLORS.teal : '#e5e7eb',
                      border: `2px solid ${isDone || isPast ? COLORS.navy : isCurrent ? COLORS.teal : '#d1d5db'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                      boxShadow: isCurrent ? `0 0 0 3px ${COLORS.teal}25` : 'none'
                    }}>
                      {(isDone || isPast) && (
                        <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    {idx < PHASE_ORDER.length - 1 && (
                      <div style={{
                        width: '20px',
                        height: '2px',
                        background: isDone || isPast ? COLORS.navy : '#e5e7eb'
                      }} />
                    )}
                  </div>
                )
              })}
              <span style={{ fontSize: '0.65rem', color: 'var(--text-faint)', marginLeft: '0.5rem' }}>
                {PHASE_ORDER.map(p => PHASE_LABELS[p]).join(' → ')}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {cycle.smartie_goals && (
                <span>Linked to: {cycle.smartie_goals.goal_title}</span>
              )}
              <span>Created {timeAgo(cycle.created_at)}</span>
            </div>
          </div>
          <span style={{ fontSize: '1.2rem', color: 'var(--text-faint)', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
            ▼
          </span>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            {/* Linked Goal card */}
            {cycle.smartie_goals && (
              <div
                style={{
                  marginBottom: '1rem',
                  padding: '0.6rem 0.75rem',
                  background: '#f0fdfa',
                  borderLeft: `4px solid ${COLORS.teal}`,
                  borderRadius: '0 6px 6px 0',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
                onClick={() => navigate(`/admin/smartie-goals/${teamId}`)}
              >
                🎯 Linked Goal: <strong>{cycle.smartie_goals.goal_title}</strong>
                {cycle.smartie_goals.framework_domain && (
                  <span style={{
                    marginLeft: '0.5rem',
                    fontSize: '0.7rem',
                    background: `${COLORS.teal}15`,
                    color: COLORS.teal,
                    padding: '0.1rem 0.4rem',
                    borderRadius: '9999px',
                    fontWeight: '600'
                  }}>
                    {domainLabels[cycle.smartie_goals.framework_domain]}
                  </span>
                )}
              </div>
            )}

            {/* Three Fundamental Questions — always visible */}
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem', color: COLORS.navy, fontSize: '0.95rem' }}>Three Fundamental Questions</h4>
              {renderField('Aim', cycle.aim, cycle.id, 'aim')}
              {renderField('Measure', cycle.measure, cycle.id, 'measure')}
              {renderField('Change Ideas', cycle.change_ideas, cycle.id, 'change_ideas')}
            </div>

            {/* PLAN */}
            <PhaseSection title="PLAN" color="#1e40af" visible={true}>
              {renderField('First test of change', cycle.plan_first_test, cycle.id, 'plan_first_test')}
              {renderField('Prediction', cycle.plan_prediction, cycle.id, 'plan_prediction')}
              {renderField('Steps', cycle.plan_steps, cycle.id, 'plan_steps')}
              {renderField('Data collection', cycle.plan_data_collection, cycle.id, 'plan_data_collection')}
            </PhaseSection>

            {/* DO */}
            {(currentPhaseIdx >= 1 || cycle.status === 'completed') && (
              <PhaseSection title="DO" color="#92400e">
                <EditableField label="Observations" value={cycle.do_observations} cycleId={cycle.id} field="do_observations" canEdit={canEdit} onSave={handleInlineUpdate} />
              </PhaseSection>
            )}

            {/* STUDY */}
            {(currentPhaseIdx >= 2 || cycle.status === 'completed') && (
              <PhaseSection title="STUDY" color="#5b21b6">
                <EditableField label="Results" value={cycle.study_results} cycleId={cycle.id} field="study_results" canEdit={canEdit} onSave={handleInlineUpdate} />
              </PhaseSection>
            )}

            {/* ACT */}
            {(currentPhaseIdx >= 3 || cycle.status === 'completed') && (
              <PhaseSection title="ACT" color="#0f766e">
                {canEdit && cycle.status === 'act' && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: COLORS.navy, marginBottom: '0.35rem' }}>Decision</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {['adjust', 'expand', 'abandon'].map(d => (
                        <button
                          key={d}
                          onClick={() => handleInlineUpdate(cycle.id, 'act_decision', d)}
                          style={{
                            padding: '0.4rem 1rem',
                            background: cycle.act_decision === d ? COLORS.teal : 'var(--bg-card)',
                            color: cycle.act_decision === d ? 'white' : 'var(--text-secondary)',
                            border: `1px solid ${cycle.act_decision === d ? COLORS.teal : 'var(--border)'}`,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            textTransform: 'capitalize'
                          }}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {cycle.act_decision && cycle.status === 'completed' && (
                  <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                    <strong style={{ color: COLORS.navy }}>Decision:</strong>{' '}
                    <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{cycle.act_decision}</span>
                  </div>
                )}
                <EditableField label="Next Steps" value={cycle.act_next_steps} cycleId={cycle.id} field="act_next_steps" canEdit={canEdit} onSave={handleInlineUpdate} />
              </PhaseSection>
            )}

            {/* Action buttons */}
            {canEdit && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                {/* Advance button */}
                {currentPhaseIdx >= 0 && currentPhaseIdx < PHASE_ORDER.length - 1 && cycle.status !== 'completed' && cycle.status !== 'abandoned' && (
                  <button
                    onClick={() => handleAdvancePhase(cycle)}
                    style={{ padding: '0.4rem 1rem', background: COLORS.teal, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}
                  >
                    Advance to {PHASE_LABELS[PHASE_ORDER[currentPhaseIdx + 1]]}
                  </button>
                )}
                {/* Complete button (only in Act phase) */}
                {cycle.status === 'act' && (
                  <button
                    onClick={() => handleComplete(cycle)}
                    style={{ padding: '0.4rem 1rem', background: COLORS.green, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}
                  >
                    Mark Completed
                  </button>
                )}
                <button
                  onClick={() => { setEditingCycle(cycle); setShowForm(true) }}
                  style={{ padding: '0.4rem 1rem', background: COLORS.navy, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500' }}
                >
                  Edit
                </button>
                {cycle.status !== 'abandoned' && cycle.status !== 'completed' && (
                  <button
                    onClick={() => handleAbandon(cycle)}
                    style={{ padding: '0.4rem 1rem', background: 'white', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    Abandon
                  </button>
                )}
                <button
                  onClick={() => handleDelete(cycle.id)}
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

  function renderField(label, value, cycleId, field) {
    if (!value) return (
      <div style={{ marginBottom: '0.5rem', padding: '0.4rem 0.5rem', background: 'var(--bg-card-alt)', borderRadius: '4px' }}>
        <strong style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>{label}:</strong>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-faint)', marginLeft: '0.5rem', fontStyle: 'italic' }}>Not yet filled in</span>
      </div>
    )
    return (
      <div style={{ marginBottom: '0.5rem', padding: '0.4rem 0.5rem', background: 'var(--bg-card-alt)', borderRadius: '4px' }}>
        <strong style={{ fontSize: '0.75rem', color: COLORS.teal }}>{label}:</strong>
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{value}</p>
      </div>
    )
  }

}

function EditableField({ label, value, cycleId, field, canEdit, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value || '')

  // Sync when value changes externally
  useEffect(() => { setVal(value || '') }, [value])

  if (editing && canEdit) {
    return (
      <div style={{ marginBottom: '0.5rem' }}>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: COLORS.teal, marginBottom: '0.25rem' }}>{label}:</label>
        <textarea
          value={val}
          onChange={(e) => setVal(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: `2px solid ${COLORS.teal}`,
            borderRadius: '6px',
            fontSize: '0.85rem',
            minHeight: '60px',
            resize: 'vertical',
            fontFamily: 'inherit',
            boxSizing: 'border-box'
          }}
          autoFocus
        />
        <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem' }}>
          <button
            onClick={async () => {
              await onSave(cycleId, field, val)
              setEditing(false)
            }}
            style={{ padding: '0.2rem 0.6rem', background: COLORS.teal, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}
          >
            Save
          </button>
          <button
            onClick={() => { setVal(value || ''); setEditing(false) }}
            style={{ padding: '0.2rem 0.6rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        marginBottom: '0.5rem',
        padding: '0.4rem 0.5rem',
        background: 'var(--bg-card-alt)',
        borderRadius: '4px',
        cursor: canEdit ? 'pointer' : 'default'
      }}
      onClick={() => canEdit && setEditing(true)}
    >
      <strong style={{ fontSize: '0.75rem', color: value ? COLORS.teal : 'var(--text-faint)' }}>{label}:</strong>
      {value ? (
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{value}</p>
      ) : (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-faint)', marginLeft: '0.5rem', fontStyle: 'italic' }}>
          {canEdit ? 'Click to add...' : 'Not yet filled in'}
        </span>
      )}
    </div>
  )
}

function PhaseSection({ title, color, children }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{
        display: 'inline-block',
        background: color,
        color: 'white',
        padding: '0.2rem 0.75rem',
        borderRadius: '4px',
        fontSize: '0.8rem',
        fontWeight: '700',
        marginBottom: '0.5rem'
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}
