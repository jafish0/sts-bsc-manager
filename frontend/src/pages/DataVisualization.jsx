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

      // Process STSS
      const stssScores = stssResponses.map(r => {
        const intrusion = (r.q1 + r.q2 + r.q3 + r.q4 + r.q5) || 0
        const avoidance = (r.q6 + r.q7) || 0
        const negCognition = (r.q8 + r.q9 + r.q10 + r.q11 + r.q12 + r.q13 + r.q14) || 0
        const arousal = (r.q15 + r.q16 + r.q17 + r.q18 + r.q19 + r.q20) || 0
        return {
          total: intrusion + avoidance + negCognition + arousal,
          intrusion,
          avoidance,
          negCognition,
          arousal
        }
      })

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

      // Process STSI-OA
      const stsioaScores = stsioaResponses.map(r => {
        const resilience = (r.q1 + r.q2 + r.q3 + r.q4 + r.q5 + r.q6 + r.q7) || 0
        const safety = (r.q8 + r.q9 + r.q10 + r.q11 + r.q12 + r.q13 + r.q14) || 0
        const policies = (r.q15 + r.q16 + r.q17 + r.q18 + r.q19 + r.q20) || 0
        const leadership = (r.q21 + r.q22 + r.q23 + r.q24 + r.q25 + r.q26) || 0
        const routine = (r.q27 + r.q28 + r.q29 + r.q30 + r.q31 + r.q32 + r.q33 + r.q34 + r.q35 + r.q36 + r.q37) || 0
        return {
          total: resilience + safety + policies + leadership + routine,
          resilience,
          safety,
          policies,
          leadership,
          routine
        }
      })

      const avgSTSIOA = stsioaScores.length > 0 ? {
        total: stsioaScores.reduce((sum, s) => sum + s.total, 0) / stsioaScores.length,
        resilience: stsioaScores.reduce((sum, s) => sum + s.resilience, 0) / stsioaScores.length,
        safety: stsioaScores.reduce((sum, s) => sum + s.safety, 0) / stsioaScores.length,
        policies: stsioaScores.reduce((sum, s) => sum + s.policies, 0) / stsioaScores.length,
        leadership: stsioaScores.reduce((sum, s) => sum + s.leadership, 0) / stsioaScores.length,
        routine: stsioaScores.reduce((sum, s) => sum + s.routine, 0) / stsioaScores.length
      } : null

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
        stsioa: avgSTSIOA
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
    const centerX = 50
    const centerY = 50
    const radius = 35

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', minHeight: '180px' }}>
        {/* Pie chart */}
        <div style={{ width: '180px', height: '180px', flexShrink: 0 }}>
          <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
            {Object.entries(data).map(([key, value], index) => {
              const percentage = (value / total) * 100
              const angle = (percentage / 100) * 360
              const startAngle = currentAngle
              currentAngle += angle

              // Calculate path for pie slice
              const x1 = centerX + radius * Math.cos((Math.PI * startAngle) / 180)
              const y1 = centerY + radius * Math.sin((Math.PI * startAngle) / 180)
              const x2 = centerX + radius * Math.cos((Math.PI * (startAngle + angle)) / 180)
              const y2 = centerY + radius * Math.sin((Math.PI * (startAngle + angle)) / 180)
              const largeArc = angle > 180 ? 1 : 0

              return (
                <path
                  key={key}
                  d={`M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                  fill={colors[index % colors.length]}
                  stroke="white"
                  strokeWidth="1"
                />
              )
            })}
          </svg>
        </div>

        {/* Legend - side by side */}
        <div style={{
          flex: 1,
          fontSize: '0.7rem',
          lineHeight: '1.6',
          maxWidth: '200px'
        }}>
          {Object.entries(data).map(([key, value], index) => {
            const percentage = ((value / total) * 100).toFixed(1)
            // Truncate long labels
            const displayKey = key.length > 20 ? key.substring(0, 20) + '...' : key
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.3rem' }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  backgroundColor: colors[index % colors.length],
                  marginRight: '0.4rem',
                  flexShrink: 0,
                  borderRadius: '2px'
                }} />
                <span style={{ fontSize: '0.7rem' }}>{displayKey} ({percentage}%)</span>
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

    const entries = Object.entries(data)
    const numBars = entries.length
    const chartHeight = height
    const chartPadding = { top: 10, right: 10, bottom: 40, left: 40 }
    const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom
    const plotWidth = 100 - chartPadding.left - chartPadding.right

    return (
      <div style={{ width: '100%', height: `${chartHeight}px`, marginTop: '0.5rem' }}>
        <svg width="100%" height="100%" viewBox={`0 0 100 ${chartHeight}`} preserveAspectRatio="none">
          {/* Grid lines and Y-axis */}
          <g>
            {[0, 0.25, 0.5, 0.75, 1].map(pct => {
              const y = chartPadding.top + plotHeight * (1 - pct)
              return (
                <g key={pct}>
                  <line
                    x1={chartPadding.left}
                    y1={y}
                    x2={100 - chartPadding.right}
                    y2={y}
                    stroke="#e5e7eb"
                    strokeWidth="0.3"
                  />
                  <text
                    x={chartPadding.left - 2}
                    y={y}
                    textAnchor="end"
                    fontSize="6"
                    fill="#666"
                    dominantBaseline="middle"
                  >
                    {(maxValue * pct).toFixed(0)}
                  </text>
                </g>
              )
            })}
          </g>

          {/* Bars and labels */}
          {entries.map(([label, value], index) => {
            const barWidth = plotWidth / numBars * 0.7
            const barSpacing = plotWidth / numBars
            const x = chartPadding.left + index * barSpacing + barSpacing * 0.15
            const barHeight = (value / maxValue) * plotHeight
            const y = chartPadding.top + plotHeight - barHeight

            // Truncate label intelligently
            const maxChars = numBars > 4 ? 8 : 12
            let displayLabel = label
            if (label.includes('(')) {
              // Keep the part before parentheses and abbreviate
              const parts = label.split('(')
              displayLabel = parts[0].trim().substring(0, maxChars)
            } else {
              displayLabel = label.length > maxChars ? label.substring(0, maxChars) + '...' : label
            }

            return (
              <g key={label}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={color}
                  rx="0.5"
                />
                <text
                  x={x + barWidth / 2}
                  y={y - 2}
                  textAnchor="middle"
                  fontSize="5"
                  fill="#000"
                  fontWeight="600"
                >
                  {value.toFixed(1)}
                </text>
                <text
                  x={x + barWidth / 2}
                  y={chartHeight - chartPadding.bottom + 8}
                  textAnchor="middle"
                  fontSize="5"
                  fill="#333"
                >
                  {displayLabel}
                </text>
              </g>
            )
          })}
        </svg>
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
              <div style={{ background: 'white', borderRadius: '0.5rem', padding: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', minHeight: '280px' }}>
                <div style={{ background: '#0E1F56', color: 'white', padding: '0.5rem', marginBottom: '1rem', fontWeight: '600', textAlign: 'center', fontSize: '0.875rem', borderRadius: '0.25rem' }}>
                  Demographics
                </div>
                <div style={{ fontSize: '0.8rem', lineHeight: '1.8', color: '#374151' }}>
                  <p style={{ margin: '0 0 0.75rem 0' }}>Respondents were mostly female ({data.demographics.femalePercent}%). The age of respondents ranged with an average age of {data.demographics.avgAge}.</p>
                  <p style={{ margin: 0 }}>The number of years in service of respondents ranged with an average of {data.demographics.avgYearsService} years.</p>
                </div>
              </div>

              {/* Job Role */}
              <div style={{ background: 'white', borderRadius: '0.5rem', padding: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', minHeight: '280px' }}>
                <div style={{ background: '#0E1F56', color: 'white', padding: '0.5rem', marginBottom: '1rem', fontWeight: '600', textAlign: 'center', fontSize: '0.875rem', borderRadius: '0.25rem' }}>
                  Job Role
                </div>
                <PieChart
                  data={data.demographics.jobRoles}
                  colors={['#0E1F56', '#00A79D', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899', '#06b6d4']}
                />
              </div>

              {/* Area of Responsibility */}
              <div style={{ background: 'white', borderRadius: '0.5rem', padding: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', minHeight: '280px' }}>
                <div style={{ background: '#0E1F56', color: 'white', padding: '0.5rem', marginBottom: '1rem', fontWeight: '600', textAlign: 'center', fontSize: '0.875rem', borderRadius: '0.25rem' }}>
                  Area of Responsibility
                </div>
                <PieChart
                  data={data.demographics.areasOfResp}
                  colors={['#0E1F56', '#00A79D', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899', '#06b6d4']}
                />
              </div>

              {/* STSI-OA */}
              <div style={{ background: 'white', borderRadius: '0.5rem', padding: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', minHeight: '280px' }}>
                <div style={{ background: '#0E1F56', color: 'white', padding: '0.5rem', marginBottom: '0.5rem', fontWeight: '600', textAlign: 'center', fontSize: '0.8rem', borderRadius: '0.25rem' }}>
                  Secondary Traumatic Stress-Informed Organization Assessment (STSI-OA)
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: '600', textAlign: 'center', marginBottom: '0.75rem', color: '#4b5563' }}>
                  Higher STSI-OA Scores indicate more STS informed
                </div>
                {data.stsioa ? (
                  <>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: '600', marginBottom: '0.5rem', textAlign: 'center', color: '#374151' }}>
                          Mean STSI-OA Total Score
                        </div>
                        <BarChart
                          data={{ 'Total': data.stsioa.total }}
                          maxValue={150}
                          color="#0E1F56"
                          height={140}
                        />
                      </div>
                      <div style={{ flex: 2 }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: '600', marginBottom: '0.5rem', textAlign: 'center', color: '#374151' }}>
                          Mean Subscale STSI-OA Score
                        </div>
                        <BarChart
                          data={{
                            'Resilience (0-28)': data.stsioa.resilience,
                            'Safety (0-28)': data.stsioa.safety,
                            'Policies (0-24)': data.stsioa.policies,
                            'Leadership (0-24)': data.stsioa.leadership,
                            'Routine (0-44)': data.stsioa.routine
                          }}
                          maxValue={44}
                          color="#00A79D"
                          height={140}
                        />
                      </div>
                    </div>
                    <div style={{ fontSize: '0.65rem', marginTop: '0.5rem', padding: '0.5rem', background: '#f9fafb', borderRadius: '0.25rem', color: '#6b7280', lineHeight: '1.4' }}>
                      Mean scores across subscales show organizational STS-informed practices.
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>No STSI-OA data available</div>
                )}
              </div>
            </div>

            {/* Row 2: Exposure, STSS, ProQOL */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '1rem' }}>
              {/* Level of Exposure */}
              <div style={{ background: 'white', borderRadius: '0.5rem', padding: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', minHeight: '280px' }}>
                <div style={{ background: '#0E1F56', color: 'white', padding: '0.5rem', marginBottom: '1rem', fontWeight: '600', textAlign: 'center', fontSize: '0.875rem', borderRadius: '0.25rem' }}>
                  Level of Exposure
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.75rem', color: '#374151' }}>
                  Level of exposure to traumatic material
                </div>
                <PieChart
                  data={data.demographics.exposurePercentiles}
                  colors={['#10b981', '#3b82f6', '#f59e0b', '#ef4444']}
                />
                <div style={{ fontSize: '0.7rem', marginTop: '0.75rem', textAlign: 'center', color: '#6b7280', lineHeight: '1.4' }}>
                  The average rank (0-100) of level of exposure to traumatic material was {data.demographics.exposureAvg}
                </div>
              </div>

              {/* STSS */}
              <div style={{ background: 'white', borderRadius: '0.5rem', padding: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', minHeight: '280px' }}>
                <div style={{ background: '#0E1F56', color: 'white', padding: '0.5rem', marginBottom: '0.5rem', fontWeight: '600', textAlign: 'center', fontSize: '0.8rem', borderRadius: '0.25rem' }}>
                  Secondary Traumatic Stress Scale (STSS)
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: '600', textAlign: 'center', marginBottom: '0.75rem', color: '#4b5563' }}>
                  Higher STSS Scores indicate higher Secondary Traumatic Stress (STS)
                </div>
                {data.stss ? (
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: '600', marginBottom: '0.5rem', textAlign: 'center', color: '#374151' }}>
                        Mean STSS Total Score
                      </div>
                      <BarChart
                        data={{ 'Total': data.stss.total }}
                        maxValue={85}
                        color="#0E1F56"
                        height={140}
                      />
                    </div>
                    <div style={{ flex: 2 }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: '600', marginBottom: '0.5rem', textAlign: 'center', color: '#374151' }}>
                        Mean Subscale STSS Scores
                      </div>
                      <BarChart
                        data={{
                          'Intrusion (5-25)': data.stss.intrusion,
                          'Avoidance (2-10)': data.stss.avoidance,
                          'Neg Cognitions (7-35)': data.stss.negCognition,
                          'Arousal (6-30)': data.stss.arousal
                        }}
                        maxValue={35}
                        color="#00A79D"
                        height={140}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>No STSS data available</div>
                )}
              </div>

              {/* ProQOL Burnout */}
              <div style={{ background: 'white', borderRadius: '0.5rem', padding: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', minHeight: '280px' }}>
                <div style={{ background: '#0E1F56', color: 'white', padding: '0.5rem', marginBottom: '1rem', fontWeight: '600', textAlign: 'center', fontSize: '0.875rem', borderRadius: '0.25rem' }}>
                  ProQOL Burnout
                </div>
                <div style={{ fontSize: '0.7rem', marginBottom: '1rem', textAlign: 'center', color: '#6b7280', lineHeight: '1.5' }}>
                  ProQOL Burnout Scores: 22 or less= low; 23-41= average; 42 or above=high
                </div>
                {data.proqol !== null ? (
                  <>
                    <div style={{ fontSize: '0.7rem', fontWeight: '600', marginBottom: '0.5rem', textAlign: 'center', color: '#374151' }}>
                      Mean ProQOL Burnout Score
                    </div>
                    <BarChart
                      data={{ 'Burnout': data.proqol }}
                      maxValue={50}
                      color="#f59e0b"
                      height={120}
                    />
                    <div style={{ fontSize: '0.75rem', marginTop: '0.75rem', padding: '0.75rem', background: data.proqol <= 22 ? '#d1fae5' : data.proqol <= 41 ? '#fef3c7' : '#fee2e2', borderRadius: '0.375rem', textAlign: 'center', fontWeight: '600', color: data.proqol <= 22 ? '#065f46' : data.proqol <= 41 ? '#92400e' : '#991b1b' }}>
                      {data.proqol <= 22 ? 'Low burnout' : data.proqol <= 41 ? 'Average burnout' : 'High burnout'}
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>No ProQOL data available</div>
                )}
              </div>
            </div>
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