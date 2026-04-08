import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import {
  STSIOA_DOMAIN_MAX, STSIOA_TOTAL_MAX, STSS_SUBSCALES, COLORS, PIE_COLORS,
  TIMEPOINTS, computeSTSSSubscale, stddev, cardStyle, cardHeaderStyle, subtitleStyle,
  K_ANONYMITY_THRESHOLD
} from '../utils/constants'
import { STSIOA_DOMAINS } from '../config/stsioa'
import { exportDataVizExcel } from '../utils/exportExcel'

export default function DataVisualization() {
  const navigate = useNavigate()
  const { user, profile, isSuperAdmin, isAgencyAdmin, isTeamMember } = useAuth()
  const [loading, setLoading] = useState(true)
  const [collaboratives, setCollaboratives] = useState([])
  const [teams, setTeams] = useState([])
  const [selectedCollaborative, setSelectedCollaborative] = useState(null)
  const [selectedTimepoint, setSelectedTimepoint] = useState('baseline')
  const [selectedTeam, setSelectedTeam] = useState('all')
  const [data, setData] = useState(null)
  const [timepointAutoSet, setTimepointAutoSet] = useState(false)

  const timepoints = TIMEPOINTS

  useEffect(() => {
    loadCollaboratives()
  }, [profile])

  useEffect(() => {
    if (selectedCollaborative) {
      loadTeams()
      loadData()
    }
  }, [selectedCollaborative, selectedTimepoint, selectedTeam])

  const loadCollaboratives = async () => {
    try {
      const { data, error } = await supabase
        .from('collaboratives')
        .select('*')
        .order('name')

      if (error) throw error
      setCollaboratives(data || [])
      if (data && data.length > 0) {
        setSelectedCollaborative(data[0].id)
      }

      // Agency admins: pre-select their team and find most recent timepoint
      if ((isAgencyAdmin || isTeamMember) && profile?.team_id) {
        setSelectedTeam(profile.team_id)
        autoSelectLatestTimepoint(profile.team_id)
      }
    } catch (error) {
      console.error('Error loading collaboratives:', error)
    } finally {
      setLoading(false)
    }
  }

  // Find the most recent timepoint that has data for this team
  const autoSelectLatestTimepoint = async (teamId) => {
    try {
      const { data: codes } = await supabase
        .from('team_codes')
        .select('id, timepoint')
        .eq('team_id', teamId)

      if (!codes || codes.length === 0) return

      // Check each timepoint from most recent to oldest
      const order = ['followup_12mo', 'followup_6mo', 'endline', 'baseline']
      for (const tp of order) {
        const code = codes.find(c => c.timepoint === tp)
        if (!code) continue
        const { count } = await supabase
          .from('assessment_responses')
          .select('id', { count: 'exact', head: true })
          .eq('team_code_id', code.id)
        if (count > 0) {
          setSelectedTimepoint(tp)
          setTimepointAutoSet(true)
          return
        }
      }
    } catch (err) {
      console.error('Error auto-selecting timepoint:', err)
    }
  }

  const loadTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, team_name, agency_name')
        .eq('collaborative_id', selectedCollaborative)
        .order('team_name')

      if (error) throw error
      setTeams(data || [])
    } catch (error) {
      console.error('Error loading teams:', error)
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      // Get teams for this collaborative
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`id, team_name, agency_name, team_codes (id, code, timepoint)`)
        .eq('collaborative_id', selectedCollaborative)

      if (teamsError) throw teamsError

      let filteredTeams = teamsData
      if (selectedTeam !== 'all') {
        filteredTeams = teamsData.filter(t => t.id === selectedTeam)
      }

      // Get all code IDs for this timepoint
      const codeIds = []
      filteredTeams.forEach(team => {
        const teamCode = team.team_codes.find(tc => tc.timepoint === selectedTimepoint)
        if (teamCode) codeIds.push(teamCode.id)
      })

      if (codeIds.length === 0) {
        setData({ totalResponses: 0, demographics: {}, stss: null, proqol: null, stsioa: null })
        setLoading(false)
        return
      }

      // Get completed assessment_response_ids for these team codes
      const { data: assessmentResponses, error: arError } = await supabase
        .from('assessment_responses')
        .select('id')
        .in('team_code_id', codeIds)

      if (arError) throw arError
      const assessmentResponseIds = assessmentResponses.map(ar => ar.id)

      if (assessmentResponseIds.length === 0) {
        setData({ totalResponses: 0, demographics: {}, stss: null, proqol: null, stsioa: null })
        setLoading(false)
        return
      }

      // Fetch all data in parallel
      const [demographicsRes, stssRes, proqolRes, stsioaRes] = await Promise.all([
        supabase.from('demographics').select('*').in('assessment_response_id', assessmentResponseIds),
        supabase.from('stss_responses').select('*').in('assessment_response_id', assessmentResponseIds),
        supabase.from('proqol_responses').select('*').in('assessment_response_id', assessmentResponseIds),
        supabase.from('stsioa_responses').select('*').in('assessment_response_id', assessmentResponseIds)
      ])

      const demographics = demographicsRes.data || []
      const stssResponses = stssRes.data || []
      const proqolResponses = proqolRes.data || []
      const stsioaResponses = stsioaRes.data || []

      // --- Process Demographics ---
      const jobRoleCounts = {}
      const areaOfRespCounts = {}
      const exposureLevels = []
      let totalAge = 0, totalYearsService = 0, femaleCount = 0, maleCount = 0, ageCount = 0, serviceCount = 0

      demographics.forEach(d => {
        if (d.job_role) jobRoleCounts[d.job_role] = (jobRoleCounts[d.job_role] || 0) + 1
        if (d.areas_of_responsibility) {
          const areas = Array.isArray(d.areas_of_responsibility)
            ? d.areas_of_responsibility
            : JSON.parse(d.areas_of_responsibility)
          areas.forEach(area => { areaOfRespCounts[area] = (areaOfRespCounts[area] || 0) + 1 })
        }
        if (d.exposure_level !== null && d.exposure_level !== undefined) exposureLevels.push(d.exposure_level)
        if (d.gender === 'F') femaleCount++
        if (d.gender === 'M') maleCount++
        if (d.age) { totalAge += d.age; ageCount++ }
        if (d.years_in_service !== null && d.years_in_service !== undefined) { totalYearsService += d.years_in_service; serviceCount++ }
      })

      const exposureMean = exposureLevels.length > 0 ? exposureLevels.reduce((a, b) => a + b, 0) / exposureLevels.length : 0
      const exposureSD = stddev(exposureLevels)

      const exposurePercentiles = { '0-25': 0, '26-50': 0, '51-75': 0, '76-100': 0 }
      exposureLevels.forEach(level => {
        if (level <= 25) exposurePercentiles['0-25']++
        else if (level <= 50) exposurePercentiles['26-50']++
        else if (level <= 75) exposurePercentiles['51-75']++
        else exposurePercentiles['76-100']++
      })

      // --- Process STSS (4-factor DSM-5) ---
      const stssScores = stssResponses.map(r => ({
        total: r.total_score || 0,
        intrusion: computeSTSSSubscale(r, STSS_SUBSCALES.intrusion.items),
        avoidance: computeSTSSSubscale(r, STSS_SUBSCALES.avoidance.items),
        negCognitions: computeSTSSSubscale(r, STSS_SUBSCALES.negCognitions.items),
        arousal: computeSTSSSubscale(r, STSS_SUBSCALES.arousal.items)
      }))

      const avgSTSS = stssScores.length > 0 ? {
        n: stssScores.length,
        total: { mean: stssScores.reduce((s, r) => s + r.total, 0) / stssScores.length, sd: stddev(stssScores.map(r => r.total)) },
        intrusion: { mean: stssScores.reduce((s, r) => s + r.intrusion, 0) / stssScores.length, sd: stddev(stssScores.map(r => r.intrusion)) },
        avoidance: { mean: stssScores.reduce((s, r) => s + r.avoidance, 0) / stssScores.length, sd: stddev(stssScores.map(r => r.avoidance)) },
        negCognitions: { mean: stssScores.reduce((s, r) => s + r.negCognitions, 0) / stssScores.length, sd: stddev(stssScores.map(r => r.negCognitions)) },
        arousal: { mean: stssScores.reduce((s, r) => s + r.arousal, 0) / stssScores.length, sd: stddev(stssScores.map(r => r.arousal)) }
      } : null

      // --- Process ProQOL (all 3 subscales from pre-calculated scores) ---
      const proqolScores = proqolResponses.filter(r => r.compassion_satisfaction_score !== null).map(r => ({
        cs: r.compassion_satisfaction_score,
        burnout: r.burnout_score,
        sts: r.secondary_trauma_score
      }))

      const avgProQOL = proqolScores.length > 0 ? {
        n: proqolScores.length,
        cs: { mean: proqolScores.reduce((s, r) => s + r.cs, 0) / proqolScores.length, sd: stddev(proqolScores.map(r => r.cs)) },
        burnout: { mean: proqolScores.reduce((s, r) => s + r.burnout, 0) / proqolScores.length, sd: stddev(proqolScores.map(r => r.burnout)) },
        sts: { mean: proqolScores.reduce((s, r) => s + r.sts, 0) / proqolScores.length, sd: stddev(proqolScores.map(r => r.sts)) }
      } : null

      // --- Process STSI-OA (domain scores from DB) ---
      const stsioaScores = stsioaResponses.map(r => ({
        total: (r.domain_1_score || 0) + (r.domain_2_score || 0) + (r.domain_3_score || 0) + (r.domain_4_score || 0) + (r.domain_5_score || 0) + (r.domain_6_score || 0),
        resilience: r.domain_1_score || 0,
        safety: r.domain_2_score || 0,
        policies: r.domain_3_score || 0,
        leadership: r.domain_4_score || 0,
        routine: r.domain_5_score || 0,
        evaluation: r.domain_6_score || 0
      }))

      const avgSTSIOA = stsioaScores.length > 0 ? {
        n: stsioaScores.length,
        total: { mean: stsioaScores.reduce((s, r) => s + r.total, 0) / stsioaScores.length, sd: stddev(stsioaScores.map(r => r.total)) },
        resilience: { mean: stsioaScores.reduce((s, r) => s + r.resilience, 0) / stsioaScores.length, sd: stddev(stsioaScores.map(r => r.resilience)) },
        safety: { mean: stsioaScores.reduce((s, r) => s + r.safety, 0) / stsioaScores.length, sd: stddev(stsioaScores.map(r => r.safety)) },
        policies: { mean: stsioaScores.reduce((s, r) => s + r.policies, 0) / stsioaScores.length, sd: stddev(stsioaScores.map(r => r.policies)) },
        leadership: { mean: stsioaScores.reduce((s, r) => s + r.leadership, 0) / stsioaScores.length, sd: stddev(stsioaScores.map(r => r.leadership)) },
        routine: { mean: stsioaScores.reduce((s, r) => s + r.routine, 0) / stsioaScores.length, sd: stddev(stsioaScores.map(r => r.routine)) },
        evaluation: { mean: stsioaScores.reduce((s, r) => s + r.evaluation, 0) / stsioaScores.length, sd: stddev(stsioaScores.map(r => r.evaluation)) }
      } : null

      // STSI-OA by job role
      const stsioaByJobRole = {}
      stsioaResponses.forEach(response => {
        const demo = demographics.find(d => d.assessment_response_id === response.assessment_response_id)
        if (demo && demo.job_role) {
          if (!stsioaByJobRole[demo.job_role]) stsioaByJobRole[demo.job_role] = []
          const total = (response.domain_1_score || 0) + (response.domain_2_score || 0) +
                       (response.domain_3_score || 0) + (response.domain_4_score || 0) +
                       (response.domain_5_score || 0) + (response.domain_6_score || 0)
          stsioaByJobRole[demo.job_role].push(total)
        }
      })

      const stsioaJobRoleStats = {}
      Object.keys(stsioaByJobRole).forEach(jobRole => {
        const scores = stsioaByJobRole[jobRole]
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length
        stsioaJobRoleStats[jobRole] = { mean: mean.toFixed(2), sd: stddev(scores).toFixed(2), count: scores.length }
      })

      setData({
        totalResponses: demographics.length,
        demographics: {
          jobRoles: jobRoleCounts,
          areasOfResp: areaOfRespCounts,
          femalePercent: demographics.length > 0 ? (femaleCount / demographics.length * 100).toFixed(1) : 0,
          malePercent: demographics.length > 0 ? (maleCount / demographics.length * 100).toFixed(1) : 0,
          avgAge: ageCount > 0 ? (totalAge / ageCount).toFixed(1) : 0,
          avgYearsService: serviceCount > 0 ? (totalYearsService / serviceCount).toFixed(1) : 0,
          exposureMean: exposureMean.toFixed(1),
          exposureSD: exposureSD.toFixed(1),
          exposurePercentiles
        },
        stss: avgSTSS,
        proqol: avgProQOL,
        stsioa: avgSTSIOA,
        stsioaByJobRole: stsioaJobRoleStats,
        stsioaRawResponses: stsioaResponses
      })
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const getCurrentDate = () => {
    return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  const selectedCollaborativeName = collaboratives.find(c => c.id === selectedCollaborative)?.name || ''
  const selectedTeamName = selectedTeam === 'all' ? 'All Teams' : teams.find(t => t.id === selectedTeam)?.agency_name || ''

  // Styles imported from utils/constants

  // --- Custom tooltip for bar charts ---
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'var(--bg-card)', padding: '0.5rem 0.75rem', border: '1px solid var(--border-light)', borderRadius: '0.25rem', fontSize: '0.8rem' }}>
          <p style={{ margin: 0, fontWeight: '600' }}>{label}</p>
          {payload.map((p, i) => (
            <p key={i} style={{ margin: '0.2rem 0 0', color: p.color }}>M = {p.value.toFixed(2)}</p>
          ))}
        </div>
      )
    }
    return null
  }

  // --- Render a Recharts PieChart ---
  const RechartsPie = ({ data, colors = PIE_COLORS }) => {
    if (!data || Object.keys(data).length === 0) {
      return <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>No data available</div>
    }
    const total = Object.values(data).reduce((sum, val) => sum + val, 0)
    const chartData = Object.entries(data).map(([name, value]) => ({ name, value, pct: ((value / total) * 100).toFixed(1) }))

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ pct }) => `${pct}%`} labelLine={false} fontSize={11}>
              {chartData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Pie>
            <Tooltip formatter={(value, name) => [`${value} (${((value / total) * 100).toFixed(1)}%)`, name]} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center', fontSize: '0.7rem' }}>
          {chartData.map((entry, i) => (
            <div key={entry.name} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: 10, height: 10, backgroundColor: colors[i % colors.length], marginRight: 4, flexShrink: 0 }} />
              <span style={{ whiteSpace: 'nowrap' }}>{entry.name}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>Loading data...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      {/* Header */}
      <div style={{ background: COLORS.navy, color: 'white', padding: '1rem 2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button onClick={() => navigate('/admin')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>
              Back
            </button>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Data Visualization</h1>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => data && exportDataVizExcel(data, { collaborative: selectedCollaborativeName, timepoint: selectedTimepoint, team: selectedTeamName })}
              disabled={!data || data.totalResponses === 0}
              style={{ padding: '0.5rem 1rem', background: data && data.totalResponses > 0 ? COLORS.green : '#9ca3af', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: data && data.totalResponses > 0 ? 'pointer' : 'not-allowed', fontWeight: '500', fontSize: '0.85rem' }}
            >
              Export Excel
            </button>
            <button onClick={() => window.print()} style={{ padding: '0.5rem 1rem', background: COLORS.blue, color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '500' }}>
              Print PDF
            </button>
            <button onClick={handleLogout} style={{ padding: '0.5rem 1rem', background: COLORS.teal, color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '500' }}>
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '2px solid var(--border)', padding: '1rem 2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Collaborative selector - hidden for agency admins (they only have one) */}
          {isSuperAdmin && (
            <div style={{ flex: '1 1 250px' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Collaborative</label>
              <select value={selectedCollaborative || ''} onChange={(e) => setSelectedCollaborative(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-light)', borderRadius: '0.375rem', fontSize: '0.875rem' }}>
                {collaboratives.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Timepoint</label>
            <select value={selectedTimepoint} onChange={(e) => setSelectedTimepoint(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-light)', borderRadius: '0.375rem', fontSize: '0.875rem' }}>
              {timepoints.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {/* Team selector - hidden for agency admins (they only see their team) */}
          {isSuperAdmin && (
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Team</label>
              <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-light)', borderRadius: '0.375rem', fontSize: '0.875rem' }}>
                <option value="all">All Teams</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.agency_name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Dashboard */}
      {data && data.totalResponses > 0 && (
        <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>
          {/* Title */}
          <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 style={{ margin: 0, color: COLORS.navy, fontSize: '1.5rem' }}>
              {selectedCollaborativeName} {selectedTeam !== 'all' && ` - ${selectedTeamName}`} <span style={{ fontWeight: 'normal', fontSize: '1.1rem' }}>(N={data.totalResponses})</span>
            </h2>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{getCurrentDate()}</div>
          </div>

          {/* K-anonymity guard for demographic breakdowns */}
          {data.totalResponses >= K_ANONYMITY_THRESHOLD ? (
            <>
              {/* Row 1: Demographics, Job Role, Area of Responsibility */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                {/* Demographics Summary */}
                <div style={cardStyle}>
                  <div style={cardHeaderStyle}>Demographics</div>
                  <div style={{ fontSize: '0.85rem', lineHeight: '1.8' }}>
                    <p style={{ margin: '0 0 0.5rem' }}>Respondents were {data.demographics.femalePercent}% female, {data.demographics.malePercent}% male.</p>
                    <p style={{ margin: '0 0 0.5rem' }}>Average age: <strong>{data.demographics.avgAge}</strong></p>
                    <p style={{ margin: '0 0 0.5rem' }}>Average years in service: <strong>{data.demographics.avgYearsService}</strong></p>
                    <p style={{ margin: 0 }}>Average exposure (0-100): <strong>{data.demographics.exposureMean}</strong> (SD={data.demographics.exposureSD})</p>
                  </div>
                </div>

                {/* Job Role */}
                <div style={cardStyle}>
                  <div style={cardHeaderStyle}>Job Role</div>
                  <RechartsPie data={data.demographics.jobRoles} />
                </div>

                {/* Area of Responsibility */}
                <div style={cardStyle}>
                  <div style={cardHeaderStyle}>Area of Responsibility</div>
                  <RechartsPie data={data.demographics.areasOfResp} />
                </div>
              </div>
            </>
          ) : (
            <div style={{ ...cardStyle, marginBottom: '1rem', textAlign: 'center', padding: '1.5rem' }}>
              <div style={cardHeaderStyle}>Demographics</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.5rem 0 0' }}>
                Demographic breakdowns are hidden when fewer than {K_ANONYMITY_THRESHOLD} responses are available to protect respondent privacy.
                Current responses: {data.totalResponses}
              </p>
            </div>
          )}

          {/* Row 2: Level of Exposure + STSS */}
          <div style={{ display: 'grid', gridTemplateColumns: data.totalResponses >= K_ANONYMITY_THRESHOLD ? '1fr 3fr' : '1fr', gap: '1rem', marginBottom: '1rem' }}>
            {/* Level of Exposure — only shown when k-anonymity threshold met */}
            {data.totalResponses >= K_ANONYMITY_THRESHOLD && (
              <div style={cardStyle}>
                <div style={cardHeaderStyle}>Level of Exposure</div>
                <div style={subtitleStyle}>Exposure to traumatic material (0-100)</div>
                <RechartsPie
                  data={data.demographics.exposurePercentiles}
                  colors={[COLORS.green, COLORS.blue, COLORS.amber, COLORS.red]}
                />
                <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.85rem', padding: '0.75rem', background: 'var(--bg-card-alt)', borderRadius: '0.25rem', border: '1px solid #e2e8f0' }}>
                  <div>Mean: <strong style={{ fontSize: '1.1rem', color: COLORS.navy }}>{data.demographics.exposureMean}</strong></div>
                  <div>SD: <strong>{data.demographics.exposureSD}</strong></div>
                </div>
              </div>
            )}

            {/* STSS */}
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>Secondary Traumatic Stress Scale (STSS) - DSM-5 4-Factor Model</div>
              <div style={subtitleStyle}>Higher scores indicate greater secondary traumatic stress (n={data.stss?.n || 0})</div>
              {data.stss ? (
                <div style={{ display: 'flex', gap: '1rem' }}>
                  {/* Total Score */}
                  <div style={{ flex: 1 }}>
                    <div style={subtitleStyle}>Total Score (17-85)</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={[{ name: 'Total', value: data.stss.total.mean }]} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 85]} tick={{ fontSize: 11 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" fill={COLORS.navy} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      M={data.stss.total.mean.toFixed(2)}, SD={data.stss.total.sd.toFixed(2)}
                    </div>
                  </div>
                  {/* Subscales */}
                  <div style={{ flex: 2 }}>
                    <div style={subtitleStyle}>Subscale Scores</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={[
                          { name: `Intrusion (${STSS_SUBSCALES.intrusion.range})`, value: data.stss.intrusion.mean, max: STSS_SUBSCALES.intrusion.max },
                          { name: `Avoidance (${STSS_SUBSCALES.avoidance.range})`, value: data.stss.avoidance.mean, max: STSS_SUBSCALES.avoidance.max },
                          { name: `Neg. Cog. & Mood (${STSS_SUBSCALES.negCognitions.range})`, value: data.stss.negCognitions.mean, max: STSS_SUBSCALES.negCognitions.max },
                          { name: `Arousal (${STSS_SUBSCALES.arousal.range})`, value: data.stss.arousal.mean, max: STSS_SUBSCALES.arousal.max }
                        ]}
                        margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={0} />
                        <YAxis domain={[0, 25]} tick={{ fontSize: 11 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" fill={COLORS.teal} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      <span>M={data.stss.intrusion.mean.toFixed(1)}</span>
                      <span>M={data.stss.avoidance.mean.toFixed(1)}</span>
                      <span>M={data.stss.negCognitions.mean.toFixed(1)}</span>
                      <span>M={data.stss.arousal.mean.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>No STSS data available</div>
              )}
            </div>
          </div>

          {/* Row 3: ProQOL + STSI-OA */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1rem' }}>
            {/* ProQOL - All 3 Subscales */}
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>Professional Quality of Life (ProQOL 5)</div>
              <div style={subtitleStyle}>Three subscales (n={data.proqol?.n || 0})</div>
              {data.proqol ? (
                <>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart
                      data={[
                        { name: 'Compassion\nSatisfaction', value: data.proqol.cs.mean },
                        { name: 'Burnout', value: data.proqol.burnout.mean },
                        { name: 'Secondary\nTraumatic Stress', value: data.proqol.sts.mean }
                      ]}
                      margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                      <YAxis domain={[0, 50]} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        <Cell fill={COLORS.green} />
                        <Cell fill={COLORS.amber} />
                        <Cell fill={COLORS.red} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ fontSize: '0.75rem', lineHeight: '1.6', marginTop: '0.5rem' }}>
                    <div><strong>CS:</strong> M={data.proqol.cs.mean.toFixed(2)}, SD={data.proqol.cs.sd.toFixed(2)} (higher = better)</div>
                    <div><strong>BO:</strong> M={data.proqol.burnout.mean.toFixed(2)}, SD={data.proqol.burnout.sd.toFixed(2)} ({data.proqol.burnout.mean <= 22 ? 'Low' : data.proqol.burnout.mean <= 41 ? 'Average' : 'High'})</div>
                    <div><strong>STS:</strong> M={data.proqol.sts.mean.toFixed(2)}, SD={data.proqol.sts.sd.toFixed(2)} (lower = better)</div>
                  </div>
                </>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>No ProQOL data available</div>
              )}
            </div>

            {/* STSI-OA with domain-specific Y-axes */}
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>STS-Informed Organizational Assessment (STSI-OA)</div>
              <div style={subtitleStyle}>Higher scores = more STS-informed (n={data.stsioa?.n || 0})</div>
              {data.stsioa ? (
                <>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    {/* Total */}
                    <div style={{ flex: 1 }}>
                      <div style={subtitleStyle}>Total (0-{STSIOA_TOTAL_MAX})</div>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={[{ name: 'Total', value: data.stsioa.total.mean }]} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis domain={[0, STSIOA_TOTAL_MAX]} tick={{ fontSize: 10 }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="value" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                      <div style={{ textAlign: 'center', fontSize: '0.75rem' }}>M={data.stsioa.total.mean.toFixed(1)}, SD={data.stsioa.total.sd.toFixed(1)}</div>
                    </div>
                    {/* Domain Subscales - normalized to percentage for comparable bars */}
                    <div style={{ flex: 2 }}>
                      <div style={subtitleStyle}>Domain Scores (raw values, domain-specific max shown)</div>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart
                          data={[
                            { name: `Resilience\n(0-${STSIOA_DOMAIN_MAX.resilience})`, value: data.stsioa.resilience.mean, max: STSIOA_DOMAIN_MAX.resilience },
                            { name: `Safety\n(0-${STSIOA_DOMAIN_MAX.safety})`, value: data.stsioa.safety.mean, max: STSIOA_DOMAIN_MAX.safety },
                            { name: `Policies\n(0-${STSIOA_DOMAIN_MAX.policies})`, value: data.stsioa.policies.mean, max: STSIOA_DOMAIN_MAX.policies },
                            { name: `Leadership\n(0-${STSIOA_DOMAIN_MAX.leadership})`, value: data.stsioa.leadership.mean, max: STSIOA_DOMAIN_MAX.leadership },
                            { name: `Routine\n(0-${STSIOA_DOMAIN_MAX.routine})`, value: data.stsioa.routine.mean, max: STSIOA_DOMAIN_MAX.routine },
                            { name: `Evaluation\n(0-${STSIOA_DOMAIN_MAX.evaluation})`, value: data.stsioa.evaluation.mean, max: STSIOA_DOMAIN_MAX.evaluation }
                          ]}
                          margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} />
                          <YAxis domain={[0, 44]} tick={{ fontSize: 10 }} label={{ value: 'Score', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="value" fill={COLORS.green} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>No STSI-OA data available</div>
              )}
            </div>
          </div>

          {/* Row 4: STSI-OA by Job Role — suppressed when below k-anonymity threshold */}
          {data.totalResponses >= K_ANONYMITY_THRESHOLD && data.stsioaByJobRole && Object.keys(data.stsioaByJobRole).length > 0 && (
            <div style={{ ...cardStyle, marginBottom: '1rem' }}>
              <div style={cardHeaderStyle}>STSI-OA Scores by Job Role</div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={Object.entries(data.stsioaByJobRole).map(([role, stats]) => ({
                    name: role,
                    value: parseFloat(stats.mean)
                  }))}
                  margin={{ top: 10, right: 30, left: 20, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" />
                  <YAxis domain={[0, STSIOA_TOTAL_MAX]} tick={{ fontSize: 11 }} label={{ value: 'Mean Total Score', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" fill={COLORS.purple} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ fontSize: '0.8rem', lineHeight: '1.8', padding: '0.5rem' }}>
                {Object.entries(data.stsioaByJobRole).map(([jobRole, stats]) => (
                  <span key={jobRole} style={{ marginRight: '1.5rem' }}>
                    <strong>{jobRole}:</strong> M={stats.mean}, SD={stats.sd}, n={stats.count}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Higher scores indicate more STS-informed organizational practices (range 0-{STSIOA_TOTAL_MAX}).
              </div>
            </div>
          )}

          {/* STSI-OA Office Visual */}
          {data.stsioaRawResponses && data.stsioaRawResponses.length > 0 && (
            <STSIOAOfficeVisual
              responses={data.stsioaRawResponses}
              teamName={selectedTeamName}
              timepoint={selectedTimepoint}
            />
          )}
        </div>
      )}

      {data && data.totalResponses === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#666' }}>
          <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No data available for the selected filters</div>
          <div>Try selecting a different collaborative or timepoint</div>
        </div>
      )}

      {!data && !loading && (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#666' }}>
          <div style={{ fontSize: '1.25rem' }}>Select a collaborative to view data</div>
        </div>
      )}
    </div>
  )
}

// --- STSI-OA Office Visual Component ---

const SCORE_COLORS = [
  { min: 4.0, max: 5.0, bg: '#00B050', text: '#000', label: 'Tested — Ready for Spread' },
  { min: 3.0, max: 3.99, bg: '#FFC000', text: '#000', label: 'Being Tested' },
  { min: 2.0, max: 2.99, bg: '#F59E0B', text: '#000', label: 'In Planning Stage' },
  { min: 1.0, max: 1.99, bg: '#EF4444', text: '#fff', label: 'Needs Attention' }
]
const NO_DATA_COLOR = { bg: '#E5E7EB', text: '#6b7280', label: 'No Data' }

function getScoreColor(mean) {
  if (mean === null) return NO_DATA_COLOR
  for (const c of SCORE_COLORS) {
    if (mean >= c.min && mean <= c.max) return c
  }
  return NO_DATA_COLOR
}

// Short labels matching the PowerPoint style
const SHORT_LABELS = {
  '1a': 'Basic knowledge about STS',
  '1b': 'Monitoring STS impact on professional well-being',
  '1c': 'Maintaining positive focus on org.\'s core mission',
  '1d': 'Instill Hope',
  '1e': 'Specific skills that enhance professional competency',
  '1f': 'Strong peer support among all staff',
  '1g': 'Healthy coping strategies',
  '2a': 'Strategies or techniques to reduce risk',
  '2b': 'Not sharing graphic details of trauma stories unnecessarily',
  '2c': 'Safety survey assessing psychological safety perceptions',
  '2d': 'Safety survey assessing physical safety perceptions',
  '2e': 'Manage risk & protect workers from dangerous situations',
  '2f': 'Training on managing potentially dangerous situations',
  '2g': 'Defined protocol for responding to critical incidents',
  '3a': 'Defined practices addressing psychological safety',
  '3b': 'Defined practices addressing physical safety',
  '3c': 'Defined procedures to promote resilience building',
  '3d': 'Strategic plan addresses staff resiliency',
  '3e': 'Strategic plan addresses staff safety',
  '3f': 'Risk management policy for high STS levels',
  '4a': 'Leadership actively encourages self-care',
  '4b': 'Leadership models good self-care',
  '4c': 'Staff input to leaders on STS policy improvement',
  '4d': 'Supervisors promote safety & resilience to STS',
  '4e': 'Supervisors refer those w/ high disturbance',
  '4f': 'Consistent supervision discussing effect of work',
  '4g': 'Additional supervision during high-risk times',
  '4h': 'Intentionally manage caseloads w/ trauma dose in mind',
  '4i': 'Leadership responds to STS as occupational hazard',
  '5a': 'Formal trainings on enhancing psychological safety',
  '5b': 'Formal trainings on enhancing physical safety',
  '5c': 'Formal trainings on enhancing resilience to STS',
  '5d': 'Activities (besides trainings) promoting resilience',
  '5e': 'Discuss STS during new employee orientation',
  '5f': 'Regular team & peer support opportunities',
  '5g': 'Release time for resilience/STS trainings',
  '6a': 'Assess STS level in the workplace',
  '6b': 'Monitor workforce trends signifying lack of safety',
  '6c': 'Respond to evaluation/feedback to build safety & resilience',
  '6d': 'Seek staff feedback on psychosocial trends'
}

function computeItemMeans(responses) {
  const items = {}
  STSIOA_DOMAINS.forEach(domain => {
    domain.questions.forEach(q => {
      const key = `item_${q.id}`
      const values = responses.map(r => r[key]).filter(v => v != null && v > 0)
      items[q.id] = values.length > 0
        ? { mean: values.reduce((a, b) => a + b, 0) / values.length, count: values.length }
        : { mean: null, count: 0 }
    })
  })
  return items
}

const TIMEPOINT_DISPLAY = {
  baseline: 'Baseline',
  endline: 'Endline',
  followup_6mo: '6-Month Follow-up',
  followup_12mo: '12-Month Follow-up'
}

function STSIOAOfficeVisual({ responses, teamName, timepoint }) {
  const [hoveredItem, setHoveredItem] = useState(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })

  const itemMeans = computeItemMeans(responses)

  const handleMouseEnter = (e, itemId) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setHoverPos({ x: rect.right + 8, y: rect.top })
    setHoveredItem(itemId)
  }

  // Render a single item as a colored cell block
  const renderCell = (q, style = {}) => {
    const data = itemMeans[q.id]
    const color = getScoreColor(data.mean)
    const label = SHORT_LABELS[q.id] || q.text
    return (
      <div
        key={q.id}
        style={{
          background: color.bg,
          color: color.text,
          padding: '0.35rem 0.4rem',
          fontSize: '0.62rem',
          lineHeight: '1.25',
          border: '1px solid rgba(0,0,0,0.15)',
          cursor: 'default',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minHeight: '44px',
          ...style
        }}
        onMouseEnter={(e) => handleMouseEnter(e, q.id)}
        onMouseLeave={() => setHoveredItem(null)}
      >
        <span>{label} ({q.id.toUpperCase()})</span>
      </div>
    )
  }

  // Get questions by domain ID
  const getQ = (domainId) => {
    const domain = STSIOA_DOMAINS.find(d => d.id === domainId)
    return domain ? domain.questions : []
  }

  // Domain header bar
  const domainHeader = (num, title) => (
    <div style={{
      background: '#FFD700', color: '#000',
      padding: '0.3rem 0.5rem', fontSize: '0.7rem', fontWeight: '700',
      textAlign: 'center', border: '2px solid #000',
      whiteSpace: 'nowrap'
    }}>
      {num}. {title}
    </div>
  )

  // Find hovered item info for tooltip
  const hoveredData = hoveredItem ? itemMeans[hoveredItem] : null
  const hoveredQ = hoveredItem ? STSIOA_DOMAINS.flatMap(d => d.questions).find(q => q.id === hoveredItem) : null
  const hoveredColor = hoveredData ? getScoreColor(hoveredData.mean) : null

  const d1 = getQ(1)
  const d2 = getQ(2)
  const d3 = getQ(3)
  const d4 = getQ(4)
  const d5 = getQ(5)
  const d6 = getQ(6)

  const bdr = '2px solid #000'

  return (
    <div style={{ ...cardStyle, marginBottom: '1rem', position: 'relative' }}>
      <div style={cardHeaderStyle}>STSI-OA Organizational Assessment — Office Visual</div>

      {/* Header info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <strong>{teamName}</strong> — {TIMEPOINT_DISPLAY[timepoint] || timepoint}
          <span style={{ color: 'var(--text-faint)', marginLeft: '0.75rem', fontSize: '0.75rem' }}>
            n = {responses.length} respondent{responses.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ fontSize: '0.6rem', color: 'var(--text-faint)', fontStyle: 'italic' }}>
          © Sprang, G., & Ross, L. Contact sprang@uky.edu for permission
        </div>
      </div>

      {/* Color Legend */}
      <div style={{
        display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem',
        padding: '0.5rem 0.75rem', background: 'var(--bg-card-alt)', borderRadius: '6px',
        border: '1px solid var(--border)'
      }}>
        <span style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-secondary)', marginRight: '0.25rem' }}>KEY:</span>
        {SCORE_COLORS.map(c => (
          <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <div style={{ width: 14, height: 14, background: c.bg, borderRadius: '2px', border: '1px solid rgba(0,0,0,0.1)' }} />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{c.label} ({c.min}–{c.max})</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <div style={{ width: 14, height: 14, background: NO_DATA_COLOR.bg, borderRadius: '2px', border: '1px solid rgba(0,0,0,0.1)' }} />
          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>No Data</span>
        </div>
      </div>

      {/* Building Layout — 3 column structure matching the reference "office" visual */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', minWidth: '820px', border: bdr, background: '#fff' }}>

          {/* LEFT COLUMN: Domain 1, Domain 2, Domain 3 */}
          <div style={{ flex: '0 0 38%', borderRight: bdr, display: 'flex', flexDirection: 'column' }}>
            {/* Domain 1 */}
            {domainHeader(1, 'Resilience Building Activities')}
            <div style={{ borderBottom: bdr }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                {d1.slice(0, 4).map(q => renderCell(q))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                {d1.slice(4).map(q => renderCell(q))}
              </div>
            </div>

            {/* Domain 2 */}
            {domainHeader(2, 'Staff Safety')}
            <div style={{ borderBottom: bdr }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                {d2.slice(0, 3).map(q => renderCell(q))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr' }}>
                {renderCell(d2[3])}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                {d2.slice(4, 7).map(q => renderCell(q))}
              </div>
            </div>

            {/* Domain 3 */}
            {domainHeader(3, 'STS-Informed Policies')}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                {d3.slice(0, 4).map(q => renderCell(q))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                {d3.slice(4).map(q => renderCell(q))}
              </div>
            </div>
          </div>

          {/* CENTER COLUMN: Domain 5 (top), Domain 4 (bottom) */}
          <div style={{ flex: '0 0 40%', borderRight: bdr, display: 'flex', flexDirection: 'column' }}>
            {/* Domain 5 */}
            {domainHeader(5, 'Routine Practices')}
            <div style={{ borderBottom: bdr }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                {d5.slice(0, 3).map(q => renderCell(q))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                {d5.slice(3, 6).map(q => renderCell(q))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr' }}>
                {d5.slice(6).map(q => renderCell(q))}
              </div>
            </div>

            {/* Domain 4 */}
            {domainHeader(4, 'Leader Practices')}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                {d4.slice(0, 2).map(q => renderCell(q))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                {d4.slice(2, 6).map(q => renderCell(q))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                {d4.slice(6, 9).map(q => renderCell(q))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Domain 6 */}
          <div style={{ flex: '0 0 22%', display: 'flex', flexDirection: 'column' }}>
            {domainHeader(6, 'Monitoring & Outcome Evaluation')}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {d6.map(q => renderCell(q, { flex: 1 }))}
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredItem && hoveredData && hoveredQ && (
        <div style={{
          position: 'fixed',
          left: Math.min(hoverPos.x, window.innerWidth - 320),
          top: hoverPos.y,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: '8px',
          padding: '0.75rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          maxWidth: '300px',
          fontSize: '0.8rem',
          pointerEvents: 'none'
        }}>
          <div style={{ fontWeight: '700', color: COLORS.navy, marginBottom: '0.3rem' }}>
            Item {hoveredItem.toUpperCase()}
          </div>
          <div style={{ color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '0.5rem' }}>
            {hoveredQ.text}
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: '600' }}>M = </span>
              {hoveredData.mean !== null ? hoveredData.mean.toFixed(2) : 'N/A'}
            </div>
            <div>
              <span style={{ fontWeight: '600' }}>n = </span>
              {hoveredData.count}
            </div>
          </div>
          {hoveredColor && (
            <div style={{
              marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem'
            }}>
              <div style={{ width: 10, height: 10, background: hoveredColor.bg, borderRadius: '2px' }} />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{hoveredColor.label}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
