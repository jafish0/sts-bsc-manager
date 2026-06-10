import { supabase } from './supabase'

// Active Participation Index — the single place the formula lives.
//
// Per team, over a trailing window (default 30 days), blend three components:
//   forum    — forum posts authored by the team's members
//   goals    — SMARTIE goals created OR updated
//   checklist— completion rate of the team's checklist items (all-time rate;
//              it's a progress measure, not an activity count)
//
// Count components are normalized 0–1 against the max across the teams being
// compared (the most active team scores 1.0); the checklist rate is already
// 0–1. Components are weighted equally. Returns scores sorted descending.
export const PARTICIPATION_WINDOW_DAYS = 30

export async function computeParticipationIndex(teams) {
  // teams: [{ id, team_name, agency_name, collaborative_id }]
  if (!teams || teams.length === 0) return []
  const teamIds = teams.map(t => t.id)
  const windowStart = new Date(Date.now() - PARTICIPATION_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Members per team (for forum attribution)
  const { data: members } = await supabase
    .from('user_profiles')
    .select('id, team_id')
    .in('team_id', teamIds)
    .eq('is_active', true)
  const teamByMember = new Map((members || []).map(m => [m.id, m.team_id]))
  const memberIds = (members || []).map(m => m.id)

  // Forum posts in window by those members
  let forumCounts = {}
  if (memberIds.length > 0) {
    const { data: posts } = await supabase
      .from('forum_posts')
      .select('created_by')
      .in('created_by', memberIds)
      .gte('created_at', windowStart)
    ;(posts || []).forEach(p => {
      const teamId = teamByMember.get(p.created_by)
      if (teamId) forumCounts[teamId] = (forumCounts[teamId] || 0) + 1
    })
  }

  // SMARTIE goal activity in window (created or updated)
  const { data: goals } = await supabase
    .from('smartie_goals')
    .select('team_id, created_at, updated_at')
    .in('team_id', teamIds)
  const goalCounts = {}
  ;(goals || []).forEach(g => {
    const active = (g.created_at && g.created_at >= windowStart) || (g.updated_at && g.updated_at >= windowStart)
    if (active) goalCounts[g.team_id] = (goalCounts[g.team_id] || 0) + 1
  })

  // Checklist completion rate (all-time)
  const { data: checklist } = await supabase
    .from('checklist_items')
    .select('team_id, is_completed')
    .in('team_id', teamIds)
  const checklistAgg = {}
  ;(checklist || []).forEach(c => {
    if (!checklistAgg[c.team_id]) checklistAgg[c.team_id] = { done: 0, total: 0 }
    checklistAgg[c.team_id].total += 1
    if (c.is_completed) checklistAgg[c.team_id].done += 1
  })

  const maxForum = Math.max(0, ...teamIds.map(id => forumCounts[id] || 0))
  const maxGoals = Math.max(0, ...teamIds.map(id => goalCounts[id] || 0))

  return teams.map(team => {
    const forumRaw = forumCounts[team.id] || 0
    const goalsRaw = goalCounts[team.id] || 0
    const cl = checklistAgg[team.id]
    const checklistRate = cl && cl.total > 0 ? cl.done / cl.total : 0

    const forumNorm = maxForum > 0 ? forumRaw / maxForum : 0
    const goalsNorm = maxGoals > 0 ? goalsRaw / maxGoals : 0

    // Equal weights. Score is 0–100 for display.
    const score = Math.round(((forumNorm + goalsNorm + checklistRate) / 3) * 100)

    return {
      team,
      score,
      components: {
        forum: { raw: forumRaw, norm: forumNorm },
        goals: { raw: goalsRaw, norm: goalsNorm },
        checklist: { rate: checklistRate, done: cl?.done || 0, total: cl?.total || 0 },
      },
    }
  }).sort((a, b) => b.score - a.score)
}
