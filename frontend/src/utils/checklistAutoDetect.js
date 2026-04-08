import { supabase } from './supabase'

/**
 * Auto-detect completion for checklist items that have is_auto = true.
 * Returns an array of { id, is_completed: true } for items whose status changed.
 */
export async function detectChecklistCompletion(teamId, items) {
  const autoItems = items.filter(i => i.is_auto && !i.is_completed)
  if (autoItems.length === 0) return []

  const updates = []

  for (const item of autoItems) {
    let completed = false

    switch (item.item_key) {
      case 'complete_baseline':
        completed = await hasAssessmentForTimepoint(teamId, 'baseline')
        break
      case 'complete_endline':
        completed = await hasAssessmentForTimepoint(teamId, 'endline')
        break
      case 'complete_6mo':
        completed = await hasAssessmentForTimepoint(teamId, 'followup_6mo')
        break
      case 'complete_12mo':
        completed = await hasAssessmentForTimepoint(teamId, 'followup_12mo')
        break
      case 'set_team_name':
        completed = await hasTeamDisplayName(teamId)
        break
      case 'set_smartie_goal':
        completed = await hasSmartieGoal(teamId)
        break
      case 'post_in_forum':
      case 'share_in_forum':
        completed = await hasForumActivity(teamId)
        break
      default:
        break
    }

    if (completed) {
      updates.push({ id: item.id, is_completed: true })
    }
  }

  // Batch update the database
  for (const update of updates) {
    await supabase
      .from('checklist_items')
      .update({ is_completed: true, completed_at: new Date().toISOString() })
      .eq('id', update.id)
  }

  return updates
}

async function hasAssessmentForTimepoint(teamId, timepoint) {
  const { data: codes } = await supabase
    .from('team_codes')
    .select('id')
    .eq('team_id', teamId)
    .eq('timepoint', timepoint)

  if (!codes || codes.length === 0) return false

  const codeIds = codes.map(c => c.id)
  const { count } = await supabase
    .from('assessment_responses')
    .select('id', { count: 'exact', head: true })
    .in('team_code_id', codeIds)

  return (count || 0) > 0
}

async function hasTeamDisplayName(teamId) {
  const { data } = await supabase
    .from('teams')
    .select('display_name, team_name')
    .eq('id', teamId)
    .single()

  return data?.display_name && data.display_name !== data.team_name
}

async function hasSmartieGoal(teamId) {
  const { count } = await supabase
    .from('smartie_goals')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .eq('status', 'active')

  return (count || 0) > 0
}

async function hasForumActivity(teamId) {
  // Check if any user on this team has posted a thread or reply
  const { data: teamUsers } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('team_id', teamId)

  if (!teamUsers || teamUsers.length === 0) return false

  const userIds = teamUsers.map(u => u.id)

  const { count: threadCount } = await supabase
    .from('forum_threads')
    .select('id', { count: 'exact', head: true })
    .in('created_by', userIds)

  if ((threadCount || 0) > 0) return true

  const { count: postCount } = await supabase
    .from('forum_posts')
    .select('id', { count: 'exact', head: true })
    .in('created_by', userIds)

  return (postCount || 0) > 0
}

/**
 * Default checklist items seeded when a team is created.
 */
export const DEFAULT_CHECKLIST_ITEMS = [
  // Preparation
  { phase: 'preparation', item_key: 'join_welcome_call', label: 'Join the welcome/orientation call', is_auto: false, sort_order: 1 },
  { phase: 'preparation', item_key: 'complete_baseline', label: 'Encourage staff to complete the baseline assessment', is_auto: true, sort_order: 2 },
  { phase: 'preparation', item_key: 'set_team_name', label: 'Create a team name and motto', is_auto: true, sort_order: 3 },
  { phase: 'preparation', item_key: 'meet_and_greet', label: 'Participate in the virtual meet and greet', is_auto: false, sort_order: 4 },
  { phase: 'preparation', item_key: 'review_dashboard', label: "Review your team's baseline data dashboard", is_auto: false, sort_order: 5 },
  { phase: 'preparation', item_key: 'schedule_meetings', label: 'Schedule regular team meetings (2x/month recommended)', is_auto: false, sort_order: 6 },

  // Action Period 1
  { phase: 'action_period_1', item_key: 'set_smartie_goal', label: 'Set at least one SMARTIE goal based on your STSI-OA results', is_auto: true, sort_order: 1 },
  { phase: 'action_period_1', item_key: 'first_pdsa', label: 'Start your first PDSA cycle', is_auto: false, sort_order: 2 },
  { phase: 'action_period_1', item_key: 'post_in_forum', label: 'Share a strategy or learning in the forum', is_auto: true, sort_order: 3 },
  { phase: 'action_period_1', item_key: 'browse_resources', label: 'Browse the resource library for tools and guides', is_auto: false, sort_order: 4 },
  { phase: 'action_period_1', item_key: 'attend_all_team_call', label: 'Attend the All-Team Learning Call', is_auto: false, sort_order: 5 },

  // Action Period 2
  { phase: 'action_period_2', item_key: 'continue_pdsa', label: 'Continue or start a new PDSA cycle', is_auto: false, sort_order: 1 },
  { phase: 'action_period_2', item_key: 'review_progress', label: 'Review your SMARTIE goal progress', is_auto: false, sort_order: 2 },
  { phase: 'action_period_2', item_key: 'attend_all_team_call_2', label: 'Attend the All-Team Learning Call', is_auto: false, sort_order: 3 },
  { phase: 'action_period_2', item_key: 'share_in_forum', label: 'Share results or challenges in the forum', is_auto: false, sort_order: 4 },

  // Action Period 3
  { phase: 'action_period_3', item_key: 'complete_endline', label: 'Encourage staff to complete the endline assessment', is_auto: true, sort_order: 1 },
  { phase: 'action_period_3', item_key: 'finalize_pdsa', label: 'Complete or summarize your PDSA cycles', is_auto: false, sort_order: 2 },
  { phase: 'action_period_3', item_key: 'document_learnings', label: 'Document your key learnings and changes made', is_auto: false, sort_order: 3 },

  // Follow-up
  { phase: 'follow_up', item_key: 'complete_6mo', label: 'Complete the 6-month follow-up assessment', is_auto: true, sort_order: 1 },
  { phase: 'follow_up', item_key: 'complete_12mo', label: 'Complete the 12-month follow-up assessment', is_auto: true, sort_order: 2 }
]
