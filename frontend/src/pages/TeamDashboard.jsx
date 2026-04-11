import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import { COLORS, cardStyle, cardHeaderStyle } from '../utils/constants'
import { getProgramBranding } from '../config/programConfig'
import { calculatePhase, PHASES, getPhaseGuidance, phaseToChecklistKey } from '../utils/phaseCalculator'
import { detectChecklistCompletion } from '../utils/checklistAutoDetect'
import AttendanceReport from '../components/AttendanceReport'

export default function TeamDashboard() {
  const navigate = useNavigate()
  const { user, profile, signOut, isTeamMember } = useAuth()
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [motto, setMotto] = useState('')
  const [goalCount, setGoalCount] = useState(0)

  // Phase timeline state
  const [phaseInfo, setPhaseInfo] = useState(null)
  const [events, setEvents] = useState([])

  // Checklist state
  const [checklistItems, setChecklistItems] = useState([])
  const [checklistLoading, setChecklistLoading] = useState(false)

  // PDSA count state
  const [pdsaCount, setPdsaCount] = useState(0)
  const [patCount, setPatCount] = useState(0)
  const [pendingGoals, setPendingGoals] = useState(0)
  const [pendingCycles, setPendingCycles] = useState(0)
  const [lastSelfRatingDate, setLastSelfRatingDate] = useState(null)
  const [sessionAttendance, setSessionAttendance] = useState([])
  const [viewAttendanceEvent, setViewAttendanceEvent] = useState(null)

  useEffect(() => {
    if (profile?.team_id) {
      loadTeam()
    } else {
      setLoading(false)
    }
  }, [profile])

  const loadTeam = async () => {
    try {
      const { data: teamData, error } = await supabase
        .from('teams')
        .select('*, collaboratives (id, name, start_date, end_date, program_type)')
        .eq('id', profile.team_id)
        .single()

      if (error) throw error
      setTeam(teamData)
      setDisplayName(teamData.display_name || teamData.team_name)
      setMotto(teamData.motto || '')

      // Count active goals
      const { count } = await supabase
        .from('smartie_goals')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', profile.team_id)
        .eq('status', 'active')
      setGoalCount(count || 0)

      // Load BSC events for phase calculation
      if (teamData.collaboratives?.id) {
        const { data: eventData } = await supabase
          .from('bsc_events')
          .select('*')
          .eq('collaborative_id', teamData.collaboratives.id)
          .order('event_date', { ascending: true })

        const evts = eventData || []
        setEvents(evts)
        const phase = calculatePhase(evts, teamData.collaboratives)
        setPhaseInfo(phase)

        // Load checklist items
        loadChecklist(teamData.id, phase)
      }

      // Count active PDSA cycles
      const { count: pdsaActiveCount } = await supabase
        .from('pdsa_cycles')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', profile.team_id)
        .in('status', ['plan', 'do', 'study', 'act'])
      setPdsaCount(pdsaActiveCount || 0)

      // Count completed STS-PAT assessments
      const { count: patCompletedCount } = await supabase
        .from('sts_pat_assessments')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', profile.team_id)
        .eq('status', 'completed')
      setPatCount(patCompletedCount || 0)

      // Count pending queued actions from STS-PAT
      const { count: pendingGoalCount } = await supabase
        .from('sts_pat_queued_actions')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', profile.team_id)
        .eq('action_type', 'smartie_goal')
        .eq('status', 'pending')
      setPendingGoals(pendingGoalCount || 0)

      const { count: pendingCycleCount } = await supabase
        .from('sts_pat_queued_actions')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', profile.team_id)
        .eq('action_type', 'pdsa_cycle')
        .eq('status', 'pending')
      setPendingCycles(pendingCycleCount || 0)

      // Self-rating: query by user_id (not team_id) — it's personal
      const { data: latestSelfRating } = await supabase
        .from('supervisor_self_ratings')
        .select('completed_at')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single()
      setLastSelfRatingDate(latestSelfRating?.completed_at || null)

      // Load session attendance for this team's collaborative
      if (teamData.collaboratives?.id) {
        const { data: lsEvents } = await supabase
          .from('bsc_events')
          .select('id, title, event_date')
          .eq('collaborative_id', teamData.collaboratives.id)
          .eq('event_type', 'learning_session')
          .order('event_date', { ascending: false })

        if (lsEvents && lsEvents.length > 0) {
          // Get attendance counts for team members
          const { data: attData } = await supabase
            .from('session_attendance')
            .select('bsc_event_id')
            .eq('team_id', profile.team_id)

          const attCounts = {}
          ;(attData || []).forEach(a => { attCounts[a.bsc_event_id] = (attCounts[a.bsc_event_id] || 0) + 1 })

          setSessionAttendance(lsEvents.map(e => ({
            ...e,
            teamAttendees: attCounts[e.id] || 0
          })))
        }
      }
    } catch (err) {
      console.error('Error loading team:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadChecklist = async (teamId, phase) => {
    setChecklistLoading(true)
    try {
      const { data: items } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('team_id', teamId)
        .order('phase')
        .order('sort_order')

      if (items && items.length > 0) {
        // Run auto-detection for incomplete auto items
        const updates = await detectChecklistCompletion(teamId, items)
        // Merge updates into local state
        const merged = items.map(item => {
          const update = updates.find(u => u.id === item.id)
          return update ? { ...item, is_completed: true, completed_at: new Date().toISOString() } : item
        })
        setChecklistItems(merged)
      } else {
        setChecklistItems([])
      }
    } catch (err) {
      console.error('Error loading checklist:', err)
    } finally {
      setChecklistLoading(false)
    }
  }


  const handleToggleChecklist = async (item) => {
    if (item.is_auto) return // auto items are read-only
    if (isTeamMember) return // team members are read-only
    const newCompleted = !item.is_completed
    const now = new Date().toISOString()

    // Optimistic update
    setChecklistItems(prev => prev.map(i =>
      i.id === item.id ? { ...i, is_completed: newCompleted, completed_at: newCompleted ? now : null } : i
    ))

    const updateData = newCompleted
      ? { is_completed: true, completed_at: now, completed_by: user.id }
      : { is_completed: false, completed_at: null, completed_by: null }

    const { error } = await supabase
      .from('checklist_items')
      .update(updateData)
      .eq('id', item.id)

    if (error) {
      console.error('Error updating checklist:', error)
      // Revert on failure
      setChecklistItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, is_completed: !newCompleted, completed_at: item.completed_at } : i
      ))
    }
  }

  const handleSaveTeamInfo = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('teams')
        .update({
          display_name: displayName.trim() || team.team_name,
          motto: motto.trim() || null
        })
        .eq('id', team.id)

      if (error) throw error
      setTeam(prev => ({ ...prev, display_name: displayName.trim() || prev.team_name, motto: motto.trim() || null }))
      setEditing(false)
    } catch (err) {
      console.error('Error saving team info:', err)
      alert('Error saving: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  // Navigation links for checklist items
  const itemNavLinks = {
    complete_baseline: null,
    complete_endline: null,
    set_team_name: null, // handled by edit button in header
    set_smartie_goal: team ? `/admin/smartie-goals/${team.id}` : null,
    post_in_forum: '/admin/forum',
    share_in_forum: '/admin/forum',
    browse_resources: '/admin/resources',
    review_dashboard: team ? `/admin/team-report/${team.id}` : null,
    review_progress: team ? `/admin/smartie-goals/${team.id}` : null
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', color: COLORS.navy, fontSize: '1.25rem' }}>Loading your dashboard...</div>
      </div>
    )
  }

  if (!team) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-page)', padding: '2rem' }}>
        <div style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center' }}>
          <h2 style={{ color: COLORS.navy }}>No Team Assigned</h2>
          <p style={{ color: 'var(--text-muted)' }}>Your account is not linked to a team yet. Please contact CTAC for assistance.</p>
          <button onClick={handleSignOut} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: COLORS.teal, color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  const teamDisplayName = team.display_name || team.team_name
  const programBranding = getProgramBranding(team.collaboratives?.program_type)

  // Current phase checklist
  const currentPhaseKey = phaseInfo ? phaseToChecklistKey(phaseInfo.phaseIndex) : 'preparation'
  const currentPhaseItems = checklistItems.filter(i => i.phase === currentPhaseKey)
  const completedCount = currentPhaseItems.filter(i => i.is_completed).length
  const totalCount = currentPhaseItems.length
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      {/* Hero Header */}
      <div style={{
        background: `linear-gradient(135deg, ${COLORS.navy} 0%, ${COLORS.teal} 100%)`,
        color: 'white',
        padding: '2.5rem 2rem 2rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '0.25rem' }}>
                {team.agency_name} — {team.collaboratives?.name}
              </div>
              <h1 style={{ margin: '0 0 0.5rem', fontSize: '2rem' }}>
                {editing ? (
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      border: '2px solid rgba(255,255,255,0.4)',
                      borderRadius: '6px',
                      color: 'white',
                      fontSize: '1.8rem',
                      fontWeight: '700',
                      padding: '0.25rem 0.5rem',
                      width: '100%',
                      maxWidth: '400px'
                    }}
                    placeholder={team.team_name}
                  />
                ) : teamDisplayName}
              </h1>
              {editing ? (
                <input
                  type="text"
                  value={motto}
                  onChange={(e) => setMotto(e.target.value)}
                  placeholder="Add a team motto..."
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '4px',
                    color: 'white',
                    fontSize: '1rem',
                    fontStyle: 'italic',
                    padding: '0.3rem 0.5rem',
                    width: '100%',
                    maxWidth: '400px'
                  }}
                />
              ) : (
                team.motto && (
                  <p style={{ margin: 0, fontSize: '1.1rem', fontStyle: 'italic', opacity: 0.9 }}>
                    "{team.motto}"
                  </p>
                )
              )}
              {editing && (
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={handleSaveTeamInfo}
                    disabled={saving}
                    style={{ padding: '0.4rem 1rem', background: 'var(--bg-card)', color: COLORS.navy, border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditing(false); setDisplayName(team.display_name || team.team_name); setMotto(team.motto || '') }}
                    style={{ padding: '0.4rem 1rem', background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
              <button onClick={handleSignOut} style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '500' }}>
                Sign Out
              </button>
              {!editing && !isTeamMember && (
                <button
                  onClick={() => setEditing(true)}
                  style={{ padding: '0.2rem 0.5rem', background: 'transparent', color: 'rgba(255,255,255,0.6)', border: 'none', cursor: 'pointer', fontSize: '0.7rem', textDecoration: 'underline' }}
                >
                  Edit Name/Motto
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>

        {/* Phase Timeline Banner */}
        {phaseInfo && (
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '0.75rem',
            border: `3px solid ${COLORS.teal}`,
            borderLeft: `6px solid ${COLORS.teal}`,
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '0.25rem' }}>
                  Current Phase
                </div>
                <h2 style={{ margin: 0, color: COLORS.navy, fontSize: '1.5rem' }}>
                  {phaseInfo.phase}
                </h2>
              </div>
              {phaseInfo.nextEvent && (
                <div style={{
                  background: `${COLORS.navy}08`,
                  border: `1px solid ${COLORS.navy}20`,
                  borderRadius: '0.5rem',
                  padding: '0.75rem 1rem',
                  textAlign: 'right'
                }}>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: '600' }}>
                    Next Event
                  </div>
                  <div style={{ color: COLORS.navy, fontWeight: '600', fontSize: '0.95rem' }}>
                    {phaseInfo.nextEvent.title}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {new Date(phaseInfo.nextEvent.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    {phaseInfo.nextEvent.start_time && ` — ${formatTime(phaseInfo.nextEvent.start_time)} ${phaseInfo.nextEvent.timezone === 'America/New_York' ? 'ET' : ''}`}
                    {phaseInfo.daysUntilNext !== null && (
                      <span style={{ color: COLORS.teal, fontWeight: '600', marginLeft: '0.5rem' }}>
                        {phaseInfo.daysUntilNext === 0 ? 'Today!' : `in ${phaseInfo.daysUntilNext} day${phaseInfo.daysUntilNext !== 1 ? 's' : ''}`}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Phase Stepper */}
            <div style={{ margin: '1.25rem 0 0.75rem', overflowX: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', minWidth: '600px', justifyContent: 'space-between' }}>
                {PHASES.map((p, idx) => {
                  const isPast = idx < phaseInfo.phaseIndex
                  const isCurrent = idx === phaseInfo.phaseIndex
                  const isFuture = idx > phaseInfo.phaseIndex

                  return (
                    <div key={p.key} style={{ display: 'flex', alignItems: 'center', flex: idx < PHASES.length - 1 ? 1 : 0 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '40px' }}>
                        <div style={{
                          width: isCurrent ? '28px' : '20px',
                          height: isCurrent ? '28px' : '20px',
                          borderRadius: '50%',
                          background: isPast ? COLORS.navy : isCurrent ? COLORS.teal : 'white',
                          border: `3px solid ${isPast ? COLORS.navy : isCurrent ? COLORS.teal : '#d1d5db'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.3s',
                          boxShadow: isCurrent ? `0 0 0 4px ${COLORS.teal}25` : 'none'
                        }}>
                          {isPast && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <div style={{
                          fontSize: '0.6rem',
                          marginTop: '0.3rem',
                          color: isPast ? COLORS.navy : isCurrent ? COLORS.teal : '#9ca3af',
                          fontWeight: isCurrent ? '700' : '500',
                          whiteSpace: 'nowrap',
                          textAlign: 'center'
                        }}>
                          {p.short}
                        </div>
                      </div>
                      {idx < PHASES.length - 1 && (
                        <div style={{
                          flex: 1,
                          height: '3px',
                          background: isPast ? COLORS.navy : '#e5e7eb',
                          marginBottom: '1.2rem',
                          marginLeft: '4px',
                          marginRight: '4px',
                          borderRadius: '2px'
                        }} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Phase Guidance */}
            <div style={{
              background: `${COLORS.teal}08`,
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.5',
              borderLeft: `3px solid ${COLORS.teal}`
            }}>
              {getPhaseGuidance(phaseInfo.phaseKey)}
            </div>
          </div>
        )}

        {/* Checklist Section */}
        {phaseInfo && currentPhaseItems.length > 0 && (
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: COLORS.navy, fontSize: '1.1rem' }}>
                Your Checklist — {phaseInfo.phase}
              </h3>
              <span style={{ fontSize: '0.85rem', color: completedCount === totalCount ? COLORS.teal : '#6b7280', fontWeight: '600' }}>
                {completedCount} of {totalCount} complete
              </span>
            </div>

            {/* Progress Bar */}
            <div style={{ background: '#e5e7eb', borderRadius: '999px', height: '8px', marginBottom: '1rem', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                borderRadius: '999px',
                background: completedCount === totalCount
                  ? `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.green})`
                  : `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.navy})`,
                width: `${progressPct}%`,
                transition: 'width 0.4s ease'
              }} />
            </div>

            {/* Checklist Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {currentPhaseItems.map(item => {
                const navLink = itemNavLinks[item.item_key]
                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.5rem',
                      background: item.is_completed ? `${COLORS.teal}08` : '#f9fafb',
                      border: `1px solid ${item.is_completed ? `${COLORS.teal}30` : '#e5e7eb'}`,
                      cursor: item.is_auto ? 'default' : 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => !item.is_auto && handleToggleChecklist(item)}
                  >
                    {/* Checkbox */}
                    <div style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '4px',
                      border: `2px solid ${item.is_completed ? COLORS.teal : '#d1d5db'}`,
                      background: item.is_completed ? COLORS.teal : 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'all 0.2s'
                    }}>
                      {item.is_completed && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>

                    {/* Label */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        color: item.is_completed ? '#6b7280' : '#1f2937',
                        textDecoration: item.is_completed ? 'line-through' : 'none',
                        fontSize: '0.9rem'
                      }}>
                        {item.label}
                      </span>
                    </div>

                    {/* Auto badge */}
                    {item.is_auto && item.is_completed && (
                      <span style={{
                        fontSize: '0.65rem',
                        background: `${COLORS.teal}15`,
                        color: COLORS.teal,
                        padding: '0.15rem 0.4rem',
                        borderRadius: '4px',
                        fontWeight: '600',
                        whiteSpace: 'nowrap'
                      }}>
                        Auto-detected
                      </span>
                    )}

                    {/* Nav link */}
                    {navLink && !item.is_completed && (
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(navLink) }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: COLORS.teal,
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          whiteSpace: 'nowrap',
                          textDecoration: 'underline',
                          padding: '0.2rem 0.4rem'
                        }}
                      >
                        Go
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Action Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* Row 1: Data */}
          <ActionCard
            icon="📊"
            title="Assessment Results"
            description="View your team's assessment results across timepoints"
            borderColor={COLORS.teal}
            onClick={() => navigate(`/admin/team-report/${team.id}`)}
          />
          <ActionCard
            icon="📈"
            title="Data Visualization"
            description="View detailed charts and graphs of assessment results"
            borderColor={COLORS.navy}
            onClick={() => navigate('/admin/data-visualization')}
          />
          <ActionCard
            icon="📋"
            title="Recommendations"
            description="See strengths, areas for growth, and suggested next steps based on your assessment results"
            borderColor={COLORS.teal}
            onClick={() => navigate(`/admin/recommendations/${team.id}`)}
          />

          {/* Row 2: Improvement */}
          <ActionCard
            icon="🎯"
            title={<>SMARTIE Goals{goalCount > 0 && <span style={{ fontSize: '0.85rem', fontWeight: '400', color: COLORS.teal, marginLeft: '0.5rem' }}>({goalCount} active)</span>}{pendingGoals > 0 && <span style={{ background: '#f59e0b', color: 'white', borderRadius: '999px', padding: '0.1rem 0.4rem', fontSize: '0.7rem', marginLeft: '0.5rem' }}>{pendingGoals} new</span>}</>}
            description="Set and track your team's improvement goals"
            borderColor={COLORS.navy}
            onClick={() => navigate(`/admin/smartie-goals/${team.id}`)}
          />
          <ActionCard
            icon="🔄"
            title={<>PDSA Cycles{pdsaCount > 0 && <span style={{ fontSize: '0.85rem', fontWeight: '400', color: COLORS.teal, marginLeft: '0.5rem' }}>({pdsaCount} active)</span>}{pendingCycles > 0 && <span style={{ background: '#f59e0b', color: 'white', borderRadius: '999px', padding: '0.1rem 0.4rem', fontSize: '0.7rem', marginLeft: '0.5rem' }}>{pendingCycles} new</span>}</>}
            description="Run Plan-Do-Study-Act improvement cycles for your team"
            borderColor={COLORS.teal}
            onClick={() => navigate(`/admin/pdsa/${team.id}`)}
          />
          <ActionCard
            icon="💡"
            title="Strategy Ideas"
            description="Browse improvement strategies from previous collaboratives by domain"
            borderColor={COLORS.navy}
            onClick={() => navigate('/admin/strategies')}
          />
          {programBranding.hasStsPat && (
            <ActionCard
              icon="📜"
              title={<>STS Policy Analysis{patCount > 0 && <span style={{ fontSize: '0.85rem', fontWeight: '400', color: COLORS.teal, marginLeft: '0.5rem' }}>({patCount} completed)</span>}</>}
              description="Analyze your organization's STS-related policies using the STS-PAT tool"
              borderColor={COLORS.navy}
              onClick={() => navigate(`/admin/sts-pat/${team.id}`)}
            />
          )}

          {programBranding.hasSupervisorSelfRating && (
            <ActionCard
              icon="&#128203;"
              title={<>Supervisor Self-Rating{lastSelfRatingDate && <span style={{ fontSize: '0.75rem', fontWeight: '400', color: COLORS.teal, marginLeft: '0.5rem' }}>(Last: {new Date(lastSelfRatingDate).toLocaleDateString()})</span>}</>}
              description="Private self-assessment of your trauma-informed supervision competencies"
              borderColor="#059669"
              onClick={() => navigate('/admin/supervisor-self-rating')}
            />
          )}

          {programBranding.hasResourceMapping && (
            <ActionCard
              icon="&#128506;"
              title="Resource Mapping"
              description="Map resources across TIC OSA domains — what you have vs. what you need"
              borderColor="#7c3aed"
              onClick={() => navigate('/admin/resource-mapping')}
            />
          )}

          {/* Row 3: Resources & Community */}
          <ActionCard
            icon="📚"
            title="Resources"
            description={`Browse guides, tools, and videos by ${programBranding.hasResourceMapping ? 'category' : 'domain'}`}
            borderColor={COLORS.teal}
            onClick={() => navigate('/admin/resources')}
          />
          <ActionCard
            icon="🏗️"
            title="Change Framework"
            description="View the collaborative improvement framework by domain"
            borderColor={COLORS.navy}
            onClick={() => navigate('/admin/change-framework')}
          />
          <ActionCard
            icon="💬"
            title="Community Forum"
            description="Discuss strategies and share experiences with your collaborative"
            borderColor={COLORS.teal}
            onClick={() => navigate('/admin/forum')}
          />

          {/* Row 4: Team & Staff */}
          <ActionCard
            icon="🧑‍🤝‍🧑"
            title="Team"
            description="View and manage team members, roles, and access"
            borderColor={COLORS.navy}
            onClick={() => navigate(`/admin/team/${team.id}/members`)}
          />
          <ActionCard
            icon="👥"
            title="Project Staff"
            description="Meet the BSC faculty and support team"
            borderColor={COLORS.teal}
            onClick={() => navigate('/admin/staff')}
          />
        </div>

        {/* Session Attendance Section */}
        {sessionAttendance.length > 0 && (
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 1rem', color: COLORS.navy, fontSize: '1.1rem' }}>
              Session Attendance
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {sessionAttendance.map(s => (
                <div key={s.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.6rem 0.75rem', borderRadius: '0.5rem',
                  background: '#f9fafb', border: '1px solid #e5e7eb'
                }}>
                  <div>
                    <span style={{ fontWeight: '600', color: COLORS.navy, fontSize: '0.9rem' }}>{s.title}</span>
                    <span style={{ color: '#6b7280', fontSize: '0.85rem', marginLeft: '0.75rem' }}>
                      {new Date(s.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      fontSize: '0.8rem', fontWeight: '600',
                      color: s.teamAttendees > 0 ? '#166534' : '#6b7280'
                    }}>
                      {s.teamAttendees} team member{s.teamAttendees !== 1 ? 's' : ''}
                    </span>
                    {s.teamAttendees > 0 && (
                      <button
                        onClick={() => setViewAttendanceEvent(s)}
                        style={{
                          padding: '0.2rem 0.5rem', background: COLORS.navy, color: 'white',
                          border: 'none', borderRadius: '4px', cursor: 'pointer',
                          fontSize: '0.7rem', fontWeight: '600'
                        }}
                      >View</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attendance Report Modal */}
        {viewAttendanceEvent && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem'
          }} onClick={() => setViewAttendanceEvent(null)}>
            <div style={{
              background: 'var(--bg-card)', borderRadius: '0.75rem', padding: '1.5rem',
              maxWidth: '1000px', width: '100%', maxHeight: '85vh', overflowY: 'auto'
            }} onClick={e => e.stopPropagation()}>
              <AttendanceReport
                eventId={viewAttendanceEvent.id}
                eventTitle={viewAttendanceEvent.title}
                eventDate={viewAttendanceEvent.event_date}
                teamFilter={team?.id}
                onClose={() => setViewAttendanceEvent(null)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ActionCard({ icon, title, description, borderColor, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '2rem',
        background: 'var(--bg-card)',
        border: '2px solid #d1d5db',
        borderRadius: '0.75rem',
        cursor: 'pointer',
        transition: 'all 0.2s',
        textAlign: 'left'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = borderColor
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = '#d1d5db'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{icon}</div>
      <div style={{ color: COLORS.navy, fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
        {title}
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        {description}
      </div>
    </button>
  )
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'pm' : 'am'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return m === '00' ? `${displayHour}${ampm}` : `${displayHour}:${m}${ampm}`
}
