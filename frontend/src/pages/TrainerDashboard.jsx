import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import { COLORS, cardStyle, cardHeaderStyle } from '../utils/constants'
import { PROGRAM_TYPE_COLORS } from '../config/programConfig'
import { exportEvaluationReportPdf } from '../utils/exportEvaluationPdf'
import { computeParticipationIndex, PARTICIPATION_WINDOW_DAYS } from '../utils/participationIndex'

const PAGE_BG = 'var(--bg-page)'

function fmtDate(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateShort(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return `${dt.getMonth() + 1}/${dt.getDate()}/${dt.getFullYear()}`
}

function fmtTimeRange(start, end) {
  if (!start) return ''
  const fmt = (t) => {
    const [h, m] = t.split(':')
    const hh = parseInt(h, 10)
    const ampm = hh >= 12 ? 'pm' : 'am'
    const dh = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh
    return m === '00' ? `${dh}${ampm}` : `${dh}:${m}${ampm}`
  }
  return end ? `${fmt(start)}–${fmt(end)}` : fmt(start)
}

const PROGRAM_BADGE = (programType) => {
  const meta = PROGRAM_TYPE_COLORS[programType] || { bg: '#e5e7eb', color: '#374151', label: programType }
  return (
    <span style={{
      background: meta.bg, color: meta.color,
      padding: '0.15rem 0.55rem', borderRadius: '9999px',
      fontSize: '0.7rem', fontWeight: 600, marginLeft: '0.5rem'
    }}>{meta.label}</span>
  )
}

export default function TrainerDashboard() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [loading, setLoading] = useState(true)
  const [collaboratives, setCollaboratives] = useState([])  // [{ id, name, program_type, status }]
  const [upcomingEvents, setUpcomingEvents] = useState([])  // [{ event, collaborative_name, program_type }]
  const [recentEvalSessions, setRecentEvalSessions] = useState([])  // sessions with at least 1 evaluation, newest first
  const [showAllEvaluations, setShowAllEvaluations] = useState(false)
  const [evalSearch, setEvalSearch] = useState('')
  const [brightSpots, setBrightSpots] = useState([])  // completed SMARTIE goals across teams in my collabs
  const [disengagedTeams, setDisengagedTeams] = useState([])  // teams idle 14+ days
  const [rsvpsByEvent, setRsvpsByEvent] = useState({})  // { eventId: { attending: [...], not_attending: [...], no_response: [...] } }
  const [expandedRsvpEvent, setExpandedRsvpEvent] = useState(null)
  const [participationScores, setParticipationScores] = useState([])  // ranked [{ team, score, components }]
  const [downloadStats, setDownloadStats] = useState(null)  // { topItems: [...], byDomain: [...] }

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    const load = async () => {
      setLoading(true)

      // 1. Collaboratives I'm a trainer on
      const { data: myAssignments } = await supabase
        .from('collaborative_trainers')
        .select('collaborative_id, is_coordinator, collaboratives(id, name, program_type, status, start_date, end_date)')
        .eq('user_id', user.id)

      if (cancelled) return
      const collabRows = (myAssignments || [])
        .filter(a => a.collaboratives)
        .map(a => ({
          ...a.collaboratives,
          is_coordinator: a.is_coordinator,
        }))
      setCollaboratives(collabRows)

      const collabIds = collabRows.map(c => c.id)

      if (collabIds.length === 0) {
        setUpcomingEvents([])
        setRecentEvalSessions([])
        setLoading(false)
        return
      }

      // 2. Upcoming events (next 3 weeks) across my collaboratives
      const today = new Date()
      const threeWeeksOut = new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000)
      const todayStr = today.toISOString().split('T')[0]
      const futureStr = threeWeeksOut.toISOString().split('T')[0]

      const { data: events } = await supabase
        .from('bsc_events')
        .select('id, collaborative_id, event_type, title, event_date, start_time, end_time, location, zoom_link')
        .in('collaborative_id', collabIds)
        .gte('event_date', todayStr)
        .lte('event_date', futureStr)
        .order('event_date', { ascending: true })

      if (cancelled) return
      const collabById = Object.fromEntries(collabRows.map(c => [c.id, c]))
      setUpcomingEvents((events || []).map(e => ({
        ...e,
        collaborative_name: collabById[e.collaborative_id]?.name || '',
        program_type: collabById[e.collaborative_id]?.program_type || '',
      })))

      // 2b. RSVPs for those upcoming events.
      const upcomingEventIds = (events || []).map(e => e.id)
      if (upcomingEventIds.length > 0) {
        const { data: rsvpRows } = await supabase
          .from('event_rsvps')
          .select('event_id, status, email, user_profiles:user_id ( full_name, email )')
          .in('event_id', upcomingEventIds)
        const grouped = {}
        ;(rsvpRows || []).forEach(r => {
          if (!grouped[r.event_id]) grouped[r.event_id] = { attending: [], not_attending: [], no_response: [] }
          grouped[r.event_id][r.status]?.push({
            name: r.user_profiles?.full_name || r.email,
            email: r.user_profiles?.email || r.email,
          })
        })
        if (!cancelled) setRsvpsByEvent(grouped)
      }

      // 3. Recent evaluations — group by event
      const { data: evalRows } = await supabase
        .from('session_evaluations')
        .select('*')
        .in('collaborative_id', collabIds)
        .order('submitted_at', { ascending: false })

      if (cancelled) return
      // Group by event and pull event metadata
      const eventIds = Array.from(new Set((evalRows || []).map(r => r.bsc_event_id)))
      let eventMeta = []
      if (eventIds.length > 0) {
        const { data: em } = await supabase
          .from('bsc_events')
          .select('id, collaborative_id, title, event_date')
          .in('id', eventIds)
        eventMeta = em || []
      }
      const eventById = Object.fromEntries(eventMeta.map(e => [e.id, e]))
      const grouped = {}
      ;(evalRows || []).forEach(r => {
        if (!grouped[r.bsc_event_id]) grouped[r.bsc_event_id] = { evaluations: [], event: eventById[r.bsc_event_id] }
        grouped[r.bsc_event_id].evaluations.push(r)
      })
      const sessions = Object.values(grouped)
        .filter(g => g.event)  // skip orphans
        .map(g => ({
          event_id: g.event.id,
          event_date: g.event.event_date,
          title: g.event.title,
          collaborative_id: g.event.collaborative_id,
          collaborative_name: collabById[g.event.collaborative_id]?.name || '',
          response_count: g.evaluations.length,
          most_recent_submitted_at: g.evaluations
            .map(e => e.submitted_at).filter(Boolean)
            .sort().reverse()[0] || null,
          evaluations: g.evaluations,
        }))
        .sort((a, b) => (b.event_date || '').localeCompare(a.event_date || ''))
      setRecentEvalSessions(sessions)

      // 4. Teams in my collabs (used for bright spots + disengagement)
      const { data: teamsInMyCollabs } = await supabase
        .from('teams')
        .select('id, team_name, agency_name, collaborative_id')
        .in('collaborative_id', collabIds)
      const teamIds = (teamsInMyCollabs || []).map(t => t.id)
      const teamById = Object.fromEntries((teamsInMyCollabs || []).map(t => [t.id, t]))

      // 5. Bright Spots — completed SMARTIE goals across my teams, newest first.
      if (teamIds.length > 0) {
        const { data: completedGoals } = await supabase
          .from('smartie_goals')
          .select('id, team_id, what_specific, completed_at, status, created_at')
          .in('team_id', teamIds)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false, nullsFirst: false })
          .limit(20)
        if (!cancelled) {
          setBrightSpots((completedGoals || []).map(g => ({
            ...g,
            team: teamById[g.team_id],
            collaborative_name: collabById[teamById[g.team_id]?.collaborative_id]?.name || '',
          })))
        }
      }

      // 6. Disengagement — teams whose latest activity is older than 14 days.
      // "Activity" = max(created_at) across smartie_goals, pdsa_cycles, checklist_items.completed_at,
      // sts_pat_assessments.created_at. We approximate with smartie_goals + pdsa_cycles since
      // those are the most user-driven and the data shape is uniform.
      if (teamIds.length > 0) {
        const fourteenAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

        const [goals, cycles] = await Promise.all([
          supabase.from('smartie_goals').select('team_id, created_at').in('team_id', teamIds),
          supabase.from('pdsa_cycles').select('team_id, created_at').in('team_id', teamIds),
        ])
        const lastByTeam = new Map()
        const update = (rows) => (rows || []).forEach(r => {
          const t = lastByTeam.get(r.team_id)
          if (!t || (r.created_at && r.created_at > t)) lastByTeam.set(r.team_id, r.created_at)
        })
        update(goals.data)
        update(cycles.data)

        const flagged = (teamsInMyCollabs || [])
          .map(t => ({ ...t, last_activity_at: lastByTeam.get(t.id) || null }))
          .filter(t => !t.last_activity_at || t.last_activity_at < fourteenAgo)
          .map(t => ({
            ...t,
            collaborative_name: collabById[t.collaborative_id]?.name || '',
            days_idle: t.last_activity_at
              ? Math.floor((Date.now() - new Date(t.last_activity_at).getTime()) / (24 * 60 * 60 * 1000))
              : null,
          }))
          .sort((a, b) => {
            // Teams with no activity first, then by oldest activity
            if (a.last_activity_at == null && b.last_activity_at != null) return -1
            if (a.last_activity_at != null && b.last_activity_at == null) return 1
            return (a.last_activity_at || '').localeCompare(b.last_activity_at || '')
          })

        if (!cancelled) setDisengagedTeams(flagged)
      }

      // 7. Active Participation Index — composite per-team engagement score.
      // Formula lives in utils/participationIndex.js.
      if (teamIds.length > 0) {
        const scored = await computeParticipationIndex(
          (teamsInMyCollabs || []).map(t => ({
            ...t,
            collaborative_name: collabById[t.collaborative_id]?.name || '',
          }))
        )
        if (!cancelled) setParticipationScores(scored)
      }

      // 8. Resource Utilization — download telemetry over the trailing 30 days.
      {
        const windowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const { data: dls } = await supabase
          .from('resource_downloads')
          .select('resource_id, document_id, downloaded_at, resources ( title, domains ), bsc_event_documents ( file_name )')
          .gte('downloaded_at', windowStart)
        if (!cancelled) {
          const byItem = new Map()
          const byDomain = {}
          ;(dls || []).forEach(d => {
            const key = d.resource_id ? `r:${d.resource_id}` : `d:${d.document_id}`
            const label = d.resources?.title || d.bsc_event_documents?.file_name || '(deleted item)'
            const entry = byItem.get(key) || { label, count: 0, kind: d.resource_id ? 'resource' : 'material' }
            entry.count += 1
            byItem.set(key, entry)
            ;(d.resources?.domains || []).forEach(dom => {
              byDomain[dom] = (byDomain[dom] || 0) + 1
            })
          })
          setDownloadStats({
            total: (dls || []).length,
            topItems: [...byItem.values()].sort((a, b) => b.count - a.count).slice(0, 8),
            byDomain: Object.entries(byDomain).map(([domain, count]) => ({ domain, count })).sort((a, b) => b.count - a.count),
          })
        }
      }

      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [user?.id])

  // Filter evaluation sessions by search term (date or keyword in title / free-text columns)
  const filteredSessions = useMemo(() => {
    const term = evalSearch.trim().toLowerCase()
    if (!term) return recentEvalSessions
    return recentEvalSessions.filter(s => {
      if ((s.title || '').toLowerCase().includes(term)) return true
      if (fmtDateShort(s.event_date).includes(term)) return true
      if ((s.event_date || '').includes(term)) return true
      return s.evaluations.some(ev => {
        return ['most_helpful', 'improvements', 'additional_comments'].some(k => {
          const v = ev[k]
          return v && String(v).toLowerCase().includes(term)
        })
      })
    })
  }, [recentEvalSessions, evalSearch])

  const visibleSessions = showAllEvaluations ? filteredSessions : filteredSessions.slice(0, 10)

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG }}>
      {/* Header */}
      <div style={{ background: COLORS.navy, color: 'white', padding: '1rem 2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button onClick={() => navigate('/admin')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>
              ← Back to Admin
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Trainer Dashboard</h1>
              <p style={{ margin: '0.2rem 0 0', opacity: 0.85, fontSize: '0.85rem' }}>
                {profile?.full_name ? `Hello, ${profile.full_name}` : 'Your assigned collaboratives, upcoming events, and recent evaluations'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>
        {loading && (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
            <div style={{ color: 'var(--text-muted)' }}>Loading your dashboard…</div>
          </div>
        )}

        {!loading && (
          <>
            {/* My Collaboratives */}
            <section style={{ ...cardStyle, marginBottom: '1.5rem' }}>
              <div style={cardHeaderStyle}>My Collaboratives</div>
              {collaboratives.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>You're not assigned as a trainer on any collaboratives yet.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                  {collaboratives.map(c => (
                    <button
                      key={c.id}
                      onClick={() => navigate(`/admin/collaboratives/${c.id}`)}
                      style={{
                        textAlign: 'left',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '8px',
                        padding: '1rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.borderColor = COLORS.teal; e.currentTarget.style.transform = 'translateY(-1px)' }}
                      onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.transform = 'translateY(0)' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
                        <strong style={{ color: 'var(--text-heading, #0E1F56)' }}>{c.name}</strong>
                        {PROGRAM_BADGE(c.program_type)}
                        {c.is_coordinator && (
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', background: '#fef3c7', color: '#92400e', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontWeight: 600 }}>
                            Coordinator
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                        {c.start_date && c.end_date
                          ? `${fmtDate(c.start_date)} → ${fmtDate(c.end_date)}`
                          : (c.status || '')}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* My Upcoming Events */}
            <section style={{ ...cardStyle, marginBottom: '1.5rem' }}>
              <div style={cardHeaderStyle}>My Upcoming Events <span style={{ fontWeight: 400, fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>(next 3 weeks)</span></div>
              {upcomingEvents.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No events in the next 3 weeks.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {upcomingEvents.map(ev => (
                    <button
                      key={ev.id}
                      onClick={() => navigate(`/admin/event/${ev.id}`)}
                      style={{
                        textAlign: 'left',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        borderLeft: `4px solid ${COLORS.teal}`,
                        borderRadius: '6px',
                        padding: '0.75rem 1rem',
                        cursor: 'pointer',
                        display: 'grid',
                        gridTemplateColumns: '7rem 1fr auto',
                        gap: '1rem',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <div style={{ fontWeight: 700 }}>{fmtDateShort(ev.event_date)}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmtTimeRange(ev.start_time, ev.end_time)}</div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{ev.title} {PROGRAM_BADGE(ev.program_type)}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{ev.collaborative_name}{ev.location ? ` · ${ev.location}` : ''}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {ev.zoom_link && (
                          <a
                            href={ev.zoom_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              background: '#2563eb', color: 'white', textDecoration: 'none',
                              padding: '0.25rem 0.55rem', borderRadius: '4px',
                              fontSize: '0.7rem', fontWeight: 600,
                            }}
                          >🎦 Zoom</a>
                        )}
                        <span style={{ color: COLORS.teal, fontSize: '1.2rem' }}>›</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Recent Evaluations */}
            <section style={{ ...cardStyle, marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={cardHeaderStyle}>Recent Evaluations</div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Search by date or keyword…"
                    value={evalSearch}
                    onChange={(e) => setEvalSearch(e.target.value)}
                    style={{
                      padding: '0.4rem 0.75rem',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      minWidth: '14rem',
                      background: 'var(--bg-card)',
                    }}
                  />
                  {filteredSessions.length > 0 && (
                    <button
                      onClick={() => exportEvaluationReportPdf(showAllEvaluations ? filteredSessions : filteredSessions.slice(0, 10))}
                      style={{
                        background: COLORS.green,
                        color: 'white', border: 'none',
                        padding: '0.45rem 0.9rem', borderRadius: '6px',
                        cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
                      }}
                    >
                      Download All as PDF
                    </button>
                  )}
                </div>
              </div>

              {filteredSessions.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.75rem' }}>
                  {recentEvalSessions.length === 0
                    ? 'No evaluation responses yet for any of your sessions.'
                    : 'No sessions match your search.'}
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                    {visibleSessions.map(s => (
                      <div
                        key={s.event_id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '7rem 1fr auto auto',
                          gap: '0.75rem',
                          alignItems: 'center',
                          padding: '0.6rem 0.85rem',
                          border: '1px solid var(--border-light)',
                          borderRadius: '6px',
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{fmtDateShort(s.event_date)}</div>
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{s.title}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.collaborative_name}</div>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {s.response_count} response{s.response_count === 1 ? '' : 's'}
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            onClick={() => navigate(`/admin/event/${s.event_id}`)}
                            style={{ background: 'transparent', color: COLORS.navy, border: `1px solid ${COLORS.navy}`, padding: '0.3rem 0.65rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem' }}
                          >View</button>
                          <button
                            onClick={() => exportEvaluationReportPdf([{ event_date: s.event_date, title: s.title, evaluations: s.evaluations }])}
                            style={{ background: COLORS.green, color: 'white', border: 'none', padding: '0.3rem 0.65rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem' }}
                          >Download PDF</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {filteredSessions.length > 10 && (
                    <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
                      <button
                        onClick={() => setShowAllEvaluations(s => !s)}
                        style={{ background: 'transparent', color: COLORS.navy, border: 'none', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}
                      >
                        {showAllEvaluations
                          ? `Show fewer (showing all ${filteredSessions.length})`
                          : `Show all ${filteredSessions.length}`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* RSVPs — who's planning to attend each upcoming session */}
            {upcomingEvents.length > 0 && Object.keys(rsvpsByEvent).length > 0 && (
              <section style={{ ...cardStyle, marginBottom: '1.5rem' }}>
                <div style={cardHeaderStyle}>
                  📨 RSVPs
                  <span style={{ fontWeight: 400, fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                    responses from automated reminders
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {upcomingEvents.map(ev => {
                    const r = rsvpsByEvent[ev.id]
                    if (!r) return null
                    const total = r.attending.length + r.not_attending.length + r.no_response.length
                    if (total === 0) return null
                    const isExpanded = expandedRsvpEvent === ev.id
                    return (
                      <div
                        key={ev.id}
                        style={{
                          padding: '0.6rem 0.85rem',
                          border: '1px solid var(--border-light)',
                          borderRadius: '6px',
                          background: 'var(--bg-card)',
                        }}
                      >
                        <button
                          onClick={() => setExpandedRsvpEvent(isExpanded ? null : ev.id)}
                          style={{
                            width: '100%', background: 'transparent', border: 'none',
                            cursor: 'pointer', textAlign: 'left', padding: 0,
                            display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.75rem', alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-body)' }}>{ev.title}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {fmtDateShort(ev.event_date)} · {ev.collaborative_name}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <Badge color="#16a34a" bg="#dcfce7">✓ {r.attending.length}</Badge>
                            <Badge color="#991b1b" bg="#fee2e2">✕ {r.not_attending.length}</Badge>
                            <Badge color="#6b7280" bg="#f3f4f6">? {r.no_response.length}</Badge>
                          </div>
                          <span style={{ color: COLORS.teal, fontSize: '1.1rem' }}>{isExpanded ? '▾' : '▸'}</span>
                        </button>
                        {isExpanded && (
                          <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                            <RsvpColumn title="Attending" people={r.attending} color="#16a34a" />
                            <RsvpColumn title="Not Attending" people={r.not_attending} color="#991b1b" />
                            <RsvpColumn title="No Response" people={r.no_response} color="#6b7280" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Bright Spots — completed goals across my teams */}
            {brightSpots.length > 0 && (
              <section style={{ ...cardStyle, marginBottom: '1.5rem' }}>
                <div style={cardHeaderStyle}>
                  ✨ Bright Spots
                  <span style={{ fontWeight: 400, fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                    completed goals you can ask teams to share
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                  {brightSpots.slice(0, 8).map(g => (
                    <div
                      key={g.id}
                      style={{
                        padding: '0.6rem 0.85rem',
                        border: '1px solid var(--border-light)',
                        borderLeft: '4px solid #16a34a',
                        borderRadius: '6px',
                        background: 'var(--bg-card)',
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: '0.5rem',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-body)' }}>
                          {g.what_specific || 'Goal'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {g.team?.team_name || g.team?.agency_name || 'Unknown team'}
                          {g.collaborative_name && ` · ${g.collaborative_name}`}
                          {g.completed_at && ` · completed ${new Date(g.completed_at).toLocaleDateString()}`}
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/admin/smartie-goals/${g.team_id}`)}
                        style={{
                          background: 'transparent', color: COLORS.navy,
                          border: `1px solid ${COLORS.navy}`,
                          padding: '0.3rem 0.7rem', borderRadius: '4px',
                          cursor: 'pointer', fontSize: '0.78rem', alignSelf: 'center',
                        }}
                      >View</button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Disengagement Alerts — teams with no activity in 14+ days */}
            {disengagedTeams.length > 0 && (
              <section style={{ ...cardStyle, marginBottom: '1.5rem' }}>
                <div style={cardHeaderStyle}>
                  ⚠️ Teams that may need a nudge
                  <span style={{ fontWeight: 400, fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                    no goal/PDSA activity in 14+ days
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                  {disengagedTeams.map(t => (
                    <div
                      key={t.id}
                      style={{
                        padding: '0.6rem 0.85rem',
                        border: '1px solid var(--border-light)',
                        borderLeft: '4px solid #f59e0b',
                        borderRadius: '6px',
                        background: 'var(--bg-card)',
                        display: 'grid',
                        gridTemplateColumns: '1fr auto auto',
                        gap: '0.5rem',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                          {t.team_name || t.agency_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {t.agency_name}
                          {t.collaborative_name && ` · ${t.collaborative_name}`}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.75rem', color: '#92400e',
                        background: '#fef3c7', borderRadius: '999px',
                        padding: '0.15rem 0.55rem', fontWeight: 600,
                      }}>
                        {t.last_activity_at == null ? 'no activity' : `${t.days_idle}d idle`}
                      </span>
                      <button
                        onClick={() => navigate(`/admin/team-report/${t.id}`)}
                        style={{
                          background: 'transparent', color: COLORS.navy,
                          border: `1px solid ${COLORS.navy}`,
                          padding: '0.3rem 0.7rem', borderRadius: '4px',
                          cursor: 'pointer', fontSize: '0.78rem',
                        }}
                      >Open</button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Active Participation Index — ranked per-team engagement */}
            {participationScores.length > 0 && (
              <section style={{ ...cardStyle, marginBottom: '1.5rem' }}>
                <div style={cardHeaderStyle}>
                  📈 Active Participation Index
                  <span style={{ fontWeight: 400, fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                    forum + goals + checklist, trailing {PARTICIPATION_WINDOW_DAYS} days
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                  {participationScores.map(({ team, score, components }) => (
                    <div
                      key={team.id}
                      style={{
                        padding: '0.6rem 0.85rem',
                        border: '1px solid var(--border-light)',
                        borderLeft: `4px solid ${score >= 60 ? '#16a34a' : score >= 30 ? '#f59e0b' : '#ef4444'}`,
                        borderRadius: '6px',
                        background: 'var(--bg-card)',
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: '0.75rem',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                          {team.team_name || team.agency_name}
                          {team.collaborative_name && (
                            <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>{team.collaborative_name}</span>
                          )}
                        </div>
                        {/* Component breakdown — visible, not a black box */}
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          💬 {components.forum.raw} forum post{components.forum.raw === 1 ? '' : 's'}
                          {' · '}🎯 {components.goals.raw} goal{components.goals.raw === 1 ? '' : 's'} active
                          {' · '}✅ checklist {components.checklist.total > 0 ? `${components.checklist.done}/${components.checklist.total}` : '—'}
                        </div>
                      </div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: score >= 60 ? '#16a34a' : score >= 30 ? '#b45309' : '#ef4444' }}>
                        {score}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Resource Utilization — most-downloaded items + domain engagement */}
            {downloadStats && downloadStats.total > 0 && (
              <section style={{ ...cardStyle, marginBottom: '1.5rem' }}>
                <div style={cardHeaderStyle}>
                  📊 Resource Utilization
                  <span style={{ fontWeight: 400, fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                    {downloadStats.total} download{downloadStats.total === 1 ? '' : 's'} in the last 30 days
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: downloadStats.byDomain.length > 0 ? '1fr 1fr' : '1fr', gap: '1.25rem', marginTop: '0.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>Most downloaded</div>
                    {downloadStats.topItems.map((item, i) => {
                      const max = downloadStats.topItems[0]?.count || 1
                      return (
                        <div key={i} style={{ marginBottom: '0.4rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                              {item.kind === 'resource' ? '📚' : '📄'} {item.label}
                            </span>
                            <strong>{item.count}</strong>
                          </div>
                          <div style={{ height: '6px', background: 'var(--bg-card-alt)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${(item.count / max) * 100}%`, height: '100%', background: COLORS.teal }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {downloadStats.byDomain.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>Engagement by domain</div>
                      {downloadStats.byDomain.map(({ domain, count }) => {
                        const max = downloadStats.byDomain[0]?.count || 1
                        return (
                          <div key={domain} style={{ marginBottom: '0.4rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                              <span style={{ textTransform: 'capitalize' }}>{domain.replace(/_/g, ' ')}</span>
                              <strong>{count}</strong>
                            </div>
                            <div style={{ height: '6px', background: 'var(--bg-card-alt)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${(count / max) * 100}%`, height: '100%', background: COLORS.navy }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Badge({ color, bg, children }) {
  return (
    <span style={{
      background: bg, color, padding: '0.15rem 0.5rem',
      borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700,
    }}>{children}</span>
  )
}

function RsvpColumn({ title, people, color }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, color, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {title} ({people.length})
      </div>
      {people.length === 0 ? (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-faint)' }}>—</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.78rem' }}>
          {people.slice(0, 12).map((p, i) => (
            <li key={i} style={{ marginBottom: '0.15rem', color: 'var(--text-body)' }}>{p.name}</li>
          ))}
          {people.length > 12 && (
            <li style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>+ {people.length - 12} more</li>
          )}
        </ul>
      )}
    </div>
  )
}
