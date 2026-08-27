import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../utils/supabase'
import { downloadRowsAsExcel, formatEt } from '../utils/exportAttendance'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'

// Learning Collaborative Roster — TIPE's replacement for Teams / Team Rosters
// (tipe_lc has no team layer and its participants have no accounts).
//
// Sourced from REGISTRATIONS, not user_profiles: event_registrations joined
// through this collaborative's registration links, excluding cancelled. The
// live sign-in status joins session_attendance on lowercased+trimmed email
// with `=` on normalized values — never ilike (`_`/`%` are LIKE wildcards; the
// same bug was fixed twice already in mint-registration and SessionSignIn).
// Read-only by design.

const norm = (e) => String(e || '').trim().toLowerCase()

// Events that carry sign-in tracking (same set CollaborativeDetail uses).
const SIGNIN_TYPES = ['learning_session', 'all_team_call', 'senior_leader_call']

// Current-session rule, same as the hub: during an event's window that event;
// otherwise the next upcoming; otherwise the most recent past.
function pickDefaultEvent(events) {
  const now = new Date()
  const withTimes = events.map(e => ({
    e,
    start: new Date(`${e.event_date}T${e.start_time || '00:00:00'}`),
    end: new Date(`${e.event_date}T${e.end_time || '23:59:59'}`),
  }))
  const inWindow = withTimes.find(x => x.start <= now && now <= x.end)
  if (inWindow) return inWindow.e
  const upcoming = withTimes.filter(x => x.start > now).sort((a, b) => a.start - b.start)
  if (upcoming.length > 0) return upcoming[0].e
  return events[events.length - 1] || null
}

const GROUPINGS = [
  { value: 'district', label: 'District' },
  { value: 'school', label: 'School' },
  { value: 'name', label: 'Name' },
]

