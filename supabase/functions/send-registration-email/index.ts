import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Send a registration confirmation email with .ics calendar attachment
// covering all events the registration link includes.
//
// POST body: { registration_id: string, kind?: 'confirmation'|'cancellation'|'promoted' }
//   default kind = 'confirmation'
//
// Called by mint-registration after a successful insert, by
// cancel-registration after cancel/promote, or manually by admins
// (the roster's "Resend confirmation" button).
//
// On a successful 'confirmation' or 'promoted' send, stamps
// event_registrations.confirmation_sent_at = now() — the admin roster
// uses a NULL there to show a "not sent" indicator with a resend path.
// NOTE: 'cancellation' sends deliberately don't stamp, so there is currently
// no "not sent" signal for cancellation emails.

function esc(s: string) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// Program labels. Deliberately duplicated here rather than imported from
// frontend/src/config/programConfig.js — an edge function runs in Deno with no
// bundler and must not reach into the frontend tree. Keep the two in sync by
// hand; the short forms match PROGRAM_TYPE_COLORS labels.
const PROGRAM_LABELS: Record<string, { long: string; short: string }> = {
  sts_bsc: { long: 'STS Breakthrough Series Collaborative', short: 'STS-BSC' },
  tic_lc:  { long: 'TIC Learning Collaborative',            short: 'TIC LC'  },
  tipe_lc: { long: 'TIPE Learning Collaborative',           short: 'TIPE LC' },
  fourc:   { long: 'FourC Collaborative',                   short: 'FourC'   },
}

// Heading for the events section. Falls back to the old wording for any
// program_type not in the map, so a new program never produces a blank heading.
function eventsHeading(programType?: string | null): string {
  const label = programType ? PROGRAM_LABELS[programType]?.long : null
  return label ? `${label} Events` : 'Events covered'
}

