import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import { COLORS, cardStyle, TIMEPOINT_ORDER, K_ANONYMITY_THRESHOLD } from '../utils/constants'
import { loadTeamReportData } from '../utils/reportDataLoader'
import { generateRecommendations } from '../utils/dataRecommendations'

const TIMEPOINT_LABELS = {
  baseline: 'Baseline',
  endline: 'Endline',
  followup_6mo: '6-Month Follow-up',
  followup_12mo: '12-Month Follow-up'
}

const SEVERITY_COLORS = {
  mild: { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
  moderate: { bg: '#fed7aa', text: '#9a3412', border: '#f97316' },
  high: { bg: '#fecaca', text: '#991b1b', border: '#ef4444' },
  severe: { bg: '#fca5a5', text: '#7f1d1d', border: '#dc2626' }
}

const LEVEL_COLORS = {
  low: '#10b981',
  average: '#f59e0b',
  high: '#ef4444',
  strong: '#10b981',
  moderate: '#f59e0b',
  needs_attention: '#ef4444',
  mild: '#f59e0b',
  severe: '#dc2626'
}

export default function DataRecommendations() {
  const { teamId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [reportData, setReportData] = useState(null)
  const [recommendations, setRecommendations] = useState(null)
  const [selectedTimepoint, setSelectedTimepoint] = useState(null)
  const [availableTimepoints, setAvailableTimepoints] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    loadData()
  }, [teamId])

  useEffect(() => {
    if (reportData && selectedTimepoint) {
      const recs = generateRecommendations(reportData.data, selectedTimepoint)
      setRecommendations(recs)
    }
  }, [selectedTimepoint, reportData])

  const loadData = async () => {
    try {
      setLoading(true)
      const data = await loadTeamReportData(teamId)
      setReportData(data)

      // Find available timepoints (most recent first)
      const available = [...TIMEPOINT_ORDER].reverse().filter(tp => {
        const d = data.data[tp]
        return d && d.n > 0
      })
      setAvailableTimepoints(available)

      if (available.length > 0) {
        setSelectedTimepoint(available[0])
      }
    } catch (err) {
      console.error('Error loading report data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', color: COLORS.navy, fontSize: '1.25rem' }}>Analyzing your data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: COLORS.red }}>Error Loading Data</h2>
        <p style={{ color: 'var(--text-muted)' }}>{error}</p>
        <button onClick={() => navigate(-1)} style={{ padding: '0.5rem 1rem', background: COLORS.navy, color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}>
          Go Back
        </button>
      </div>
    )
  }

  const team = reportData?.team
  const tp = reportData?.data?.[selectedTimepoint]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      {/* Header */}
      <div style={{ background: COLORS.navy, color: 'white', padding: '1rem 2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>
              Back
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Recommendations from Your Data</h1>
              <p style={{ margin: '0.2rem 0 0', opacity: 0.8, fontSize: '0.85rem' }}>
                {team?.agencyName} — {team?.collaborativeName}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {availableTimepoints.length > 1 && (
              <select
                value={selectedTimepoint || ''}
                onChange={(e) => setSelectedTimepoint(e.target.value)}
                style={{
                  padding: '0.4rem 0.6rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  background: 'rgba(255,255,255,0.15)',
                  color: 'white',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                {availableTimepoints.map(tp => (
                  <option key={tp} value={tp} style={{ color: '#1f2937' }}>
                    {TIMEPOINT_LABELS[tp]}
                  </option>
                ))}
              </select>
            )}
            <button onClick={handleSignOut} style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '500' }}>
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>
        {/* No data state */}
        {availableTimepoints.length === 0 && (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📋</div>
            <h2 style={{ color: COLORS.navy, marginBottom: '0.5rem' }}>No Assessment Data Available Yet</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Once your team completes assessments, you'll see personalized recommendations here.
            </p>
            <button
              onClick={() => navigate('/admin/completion')}
              style={{ padding: '0.75rem 2rem', background: COLORS.teal, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '1rem' }}
            >
              View Completion Tracking
            </button>
          </div>
        )}

        {/* Has data */}
        {recommendations && (
          <>
            {/* Overview Banner */}
            <OverviewBanner summary={recommendations.summary} />

            {/* Small sample warning */}
            {recommendations.summary.n < K_ANONYMITY_THRESHOLD && (
              <div style={{
                ...cardStyle,
                marginBottom: '1.5rem',
                borderLeft: `4px solid ${COLORS.amber}`,
                background: '#fffbeb',
                fontSize: '0.85rem',
                color: '#92400e'
              }}>
                Based on {recommendations.summary.n} response{recommendations.summary.n !== 1 ? 's' : ''}. Recommendations become more reliable with more data.
              </div>
            )}

            {/* Strengths */}
            {recommendations.strengths.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ color: COLORS.navy, fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: COLORS.green }}>●</span> Your Strengths
                </h2>
                {recommendations.strengths.map((s, i) => (
                  <div key={i} style={{
                    ...cardStyle,
                    marginBottom: '0.75rem',
                    borderLeft: `4px solid ${COLORS.green}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h3 style={{ margin: 0, color: COLORS.navy, fontSize: '1rem' }}>{s.label}</h3>
                        <SourceBadge source={s.source} />
                      </div>
                      <span style={{ fontWeight: '700', color: COLORS.green, fontSize: '0.9rem' }}>{s.score}</span>
                    </div>
                    <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                      {s.interpretation}
                    </p>
                    {s.leverageAdvice && (
                      <div style={{
                        background: `${COLORS.green}08`,
                        border: `1px solid ${COLORS.green}30`,
                        borderRadius: '6px',
                        padding: '0.6rem 0.75rem'
                      }}>
                        <strong style={{ fontSize: '0.8rem', color: '#166534' }}>How to leverage this:</strong>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                          {s.leverageAdvice}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Growth Areas */}
            {recommendations.growthAreas.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ color: COLORS.navy, fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: COLORS.amber }}>●</span> Areas for Growth
                </h2>
                {recommendations.growthAreas.map((ga, i) => {
                  const sevColors = SEVERITY_COLORS[ga.severity] || SEVERITY_COLORS.moderate
                  return (
                    <div key={i} style={{
                      ...cardStyle,
                      marginBottom: '0.75rem',
                      borderLeft: `4px solid ${sevColors.border}`
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <h3 style={{ margin: 0, color: COLORS.navy, fontSize: '1rem' }}>{ga.label}</h3>
                          <SourceBadge source={ga.source} />
                          <span style={{
                            padding: '0.1rem 0.4rem',
                            borderRadius: '9999px',
                            fontSize: '0.65rem',
                            fontWeight: '700',
                            background: sevColors.bg,
                            color: sevColors.text,
                            textTransform: 'capitalize'
                          }}>
                            {ga.severity}
                          </span>
                        </div>
                        <span style={{ fontWeight: '700', color: sevColors.border, fontSize: '0.9rem' }}>{ga.score}</span>
                      </div>
                      <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        {ga.interpretation}
                      </p>

                      {/* Suggested domains */}
                      {ga.suggestedDomains && ga.suggestedDomains.length > 0 && (
                        <div style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontWeight: '600' }}>Target domains:</span>
                          {ga.suggestedDomains.map(d => (
                            <span key={d} style={{
                              fontSize: '0.7rem',
                              background: `${COLORS.teal}15`,
                              color: COLORS.teal,
                              padding: '0.1rem 0.4rem',
                              borderRadius: '9999px',
                              fontWeight: '600'
                            }}>
                              {d}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Suggested actions */}
                      {ga.suggestedActions && ga.suggestedActions.length > 0 && (
                        <ul style={{ margin: '0 0 0.75rem', paddingLeft: '1.25rem' }}>
                          {ga.suggestedActions.map((a, j) => (
                            <li key={j} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', lineHeight: '1.4' }}>
                              {a}
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => navigate(`/admin/smartie-goals/${teamId}?domain=${ga.suggestedDomains?.[0] || ''}`)}
                          style={{
                            padding: '0.4rem 0.75rem',
                            background: COLORS.navy,
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: '600'
                          }}
                        >
                          Set a SMARTIE Goal for this →
                        </button>
                        <button
                          onClick={() => navigate(`/admin/pdsa/${teamId}?domain=${ga.suggestedDomains?.[0] || ''}`)}
                          style={{
                            padding: '0.4rem 0.75rem',
                            background: COLORS.teal,
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: '600'
                          }}
                        >
                          Start a PDSA Cycle →
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Cross-Cutting Insights */}
            {recommendations.insights.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ color: COLORS.navy, fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: COLORS.navy }}>●</span> Cross-Cutting Insights
                </h2>
                {recommendations.insights.map((ins, i) => (
                  <div key={i} style={{
                    ...cardStyle,
                    marginBottom: '0.75rem',
                    borderLeft: `4px solid ${COLORS.navy}`
                  }}>
                    <h3 style={{ margin: '0 0 0.5rem', color: COLORS.navy, fontSize: '1rem' }}>{ins.title}</h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                      {ins.text}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Suggested Next Steps */}
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ color: COLORS.navy, fontSize: '1.2rem', marginBottom: '1rem' }}>
                Suggested Next Steps
              </h2>
              <div style={cardStyle}>
                <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
                  {recommendations.growthAreas.length > 0 && (
                    <li style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                      <strong>Set a SMARTIE goal</strong> targeting your weakest area:{' '}
                      <button
                        onClick={() => navigate(`/admin/smartie-goals/${teamId}?domain=${recommendations.growthAreas[0].suggestedDomains?.[0] || ''}`)}
                        style={{ background: 'none', border: 'none', color: COLORS.teal, cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', textDecoration: 'underline', padding: 0 }}
                      >
                        {recommendations.growthAreas[0].label}
                      </button>
                    </li>
                  )}
                  <li style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    <strong>Run a PDSA cycle</strong> to test a specific improvement strategy:{' '}
                    <button
                      onClick={() => navigate(`/admin/pdsa/${teamId}`)}
                      style={{ background: 'none', border: 'none', color: COLORS.teal, cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', textDecoration: 'underline', padding: 0 }}
                    >
                      Go to PDSA Cycles →
                    </button>
                  </li>
                  <li style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    <strong>Browse resources</strong> for strategies and tools:{' '}
                    <button
                      onClick={() => navigate('/admin/resources')}
                      style={{ background: 'none', border: 'none', color: COLORS.teal, cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', textDecoration: 'underline', padding: 0 }}
                    >
                      Resource Library →
                    </button>
                  </li>
                  <li style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    <strong>Discuss strategies</strong> with your collaborative:{' '}
                    <button
                      onClick={() => navigate('/admin/forum')}
                      style={{ background: 'none', border: 'none', color: COLORS.teal, cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', textDecoration: 'underline', padding: 0 }}
                    >
                      Community Forum →
                    </button>
                  </li>
                  <li style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    <strong>Get inspired</strong> by strategies from previous collaboratives:{' '}
                    <button
                      onClick={() => navigate('/admin/strategies')}
                      style={{ background: 'none', border: 'none', color: COLORS.teal, cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', textDecoration: 'underline', padding: 0 }}
                    >
                      Strategy Ideas →
                    </button>
                  </li>
                </ol>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function OverviewBanner({ summary }) {
  if (!summary) return null

  const metrics = []
  if (summary.stssTotal) {
    metrics.push({ label: 'STSS', value: summary.stssTotal.mean.toFixed(1), sublabel: summary.stssTotal.label, level: summary.stssTotal.level })
  }
  if (summary.proqolCS) {
    metrics.push({ label: 'Compassion Sat.', value: summary.proqolCS.mean.toFixed(1), sublabel: summary.proqolCS.label, level: summary.proqolCS.level === 'high' ? 'low' : summary.proqolCS.level === 'low' ? 'high' : 'average' })
  }
  if (summary.proqolBurnout) {
    metrics.push({ label: 'Burnout', value: summary.proqolBurnout.mean.toFixed(1), sublabel: summary.proqolBurnout.label, level: summary.proqolBurnout.level })
  }
  if (summary.stsioaTotal) {
    metrics.push({ label: 'STSI-OA', value: `${summary.stsioaTotal.pct.toFixed(0)}%`, sublabel: 'of max', level: summary.stsioaTotal.pct >= 75 ? 'low' : summary.stsioaTotal.pct >= 50 ? 'average' : 'high' })
  }
  if (summary.exposureMean !== null && !isNaN(summary.exposureMean)) {
    metrics.push({ label: 'Exposure', value: `${summary.exposureMean.toFixed(0)}/100`, sublabel: summary.exposureMean > 75 ? 'Very High' : summary.exposureMean > 50 ? 'High' : summary.exposureMean > 25 ? 'Moderate' : 'Low', level: summary.exposureMean > 50 ? 'high' : summary.exposureMean > 25 ? 'average' : 'low' })
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: '0.75rem',
      padding: '1.25rem',
      marginBottom: '1.5rem',
      boxShadow: 'var(--shadow-card)',
      border: `2px solid ${COLORS.teal}20`
    }}>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Based on <strong>{summary.n}</strong> responses at <strong>{TIMEPOINT_LABELS[summary.timepoint]}</strong>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(metrics.length, 5)}, 1fr)`, gap: '1rem' }}>
        {metrics.map((m, i) => {
          const color = LEVEL_COLORS[m.level] || '#6b7280'
          return (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                {m.label}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color }}>{m.value}</div>
              <div style={{ fontSize: '0.75rem', color, fontWeight: '600' }}>{m.sublabel}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SourceBadge({ source }) {
  const labels = {
    stss: 'STSS',
    proqol: 'ProQOL',
    stsioa: 'STSI-OA',
    demographics: 'Demographics'
  }
  const colors = {
    stss: { bg: '#dbeafe', text: '#1e40af' },
    proqol: { bg: '#ede9fe', text: '#5b21b6' },
    stsioa: { bg: '#ccfbf1', text: '#0f766e' },
    demographics: { bg: '#fef3c7', text: '#92400e' }
  }
  const c = colors[source] || { bg: '#f3f4f6', text: '#6b7280' }
  return (
    <span style={{
      padding: '0.1rem 0.4rem',
      borderRadius: '4px',
      fontSize: '0.65rem',
      fontWeight: '700',
      background: c.bg,
      color: c.text
    }}>
      {labels[source] || source}
    </span>
  )
}
