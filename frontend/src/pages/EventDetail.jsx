import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Cell,
} from 'recharts'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import { COLORS, cardStyle, cardHeaderStyle } from '../utils/constants'
import { PROGRAM_TYPE_COLORS } from '../config/programConfig'
import { exportEvaluationReportPdf } from '../utils/exportEvaluationPdf'

const ATTENDANCE_REFRESH_MS = 30000

function fmtDate(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
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
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start)
}

const ROLE_LABEL = {
  super_admin: 'Super Admin',
  agency_admin: 'Agency Admin',
  team_leader: 'Team Leader',
  senior_leader: 'Senior Leader',
  team_member: 'Team Member',
}

function fmtBytes(n) {
  if (n == null) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

// Likert items in display order matching the evaluation form / sample PDF.
const LIKERT_ITEMS = [
  { key: 'trainer_effective',            label: 'Trainer was effective' },
  { key: 'content_objective_alignment',  label: 'Content/objective alignment' },
  { key: 'applicable_to_work',           label: 'Applicable to work' },
  { key: 'practical_knowledge',          label: 'Practical knowledge & skills' },
  { key: 'methods_appropriate_audience', label: 'Methods fit audience' },
  { key: 'methods_appropriate_subject',  label: 'Methods fit subject' },
]
// NPS-style colors: detractors red (0–6), passives amber (7–8), promoters green (9–10)
const NPS_COLOR = (score) => score >= 9 ? '#16a34a' : score >= 7 ? '#f59e0b' : '#ef4444'

export default function EventDetail() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const { user, canAdminCollaborative } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [event, setEvent] = useState(null)
  const [collaborative, setCollaborative] = useState(null)
  const [teams, setTeams] = useState([])             // [{ id, team_name, agency_name }]
  const [members, setMembers] = useState([])         // [{ id, full_name, email, role, team_id }]
  const [attendance, setAttendance] = useState([])   // raw session_attendance rows for this event
  const [attRefreshing, setAttRefreshing] = useState(false)
  const [lastRefreshAt, setLastRefreshAt] = useState(null)
  const [documents, setDocuments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  // Email composer modal: { recipientsType: 'all'|'team'|'coordinator', teamId?, teamName?, defaultSubject? } | null
  const [emailModal, setEmailModal] = useState(null)
  // Coordinator address (for "Message coordinator" section)
  const [coordinatorEmail, setCoordinatorEmail] = useState(null)
  const [coordinatorName, setCoordinatorName] = useState(null)
  // Session evaluations (Phase 6)
  const [evaluations, setEvaluations] = useState([])

  // 1. Initial load: event, collaborative, teams in collab, all team_members
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true); setError(null)
      try {
        const { data: ev, error: evErr } = await supabase
          .from('bsc_events')
          .select('*')
          .eq('id', eventId)
          .single()
        if (evErr) throw evErr
        if (cancelled) return
        setEvent(ev)

        const { data: coll, error: collErr } = await supabase
          .from('collaboratives')
          .select('id, name, program_type')
          .eq('id', ev.collaborative_id)
          .single()
        if (collErr) throw collErr
        if (cancelled) return
        setCollaborative(coll)

        const { data: tms, error: tmsErr } = await supabase
          .from('teams')
          .select('id, team_name, agency_name')
          .eq('collaborative_id', ev.collaborative_id)
          .order('team_name')
        if (tmsErr) throw tmsErr
        if (cancelled) return
        setTeams(tms || [])

        const teamIds = (tms || []).map(t => t.id)
        if (teamIds.length === 0) {
          setMembers([])
        } else {
          const { data: mems, error: memErr } = await supabase
            .from('user_profiles')
            .select('id, full_name, email, role, team_id, agency_role')
            .in('team_id', teamIds)
            .eq('is_active', true)
            .order('full_name')
          if (memErr) throw memErr
          if (cancelled) return
          setMembers(mems || [])
        }

        // Coordinator (one per collaborative — unique partial index guarantees ≤1)
        const { data: coordRow } = await supabase
          .from('collaborative_trainers')
          .select('user_profiles ( full_name, email )')
          .eq('collaborative_id', ev.collaborative_id)
          .eq('is_coordinator', true)
          .maybeSingle()
        if (!cancelled) {
          setCoordinatorEmail(coordRow?.user_profiles?.email || null)
          setCoordinatorName(coordRow?.user_profiles?.full_name || null)
        }
      } catch (err) {
        if (!cancelled) setError(err.message || String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [eventId])

  // 2. Attendance fetcher (initial + 30s polling + manual refresh button)
  const fetchAttendance = useCallback(async () => {
    setAttRefreshing(true)
    const { data, error: err } = await supabase
      .from('session_attendance')
      .select('user_profile_id, attendee_email, signed_in_at, signed_out_at')
      .eq('bsc_event_id', eventId)
    if (!err) setAttendance(data || [])
    setLastRefreshAt(new Date())
    setAttRefreshing(false)
  }, [eventId])

  useEffect(() => {
    fetchAttendance()
    const id = setInterval(fetchAttendance, ATTENDANCE_REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchAttendance])

  // 3. Documents
  const fetchDocuments = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('bsc_event_documents')
      .select('id, file_name, file_size, mime_type, storage_path, created_at, uploaded_by, user_profiles:uploaded_by ( full_name )')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
    if (!err) setDocuments(data || [])
  }, [eventId])

  useEffect(() => { fetchDocuments() }, [fetchDocuments])

  // 4. Evaluations (Phase 6 deep-dive)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error: err } = await supabase
        .from('session_evaluations')
        .select('trainer_effective, content_objective_alignment, applicable_to_work, practical_knowledge, methods_appropriate_audience, methods_appropriate_subject, recommend_score, most_helpful, improvements, additional_comments, submitted_at')
        .eq('bsc_event_id', eventId)
      if (!cancelled && !err) setEvaluations(data || [])
    })()
    return () => { cancelled = true }
  }, [eventId])

  // Likert item summary: { key, label, mean, n }
  const likertSummary = useMemo(() => {
    return LIKERT_ITEMS.map(item => {
      const vals = evaluations.map(e => e[item.key]).filter(v => v != null)
      return {
        key: item.key,
        label: item.label,
        n: vals.length,
        mean: vals.length === 0 ? 0 : vals.reduce((a, b) => a + b, 0) / vals.length,
      }
    })
  }, [evaluations])

  // NPS distribution: 0–10 buckets
  const npsDistribution = useMemo(() => {
    const buckets = Array.from({ length: 11 }, (_, i) => ({ score: i, count: 0 }))
    evaluations.forEach(e => {
      const s = e.recommend_score
      if (s != null && s >= 0 && s <= 10) buckets[s].count += 1
    })
    return buckets
  }, [evaluations])

  const npsScore = useMemo(() => {
    const scores = evaluations.map(e => e.recommend_score).filter(s => s != null)
    if (scores.length === 0) return null
    const promoters = scores.filter(s => s >= 9).length
    const detractors = scores.filter(s => s <= 6).length
    return Math.round(((promoters - detractors) / scores.length) * 100)
  }, [evaluations])

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setUploading(true)
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
      const storagePath = `${eventId}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('event-documents')
        .upload(storagePath, file, { contentType: file.type || 'application/octet-stream' })
      if (upErr) throw upErr

      const { error: insErr } = await supabase.from('bsc_event_documents').insert({
        event_id: eventId,
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: user?.id || null,
      })
      if (insErr) {
        // Roll back the storage object
        await supabase.storage.from('event-documents').remove([storagePath])
        throw insErr
      }
      await fetchDocuments()
    } catch (err) {
      setUploadError(err.message || String(err))
    } finally {
      setUploading(false)
      // Reset input so same file can be uploaded again if needed
      if (e.target) e.target.value = ''
    }
  }

  const handleDocumentDownload = async (doc) => {
    const { data, error: err } = await supabase.storage
      .from('event-documents')
      .createSignedUrl(doc.storage_path, 3600)
    if (err) { alert('Could not generate download link'); return }
    window.open(data.signedUrl, '_blank')
  }

  const handleDocumentDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return
    await supabase.storage.from('event-documents').remove([doc.storage_path])
    const { error: err } = await supabase.from('bsc_event_documents').delete().eq('id', doc.id)
    if (err) { alert('Error deleting document'); return }
    setDocuments(prev => prev.filter(d => d.id !== doc.id))
  }

  // Build attendance lookup: user_profile_id → row, OR fallback by lowercase email
  const attendanceByMember = useMemo(() => {
    const byProfile = new Map()
    const byEmail = new Map()
    attendance.forEach(a => {
      if (a.user_profile_id) byProfile.set(a.user_profile_id, a)
      if (a.attendee_email) byEmail.set(a.attendee_email.toLowerCase(), a)
    })
    return { byProfile, byEmail }
  }, [attendance])

  const isPresent = (member) => {
    const a = attendanceByMember.byProfile.get(member.id)
      || (member.email && attendanceByMember.byEmail.get(member.email.toLowerCase()))
    return Boolean(a?.signed_in_at)
  }

  // Group members by team
  const membersByTeam = useMemo(() => {
    const map = {}
    teams.forEach(t => { map[t.id] = { team: t, members: [] } })
    members.forEach(m => {
      if (map[m.team_id]) map[m.team_id].members.push(m)
    })
    return Object.values(map)
  }, [teams, members])

  const presentCount = members.filter(isPresent).length
  const absentCount = members.length - presentCount

  if (loading) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading event…</div>
    )
  }
  if (error || !event) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center' }}>
        <h2 style={{ color: COLORS.red }}>Event not found</h2>
        <p>{error}</p>
        <button onClick={() => navigate(-1)} style={{ padding: '0.5rem 1rem', background: COLORS.navy, color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Go Back</button>
      </div>
    )
  }

  const programMeta = PROGRAM_TYPE_COLORS[collaborative?.program_type] || { bg: '#e5e7eb', color: '#374151', label: collaborative?.program_type }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      {/* Header */}
      <div style={{ background: COLORS.navy, color: 'white', padding: '1rem 2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>← Back</button>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.4rem' }}>
                {event.title}
                <span style={{ background: programMeta.bg, color: programMeta.color, padding: '0.15rem 0.55rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600, marginLeft: '0.6rem', verticalAlign: 'middle' }}>{programMeta.label}</span>
              </h1>
              <p style={{ margin: '0.2rem 0 0', opacity: 0.85, fontSize: '0.85rem' }}>
                {fmtDate(event.event_date)}
                {event.start_time && <span> · {fmtTimeRange(event.start_time, event.end_time)}</span>}
                {event.location && <span> · {event.location}</span>}
                {collaborative?.name && <span> · {collaborative.name}</span>}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>

        {/* Attendance summary */}
        <div style={{ ...cardStyle, marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', flexGrow: 1 }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Roster</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-heading)' }}>{members.length}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Present</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: COLORS.green }}>{presentCount}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Absent</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-muted)' }}>{absentCount}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Last refresh: {lastRefreshAt ? lastRefreshAt.toLocaleTimeString() : '—'} (auto every 30s)
            </span>
            <button
              onClick={fetchAttendance}
              disabled={attRefreshing}
              style={{ background: COLORS.teal, color: 'white', border: 'none', padding: '0.4rem 0.85rem', borderRadius: '6px', cursor: attRefreshing ? 'wait' : 'pointer', fontSize: '0.85rem', fontWeight: 500 }}
            >
              {attRefreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <button
              onClick={() => setEmailModal({
                recipientsType: 'all',
                defaultSubject: `${event.title} — ${collaborative?.name || ''}`.trim().replace(/—\s*$/, '').trim(),
              })}
              style={{ background: COLORS.navy, color: 'white', border: 'none', padding: '0.4rem 0.85rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}
            >
              ✉ Email all participants
            </button>
          </div>
        </div>

        {/* Session Materials */}
        <section style={{ ...cardStyle, marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-heading)' }}>Session Materials</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {documents.length === 0 ? 'No documents uploaded yet.' : `${documents.length} document${documents.length === 1 ? '' : 's'}`}
              </div>
            </div>
            {canAdminCollaborative(event?.collaborative_id) && (
              <label style={{ background: COLORS.teal, color: 'white', padding: '0.45rem 0.9rem', borderRadius: '6px', cursor: uploading ? 'wait' : 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>
                {uploading ? 'Uploading…' : '+ Upload document'}
                <input type="file" onChange={handleUpload} disabled={uploading} style={{ display: 'none' }} />
              </label>
            )}
          </div>
          {uploadError && (
            <div style={{ background: '#fef2f2', color: '#991b1b', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
              Upload failed: {uploadError}
            </div>
          )}
          {documents.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {documents.map(d => (
                <li key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.5rem 0', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: '1.1rem' }}>📄</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.file_name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {fmtBytes(d.file_size)}
                        {d.user_profiles?.full_name && <span> · uploaded by {d.user_profiles.full_name}</span>}
                        {d.created_at && <span> · {new Date(d.created_at).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      onClick={() => handleDocumentDownload(d)}
                      style={{ background: COLORS.navy, color: 'white', border: 'none', padding: '0.3rem 0.7rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem' }}
                    >Download</button>
                    {canAdminCollaborative(event?.collaborative_id) && (
                      <button
                        onClick={() => handleDocumentDelete(d)}
                        style={{ background: 'transparent', color: COLORS.red, border: `1px solid ${COLORS.red}`, padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem' }}
                      >Delete</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Per-team roster */}
        {membersByTeam.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--text-muted)' }}>
            No teams in this collaborative yet.
          </div>
        ) : (
          membersByTeam.map(({ team, members: tm }) => {
            const teamPresent = tm.filter(isPresent).length
            const hasEmails = tm.some(m => m.email)

            return (
              <section key={team.id} style={{ ...cardStyle, marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                      {team.team_name || team.agency_name}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {team.agency_name}
                      {tm.length > 0 && (
                        <span> · <strong style={{ color: COLORS.green }}>{teamPresent}</strong> / {tm.length} present</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      onClick={() => navigate(`/admin/team-report/${team.id}`)}
                      style={{ background: 'transparent', color: COLORS.navy, border: `1px solid ${COLORS.navy}`, padding: '0.35rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                    >View team dashboard</button>
                    {hasEmails ? (
                      <button
                        onClick={() => setEmailModal({
                          recipientsType: 'team',
                          teamId: team.id,
                          teamName: team.team_name || team.agency_name,
                          defaultSubject: `${event.title} — ${team.team_name || team.agency_name}`,
                        })}
                        style={{ background: COLORS.teal, color: 'white', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                      >Email team</button>
                    ) : (
                      <span style={{ color: 'var(--text-faint)', fontSize: '0.8rem' }}>(no emails)</span>
                    )}
                  </div>
                </div>

                {tm.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No members on this team yet.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-card-alt)' }}>
                          <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem', width: '3rem' }}>Status</th>
                          <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Name</th>
                          <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Email</th>
                          <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Role</th>
                          <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Agency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tm.map(m => {
                          const present = isPresent(m)
                          return (
                            <tr key={m.id} style={{
                              borderBottom: '1px solid var(--border)',
                              opacity: present ? 1 : 0.55,
                            }}>
                              <td style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>
                                {present ? (
                                  <span title="Signed in" style={{ color: COLORS.green, fontSize: '1.1rem', fontWeight: 700 }}>✓</span>
                                ) : (
                                  <span title="Absent" style={{ color: 'var(--text-faint)', fontSize: '1.1rem', fontWeight: 700 }}>✕</span>
                                )}
                              </td>
                              <td style={{ padding: '0.4rem 0.5rem', fontWeight: 500 }}>{m.full_name}</td>
                              <td style={{ padding: '0.4rem 0.5rem' }}>
                                {m.email ? (
                                  <a href={`mailto:${m.email}`} style={{ color: COLORS.navy, textDecoration: 'none' }}>{m.email}</a>
                                ) : '—'}
                              </td>
                              <td style={{ padding: '0.4rem 0.5rem', color: 'var(--text-muted)' }}>{ROLE_LABEL[m.role] || m.role}</td>
                              <td style={{ padding: '0.4rem 0.5rem', color: 'var(--text-muted)' }}>{team.agency_name}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )
          })
        )}

        {/* Evaluations deep-dive (Phase 6) */}
        {evaluations.length > 0 && (
          <section style={{ ...cardStyle, marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-heading)' }}>Evaluation Results</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {evaluations.length} response{evaluations.length === 1 ? '' : 's'} submitted
                </div>
              </div>
              <button
                onClick={() => exportEvaluationReportPdf([{
                  event_date: event.event_date,
                  title: event.title,
                  evaluations,
                }])}
                style={{ background: COLORS.teal, color: 'white', border: 'none', padding: '0.4rem 0.85rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}
              >Download PDF report</button>
            </div>

            {/* Likert mean scores */}
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '0.4rem' }}>
                Mean rating per item (1 = strongly disagree, 5 = strongly agree)
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={likertSummary}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 130, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={130} />
                  <Tooltip formatter={(v) => v.toFixed(2)} />
                  <Bar dataKey="mean" fill={COLORS.teal} radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="mean" position="right" formatter={(v) => v.toFixed(2)} style={{ fontSize: 11, fill: '#374151' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* NPS distribution */}
            {evaluations.some(e => e.recommend_score != null) && (
              <div style={{ marginTop: '1.25rem' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '0.4rem' }}>
                  Recommend score distribution
                  {npsScore != null && (
                    <span style={{ marginLeft: '0.75rem', fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      Net Promoter Score: <strong style={{ color: npsScore >= 0 ? COLORS.green : COLORS.red }}>{npsScore}</strong>
                    </span>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={npsDistribution} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="score" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {npsDistribution.map((d) => (
                        <Cell key={d.score} fill={NPS_COLOR(d.score)} />
                      ))}
                      <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: '#374151' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  <span>🟥 0–6 detractors</span>
                  <span>🟧 7–8 passives</span>
                  <span>🟩 9–10 promoters</span>
                </div>
              </div>
            )}

            {/* Free-text responses (collapsed by default) */}
            <FreeTextBlock heading="What part of the training was most helpful?" responses={evaluations.map(e => e.most_helpful)} />
            <FreeTextBlock heading="What changes would you make to improve this training?" responses={evaluations.map(e => e.improvements)} />
            <FreeTextBlock heading="Additional comments" responses={evaluations.map(e => e.additional_comments)} />
          </section>
        )}

        {/* Message Coordinator */}
        <section style={{ ...cardStyle, marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-heading)' }}>Coordinator</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {coordinatorEmail
                  ? <>The named contact for this collaborative is <strong>{coordinatorName}</strong> ({coordinatorEmail}).</>
                  : 'No coordinator assigned to this collaborative yet.'}
              </div>
            </div>
            {coordinatorEmail && (
              <button
                onClick={() => setEmailModal({
                  recipientsType: 'coordinator',
                  defaultSubject: `Question about ${event.title}`,
                })}
                style={{ background: COLORS.navy, color: 'white', border: 'none', padding: '0.4rem 0.85rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
              >Message coordinator</button>
            )}
          </div>
        </section>
      </div>

      {emailModal && (
        <EmailComposerModal
          mode={emailModal}
          eventId={eventId}
          onClose={() => setEmailModal(null)}
        />
      )}
    </div>
  )
}

// Collapsible verbatim free-text responses (collapsed by default)
function FreeTextBlock({ heading, responses }) {
  const [open, setOpen] = useState(false)
  const filtered = (responses || []).filter(r => r && String(r).trim().length > 0)
  if (filtered.length === 0) return null
  return (
    <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.9rem', fontWeight: 600, color: COLORS.navy, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
      >
        <span style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▶</span>
        {heading}
        <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8rem' }}>({filtered.length})</span>
      </button>
      {open && (
        <ul style={{ listStyle: 'disc', paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
          {filtered.map((text, i) => (
            <li key={i} style={{ fontSize: '0.85rem', color: 'var(--text-body)', marginBottom: '0.4rem', whiteSpace: 'pre-wrap' }}>{text}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Composer modal: subject + body, sends via the send-event-email edge function.
// `mode` shape: { recipientsType: 'all'|'team'|'coordinator', teamId?, teamName?, defaultSubject? }
function EmailComposerModal({ mode, eventId, onClose }) {
  const [subject, setSubject] = useState(mode.defaultSubject || '')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const recipientLabel = mode.recipientsType === 'all'
    ? 'All event participants'
    : mode.recipientsType === 'team'
      ? `Team: ${mode.teamName}`
      : 'Collaborative coordinator'

  const send = async () => {
    if (!subject.trim() || !body.trim()) {
      setError('Subject and body are required.')
      return
    }
    setSending(true); setError(null); setSuccess(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-event-email`
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_id: eventId,
          recipients_type: mode.recipientsType,
          team_id: mode.teamId || null,
          subject: subject.trim(),
          body: body.trim(),
        }),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(json.error || `Email send failed (HTTP ${resp.status})`)

      setSuccess(`Sent to ${json.recipient_count} recipient${json.recipient_count === 1 ? '' : 's'}.`)
      setBody('')
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-card)', borderRadius: '0.75rem', padding: '1.5rem', maxWidth: '640px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: 'var(--text-heading)' }}>Send email</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
        </div>

        <div style={{ background: 'var(--bg-card-alt, #f9fafb)', padding: '0.5rem 0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
          <strong>To:</strong> {recipientLabel}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Recipients will be BCC'd. Replies go directly to your email.
          </div>
        </div>

        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '0.25rem' }}>Subject</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={sending}
          style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '0.75rem', background: 'var(--bg-card)', color: 'var(--text-body)', fontSize: '0.9rem', boxSizing: 'border-box' }}
        />

        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '0.25rem' }}>Message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={sending}
          rows={10}
          style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-body)', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
        />

        {error && (
          <div style={{ background: '#fef2f2', color: '#991b1b', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', marginTop: '0.75rem' }}>{error}</div>
        )}
        {success && (
          <div style={{ background: '#ecfdf5', color: '#065f46', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', marginTop: '0.75rem' }}>{success}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            onClick={onClose}
            disabled={sending}
            style={{ background: 'transparent', color: 'var(--text-body)', border: '1px solid var(--border)', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}
          >Close</button>
          <button
            onClick={send}
            disabled={sending}
            style={{ background: COLORS.navy, color: 'white', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '6px', cursor: sending ? 'wait' : 'pointer', fontSize: '0.9rem', fontWeight: 600 }}
          >{sending ? 'Sending…' : 'Send'}</button>
        </div>
      </div>
    </div>
  )
}
