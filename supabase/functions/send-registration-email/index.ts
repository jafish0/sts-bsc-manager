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
      .select('title, description, collaborative_id, collaboratives(name)')
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

    const eventsHtml = events.map(e => {
      const dt = new Date(e.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      return `<li style="margin-bottom: 0.5rem;"><strong>${esc(e.title)}</strong> — ${esc(dt)}${e.start_time ? ` at ${esc(e.start_time.slice(0,5))}` : ''}${e.location ? ` · ${esc(e.location)}` : ''}${e.zoom_link ? ` · <a href="${esc(e.zoom_link)}">Zoom</a>` : ''}</li>`
    }).join('')
    const eventsText = events.map(e => {
      const dt = new Date(e.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      return `• ${e.title} — ${dt}${e.start_time ? ' at ' + e.start_time.slice(0,5) : ''}${e.location ? ' (' + e.location + ')' : ''}${e.zoom_link ? '\n  Zoom: ' + e.zoom_link : ''}`
    }).join('\n')

    const html = `<!doctype html><html><body style="font-family: Arial, Helvetica, sans-serif; color: #1f2937; line-height: 1.5;">
      <div style="max-width: 640px; margin: 0 auto; padding: 1rem;">
        <h2 style="color: #0E1F56; margin-bottom: 0.25rem;">${esc(link?.title || 'Event Registration')}</h2>
        <div style="color: #6b7280; font-size: 14px;">${esc(link?.collaboratives?.name || '')}</div>
        <p style="margin-top: 1rem;">Hi ${esc(reg.full_name)},</p>
        <p>${esc(headline)}</p>
        ${link?.description ? `<p style="color:#374151; font-size: 14px;">${esc(link.description)}</p>` : ''}
        ${events.length > 0 ? `<h3 style="color: #0E1F56; font-size: 1rem; margin-top: 1.25rem; margin-bottom: 0.4rem;">Events covered</h3><ul style="padding-left: 1.2rem;">${eventsHtml}</ul>` : ''}
        ${kind !== 'cancellation' ? `<p style="font-size: 13px; color: #6b7280;">Need to cancel? <a href="${cancelUrl}">Cancel my registration</a>.</p>` : ''}
        <hr style="margin-top: 2rem; border: 0; border-top: 1px solid #e5e7eb;"/>
        <p style="font-size: 11px; color: #9ca3af;">Sent by the CTAC BSC Manager. If this was unexpected, you can ignore it.</p>
      </div></body></html>`

    const text = [
      link?.title || 'Event Registration',
      link?.collaboratives?.name || '',
      '',
      `Hi ${reg.full_name},`,
      headline,
      link?.description || '',
      '',
      events.length > 0 ? 'Events covered:\n' + eventsText : '',
      '',
      kind !== 'cancellation' ? `Cancel: ${cancelUrl}` : '',
    ].filter(Boolean).join('\n')

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
