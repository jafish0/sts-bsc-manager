import { supabase } from './supabase'
import { TIMEPOINT_ORDER, STSS_SUBSCALES, computeSTSSSubscale, stddev } from './constants'

/**
 * Load all report data for a single team across ALL timepoints.
 * Queries the raw response tables and computes aggregates client-side
 * (matching the pattern in DataVisualization.jsx).
 */
export async function loadTeamReportData(teamId) {
  // 1. Get team metadata with collaborative info
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('id, team_name, agency_name, display_name, motto, collaborative_id, collaboratives (id, name)')
    .eq('id', teamId)
    .single()

  if (teamError) throw teamError

  // 2. Get all team codes for this team
  const { data: teamCodes, error: codesError } = await supabase
    .from('team_codes')
    .select('id, code, timepoint, active')
    .eq('team_id', teamId)

  if (codesError) throw codesError

  // 3. For each timepoint, get assessment responses and compute stats
  const reportByTimepoint = {}

  for (const tp of TIMEPOINT_ORDER) {
    const teamCode = teamCodes.find(tc => tc.timepoint === tp)
    if (!teamCode) {
      reportByTimepoint[tp] = null
      continue
    }

    // Get assessment response IDs for this timepoint
    const { data: assessmentResponses, error: arError } = await supabase
      .from('assessment_responses')
      .select('id')
      .eq('team_code_id', teamCode.id)

    if (arError) throw arError
    const arIds = (assessmentResponses || []).map(ar => ar.id)

    if (arIds.length === 0) {
      reportByTimepoint[tp] = { n: 0, demographics: null, stss: null, proqol: null, stsioa: null, completion: { responses: 0 } }
      continue
    }

    // Fetch all data in parallel
    const [demographicsRes, stssRes, proqolRes, stsioaRes] = await Promise.all([
      supabase.from('demographics').select('*').in('assessment_response_id', arIds),
      supabase.from('stss_responses').select('*').in('assessment_response_id', arIds),
      supabase.from('proqol_responses').select('*').in('assessment_response_id', arIds),
      supabase.from('stsioa_responses').select('*').in('assessment_response_id', arIds)
    ])

    const demographics = demographicsRes.data || []
    const stssResponses = stssRes.data || []
    const proqolResponses = proqolRes.data || []
    const stsioaResponses = stsioaRes.data || []

    // Process demographics
    let femaleCount = 0, maleCount = 0, ageSum = 0, ageCount = 0, serviceSum = 0, serviceCount = 0
    const exposureLevels = []
    demographics.forEach(d => {
      if (d.gender === 'F') femaleCount++
      if (d.gender === 'M') maleCount++
      if (d.age) { ageSum += d.age; ageCount++ }
      if (d.years_in_service !== null && d.years_in_service !== undefined) { serviceSum += d.years_in_service; serviceCount++ }
      if (d.exposure_level !== null && d.exposure_level !== undefined) exposureLevels.push(d.exposure_level)
    })

    const demoStats = demographics.length > 0 ? {
      n: demographics.length,
      femalePercent: (femaleCount / demographics.length * 100).toFixed(1),
      malePercent: (maleCount / demographics.length * 100).toFixed(1),
      avgAge: ageCount > 0 ? (ageSum / ageCount).toFixed(1) : 'N/A',
      avgYearsService: serviceCount > 0 ? (serviceSum / serviceCount).toFixed(1) : 'N/A',
      exposureMean: exposureLevels.length > 0 ? (exposureLevels.reduce((a, b) => a + b, 0) / exposureLevels.length).toFixed(1) : 'N/A',
      exposureSD: exposureLevels.length > 1 ? stddev(exposureLevels).toFixed(1) : 'N/A'
    } : null

    // Process STSS
    const stssScores = stssResponses.map(r => ({
      total: r.total_score || 0,
      intrusion: computeSTSSSubscale(r, STSS_SUBSCALES.intrusion.items),
      avoidance: computeSTSSSubscale(r, STSS_SUBSCALES.avoidance.items),
      negCognitions: computeSTSSSubscale(r, STSS_SUBSCALES.negCognitions.items),
      arousal: computeSTSSSubscale(r, STSS_SUBSCALES.arousal.items)
    }))

    const stssStats = stssScores.length > 0 ? {
      n: stssScores.length,
      total: { mean: stssScores.reduce((s, r) => s + r.total, 0) / stssScores.length, sd: stddev(stssScores.map(r => r.total)) },
      intrusion: { mean: stssScores.reduce((s, r) => s + r.intrusion, 0) / stssScores.length, sd: stddev(stssScores.map(r => r.intrusion)) },
      avoidance: { mean: stssScores.reduce((s, r) => s + r.avoidance, 0) / stssScores.length, sd: stddev(stssScores.map(r => r.avoidance)) },
      negCognitions: { mean: stssScores.reduce((s, r) => s + r.negCognitions, 0) / stssScores.length, sd: stddev(stssScores.map(r => r.negCognitions)) },
      arousal: { mean: stssScores.reduce((s, r) => s + r.arousal, 0) / stssScores.length, sd: stddev(stssScores.map(r => r.arousal)) }
    } : null

    // Process ProQOL
    const proqolScores = proqolResponses.filter(r => r.compassion_satisfaction_score !== null).map(r => ({
      cs: r.compassion_satisfaction_score,
      burnout: r.burnout_score,
      sts: r.secondary_trauma_score
    }))

    const proqolStats = proqolScores.length > 0 ? {
      n: proqolScores.length,
      cs: { mean: proqolScores.reduce((s, r) => s + r.cs, 0) / proqolScores.length, sd: stddev(proqolScores.map(r => r.cs)) },
      burnout: { mean: proqolScores.reduce((s, r) => s + r.burnout, 0) / proqolScores.length, sd: stddev(proqolScores.map(r => r.burnout)) },
      sts: { mean: proqolScores.reduce((s, r) => s + r.sts, 0) / proqolScores.length, sd: stddev(proqolScores.map(r => r.sts)) }
    } : null

    // Process STSI-OA
    const stsioaScores = stsioaResponses.map(r => ({
      total: (r.domain_1_score || 0) + (r.domain_2_score || 0) + (r.domain_3_score || 0) + (r.domain_4_score || 0) + (r.domain_5_score || 0) + (r.domain_6_score || 0),
      resilience: r.domain_1_score || 0,
      safety: r.domain_2_score || 0,
      policies: r.domain_3_score || 0,
      leadership: r.domain_4_score || 0,
      routine: r.domain_5_score || 0,
      evaluation: r.domain_6_score || 0
    }))

    const stsioaStats = stsioaScores.length > 0 ? {
      n: stsioaScores.length,
      total: { mean: stsioaScores.reduce((s, r) => s + r.total, 0) / stsioaScores.length, sd: stddev(stsioaScores.map(r => r.total)) },
      resilience: { mean: stsioaScores.reduce((s, r) => s + r.resilience, 0) / stsioaScores.length, sd: stddev(stsioaScores.map(r => r.resilience)) },
      safety: { mean: stsioaScores.reduce((s, r) => s + r.safety, 0) / stsioaScores.length, sd: stddev(stsioaScores.map(r => r.safety)) },
      policies: { mean: stsioaScores.reduce((s, r) => s + r.policies, 0) / stsioaScores.length, sd: stddev(stsioaScores.map(r => r.policies)) },
      leadership: { mean: stsioaScores.reduce((s, r) => s + r.leadership, 0) / stsioaScores.length, sd: stddev(stsioaScores.map(r => r.leadership)) },
      routine: { mean: stsioaScores.reduce((s, r) => s + r.routine, 0) / stsioaScores.length, sd: stddev(stsioaScores.map(r => r.routine)) },
      evaluation: { mean: stsioaScores.reduce((s, r) => s + r.evaluation, 0) / stsioaScores.length, sd: stddev(stsioaScores.map(r => r.evaluation)) }
    } : null

    // Completion stats
    const completion = {
      responses: arIds.length,
      demographics: demographics.length,
      stss: stssResponses.length,
      proqol: proqolResponses.length,
      stsioa: stsioaResponses.length
    }

    reportByTimepoint[tp] = {
      n: arIds.length,
      demographics: demoStats,
      stss: stssStats,
      proqol: proqolStats,
      stsioa: stsioaStats,
      completion
    }
  }

  // 4. Get admin reviews for this team
  const { data: reviews, error: reviewsError } = await supabase
    .from('admin_reviews')
    .select('*')
    .eq('team_id', teamId)

  const reviewsByTimepoint = {}
  if (!reviewsError && reviews) {
    reviews.forEach(r => { reviewsByTimepoint[r.timepoint] = r })
  }

  return {
    team: {
      id: team.id,
      teamName: team.team_name,
      agencyName: team.agency_name,
      displayName: team.display_name || team.team_name,
      motto: team.motto,
      collaborativeName: team.collaboratives?.name || 'Unknown'
    },
    teamCodes,
    data: reportByTimepoint,
    reviews: reviewsByTimepoint
  }
}
