import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import { COLORS, cardStyle, cardHeaderStyle } from '../utils/constants'
import { buildLcAttendance, eventHours, fmtHours } from '../utils/ceu'

// CEU roster for one learning collaborative.
// 2026-06-10 course-correction: the app no longer generates certificates —
// it computes WHO qualifies (strict credit rule, see utils/ceu.js) and
// exports an Excel roster that the desktop Training Manager tool consumes
// to issue uneditable PDF certificates locally.
//
// Three steps: Configure (mark CEU-eligible sessions), Review
// (per-participant hours with manual overrides), Export (.xlsx roster).
export default function CeuManager() {
  const { collaborativeId } = useParams()
  const navigate = useNavigate()
  const { canAdminCollaborative } = useAuth()

  const [loading, setLoading] = useState(true)
  const [collaborative, setCollaborative] = useState(null)
  const [events, setEvents] = useState([])
  const [attendanceRows, setAttendanceRows] = useState([])
  const [excluded, setExcluded] = useState(new Set())        // emails excluded from the roster
  const [overrides, setOverrides] = useState(new Set())      // `${email}|${eventId}` force-counted
  const [expandedEmail, setExpandedEmail] = useState(null)

  const load = async () => {
    setLoading(true)
    const { data: collab } = await supabase
      .from('collaboratives').select('id, name').eq('id', collaborativeId).maybeSingle()
    setCollaborative(collab || null)

    const { data: evts } = await supabase
      .from('bsc_events')
      .select('id, title, event_date, start_time, end_time, event_type, ceu_eligible')
      .eq('collaborative_id', collaborativeId)
      .order('event_date', { ascending: true })
    setEvents(evts || [])

    const eligibleIds = (evts || []).filter(e => e.ceu_eligible).map(e => e.id)
    if (eligibleIds.length > 0) {
      const { data: att } = await supabase
        .from('session_attendance')
        .select('bsc_event_id, attendee_name, attendee_email, signed_in_at, evaluation_completed_at, sign_out_method')
        .in('bsc_event_id', eligibleIds)
      setAttendanceRows(att || [])
    } else {
      setAttendanceRows([])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [collaborativeId])

  const eligibleEvents = useMemo(
    () => events.filter(e => e.ceu_eligible && e.start_time && e.end_time),
    [events]
  )

  // Base computation + manual overrides applied on top.
  const participants = useMemo(() => {
    const base = buildLcAttendance(eligibleEvents, attendanceRows)
    return base.map(p => {
      let hoursAwarded = 0
      const sessionData = p.sessionData.map(s => {
        const forced = overrides.has(`${p.email}|${s.eventId}`)
        const effective = s.counted || forced
        if (effective) hoursAwarded += s.hours
        return { ...s, forced, effective }
      })
      return { ...p, sessionData, hoursAwarded }
    })
  }, [eligibleEvents, attendanceRows, overrides])

  const included = participants.filter(p => !excluded.has(p.email) && p.hoursAwarded > 0)
  const hoursTotal = eligibleEvents.reduce((sum, e) => sum + eventHours(e), 0)

  const toggleEligible = async (evt) => {
    const next = !evt.ceu_eligible
    if (next && (!evt.start_time || !evt.end_time)) {
      alert('CEU-eligible sessions need both a start and end time (hours are computed from the schedule). Set times on the collaborative page first.')
      return
    }
    const { error } = await supabase.from('bsc_events').update({ ceu_eligible: next }).eq('id', evt.id)
    if (error) { alert('Could not update: ' + error.message); return }
    await load()
  }

  // Export the qualifying + included participants as the roster the desktop
  // Training Manager tool consumes. Columns are exactly the ones its
  // "Import precomputed roster" mode expects — hours come from the computed
  // values here and are used verbatim downstream (no recompute).
  const exportRoster = () => {
    if (included.length === 0) { alert('No participants with awarded hours to export.'); return }
    const rows = included.map(p => ({
      'Name': p.name,
      'Email': p.email,
      'Hours Attended': Number(fmtHours(p.hoursAwarded)),
      'Hours Total': Number(fmtHours(hoursTotal)),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 28 }, { wch: 32 }, { wch: 14 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Roster')
    const safeName = (collaborative?.name || 'Collaborative').replace(/[\\/:*?"<>|]/g, '')
    XLSX.writeFile(wb, `LC Certificate Report - ${safeName}.xlsx`)
  }

  if (!canAdminCollaborative(collaborativeId)) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Only admins of this collaborative can manage CEU rosters.
      </div>
    )
  }
  if (loading) return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      <div style={{ background: COLORS.navy, color: 'white', padding: '1rem 2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button onClick={() => navigate(`/admin/collaboratives/${collaborativeId}`)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>← Back</button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem' }}>🎓 CEU Roster</h1>
            <div style={{ fontSize: '0.85rem', opacity: 0.85 }}>{collaborative?.name}</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>

        {/* Step 1 — Configure eligible sessions */}
        <section style={{ ...cardStyle, marginBottom: '1.5rem' }}>
          <div style={cardHeaderStyle}>1 · CEU-eligible sessions</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Hours auto-compute from each session's scheduled start/end time. Sessions without both times can't be eligible.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {events.map(evt => {
              const hrs = eventHours(evt)
              const hasTimes = evt.start_time && evt.end_time
              return (
                <label key={evt.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', padding: '0.35rem 0.5rem', borderRadius: '4px', background: evt.ceu_eligible ? '#ecfdf5' : 'transparent', cursor: hasTimes ? 'pointer' : 'not-allowed', opacity: hasTimes ? 1 : 0.55 }}>
                  <input type="checkbox" checked={evt.ceu_eligible} disabled={!hasTimes && !evt.ceu_eligible} onChange={() => toggleEligible(evt)} />
                  <span style={{ flex: 1 }}>
                    <strong>{evt.title}</strong> · {evt.event_date}
                    {hasTimes ? ` · ${fmtHours(hrs)} hr${hrs === 1 ? '' : 's'}` : ' · (no start/end time)'}
                  </span>
                </label>
              )
            })}
          </div>
          <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
            Total possible hours: <strong>{fmtHours(hoursTotal)}</strong> across {eligibleEvents.length} session{eligibleEvents.length === 1 ? '' : 's'}
          </div>
        </section>

        {/* Step 2 — Review */}
        <section style={{ ...cardStyle, marginBottom: '1.5rem' }}>
          <div style={cardHeaderStyle}>
            2 · Review participants
            <span style={{ fontWeight: 400, fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
              credit per session = sign-in + completed evaluation + explicit sign-out
            </span>
          </div>
          {participants.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No attendance on CEU-eligible sessions yet. Mark sessions eligible in step 1.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.5rem' }}>
              {participants.map(p => {
                const isExcluded = excluded.has(p.email)
                const isOpen = expandedEmail === p.email
                const zero = p.hoursAwarded === 0
                return (
                  <div key={p.email} style={{ border: '1px solid var(--border-light)', borderLeft: `4px solid ${isExcluded ? '#9ca3af' : zero ? '#ef4444' : p.hoursAwarded < hoursTotal ? '#f59e0b' : '#16a34a'}`, borderRadius: '6px', background: 'var(--bg-card)', opacity: isExcluded ? 0.55 : 1 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0.75rem', alignItems: 'center', padding: '0.5rem 0.75rem' }}>
                      <button onClick={() => setExpandedEmail(isOpen ? null : p.email)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-body)' }}>{p.name} <span style={{ color: COLORS.teal }}>{isOpen ? '▾' : '▸'}</span></div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.email}</div>
                      </button>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: zero ? '#ef4444' : 'var(--text-body)' }}>
                        {fmtHours(p.hoursAwarded)} / {fmtHours(hoursTotal)} hrs
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {p.sessionData.filter(s => s.effective).length}/{p.sessionData.length} sessions
                      </span>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={!isExcluded}
                          onChange={() => setExcluded(prev => {
                            const next = new Set(prev)
                            if (next.has(p.email)) next.delete(p.email); else next.add(p.email)
                            return next
                          })}
                        /> include
                      </label>
                    </div>
                    {isOpen && (
                      <div style={{ padding: '0 0.75rem 0.75rem' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-card-alt)', borderBottom: '1px solid var(--border)' }}>
                              <th style={thMini}>Session</th>
                              <th style={thMini}>Hours</th>
                              <th style={thMini}>Signed in</th>
                              <th style={thMini}>Eval</th>
                              <th style={thMini}>Signed out</th>
                              <th style={thMini}>Credited</th>
                              <th style={thMini}>Manual override</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.sessionData.map(s => (
                              <tr key={s.eventId} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={tdMini}>{s.title} · {s.date}</td>
                                <td style={tdMini}>{fmtHours(s.hours)}</td>
                                <td style={{ ...tdMini, textAlign: 'center' }}>{s.signedIn ? '✓' : '—'}</td>
                                <td style={{ ...tdMini, textAlign: 'center' }}>{s.evalCompleted ? '✓' : '—'}</td>
                                <td style={{ ...tdMini, textAlign: 'center' }}>{s.signedOut ? '✓' : '—'}</td>
                                <td style={{ ...tdMini, textAlign: 'center', fontWeight: 700, color: s.effective ? '#16a34a' : '#ef4444' }}>{s.effective ? 'yes' : 'no'}</td>
                                <td style={{ ...tdMini, textAlign: 'center' }}>
                                  {!s.counted && (
                                    <label style={{ fontSize: '0.72rem', cursor: 'pointer' }}>
                                      <input
                                        type="checkbox"
                                        checked={s.forced}
                                        onChange={() => setOverrides(prev => {
                                          const key = `${p.email}|${s.eventId}`
                                          const next = new Set(prev)
                                          if (next.has(key)) next.delete(key); else next.add(key)
                                          return next
                                        })}
                                      /> count it
                                    </label>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Step 3 — Export */}
        <section style={{ ...cardStyle, marginBottom: '1.5rem' }}>
          <div style={cardHeaderStyle}>3 · Export roster</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <strong>{included.length}</strong> participant{included.length === 1 ? '' : 's'} will be exported
            (included + at least one credited session). Open the .xlsx in the desktop <strong>Training Manager</strong> tool
            ("Import precomputed roster" on the LC tab) to generate and email the PDF certificates.
          </p>
          <button onClick={exportRoster} disabled={included.length === 0} style={{ background: COLORS.navy, color: 'white', border: 'none', padding: '0.55rem 1.25rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', opacity: included.length === 0 ? 0.5 : 1 }}>
            ⬇ Export roster (.xlsx)
          </button>
        </section>
      </div>
    </div>
  )
}

const thMini = { textAlign: 'left', padding: '0.3rem 0.4rem', fontWeight: 700 }
const tdMini = { padding: '0.3rem 0.4rem' }
