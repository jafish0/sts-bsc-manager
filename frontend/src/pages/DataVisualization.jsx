import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function DataVisualization() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [collaboratives, setCollaboratives] = useState([])
  const [teams, setTeams] = useState([])
  const [selectedCollaborative, setSelectedCollaborative] = useState(null)
  const [selectedTimepoint, setSelectedTimepoint] = useState('baseline')
  const [selectedTeam, setSelectedTeam] = useState('all')
  const [data, setData] = useState(null)

  const timepoints = [
    { value: 'baseline', label: 'Baseline' },
    { value: 'endline', label: 'Endline' },
    { value: '6_month', label: '6-Month Follow-up' },
    { value: '12_month', label: '12-Month Follow-up' }
  ]

  useEffect(() => {
    loadCollaboratives()
  }, [])

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
    } catch (error) {
      console.error('Error loading collaboratives:', error)
      alert('Error loading collaboratives')
    } finally {
      setLoading(false)
    }
  }

  const loadTeams = async () => {
    try {
      const { data, error} = await supabase
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
        .select(`
          id,
          team_name,
          agency_name,
          team_codes (
            id,
            code,
            timepoint
          )
        `)
        .eq('collaborative_id', selectedCollaborative)

      if (teamsError) throw teamsError

      // Filter by selected team if not 'all'
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
        setData({
          totalResponses: 0,
          demographics: {},
          stss: {},
          proqol: {},
          stsioa: {}
        })
        setLoading(false)
        return
      }

      // Get assessment_response_ids for these team codes
      const { data: assessmentResponses, error: arError } = await supabase
        .from('assessment_responses')
        .select('id')
        .in('team_code_id', codeIds)

      if (arError) throw arError

      const assessmentResponseIds = assessmentResponses.map(ar => ar.id)

      if (assessmentResponseIds.length === 0) {
        setData({
          totalResponses: 0,
          demographics: {},
          stss: {},
          proqol: {},
          stsioa: {}
        })
        setLoading(false)
        return
      }

      // Fetch all assessment data using assessment_response_id
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

      // Debug logging
      console.log('=== DATA FETCHING DEBUG ===')
      console.log('Assessment Response IDs:', assessmentResponseIds.length)
      console.log('Demographics count:', demographics.length)
      console.log('STSS responses count:', stssResponses.length)
      console.log('ProQOL responses count:', proqolResponses.length)
      console.log('STSIOA responses count:', stsioaResponses.length)
      console.log('STSS sample:', stssResponses[0])
      console.log('STSIOA sample:', stsioaResponses[0])

      // Process demographics
      const jobRoleCounts = {}
      const areaOfRespCounts = {}
      const exposureLevels = []
      let totalAge = 0
      let totalYearsService = 0
      let femaleCount = 0
      let ageCount = 0
      let serviceCount = 0

      demographics.forEach(d => {
        // Job roles
        if (d.job_role) {
          jobRoleCounts[d.job_role] = (jobRoleCounts[d.job_role] || 0) + 1
        }
        // Area of responsibility - handle array
        if (d.areas_of_responsibility) {
          const areas = Array.isArray(d.areas_of_responsibility) 
            ? d.areas_of_responsibility 
            : JSON.parse(d.areas_of_responsibility)
          areas.forEach(area => {
            areaOfRespCounts[area] = (areaOfRespCounts[area] || 0) + 1
          })
        }
        // Exposure level
        if (d.exposure_level !== null) {
          exposureLevels.push(d.exposure_level)
        }
        // Demographics summary
        if (d.gender === 'F') femaleCount++
        if (d.age) {
          totalAge += d.age
          ageCount++
        }
        if (d.years_in_service) {
          totalYearsService += d.years_in_service
          serviceCount++
        }
      })

      // Calculate exposure percentiles
      const exposurePercentiles = { '0-25': 0, '25-50': 0, '50-75': 0, '75-100': 0 }
      exposureLevels.forEach(level => {
        if (level <= 25) exposurePercentiles['0-25']++
        else if (level <= 50) exposurePercentiles['25-50']++
        else if (level <= 75) exposurePercentiles['50-75']++
        else exposurePercentiles['75-100']++
      })

      // Process STSS - use pre-calculated scores from database
      const stssScores = stssResponses.map(r => ({
        total: r.total_score || 0,
        intrusion: r.intrusion_score || 0,
        avoidance: r.avoidance_score || 0,
        negCognition: r.neg_cognition_score || r.negative_cognition_score || 0,
        arousal: r.arousal_score || 0
      }))

      const avgSTSS = stssScores.length > 0 ? {
        total: stssScores.reduce((sum, s) => sum + s.total, 0) / stssScores.length,
        intrusion: stssScores.reduce((sum, s) => sum + s.intrusion, 0) / stssScores.length,
        avoidance: stssScores.reduce((sum, s) => sum + s.avoidance, 0) / stssScores.length,
        negCognition: stssScores.reduce((sum, s) => sum + s.negCognition, 0) / stssScores.length,
        arousal: stssScores.reduce((sum, s) => sum + s.arousal, 0) / stssScores.length
      } : null

      // Process ProQOL Burnout
      const burnoutScores = proqolResponses.map(r => {
        // Burnout = items 1,4,8,10,15,17,19,21,26,27 (reverse: 1,4,15,17,19)
        const reverse = (val) => 6 - val
        return (
          reverse(r.q1 || 1) + (r.q4 || 1) + (r.q8 || 1) + (r.q10 || 1) +
          reverse(r.q15 || 1) + reverse(r.q17 || 1) + reverse(r.q19 || 1) +
          (r.q21 || 1) + (r.q26 || 1) + (r.q27 || 1)
        )
      })

      const avgBurnout = burnoutScores.length > 0 
        ? burnoutScores.reduce((sum, s) => sum + s, 0) / burnoutScores.length 
        : null

      // Process STSI-OA - use pre-calculated domain scores from database
      const stsioaScores = stsioaResponses.map(r => {
        const domain1 = r.domain_1_score || 0
        const domain2 = r.domain_2_score || 0
        const domain3 = r.domain_3_score || 0
        const domain4 = r.domain_4_score || 0
        const domain5 = r.domain_5_score || 0
        const domain6 = r.domain_6_score || 0
        return {
          total: domain1 + domain2 + domain3 + domain4 + domain5 + domain6,
          resilience: domain1,
          safety: domain2,
          policies: domain3,
          leadership: domain4,
          routine: domain5,
          evaluation: domain6
        }
      })

      const avgSTSIOA = stsioaScores.length > 0 ? {
        total: stsioaScores.reduce((sum, s) => sum + s.total, 0) / stsioaScores.length,
        resilience: stsioaScores.reduce((sum, s) => sum + s.resilience, 0) / stsioaScores.length,
        safety: stsioaScores.reduce((sum, s) => sum + s.safety, 0) / stsioaScores.length,
        policies: stsioaScores.reduce((sum, s) => sum + s.policies, 0) / stsioaScores.length,
        leadership: stsioaScores.reduce((sum, s) => sum + s.leadership, 0) / stsioaScores.length,
        routine: stsioaScores.reduce((sum, s) => sum + s.routine, 0) / stsioaScores.length,
        evaluation: stsioaScores.reduce((sum, s) => sum + s.evaluation, 0) / stsioaScores.length
      } : null

      // Calculate STSI-OA scores by job role - use pre-calculated domain scores
      const stsioaByJobRole = {}
      stsioaResponses.forEach(response => {
        const demo = demographics.find(d => d.assessment_response_id === response.assessment_response_id)
        if (demo && demo.job_role) {
          if (!stsioaByJobRole[demo.job_role]) {
            stsioaByJobRole[demo.job_role] = []
          }
          const total = (response.domain_1_score || 0) + (response.domain_2_score || 0) +
                       (response.domain_3_score || 0) + (response.domain_4_score || 0) +
                       (response.domain_5_score || 0) + (response.domain_6_score || 0)
          stsioaByJobRole[demo.job_role].push(total)
        }
      })

      // Calculate mean and SD for each job role
      const stsioaJobRoleStats = {}
      Object.keys(stsioaByJobRole).forEach(jobRole => {
        const scores = stsioaByJobRole[jobRole]
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length
        const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length
        const sd = Math.sqrt(variance)
        stsioaJobRoleStats[jobRole] = { mean: mean.toFixed(2), sd: sd.toFixed(2), count: scores.length }
      })

      setData({
        totalResponses: demographics.length,
        demographics: {
          jobRoles: jobRoleCounts,
          areasOfResp: areaOfRespCounts,
          femalePercent: demographics.length > 0 ? (femaleCount / demographics.length * 100).toFixed(1) : 0,
          avgAge: ageCount > 0 ? (totalAge / ageCount).toFixed(1) : 0,
          avgYearsService: serviceCount > 0 ? (totalYearsService / serviceCount).toFixed(1) : 0,
          exposureAvg: exposureLevels.length > 0 ? (exposureLevels.reduce((a,b) => a + b, 0) / exposureLevels.length).toFixed(2) : 0,
          exposurePercentiles
        },
        stss: avgSTSS,
        proqol: avgBurnout,
        stsioa: avgSTSIOA,
        stsioaByJobRole: stsioaJobRoleStats
      })
    } catch (error) {
      console.error('Error loading data:', error)
      alert('Error loading visualization data')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const getCurrentDate = () => {
    const now = new Date()
    return now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  const selectedCollaborativeName = collaboratives.find(c => c.id === selectedCollaborative)?.name || ''
  const selectedTeamName = selectedTeam === 'all' ? 'All Teams' : teams.find(t => t.id === selectedTeam)?.team_name || ''

  // Helper to create pie chart
  const PieChart = ({ data, colors }) => {
    if (!data || Object.keys(data).length === 0) {
      return <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>No data available</div>
    }

    const total = Object.values(data).reduce((sum, val) => sum + val, 0)
    let currentAngle = 0

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <div style={{ position: 'relative', width: '200px', height: '200px', margin: '0 auto 1rem' }}>
          <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
            {Object.entries(data).map(([key, value], index) => {
              const percentage = (value / total) * 100
              const angle = (percentage / 100) * 360
              const startAngle = currentAngle
              const midAngle = startAngle + angle / 2
              currentAngle += angle

              // Calculate path for pie slice
              const x1 = 50 + 40 * Math.cos((Math.PI * startAngle) / 180)
              const y1 = 50 + 40 * Math.sin((Math.PI * startAngle) / 180)
              const x2 = 50 + 40 * Math.cos((Math.PI * (startAngle + angle)) / 180)
              const y2 = 50 + 40 * Math.sin((Math.PI * (startAngle + angle)) / 180)
              const largeArc = angle > 180 ? 1 : 0

              // Calculate label position (at 70% of radius from center)
              const labelX = 50 + 28 * Math.cos((Math.PI * midAngle) / 180)
              const labelY = 50 + 28 * Math.sin((Math.PI * midAngle) / 180)

              return (
                <g key={key}>
                  <path
                    d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
                    fill={colors[index % colors.length]}
                    stroke="white"
                    strokeWidth="0.5"
                  />
                  {percentage > 5 && (
                    <text
                      x={labelX}
                      y={labelY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="4"
                      fontWeight="bold"
                      fill="white"
                      stroke="rgba(0,0,0,0.3)"
                      strokeWidth="0.3"
                      transform={`rotate(90 ${labelX} ${labelY})`}
                    >
                      {percentage.toFixed(0)}%
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>
        <div style={{
          width: '100%',
          fontSize: '0.7rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          justifyContent: 'center'
        }}>
          {Object.entries(data).map(([key, value], index) => {
            const percentage = ((value / total) * 100).toFixed(1)
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', minWidth: 'fit-content' }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  backgroundColor: colors[index % colors.length],
                  marginRight: '0.3rem',
                  flexShrink: 0
                }} />
                <span style={{ whiteSpace: 'nowrap' }}>{key} ({percentage}%)</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Helper to create bar chart
  const BarChart = ({ data, maxValue, color, height = 200 }) => {
    if (!data || Object.keys(data).length === 0) {
      return <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>No data available</div>
    }

    const barWidth = 80 / Object.keys(data).length
    const chartHeight = height

    return (
      <div style={{ width: '100%', height: `${chartHeight}px`, position: 'relative', marginTop: '1rem' }}>
        {/* Y-axis labels */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 20, width: '30px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '0.7rem', textAlign: 'right', paddingRight: '5px' }}>
          <span>{maxValue}</span>
          <span>{(maxValue * 0.75).toFixed(0)}</span>
          <span>{(maxValue * 0.5).toFixed(0)}</span>
          <span>{(maxValue * 0.25).toFixed(0)}</span>
          <span>0</span>
        </div>

        {/* Chart area */}
        <div style={{ position: 'absolute', left: '35px', right: 0, top: 0, bottom: 0 }}>
          <svg width="100%" height={chartHeight} style={{ overflow: 'visible' }}>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map(pct => (
              <line
                key={pct}
                x1="0"
                y1={chartHeight * (1 - pct) - 20}
                x2="100%"
                y2={chartHeight * (1 - pct) - 20}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
            ))}

            {/* Bars */}
            {Object.entries(data).map(([label, value], index) => {
              const x = (index / Object.keys(data).length) * 100
              const barHeight = ((value / maxValue) * (chartHeight - 20))
              const y = chartHeight - barHeight - 20

              return (
                <g key={label}>
                  <rect
                    x={`${x}%`}
                    y={y}
                    width={`${barWidth * 0.8}%`}
                    height={barHeight}
                    fill={color}
                  />
                  <text
                    x={`${x + barWidth * 0.4}%`}
                    y={y - 5}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#000"
                  >
                    M={value.toFixed(2)}
                  </text>
                  <text
                    x={`${x + barWidth * 0.4}%`}
                    y={chartHeight}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#000"
                    style={{ writingMode: 'horizontal-tb' }}
                  >
                    {label.length > 15 ? label.substring(0, 15) + '...' : label}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📊</div>
          <div>Loading data...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      {/* Header */}
      <div style={{ 
        background: '#0E1F56', 
        color: 'white', 
        padding: '1rem 2rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button
              onClick={() => navigate('/admin')}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              ← Back
            </button>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Data Visualization</h1>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => window.print()}
              style={{
                padding: '0.5rem 1rem',
                background: '#4682b4',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              📄 Download PDF
            </button>
            <button
              onClick={handleLogout}
              style={{
                padding: '0.5rem 1rem',
                background: '#00A79D',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: 'white', borderBottom: '2px solid #e5e7eb', padding: '1rem 2rem' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 250px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', color: '#374151' }}>
              Collaborative
            </label>
            <select
              value={selectedCollaborative || ''}
              onChange={(e) => setSelectedCollaborative(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
            >
              {collaboratives.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', color: '#374151' }}>
              Timepoint
            </label>
            <select
              value={selectedTimepoint}
              onChange={(e) => setSelectedTimepoint(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
            >
              {timepoints.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', color: '#374151' }}>
              Team
            </label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
            >
              <option value="all">All Teams</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.team_name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Dashboard */}
      {data && (
        <div style={{
          maxWidth: '1400px',
          margin: '2rem auto',
          background: 'linear-gradient(135deg, #4682b4 0%, #87ceeb 100%)',
          padding: '2rem',
          borderRadius: '0.5rem',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Diagonal stripes background */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,.05) 35px, rgba(255,255,255,.05) 70px)',
            pointerEvents: 'none'
          }} />

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Title Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '2rem',
              color: 'white',
              fontSize: '2rem',
              fontWeight: 'bold'
            }}>
              <div>{selectedCollaborativeName} {selectedTeam !== 'all' && `- ${selectedTeamName}`} (N={data.totalResponses})</div>
              <div style={{ fontSize: '1.5rem' }}>DATE: {getCurrentDate()}</div>
            </div>

            {/* Row 1: Demographics, Job Role, Area of Responsibility, STSI-OA */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: '1rem', marginBottom: '1rem' }}>
              {/* Demographics */}
              <div style={{ background: 'white', borderRadius: '0.5rem', padding: '1rem' }}>
                <div style={{ background: '#4682b4', color: 'white', padding: '0.5rem', marginBottom: '1rem', fontWeight: 'bold', textAlign: 'center' }}>
                  Demographics
                </div>
                <div style={{ fontSize: '0.85rem', lineHeight: '1.6' }}>
                  <p>Respondents were mostly female ({data.demographics.femalePercent}%). The age of respondents ranged with an average age of {data.demographics.avgAge}.</p>
                  <p>The number of years in service of respondents ranged with an average of {data.demographics.avgYearsService} years.</p>
                </div>
              </div>

              {/* Job Role */}
              <div style={{ background: 'white', borderRadius: '0.5rem', padding: '1rem' }}>
                <div style={{ background: '#4682b4', color: 'white', padding: '0.5rem', marginBottom: '1rem', fontWeight: 'bold', textAlign: 'center' }}>
                  Job Role
                </div>
                <PieChart 
                  data={data.demographics.jobRoles}
                  colors={['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#84cc16']}
                />
              </div>

              {/* Area of Responsibility */}
              <div style={{ background: 'white', borderRadius: '0.5rem', padding: '1rem' }}>
                <div style={{ background: '#4682b4', color: 'white', padding: '0.5rem', marginBottom: '1rem', fontWeight: 'bold', textAlign: 'center' }}>
                  Area of Responsibility
                </div>
                <PieChart 
                  data={data.demographics.areasOfResp}
                  colors={['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#84cc16']}
                />
              </div>

              {/* STSI-OA */}
              <div style={{ background: 'white', borderRadius: '0.5rem', padding: '1rem' }}>
                <div style={{ background: '#4682b4', color: 'white', padding: '0.5rem', marginBottom: '0.5rem', fontWeight: 'bold', textAlign: 'center' }}>
                  Secondary Traumatic Stress-Informed Organization Assessment (STSI-OA)
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '0.5rem' }}>
                  Higher STSI-OA Scores indicate more STS informed
                </div>
                {data.stsioa ? (
                  <>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem', textAlign: 'center' }}>
                          Mean STSI-OA Total Score
                        </div>
                        <BarChart
                          data={{ 'Total Score': data.stsioa.total }}
                          maxValue={150}
                          color="#4682b4"
                          height={150}
                        />
                        <div style={{ textAlign: 'center', fontSize: '0.7rem', marginTop: '0.5rem' }}>
                          50th Percentile
                        </div>
                      </div>
                      <div style={{ flex: 2 }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem', textAlign: 'center' }}>
                          Mean Subscale STSI-OA Score
                        </div>
                        <BarChart
                          data={{
                            'Resilience': data.stsioa.resilience,
                            'Safety': data.stsioa.safety,
                            'Policies': data.stsioa.policies,
                            'Leadership': data.stsioa.leadership,
                            'Routine': data.stsioa.routine,
                            'Evaluation': data.stsioa.evaluation
                          }}
                          maxValue={45}
                          color="#10b981"
                          height={150}
                        />
                      </div>
                    </div>
                    <div style={{ fontSize: '0.7rem', marginTop: '0.5rem', padding: '0.5rem', background: '#f3f4f6', borderRadius: '0.25rem' }}>
                      Mean scores across subscales show organizational STS-informed practices.
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>No STSI-OA data available</div>
                )}
              </div>
            </div>

            {/* Row 2: Exposure, STSS, ProQOL */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '1rem' }}>
              {/* Level of Exposure */}
              <div style={{ background: 'white', borderRadius: '0.5rem', padding: '1rem' }}>
                <div style={{ background: '#4682b4', color: 'white', padding: '0.5rem', marginBottom: '1rem', fontWeight: 'bold', textAlign: 'center' }}>
                  Level of Exposure
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Level of exposure to traumatic material
                </div>
                <PieChart 
                  data={data.demographics.exposurePercentiles}
                  colors={['#10b981', '#3b82f6', '#f59e0b', '#ef4444']}
                />
                <div style={{ fontSize: '0.75rem', marginTop: '1rem', textAlign: 'center' }}>
                  The average rank (0-100) of level of exposure to traumatic material was {data.demographics.exposureAvg}
                </div>
              </div>

              {/* STSS */}
              <div style={{ background: 'white', borderRadius: '0.5rem', padding: '1rem' }}>
                <div style={{ background: '#4682b4', color: 'white', padding: '0.5rem', marginBottom: '0.5rem', fontWeight: 'bold', textAlign: 'center' }}>
                  Secondary Traumatic Stress Scale (STSS)
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '0.5rem' }}>
                  Higher STSS Scores indicate higher Secondary Traumatic Stress (STS)
                </div>
                {data.stss ? (
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem', textAlign: 'center' }}>
                        Mean STSS Total Score
                      </div>
                      <BarChart
                        data={{ 'Total Score': data.stss.total }}
                        maxValue={100}
                        color="#4682b4"
                        height={150}
                      />
                    </div>
                    <div style={{ flex: 2 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem', textAlign: 'center' }}>
                        Mean Subscale STSS Scores
                      </div>
                      <BarChart
                        data={{
                          'Intrusion Subscale (5-25)': data.stss.intrusion,
                          'Avoidance Subscale (2-10)': data.stss.avoidance,
                          'Negative Cognitions and Mood Subscale (7-35)': data.stss.negCognition,
                          'Arousal Subscale (6-30)': data.stss.arousal
                        }}
                        maxValue={35}
                        color="#10b981"
                        height={150}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>No STSS data available</div>
                )}
              </div>

              {/* ProQOL Burnout */}
              <div style={{ background: 'white', borderRadius: '0.5rem', padding: '1rem' }}>
                <div style={{ background: '#4682b4', color: 'white', padding: '0.5rem', marginBottom: '1rem', fontWeight: 'bold', textAlign: 'center' }}>
                  ProQOL Burnout
                </div>
                <div style={{ fontSize: '0.75rem', marginBottom: '1rem', textAlign: 'center' }}>
                  ProQOL Burnout Scores: 22 or less= low burnout; 23-41= average; 42 or above=high
                </div>
                {data.proqol !== null ? (
                  <>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem', textAlign: 'center' }}>
                      Mean ProQOL Burnout Score
                    </div>
                    <BarChart
                      data={{ 'Burnout': data.proqol }}
                      maxValue={50}
                      color="#f59e0b"
                      height={150}
                    />
                    <div style={{ fontSize: '0.7rem', marginTop: '0.5rem', padding: '0.5rem', background: '#f3f4f6', borderRadius: '0.25rem' }}>
                      {data.proqol <= 22 ? 'Low burnout' : data.proqol <= 41 ? 'Average burnout' : 'High burnout'}
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>No ProQOL data available</div>
                )}
              </div>
            </div>

            {/* Row 3: STSI-OA Job Role Comparison */}
            {data.stsioaByJobRole && Object.keys(data.stsioaByJobRole).length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ background: 'white', borderRadius: '0.5rem', padding: '1.5rem' }}>
                  <div style={{ background: '#4682b4', color: 'white', padding: '0.5rem', marginBottom: '1rem', fontWeight: 'bold', textAlign: 'center' }}>
                    STSI-OA Scores by Job Role
                  </div>
                  <div style={{ fontSize: '0.85rem', lineHeight: '1.8', marginBottom: '1rem' }}>
                    {Object.entries(data.stsioaByJobRole).map(([jobRole, stats], index, arr) => (
                      <span key={jobRole}>
                        <strong>{jobRole}</strong> (M={stats.mean}, SD={stats.sd}, n={stats.count})
                        {index < arr.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.8rem', fontStyle: 'italic', color: '#666', marginTop: '0.5rem' }}>
                    Note: Higher scores indicate more STS-informed organizational practices. Scores range from 0-148.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!data && !loading && (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#666' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
          <div style={{ fontSize: '1.25rem' }}>No data available for the selected filters</div>
          <div style={{ marginTop: '0.5rem' }}>Try selecting a different collaborative or timepoint</div>
        </div>
      )}
    </div>
  )
}