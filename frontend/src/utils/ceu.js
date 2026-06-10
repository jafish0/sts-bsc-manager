import JSZip from 'jszip'
import { supabase } from './supabase'

// CEU certificate engine — ported from the desktop tool
// `Training Manager/TrainingEventManager.py` (build_lc_attendance,
// generate_lc_cert, _lc_get_ceu_vars, _lc_date_range).
//
// Differences from the desktop tool, by design:
// - Attendance comes from session_attendance (native app data), not
//   Qualtrics CSVs, so there's no fuzzy name matching: rows group by
//   lower(attendee_email).
// - Credit per session is the three-part rule locked with Josh:
//   signed_in_at AND evaluation_completed_at AND sign_out_method='manual'.
// - Output is a merged .docx per participant (faithful to the branded
//   template). PDF conversion is not available in-browser; the desktop tool
//   itself falls back to .docx when Word automation is unavailable.

// ---- CEU approval texts (verbatim from TrainingEventManager.py:115-123) ----
export const CEU_SWBOARD_TEXT = 'CTAC is approved by the Kentucky Board of Social Work as a sponsor for continuing education for Social Work (SW# KBSWSP 202536).'
export const CEU_PSYCHBOARD_TEXT = 'The Center on Trauma and Children is approved by the Kentucky Board of Examiners of Psychology to offer continuing education for Psychologists.'
export const CEU_LPCC_TEXT = 'This course is approved by the Board of Licensed Professional Counselors. CTAC maintains responsibility for this program and its content.'
export const CEU_ASWB_TEMPLATE = 'University of Kentucky Center on Trauma and Children, 112345, is approved as an ACE provider to offer social work continuing education by the Association of Social Work Boards (ASWB) Approved Continuing Education (ACE) program. Regulatory boards are the final authority on courses accepted for continuing education credit. ACE provider approval period: {period}. Social workers completing this course receive {hours} continuing education credits.'
export const CEU_EILA_TEMPLATE = 'This course is approved for {hours} EILA Hours (EILA #: {number}).'
export const CEU_FRSKY_TEMPLATE = 'This course is approved for {hours} FRSKY Hours (FRSKY #: {number}).'

// Format a number the way the desktop tool does (f"{float(n):g}" — no
// trailing zeros: 6.0 → "6", 1.5 → "1.5").
export const fmtHours = (n) => String(parseFloat(Number(n).toPrecision(12)))

// Build the combined approvals block from a collaborative_ceu_config row.
// Order matches _lc_get_ceu_vars: sw, psych, eila, frsky, aswb, lpcc.
export function buildApprovalsText(config, hoursTotal) {
  const hours = fmtHours(hoursTotal)
  const parts = [
    config.ceu_sw ? CEU_SWBOARD_TEXT : '',
    config.ceu_psych ? CEU_PSYCHBOARD_TEXT : '',
    config.ceu_eila ? CEU_EILA_TEMPLATE.replace('{hours}', hours).replace('{number}', config.eila_number || '') : '',
    config.ceu_frsky ? CEU_FRSKY_TEMPLATE.replace('{hours}', hours).replace('{number}', config.frsky_number || '') : '',
    config.ceu_aswb ? CEU_ASWB_TEMPLATE.replace('{period}', config.aswb_period || '').replace('{hours}', hours) : '',
    config.ceu_lpcc ? CEU_LPCC_TEXT : '',
  ]
  return parts.filter(Boolean).join('\n')
}

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

// Per-session credit rule (locked with Josh 2026-06-10):
// sign-in + completed evaluation + explicit final sign-out, all three.
// 'evaluation' (eval but no final sign-out) and 'session_closed' (auto-close)
// do NOT earn credit.
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
// breakdown for the review table + the email attendance grid.
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

// ---- docx merge ----
// The template's <<PLACEHOLDER>> strings are contiguous in the XML (verified
// against "LC Certificate Template Fixed.docx"), so plain string replacement
// on the XML-escaped form works. Values are XML-escaped; newlines become
// <w:br/> so the multi-line approvals block renders.
function xmlEscape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
    .replace(/\n/g, '</w:t><w:br/><w:t xml:space="preserve">')
}

export async function mergeCertificate(templateArrayBuffer, mapping) {
  const zip = await JSZip.loadAsync(templateArrayBuffer)
  const xmlFiles = Object.keys(zip.files).filter(p => p.startsWith('word/') && p.endsWith('.xml'))
  for (const path of xmlFiles) {
    let xml = await zip.file(path).async('string')
    let changed = false
    for (const [key, value] of Object.entries(mapping)) {
      // Placeholders appear XML-escaped in document.xml: <<NAME>> → &lt;&lt;NAME&gt;&gt;
      const escapedKey = key.replace(/</g, '&lt;').replace(/>/g, '&gt;')
      if (xml.includes(escapedKey)) {
        xml = xml.split(escapedKey).join(xmlEscape(value))
        changed = true
      }
    }
    if (changed) zip.file(path, xml)
  }
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  })
}

// Fetch the bundled template once (served from /templates/ in public/).
export async function fetchCertificateTemplate() {
  const resp = await fetch('/templates/lc-certificate-template.docx')
  if (!resp.ok) throw new Error('Could not load certificate template')
  return resp.arrayBuffer()
}

// Attendance grid for the optional email (mirror of build_attendance_html).
export function buildAttendanceHtml(participant) {
  const fmt = (s) => {
    const d = new Date(s + 'T00:00:00')
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
  }
  const header = `<tr style="background:#e8e8e8;">
    <th style="padding:4px 10px;border:1px solid #ccc;text-align:left;">Session Date</th>
    <th style="padding:4px 10px;border:1px solid #ccc;">Signed In</th>
    <th style="padding:4px 10px;border:1px solid #ccc;">Eval Completed</th>
    <th style="padding:4px 10px;border:1px solid #ccc;">Signed Out</th>
    <th style="padding:4px 10px;border:1px solid #ccc;">Hours Credited</th>
  </tr>`
  const rows = participant.sessionData.map(s => `<tr>
    <td style="padding:4px 10px;border:1px solid #ccc;">${fmt(s.date)}</td>
    <td style="padding:4px 10px;border:1px solid #ccc;text-align:center;">${s.signedIn ? '✓' : '—'}</td>
    <td style="padding:4px 10px;border:1px solid #ccc;text-align:center;">${s.evalCompleted ? '✓' : '—'}</td>
    <td style="padding:4px 10px;border:1px solid #ccc;text-align:center;">${s.signedOut ? '✓' : '—'}</td>
    <td style="padding:4px 10px;border:1px solid #ccc;text-align:center;">${s.counted ? fmtHours(s.hours) : '0'}</td>
  </tr>`).join('')
  return `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;margin:8px 0;">${header}${rows}</table>`
}
