import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Weekly trainer digest. Fired Monday mornings by the pg_cron job
// 'weekly-trainer-digest' (or manually). For every trainer in
// collaborative_trainers (skipping unsubscribed users), emails a prior-week
// summary of each of their collaboratives: new/updated SMARTIE goals,
// completed PDSA cycles, evaluation responses, and new parking-lot items.
// One email per trainer covering all their collabs. Per-recipient Resend
// send with the standard unsubscribe link.

function esc(s: string) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
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

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // All trainer assignments + trainer contact info
    const { data: assignments } = await admin
      .from('collaborative_trainers')
      .select('collaborative_id, user_id, collaboratives ( id, name ), user_profiles:user_id ( id, full_name, email, unsubscribe_token, notifications_unsubscribed_at )')

    const eligible = (assignments || []).filter((a: any) =>
      a.user_profiles?.email && !a.user_profiles.notifications_unsubscribed_at && a.collaboratives
    )
    if (eligible.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, reason: 'no_eligible_trainers' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Distinct collabs to summarize
    const collabIds = [...new Set(eligible.map((a: any) => a.collaborative_id))]

    // Teams per collab (for scoping team-keyed tables)
    const { data: teams } = await admin
      .from('teams').select('id, collaborative_id, team_name, agency_name').in('collaborative_id', collabIds)
    const teamsByCollab: Record<string, any[]> = {}
    ;(teams || []).forEach(t => {
      if (!teamsByCollab[t.collaborative_id]) teamsByCollab[t.collaborative_id] = []
      teamsByCollab[t.collaborative_id].push(t)
    })
    const allTeamIds = (teams || []).map(t => t.id)
    const collabByTeam = new Map((teams || []).map(t => [t.id, t.collaborative_id]))

    // Week's activity, fetched once and grouped per collab
    const summaries: Record<string, { goals: string[]; pdsas: string[]; evalCount: number; parkingLot: string[] }> = {}
    const S = (cid: string) => {
      if (!summaries[cid]) summaries[cid] = { goals: [], pdsas: [], evalCount: 0, parkingLot: [] }
      return summaries[cid]
    }

    if (allTeamIds.length > 0) {
      const { data: goals } = await admin
        .from('smartie_goals')
        .select('team_id, goal_title, created_at, updated_at')
        .in('team_id', allTeamIds)
      ;(goals || []).forEach(g => {
        const fresh = (g.created_at && g.created_at >= weekAgo) || (g.updated_at && g.updated_at >= weekAgo)
        if (!fresh) return
        const cid = collabByTeam.get(g.team_id)
        if (cid) S(cid).goals.push(g.goal_title || '(untitled goal)')
      })

      const { data: pdsas } = await admin
        .from('pdsa_cycles')
        .select('team_id, title, status, updated_at')
        .in('team_id', allTeamIds)
        .eq('status', 'completed')
        .gte('updated_at', weekAgo)
      ;(pdsas || []).forEach(p => {
        const cid = collabByTeam.get(p.team_id)
        if (cid) S(cid).pdsas.push(p.title || '(untitled cycle)')
      })
    }

    const { data: evals } = await admin
      .from('session_evaluations')
      .select('collaborative_id, submitted_at')
      .in('collaborative_id', collabIds)
      .gte('submitted_at', weekAgo)
    ;(evals || []).forEach(e => { S(e.collaborative_id).evalCount += 1 })

    // Parking lot items via the collab's events
    const { data: plItems } = await admin
      .from('event_parking_lot_items')
      .select('body, created_at, bsc_events!inner ( collaborative_id )')
      .gte('created_at', weekAgo)
    ;(plItems || []).forEach((p: any) => {
      const cid = p.bsc_events?.collaborative_id
      if (cid && collabIds.includes(cid)) S(cid).parkingLot.push(p.body)
    })

    // Group assignments per trainer → one email each
    const byTrainer = new Map<string, { profile: any; collabs: any[] }>()
    eligible.forEach((a: any) => {
      const entry = byTrainer.get(a.user_id) || { profile: a.user_profiles, collabs: [] }
      entry.collabs.push(a.collaboratives)
      byTrainer.set(a.user_id, entry)
    })

    let sent = 0; let failed = 0; let skippedQuiet = 0
    for (const { profile, collabs } of byTrainer.values()) {
      // Build per-collab sections; skip the email entirely if every collab was quiet.
      const sections: string[] = []
      const textSections: string[] = []
      for (const c of collabs) {
        const s = summaries[c.id]
        const quiet = !s || (s.goals.length === 0 && s.pdsas.length === 0 && s.evalCount === 0 && s.parkingLot.length === 0)
        if (quiet) continue
        const list = (label: string, items: string[]) => items.length > 0
          ? `<li><strong>${esc(label)}:</strong><ul>${items.slice(0, 10).map(i => `<li>${esc(i)}</li>`).join('')}${items.length > 10 ? `<li><em>…and ${items.length - 10} more</em></li>` : ''}</ul></li>`
          : ''
        sections.push(`
          <h3 style="color:#0E1F56; margin-bottom: 0.25rem;">${esc(c.name)}</h3>
          <ul style="margin-top: 0.25rem;">
            ${list('SMARTIE goals (new or updated)', s.goals)}
            ${list('PDSA cycles completed', s.pdsas)}
            ${s.evalCount > 0 ? `<li><strong>Evaluation responses:</strong> ${s.evalCount}</li>` : ''}
            ${list('Parking lot items', s.parkingLot)}
          </ul>`)
        textSections.push([
          c.name,
          s.goals.length > 0 ? `  Goals: ${s.goals.slice(0, 10).join('; ')}` : null,
          s.pdsas.length > 0 ? `  PDSAs completed: ${s.pdsas.slice(0, 10).join('; ')}` : null,
          s.evalCount > 0 ? `  Evaluation responses: ${s.evalCount}` : null,
          s.parkingLot.length > 0 ? `  Parking lot: ${s.parkingLot.slice(0, 10).join('; ')}` : null,
        ].filter(Boolean).join('\n'))
      }

      if (sections.length === 0) { skippedQuiet += 1; continue }

      const unsubUrl = profile.unsubscribe_token ? `https://bsc.ctac.app/unsubscribe/${profile.unsubscribe_token}` : null
      const html = `<!doctype html><html><body style="font-family: Arial, Helvetica, sans-serif; color: #1f2937; line-height: 1.5;">
        <div style="max-width: 640px; margin: 0 auto; padding: 1rem;">
          <h2 style="color: #0E1F56;">Your weekly collaborative digest</h2>
          <p>Hi ${esc(profile.full_name || '')}, here's what happened across your collaboratives in the past week:</p>
          ${sections.join('')}
          <p style="font-size: 13px; color: #6b7280; margin-top: 1.5rem;">Open the <a href="https://bsc.ctac.app/admin/trainer">Trainer Dashboard</a> for details.</p>
          <hr style="margin-top: 2rem; border: 0; border-top: 1px solid #e5e7eb;"/>
          <p style="font-size: 11px; color: #9ca3af;">Sent by the CTAC BSC Manager every Monday morning.${unsubUrl ? ` <a href="${unsubUrl}" style="color:#9ca3af; text-decoration: underline;">Unsubscribe from all notifications</a>.` : ''}</p>
        </div></body></html>`
      const text = `Your weekly collaborative digest\n\n${textSections.join('\n\n')}\n\nTrainer Dashboard: https://bsc.ctac.app/admin/trainer${unsubUrl ? `\n\nUnsubscribe: ${unsubUrl}` : ''}`

      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'CTAC <no-reply@ctac.app>',
          to: [profile.email],
          subject: 'Your weekly collaborative digest',
          html, text,
        }),
      })
      if (resp.ok) sent += 1; else failed += 1
    }

    return new Response(JSON.stringify({ success: true, sent, failed, skipped_quiet: skippedQuiet }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
