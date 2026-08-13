import * as XLSX from 'xlsx'

// Shared attendance sheet builder for BOTH the collaborative AttendanceReport and
// the standalone training's attendance list. One implementation on purpose — the
// draft called for extracting this rather than writing a second exporter that
// drifts from the first.

// Timestamps are rendered in EASTERN time explicitly, not via toLocaleString().
// The previous collaborative export used bare toLocaleString(), so the same
// session exported from a laptop in another timezone produced different times in
// the file — and an attendance record that shifts by whoever downloaded it is
// worthless for CEU reporting. Matches the ET convention used in the emails, the
// registration page and the roster share.
const ET = {
  timeZone: 'America/New_York',
  year: 'numeric', month: 'short', day: '2-digit',
  hour: 'numeric', minute: '2-digit',
}

export function formatEt(ts) {
  if (!ts) return ''
  return new Intl.DateTimeFormat('en-US', ET).format(new Date(ts)) + ' ET'
}

// "1h 45m" / "35m". Blank when either end is missing, rather than inventing a
// duration for someone who never signed out.
export function attendanceDuration(a) {
  if (!a?.signed_in_at || !a?.signed_out_at) return ''
  const mins = Math.round((new Date(a.signed_out_at) - new Date(a.signed_in_at)) / 60000)
  if (mins < 0) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// Windows forbids \ / : * ? " < > | in filenames, and the real training title
// ("Belonging, Recognition, and Sustainable Care for Counselors & Therapists")
// contains commas and an ampersand — harmless but ugly in a filename, and the
// comma is a genuine nuisance in shells and CSV tooling.
export function safeFileStem(title, date) {
  const clean = String(title || 'Session')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/[,&]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return `Attendance_${clean}${date ? `_${date}` : ''}`
}

// One row per attendee. `showTeam` is off for standalone trainings, which have no
// teams — a column of "Unmatched" for all 44 people would read as a problem
// rather than as "not applicable here".
export function buildAttendanceRows(attendance, { showTeam = true } = {}) {
  return (attendance || []).map(a => {
    const row = {
      Name: a.attendee_name || '',
      Email: a.attendee_email || '',
      Agency: a.attendee_agency || '',
      Role: a.attendee_role || '',
    }
    if (showTeam) row.Team = a.teams?.team_name || 'Unmatched'
    row['Signed In'] = formatEt(a.signed_in_at)
    row['Signed Out'] = formatEt(a.signed_out_at)
    row.Duration = attendanceDuration(a)
    row['Evaluation Completed'] = formatEt(a.evaluation_completed_at)
    // The CEU signal: credit needs sign-in + evaluation + an explicit manual
    // sign-out. 'session_closed' means the admin closed the session or the cron
    // swept them, which is NOT the same thing — so it must be visible, not
    // flattened into a yes/no.
    row['Sign-Out Method'] = a.sign_out_method || ''
    row.Status = a.signed_out_at ? 'Signed out' : 'Still signed in'
    if (showTeam) row.Matched = a.is_matched ? 'Yes' : 'No'
    return row
  })
}

const WIDTHS = {
  Name: 26, Email: 30, Agency: 24, Role: 20, Team: 20,
  'Signed In': 22, 'Signed Out': 22, Duration: 10,
  'Evaluation Completed': 22, 'Sign-Out Method': 16, Status: 16, Matched: 9,
}

// Builds and downloads the workbook. Returns the row count so a caller can tell
// the user what actually went into the file.
export function downloadAttendanceExcel(attendance, { title, date, showTeam = true } = {}) {
  const rows = buildAttendanceRows(attendance, { showTeam })
  const wb = XLSX.utils.book_new()
  // aoa when empty: json_to_sheet([]) yields a sheet with no header row at all,
  // so an export taken before anyone signs in opens as a blank file with no
  // indication of what it was meant to contain.
  const ws = rows.length
    ? XLSX.utils.json_to_sheet(rows)
    : XLSX.utils.aoa_to_sheet([Object.keys(buildAttendanceRows([{}], { showTeam })[0])])
  const headers = rows.length
    ? Object.keys(rows[0])
    : Object.keys(buildAttendanceRows([{}], { showTeam })[0])
  ws['!cols'] = headers.map(h => ({ wch: WIDTHS[h] || 16 }))
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance')
  XLSX.writeFile(wb, `${safeFileStem(title, date)}.xlsx`)
  return rows.length
}

// CSV, since Josh asked for "csv or excel" — same rows, same ET formatting, no
// second source of truth. Uses xlsx's own CSV writer so quoting and embedded
// commas/newlines (one real response contains a newline) are handled properly
// rather than by hand-rolled string joining.
export function downloadAttendanceCsv(attendance, { title, date, showTeam = true } = {}) {
  const rows = buildAttendanceRows(attendance, { showTeam })
  const ws = rows.length
    ? XLSX.utils.json_to_sheet(rows)
    : XLSX.utils.aoa_to_sheet([Object.keys(buildAttendanceRows([{}], { showTeam })[0])])
  const csv = XLSX.utils.sheet_to_csv(ws)
  // ﻿ so Excel opens UTF-8 correctly — without it, smart quotes and
  // accented names arrive mojibaked.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeFileStem(title, date)}.csv`
  a.click()
  URL.revokeObjectURL(url)
  return rows.length
}
