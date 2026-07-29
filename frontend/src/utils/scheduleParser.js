// Parse a CTAC schedule (pasted text, or a .docx converted to HTML by mammoth)
// into schedule rows for the create-collaborative modal.
//
// Deliberately pure + DOM-free so it can be unit-tested outside the browser.
// Nothing here auto-applies: the modal shows a preview and requires an explicit
// Confirm. Anything we can't read is reported rather than guessed at.
//
// Reference shape (AWARE 3 Year 4 Proposed Schedule):
//   | Session Type                    | Date     | Time (ET)          |
//   | Learning Session 1              | 10/27/26 | 10:00 am - 2:30 pm |
//   | Implementation Session 1 (call) | 11/17/26 | 10:00 am - 11:00 am|
//   | *Learning Session 5             | 01/26/27 | 10:00 am - 2:30 pm |
//   *Learning Session 5 will include...      <- prose footnote, ignored

const DATE_RE = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/
const MERIDIEM_TIME_RE = /\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s?m\.?\b/gi
const COLON_TIME_RE = /\b(\d{1,2}):(\d{2})\b/g

/** MM/DD/YY(YY) -> 'YYYY-MM-DD'. Two-digit years are 2000-based (10/27/26 -> 2026). */
export function toIsoDate(mm, dd, yy) {
  let year = parseInt(yy, 10)
  if (String(yy).length <= 2) year += 2000
  const m = parseInt(mm, 10)
  const d = parseInt(dd, 10)
  if (!year || year < 2000 || year > 2100) return null
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Map a session label to an app event_type.
 * "learning session" wins first; anything else containing "call" (e.g. CTAC's
 * "Implementation Session 1 (call)") is a call. Otherwise null — we report the
 * row as uninterpreted rather than guessing.
 */
export function classifyEventType(label) {
  const l = String(label || '').toLowerCase()
  if (l.includes('learning session')) return 'learning_session'
  if (l.includes('call')) return 'all_team_call'
  return null
}

function to24h(tok, fallbackMeridiem) {
  const mer = tok.mer || fallbackMeridiem
  let h = tok.h
  if (mer === 'p' && h < 12) h += 12
  if (mer === 'a' && h === 12) h = 0
  if (h > 23) return null
  return `${String(h).padStart(2, '0')}:${String(tok.min).padStart(2, '0')}`
}

/**
 * Pull up to two clock times out of a string, tolerating "-", en/em dash and
 * "to" as the range separator (we just take the first two times in order).
 * Returns { start_time, end_time } as 'HH:MM' (24h), '' when absent.
 */
export function parseTimeRange(text) {
  const s = String(text || '')
  const tokens = []
  const claimed = []

  MERIDIEM_TIME_RE.lastIndex = 0
  let m
  while ((m = MERIDIEM_TIME_RE.exec(s))) {
    tokens.push({ index: m.index, h: +m[1], min: m[2] ? +m[2] : 0, mer: m[3].toLowerCase() })
    claimed.push([m.index, m.index + m[0].length])
  }

  // Bare HH:MM (e.g. "10:00 - 2:30 pm" or a 24h range) — only for slots the
  // meridiem pass didn't already claim.
  COLON_TIME_RE.lastIndex = 0
  while ((m = COLON_TIME_RE.exec(s))) {
    const inClaimed = claimed.some(([a, b]) => m.index >= a && m.index < b)
    if (inClaimed) continue
    tokens.push({ index: m.index, h: +m[1], min: +m[2], mer: null })
  }

  tokens.sort((a, b) => a.index - b.index)
  if (tokens.length === 0) return { start_time: '', end_time: '' }

  const [startTok, endTok] = tokens
  let start = to24h(startTok, null)
  let end = endTok ? to24h(endTok, null) : ''

  // "10:00 - 2:30 pm": infer the start's meridiem as whichever keeps start < end.
  if (!startTok.mer && endTok?.mer) {
    const asAm = to24h(startTok, 'a')
    start = (asAm && end && asAm < end) ? asAm : to24h(startTok, endTok.mer)
  }

  return { start_time: start || '', end_time: end || '' }
}

/**
 * Parse a single line. Returns null for lines that aren't schedule rows at all
 * (headers, prose, footnotes) — identified by having no date. A line WITH a
 * date but no usable label/type comes back with ok:false so the preview can
 * surface it.
 */
export function parseScheduleLine(line) {
  const raw = String(line || '').replace(/\s+/g, ' ').trim()
  if (!raw) return null

  const dm = raw.match(DATE_RE)
  if (!dm) return null // no date -> not a schedule row (header/footnote/prose)

  const event_date = toIsoDate(dm[1], dm[2], dm[3])

  // Title is whatever precedes the date, minus cell separators and footnote
  // markers. Use the document's own label so this composes with renaming.
  let title = raw.slice(0, dm.index)
    .replace(/[|\t]+/g, ' ')
    .replace(/[-–—:,]\s*$/, '')
    .trim()
  title = title.replace(/^[*†‡•]+\s*/, '').replace(/\s*[*†‡•]+$/, '').trim()

  const afterDate = raw.slice(dm.index + dm[0].length)
  const { start_time, end_time } = parseTimeRange(afterDate)
  const event_type = classifyEventType(title)

  const problems = []
  if (!title) problems.push('no session label found before the date')
  if (!event_date) problems.push('unreadable date')
  if (!event_type) problems.push('could not tell if this is a session or a call')

  return {
    title,
    event_type,
    event_date: event_date || '',
    start_time,
    end_time,
    raw,
    ok: problems.length === 0,
    problems,
  }
}

/** Strip tags/entities from a mammoth HTML fragment. */
function stripTags(html) {
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Turn mammoth's HTML into candidate lines: one per table row (cells joined by
 * " | "), plus paragraphs outside tables (which the line parser then ignores,
 * since prose has no date). Regex is fine here — the input is mammoth's own
 * simple, well-formed output, not arbitrary web HTML.
 */
export function htmlToScheduleLines(html) {
  const src = String(html || '')
  const lines = []

  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let r
  while ((r = rowRe.exec(src))) {
    const cells = []
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
    let c
    while ((c = cellRe.exec(r[1]))) cells.push(stripTags(c[1]))
    const joined = cells.filter(Boolean).join(' | ')
    if (joined) lines.push(joined)
  }

  const noTables = src.replace(/<table[\s\S]*?<\/table>/gi, ' ')
  const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi
  let p
  while ((p = pRe.exec(noTables))) {
    const t = stripTags(p[1])
    if (t) lines.push(t)
  }

  return lines
}

/**
 * Parse many lines (from a paste, or from htmlToScheduleLines).
 * Returns { rows, unmatched }:
 *   rows      — fully interpreted, ready to preview/apply
 *   unmatched — had a date but something couldn't be read (shown in preview)
 * Lines without a date are silently ignored (headers, prose, footnotes).
 */
export function parseScheduleLines(lines) {
  const rows = []
  const unmatched = []
  for (const line of lines || []) {
    const parsed = parseScheduleLine(line)
    if (!parsed) continue
    if (parsed.ok) rows.push(parsed)
    else unmatched.push(parsed)
  }
  return { rows, unmatched }
}

/** Convenience wrapper for the paste textarea. */
export function parseScheduleText(text) {
  return parseScheduleLines(String(text || '').split(/\r?\n/))
}

/**
 * Convert parsed rows into the modal's bscEvents shape. sequence_number is
 * assigned per event_type in the order given, matching how the pre-populated
 * defaults are numbered.
 */
export function rowsToBscEvents(rows) {
  const counters = {}
  return (rows || []).map(r => {
    counters[r.event_type] = (counters[r.event_type] || 0) + 1
    return {
      event_type: r.event_type,
      title: r.title,
      event_date: r.event_date,
      start_time: r.start_time || '',
      end_time: r.end_time || '',
      location: 'Virtual',
      zoom_link: '',
      sequence_number: counters[r.event_type],
      locked: false,
    }
  })
}