// "Tue, Jan 5, 2027". The YEAR matters: cohorts cross a calendar boundary, so
// "Tuesday, January 5" alone is ambiguous. timeZone is pinned to UTC because
// event_date is a bare date and 'T00:00:00' would otherwise be interpreted in
// whatever zone the isolate happens to run in, which can shift the day.
function fmtDate(eventDate: string): string {
  return new Date(eventDate + 'T00:00:00Z').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

// '14:30:00' -> '2:30 PM'. Parsed off the string rather than via Date so no
// timezone can enter the picture — start_time/end_time are local wall times.
function fmtTime(t?: string | null): string | null {
  if (!t) return null
  const [hRaw, mRaw] = String(t).split(':')
  let h = Number(hRaw)
  if (!Number.isFinite(h)) return null
  const m = (mRaw ?? '00').padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${m} ${ampm}`
}

// Both ends, so a 4.5-hour learning session is distinguishable from a 1-hour
// call. Previously only the start showed.
function fmtTimeRange(start?: string | null, end?: string | null): string {
  const s = fmtTime(start)
  if (!s) return 'TBD'
  const e = fmtTime(end)
  return e && e !== s ? `${s} to ${e}` : s
}

// btoa() only accepts code points 0-255 and THROWS on anything above U+00FF.
// Event titles/locations routinely contain curly apostrophes and em dashes
// (anything pasted from Word or Outlook — and titles now come straight from
// imported schedule documents), which made the whole request 500 and sent NO
// email at all rather than merely dropping the attachment.
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  const chunk = 0x8000 // chunked so large calendars can't blow the call stack
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

// RFC 5545 TEXT values must escape backslash, semicolon, comma and newlines.
// An unescaped comma in a title ("Session 2: Cognitive Coping, Part 1") would
// otherwise be parsed as a value separator and corrupt the entry.
function escIcsText(s: string): string {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function buildIcs(events: any[]): string {
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const blocks: string[] = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//CTAC//BSC Manager//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH']
  for (const e of events) {
    if (!e.start_time) continue
    const tz = e.timezone || 'America/New_York'
    const startBits = e.start_time.split(':')
    const endBits = (e.end_time || e.start_time).split(':')
    const dateNoDash = e.event_date.replace(/-/g, '')
    const start = `${dateNoDash}T${startBits[0]}${startBits[1]}${startBits[2] || '00'}`
    const end = `${dateNoDash}T${endBits[0]}${endBits[1]}${endBits[2] || '00'}`
    const description = [e.title, e.zoom_link ? `Join: ${e.zoom_link}` : null, e.location ? `Location: ${e.location}` : null]
      .filter(Boolean).map(part => escIcsText(part as string)).join('\\n')
    blocks.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@bsc.ctac.app`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART;TZID=${tz}:${start}`,
      `DTEND;TZID=${tz}:${end}`,
      `SUMMARY:${escIcsText(e.title)}`,
      `DESCRIPTION:${description}`,
      e.location ? `LOCATION:${escIcsText(e.location)}` : '',
      e.zoom_link ? `URL:${e.zoom_link}` : '',
      'END:VEVENT'
    )
  }
  blocks.push('END:VCALENDAR')
  return blocks.filter(Boolean).join('\r\n')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { registration_id, kind = 'confirmation' } = await req.json().catch(() => ({}))
    if (!registration_id) {
      return new Response(JSON.stringify({ error: 'registration_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: reg, error: regErr } = await admin
      .from('event_registrations')
      .select('id, email, full_name, status, waitlist_position, cancel_token, registration_link_id')
      .eq('id', registration_id)
      .maybeSingle()
    if (regErr || !reg) {
      return new Response(JSON.stringify({ error: 'Registration not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: link } = await admin
      .from('event_registration_links')
      .select('title, description, collaborative_id, collaboratives(name, program_type)')
      .eq('id', reg.registration_link_id)
      .single()

    // Pull events covered by the link.
    const { data: linkEventRows } = await admin
      .from('event_registration_link_events')
      .select('event_id')
      .eq('registration_link_id', reg.registration_link_id)
    const eventIds = (linkEventRows || []).map(r => r.event_id)
    let events: any[] = []
    if (eventIds.length > 0) {
      const { data: ev } = await admin
        .from('bsc_events')
        .select('id, title, event_date, start_time, end_time, location, zoom_link, timezone')
        .in('id', eventIds)
        .order('event_date', { ascending: true })
      events = ev || []
    }

    const cancelUrl = `https://bsc.ctac.app/cancel-registration/${reg.cancel_token}`

    let subject: string, headline: string
    if (kind === 'cancellation') {
      subject = `Registration cancelled: ${link?.title || 'Event'}`
      headline = 'Your registration has been cancelled. We’re sorry you can’t make it.'
    } else if (kind === 'promoted') {
      subject = `Spot opened — you’re registered for ${link?.title || 'the event'}`
      headline = 'Good news — a spot opened up and you’ve been moved off the waitlist.'
    } else if (reg.status === 'waitlisted') {
      subject = `You’re on the waitlist for ${link?.title || 'the event'}`
      headline = `Thanks for registering. You're currently #${reg.waitlist_position || '?'} on the waitlist; we'll email if a spot opens up.`
    } else {
      subject = `Registration confirmed: ${link?.title || 'Event'}`
      headline = `You're registered. Save the dates below — a calendar file is attached so you can add them to Outlook, Apple Calendar, or Google Calendar in one click.`
    }

    const programType = link?.collaboratives?.program_type as string | undefined
    const heading = eventsHeading(programType)

    // Every size below is in px with an explicit line-height, and there is no
    // rem/em anywhere in this template. Outlook renders with the Word engine,
    // which handles rem/em unreliably and imposes its own heading defaults —
    // that mix is what made the received email's type sizes look random.
    // Scale: title 22 / section heading 16 / body 15 / secondary 13 / footer 11.
    const FONT = "font-family: Arial, Helvetica, sans-serif;"

    // A real data table, not role="presentation": this IS tabular data, and a
    // presentation role would hide the column structure from screen readers.
    // Outlook-safety comes from the cellpadding/cellspacing/border attributes,
    // fixed widths and inline px styles — not from the role.
    const th = (label: string, width: string, align = 'left') =>
      `<th scope="col" width="${width}" style="${FONT} font-size: 12px; line-height: 16px; color: #0E1F56; text-align: ${align}; padding: 8px 10px; background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-weight: bold;">${label}</th>`

    const eventsRows = events.map(e => {
      const td = 'style="' + FONT + ' font-size: 13px; line-height: 18px; color: #1f2937; padding: 8px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top;"'
      return `<tr>
              <td ${td}><span style="font-weight: bold;">${esc(e.title)}</span>${e.location ? `<br /><span style="font-size: 12px; line-height: 16px; color: #6b7280;">${esc(e.location)}</span>` : ''}</td>
              <td ${td}>${esc(fmtDate(e.event_date))}</td>
              <td ${td}>${esc(fmtTimeRange(e.start_time, e.end_time))}</td>
              <td ${td}>${e.zoom_link ? `<a href="${esc(e.zoom_link)}" style="color: #00A79D; font-weight: bold; text-decoration: underline;">Zoom</a>` : '<span style="color: #9ca3af;">—</span>'}</td>
            </tr>`
    }).join('')

    const eventsTable = events.length === 0 ? '' : `
          <p style="${FONT} font-size: 16px; line-height: 22px; color: #0E1F56; font-weight: bold; margin: 24px 0 8px 0;">${esc(heading)}</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; width: 100%; max-width: 600px;">
            <tr>${th('Session', '40%')}${th('Date', '20%')}${th('Time', '28%')}${th('Join', '12%')}</tr>
            ${eventsRows}
          </table>`

    const eventsText = events.map(e => {
      const when = `${fmtDate(e.event_date)}, ${fmtTimeRange(e.start_time, e.end_time)}`
      return `• ${e.title}\n    ${when}${e.location ? `\n    ${e.location}` : ''}${e.zoom_link ? `\n    Zoom: ${e.zoom_link}` : ''}`
    }).join('\n')

    // Outer 100%-width table with a fixed-width inner table is the layout that
    // survives Outlook; max-width alone on a div does not.
    const html = `<!doctype html><html><body style="margin: 0; padding: 0; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="width: 600px; max-width: 600px; background-color: #ffffff; border: 1px solid #e5e7eb;">
          <tr><td style="padding: 24px;">
            <p style="${FONT} font-size: 22px; line-height: 28px; color: #0E1F56; font-weight: bold; margin: 0 0 4px 0;">${esc(link?.title || 'Event Registration')}</p>
            <p style="${FONT} font-size: 13px; line-height: 18px; color: #6b7280; margin: 0 0 20px 0;">${esc(link?.collaboratives?.name || '')}</p>
            <p style="${FONT} font-size: 15px; line-height: 22px; color: #1f2937; margin: 0 0 12px 0;">Hi ${esc(reg.full_name)},</p>
            <p style="${FONT} font-size: 15px; line-height: 22px; color: #1f2937; margin: 0 0 12px 0;">${esc(headline)}</p>
            ${link?.description ? `<p style="${FONT} font-size: 13px; line-height: 18px; color: #374151; margin: 0 0 12px 0;">${esc(link.description)}</p>` : ''}
            ${eventsTable}
            ${kind !== 'cancellation' ? `<p style="${FONT} font-size: 13px; line-height: 18px; color: #6b7280; margin: 20px 0 0 0;">Need to cancel? <a href="${cancelUrl}" style="color: #0E1F56; text-decoration: underline;">Cancel my registration</a>.</p>` : ''}
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0 0 0;"><tr><td style="border-top: 1px solid #e5e7eb; font-size: 0; line-height: 0;">&nbsp;</td></tr></table>
            <p style="${FONT} font-size: 11px; line-height: 15px; color: #9ca3af; margin: 12px 0 0 0;">Sent by the CTAC BSC Manager. If this was unexpected, you can ignore it.</p>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body></html>`

    // Filter on `=== null`, not Boolean: the '' entries are intentional blank
    // lines, and the old .filter(Boolean) stripped every one of them, so the
    // plain-text alternative arrived as one dense unbroken block.
    const text = [
      link?.title || 'Event Registration',
      link?.collaboratives?.name || null,
      '',
      `Hi ${reg.full_name},`,
      headline,
      link?.description || null,
      '',
      events.length > 0 ? heading + ':\n' + eventsText : null,
      '',
      kind !== 'cancellation' ? `Cancel: ${cancelUrl}` : null,
    ].filter(p => p !== null).join('\n')

    const attachments: any[] = []
    if (kind !== 'cancellation' && events.some(e => e.start_time)) {
      attachments.push({ filename: 'registration.ics', content: utf8ToBase64(buildIcs(events)), content_type: 'text/calendar' })
    }

    const resendPayload: any = {
      from: 'CTAC <no-reply@ctac.app>',
      to: [reg.email],
      subject, html, text,
    }
    if (attachments.length > 0) resendPayload.attachments = attachments

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(resendPayload),
    })
    if (!resp.ok) {
      const detail = await resp.text()
      return new Response(JSON.stringify({ error: 'Resend API error', detail }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Stamp confirmation_sent_at on successful confirmation/promotion sends
    // so the admin roster can spot rows whose email never went out (NULL =
    // not sent) and offer a resend. Cancellation emails don't stamp.
    if (kind === 'confirmation' || kind === 'promoted') {
      await admin
        .from('event_registrations')
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq('id', reg.id)
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
