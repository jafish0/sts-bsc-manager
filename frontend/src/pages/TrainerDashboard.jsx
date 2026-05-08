import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import { COLORS, cardStyle, cardHeaderStyle } from '../utils/constants'
import { PROGRAM_TYPE_COLORS } from '../config/programConfig'
import { exportEvaluationReportPdf } from '../utils/exportEvaluationPdf'

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
          </>
        )}
      </div>
    </div>
  )
}