export default function LearningCollaborativeRoster({ collaborativeId, events }) {
  const [roster, setRoster] = useState([])          // [{ name, email, district, school, position }]
  const [loading, setLoading] = useState(true)
  const [groupBy, setGroupBy] = useState('district')

  const signinEvents = useMemo(
    () => (events || []).filter(e => SIGNIN_TYPES.includes(e.event_type)),
    [events]
  )
  const [selectedEventId, setSelectedEventId] = useState(null)
  const [attendance, setAttendance] = useState([])

  // Default the session selector once events arrive.
  useEffect(() => {
    if (!selectedEventId && signinEvents.length > 0) {
      const def = pickDefaultEvent(signinEvents)
      if (def) setSelectedEventId(def.id)
    }
  }, [signinEvents, selectedEventId])

  // --- Roster from registrations (deduped by email — one person can only
  // hold one seat even if two links ever cover the same cohort) ---
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data: links } = await supabase
        .from('event_registration_links')
        .select('id')
        .eq('collaborative_id', collaborativeId)
      const linkIds = (links || []).map(l => l.id)
      if (linkIds.length === 0) { if (!cancelled) { setRoster([]); setLoading(false) } return }

      const { data: regs } = await supabase
        .from('event_registrations')
        .select('id, full_name, email, responses, status, registered_at')
        .in('registration_link_id', linkIds)
        .neq('status', 'cancelled')
        .order('registered_at')
      if (cancelled) return

      const seen = new Set()
      const rows = []
      ;(regs || []).forEach(r => {
        const key = norm(r.email)
        if (key && seen.has(key)) return
        seen.add(key)
        const resp = r.responses || {}
        rows.push({
          name: r.full_name || '',
          email: r.email || '',
          // Tolerate missing keys — the three earliest registrants answered
          // under the old combined "School or District" label, so their
          // district holds mixed values and school is blank. Shown exactly as
          // submitted; never parsed or "corrected".
          district: typeof resp.agency === 'string' ? resp.agency.trim() : '',
          school: typeof resp.school === 'string' ? resp.school.trim() : '',
          position: typeof resp.role === 'string' ? resp.role.trim() : '',
          status: r.status,
        })
      })
      setRoster(rows)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [collaborativeId])

  // --- Live attendance for the selected session (Realtime + 30s fallback,
  // the 56745fa pattern) ---
  const fetchAttendance = useCallback(async () => {
    if (!selectedEventId) { setAttendance([]); return }
    const { data } = await supabase
      .from('session_attendance')
      .select('id, attendee_name, attendee_email, attendee_agency, attendee_role, signed_in_at, signed_out_at')
      .eq('bsc_event_id', selectedEventId)
    setAttendance(data || [])
  }, [selectedEventId])

  useEffect(() => {
    fetchAttendance()
    if (!selectedEventId) return undefined
    const channel = supabase
      .channel(`lc_roster_attendance:${selectedEventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_attendance', filter: `bsc_event_id=eq.${selectedEventId}` },
        () => fetchAttendance()
      )
      .subscribe()
    const id = setInterval(fetchAttendance, 30000)
    return () => {
      clearInterval(id)
      supabase.removeChannel(channel)
    }
  }, [fetchAttendance, selectedEventId])

  // Latest attendance row per normalized email (repeat sign-ins keep the most
  // recent, mirroring sign_out_by_email's "most recent sign-in" rule).
  const attendanceByEmail = useMemo(() => {
    const map = new Map()
    attendance.forEach(a => {
      const key = norm(a.attendee_email)
      if (!key) return
      const prev = map.get(key)
      if (!prev || (a.signed_in_at || '') > (prev.signed_in_at || '')) map.set(key, a)
    })
    return map
  }, [attendance])

  const rosterEmails = useMemo(() => new Set(roster.map(r => norm(r.email)).filter(Boolean)), [roster])

  // Walk-ins: signed in but not on the registration roster. Shown separately —
  // never silently dropped, never merged into the main list.
  const walkIns = useMemo(() => {
    const seen = new Set()
    return attendance.filter(a => {
      const key = norm(a.attendee_email)
      if (!key || rosterEmails.has(key) || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [attendance, rosterEmails])

  const signedInCount = roster.filter(r => attendanceByEmail.has(norm(r.email))).length
  const signedOutCount = roster.filter(r => attendanceByEmail.get(norm(r.email))?.signed_out_at).length

  // Grouping (switchable): district (school, name secondary), school, or a
  // flat name sort.
  const groups = useMemo(() => {
    const byName = (a, b) => a.name.localeCompare(b.name)
    if (groupBy === 'name') {
      return [{ label: null, rows: roster.slice().sort(byName) }]
    }
    const keyOf = r => (groupBy === 'district' ? r.district : r.school) || '(not provided)'
    const map = new Map()
    roster.forEach(r => {
      const k = keyOf(r)
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(r)
    })
    return [...map.entries()]
      .sort((a, b) => {
        // Real values first, "(not provided)" last.
        if (a[0] === '(not provided)') return 1
        if (b[0] === '(not provided)') return -1
        return a[0].localeCompare(b[0])
      })
      .map(([label, rows]) => ({
        label,
        rows: rows.sort((a, b) =>
          groupBy === 'district'
            ? (a.school.localeCompare(b.school) || byName(a, b))
            : byName(a, b)
        ),
      }))
  }, [roster, groupBy])

  const selectedEvent = signinEvents.find(e => e.id === selectedEventId) || null

  const statusOf = (r) => {
    const a = attendanceByEmail.get(norm(r.email))
    if (!a) return { label: 'Not signed in', color: '#9ca3af', icon: '—' }
    if (a.signed_out_at) return { label: `Signed out ${timeOnly(a.signed_out_at)}`, color: '#6b7280', icon: '⏻' }
    return { label: `Signed in ${timeOnly(a.signed_in_at)}`, color: '#16a34a', icon: '✓' }
  }

  const exportRoster = () => {
    const rows = groups.flatMap(g => g.rows).map(r => {
      const a = attendanceByEmail.get(norm(r.email))
      return {
        Name: r.name,
        District: r.district,
        School: r.school,
        'Position/Title': r.position,
        Email: r.email,
        Status: r.status === 'waitlisted' ? 'Waitlisted' : 'Registered',
        'Sign-In Status': !a ? 'Not signed in' : a.signed_out_at ? 'Signed out' : 'Signed in',
        'Signed In': a ? formatEt(a.signed_in_at) : '',
      }
    })
    downloadRowsAsExcel(rows, {
      fileStem: `LC_Roster_${selectedEvent ? selectedEvent.event_date : ''}`,
      sheetName: 'Roster',
      widths: { Name: 26, District: 22, School: 24, 'Position/Title': 22, Email: 30, Status: 12, 'Sign-In Status': 14, 'Signed In': 22 },
    })
  }

  return (
    <div style={{
      background: 'white', borderRadius: '12px', padding: '2rem',
      marginBottom: '2rem', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: NAVY, margin: 0 }}>
            👥 Learning Collaborative Roster
          </h3>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.25rem' }}>
            {roster.length} registrant{roster.length === 1 ? '' : 's'} (from the registration links, cancelled excluded) · read-only
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 600 }}>
            Group by{' '}
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}
              style={{ padding: '0.35rem 0.5rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.8rem' }}>
              {GROUPINGS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </label>
          {roster.length > 0 && (
            <button onClick={exportRoster} style={{
              background: TEAL, color: 'white', border: 'none', padding: '0.45rem 0.9rem',
              borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
            }}>Download Excel</button>
          )}
        </div>
      </div>

      {/* Session selector + live summary */}
      {signinEvents.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
          background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px',
          padding: '0.6rem 0.85rem', marginBottom: '0.75rem',
        }}>
          <label style={{ fontSize: '0.82rem', color: '#374151', fontWeight: 600 }}>
            Sign-in status for{' '}
            <select
              value={selectedEventId || ''}
              onChange={(e) => setSelectedEventId(e.target.value)}
              style={{ padding: '0.35rem 0.5rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.8rem', maxWidth: '280px' }}
            >
              {signinEvents.map(e => (
                <option key={e.id} value={e.id}>{e.title} · {e.event_date}</option>
              ))}
            </select>
          </label>
          <span style={{ fontSize: '0.85rem', color: NAVY, fontWeight: 700 }}>
            {signedInCount} of {roster.length} signed in
          </span>
          {signedOutCount > 0 && (
            <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{signedOutCount} signed out</span>
          )}
          <span title="Live via Supabase Realtime — also resyncs every 30s as a safety net" style={{ fontSize: '0.72rem', color: '#16a34a' }}>● live</span>
        </div>
      )}

      {/* Data-quality caveat — stated, not hidden. Values shown as submitted. */}
      <div style={{ fontSize: '0.75rem', color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '6px', padding: '0.45rem 0.7rem', marginBottom: '0.9rem' }}>
        The earliest registrants answered a combined "School or District" question, so a few District values
        are mixed and their School is blank. Answers are shown exactly as submitted.
      </div>

      {loading ? (
        <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>Loading roster…</div>
      ) : roster.length === 0 ? (
        <div style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
          Nobody has registered yet — the roster fills in as registrations come through the registration links.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {groups.map((g, gi) => (
            <div key={g.label ?? gi}>
              {g.label != null && (
                <div style={{
                  fontSize: '0.8rem', fontWeight: 700, color: NAVY,
                  borderBottom: '2px solid #e5e7eb', padding: '0.25rem 0', marginBottom: '0.25rem',
                }}>
                  {g.label} <span style={{ color: '#9ca3af', fontWeight: 400 }}>({g.rows.length})</span>
                </div>
              )}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                  <tbody>
                    {g.rows.map(r => {
                      const st = statusOf(r)
                      return (
                        <tr key={r.email || r.name} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '0.35rem 0.5rem', width: '1.6rem', textAlign: 'center' }}>
                            <span title={st.label} style={{ color: st.color, fontWeight: 700 }}>{st.icon}</span>
                          </td>
                          <td style={{ padding: '0.35rem 0.5rem' }}>
                            <div style={{ fontWeight: 600, color: '#1f2937' }}>
                              {r.name}
                              {r.status === 'waitlisted' && (
                                <span style={{ marginLeft: '0.4rem', background: '#fef3c7', color: '#92400e', padding: '0.05rem 0.4rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700 }}>waitlist</span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{r.email}</div>
                          </td>
                          <td style={{ padding: '0.35rem 0.5rem', color: '#374151' }}>{groupBy === 'district' ? (r.school || '—') : (r.district || '—')}</td>
                          <td style={{ padding: '0.35rem 0.5rem', color: '#6b7280' }}>{r.position || '—'}</td>
                          <td style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', color: st.color, whiteSpace: 'nowrap' }}>{st.label}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Walk-ins: signed in but not on the roster */}
          {walkIns.length > 0 && (
            <div>
              <div style={{
                fontSize: '0.8rem', fontWeight: 700, color: '#92400E',
                borderBottom: '2px solid #FDE68A', padding: '0.25rem 0', marginBottom: '0.25rem',
              }}>
                Signed in but not registered <span style={{ color: '#b45309', fontWeight: 400 }}>({walkIns.length})</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                  <tbody>
                    {walkIns.map(a => (
                      <tr key={a.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.35rem 0.5rem', width: '1.6rem', textAlign: 'center' }}>
                          <span style={{ color: a.signed_out_at ? '#6b7280' : '#16a34a', fontWeight: 700 }}>{a.signed_out_at ? '⏻' : '✓'}</span>
                        </td>
                        <td style={{ padding: '0.35rem 0.5rem' }}>
                          <div style={{ fontWeight: 600, color: '#1f2937' }}>{a.attendee_name || '—'}</div>
                          <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{a.attendee_email}</div>
                        </td>
                        <td style={{ padding: '0.35rem 0.5rem', color: '#374151' }}>{a.attendee_agency || '—'}</td>
                        <td style={{ padding: '0.35rem 0.5rem', color: '#6b7280' }}>{a.attendee_role || '—'}</td>
                        <td style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                          {a.signed_out_at ? `Signed out ${timeOnly(a.signed_out_at)}` : `Signed in ${timeOnly(a.signed_in_at)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function timeOnly(ts) {
  if (!ts) return ''
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit',
  }).format(new Date(ts)) + ' ET'
}
