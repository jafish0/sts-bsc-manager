// CEU credit computation — ported from the desktop tool
// `Training Manager/TrainingEventManager.py` (build_lc_attendance).
//
// 2026-06-10 course-correction: the app computes WHO qualifies and their
// hours, then exports an Excel roster (Name / Email / Hours Attended /
// Hours Total). Certificate generation + emailing happens in the desktop
// Training Manager tool, which produces uneditable PDFs locally via Word
// (docx2pdf) at zero cost. The docx merge engine, approval-text constants,
// and email grid that briefly lived here (commit 886245a) now belong to the
// desktop tool exclusively.
//
// Credit rule (locked with Josh): a participant earns a session only when
// their attendance row has all three of:
//   signed_in_at                 (they signed in)
//   evaluation_completed_at      (they completed the evaluation)
//   sign_out_method = 'manual'   (they reached the explicit final sign-out)
// 'evaluation' (eval but no final sign-out) and 'session_closed'
// (auto-close cron / admin "Close now") do NOT earn credit. The review
// screen allows per-session manual overrides for verified exceptions.

// Format a number the way the desktop tool does (f"{float(n):g}" — no
// trailing zeros: 6.0 → "6", 1.5 → "1.5").
export const fmtHours = (n) => String(parseFloat(Number(n).toPrecision(12)))

// Hours for one event from its schedule. Eligible sessions must have both times.
export function eventHours(evt) {
  if (!evt.start_time || !evt.end_time) return 0
  const [sh, sm] = evt.start_time.split(':').map(Number)
  const [eh, em] = evt.end_time.split(':').map(Number)
  const minutes = (eh * 60 + em) - (sh * 60 + sm)
  return minutes > 0 ? minutes / 60 : 0
}

// Human date range across sessions, like _lc_date_range: "11/12/2025 – 3/17/2026"
export function dateRange(events) {
  const ds = events.map(e => e.event_date).filter(Boolean).sort()
  if (ds.length === 0) return ''
  const fmt = (s) => {
    const d = new Date(s + 'T00:00:00')
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
  }
  return ds.length === 1 || ds[0] === ds[ds.length - 1]
    ? fmt(ds[0])
    : `${fmt(ds[0])} – ${fmt(ds[ds.length - 1])}`
}

// Per-session credit rule — see header comment.
export function sessionCounted(attendanceRow) {
  return Boolean(
    attendanceRow &&
    attendanceRow.signed_in_at &&
    attendanceRow.evaluation_completed_at &&
    attendanceRow.sign_out_method === 'manual'
  )
}

// Mirror of build_lc_attendance on app data. eligibleEvents: bsc_events rows
// with ceu_eligible + both times. attendanceRows: session_attendance rows for
// those events. Returns participants sorted by name, each with a per-session
// breakdown for the review table.
export function buildLcAttendance(eligibleEvents, attendanceRows) {
  const events = [...eligibleEvents].sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
  const hoursTotal = events.reduce((sum, e) => sum + eventHours(e), 0)

  // attendance row per (email, event)
  const byEmailEvent = new Map()
  const nameByEmail = new Map()
  attendanceRows.forEach(r => {
    if (!r.attendee_email) return
    const email = r.attendee_email.toLowerCase()
    byEmailEvent.set(`${email}|${r.bsc_event_id}`, r)
    if (r.attendee_name && !nameByEmail.has(email)) nameByEmail.set(email, r.attendee_name)
  })

  const emails = [...new Set(attendanceRows.filter(r => r.attendee_email).map(r => r.attendee_email.toLowerCase()))]

  return emails.map(email => {
    let hoursAttended = 0
    const sessionData = events.map(evt => {
      const row = byEmailEvent.get(`${email}|${evt.id}`)
      const hours = eventHours(evt)
      const counted = sessionCounted(row)
      if (counted) hoursAttended += hours
      return {
        eventId: evt.id,
        date: evt.event_date,
        title: evt.title,
        hours,
        signedIn: Boolean(row?.signed_in_at),
        evalCompleted: Boolean(row?.evaluation_completed_at),
        signedOut: row?.sign_out_method === 'manual',
        counted,
      }
    })
    return {
      name: nameByEmail.get(email) || email,
      email,
      hoursAttended,
      hoursTotal,
      sessionData,
    }
  }).sort((a, b) => a.name.localeCompare(b.name))
}
