/**
 * Determines the current BSC phase based on Learning Session dates.
 *
 * Phase logic:
 * - Before LS1: "Preparation"
 * - LS1 date: "Learning Session 1"
 * - Between LS1 and LS2: "Action Period 1"
 * - LS2 date: "Learning Session 2"
 * - Between LS2 and LS3: "Action Period 2"
 * - LS3 date: "Learning Session 3"
 * - After LS3 but before collaborative end_date: "Action Period 3"
 * - After collaborative end_date: "Follow-up"
 *
 * @param {Array} events - bsc_events for this collaborative
 * @param {Object} collaborative - collaborative record with start_date, end_date
 * @returns {Object} { phase, phaseIndex (0-7), nextEvent, daysUntilNext }
 */

const PHASES = [
  { key: 'preparation', label: 'Preparation', short: 'Prep' },
  { key: 'learning_session_1', label: 'Learning Session 1', short: 'LS1' },
  { key: 'action_period_1', label: 'Action Period 1', short: 'AP1' },
  { key: 'learning_session_2', label: 'Learning Session 2', short: 'LS2' },
  { key: 'action_period_2', label: 'Action Period 2', short: 'AP2' },
  { key: 'learning_session_3', label: 'Learning Session 3', short: 'LS3' },
  { key: 'action_period_3', label: 'Action Period 3', short: 'AP3' },
  { key: 'follow_up', label: 'Follow-up', short: 'Follow-up' }
]

export { PHASES }

const PHASE_GUIDANCE = {
  preparation: 'Get your team ready! Complete baseline assessments, set your team name and motto, and attend the welcome orientation.',
  learning_session_1: 'Today is Learning Session 1! Review your data, set goals, and plan your next tests of change.',
  action_period_1: 'Run your PDSA cycles, test small changes, and discuss results at team meetings. Share your learnings in the forum!',
  learning_session_2: 'Today is Learning Session 2! Review your data, set goals, and plan your next tests of change.',
  action_period_2: 'Run your PDSA cycles, test small changes, and discuss results at team meetings. Share your learnings in the forum!',
  learning_session_3: 'Today is Learning Session 3! Review your data, set goals, and plan your next tests of change.',
  action_period_3: 'Complete your endline assessments, finalize PDSA cycles, and document your key learnings and changes made.',
  follow_up: 'Complete your follow-up assessments and reflect on what your team accomplished.'
}

export function getPhaseGuidance(phaseKey) {
  return PHASE_GUIDANCE[phaseKey] || ''
}

function toDateStr(d) {
  if (!d) return null
  return typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10)
}

function daysBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1 + 'T00:00:00')
  const d2 = new Date(dateStr2 + 'T00:00:00')
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24))
}

export function calculatePhase(events, collaborative) {
  const today = toDateStr(new Date())

  // Extract learning sessions sorted by sequence_number
  const learningSessions = (events || [])
    .filter(e => e.event_type === 'learning_session')
    .sort((a, b) => (a.sequence_number || 0) - (b.sequence_number || 0))

  const ls1Date = learningSessions[0] ? toDateStr(learningSessions[0].event_date) : null
  const ls2Date = learningSessions[1] ? toDateStr(learningSessions[1].event_date) : null
  const ls3Date = learningSessions[2] ? toDateStr(learningSessions[2].event_date) : null
  const endDate = collaborative?.end_date ? toDateStr(collaborative.end_date) : null

  // Determine phase
  let phaseIndex = 0
  if (!ls1Date || today < ls1Date) {
    phaseIndex = 0 // Preparation
  } else if (today === ls1Date) {
    phaseIndex = 1 // LS1
  } else if (!ls2Date || today < ls2Date) {
    phaseIndex = 2 // AP1
  } else if (today === ls2Date) {
    phaseIndex = 3 // LS2
  } else if (!ls3Date || today < ls3Date) {
    phaseIndex = 4 // AP2
  } else if (today === ls3Date) {
    phaseIndex = 5 // LS3
  } else if (!endDate || today <= endDate) {
    phaseIndex = 6 // AP3
  } else {
    phaseIndex = 7 // Follow-up
  }

  const phase = PHASES[phaseIndex]

  // Find next upcoming event
  const upcomingEvents = (events || [])
    .filter(e => toDateStr(e.event_date) >= today)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))

  const nextEvent = upcomingEvents[0] || null
  const daysUntilNext = nextEvent ? daysBetween(today, toDateStr(nextEvent.event_date)) : null

  return {
    phase: phase.label,
    phaseKey: phase.key,
    phaseIndex,
    nextEvent,
    daysUntilNext,
    phases: PHASES
  }
}

/**
 * Maps a phase index to the checklist phase key used in the database.
 */
export function phaseToChecklistKey(phaseIndex) {
  const map = {
    0: 'preparation',
    1: 'preparation',
    2: 'action_period_1',
    3: 'action_period_1',
    4: 'action_period_2',
    5: 'action_period_2',
    6: 'action_period_3',
    7: 'follow_up'
  }
  return map[phaseIndex] || 'preparation'
}
