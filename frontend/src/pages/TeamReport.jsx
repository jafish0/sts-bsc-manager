import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import { loadTeamReportData } from '../utils/reportDataLoader'
import {
  COLORS, STSS_SUBSCALES, STSIOA_DOMAIN_MAX, STSIOA_TOTAL_MAX,
  TIMEPOINT_LABELS, TIMEPOINT_ORDER, cardStyle, cardHeaderStyle, subtitleStyle,
  K_ANONYMITY_THRESHOLD
} from '../utils/constants'
import { exportTeamReportExcel } from '../utils/exportExcel'
import { exportTeamReportPdf } from '../utils/exportPdf'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar
} from 'recharts'

// Line colors for each measure
const LINE_COLORS = [COLORS.navy, COLORS.teal, COLORS.blue, COLORS.amber, COLORS.purple, COLORS.green]

function formatMSD(stat) {
  if (!stat) return '—'
  return `${stat.mean.toFixed(2)} (${stat.sd.toFixed(2)})`
}

export default function TeamReport() {
  const { teamId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [report, setReport] = useState(null)
  const [smartieGoals, setSmartieGoals] = useState([])

  useEffect(() => {
    loadReport()
  }, [teamId])

  const loadReport = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await loadTeamReportData(teamId)
      setReport(data)

      // Load SMARTIE goals for this team
      const { data: goals } = await supabase
        .from('smartie_goals')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
      setSmartieGoals(goals || [])
    } catch (err) {
      console.error('Error loading team report:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  // Build longitudinal line chart data from report
  function buildLineData(metricKey, subKeys) {
    return TIMEPOINT_ORDER
      .filter(tp => report.data[tp] && report.data[tp][metricKey])
      .map(tp => {
        const d = report.data[tp][metricKey]
        const point = { timepoint: TIMEPOINT_LABELS[tp], n: d.n }
        subKeys.forEach(key => {
          if (d[key]) point[key] = parseFloat(d[key].mean.toFixed(2))
        })
        return point
      })
  }

  // Custom tooltip showing M (SD) and n
  const ReportTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'var(--bg-card)', padding: '0.5rem 0.75rem', border: '1px solid var(--border-light)', borderRadius: '0.25rem', fontSize: '0.8rem' }}>
          <p style={{ margin: 0, fontWeight: '600' }}>{label}</p>
          {payload.map((p, i) => (
            <p key={i} style={{ margin: '0.2rem 0 0', color: p.color }}>
              {p.name}: M = {p.value?.toFixed(2)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', color: COLORS.navy, marginBottom: '0.5rem' }}>Loading Team Report...</div>
          <div style={{ color: 'var(--text-muted)' }}>Fetching data across all timepoints</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: COLORS.red }}>Error Loading Report</h2>
        <p>{error}</p>
        <button onClick={() => navigate(-1)} style={{ padding: '0.5rem 1rem', background: COLORS.navy, color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}>
          Go Back
        </button>
      </div>
    )
  }

  if (!report) return null

  const { team, data: tpData, reviews } = report

  // Build chart datasets
  const stssLineData = buildLineData('stss', ['total', 'intrusion', 'avoidance', 'negCognitions', 'arousal'])
  const proqolLineData = buildLineData('proqol', ['cs', 'burnout', 'sts'])
  const stsioaLineData = buildLineData('stsioa', ['total', 'resilience', 'safety', 'policies', 'leadership', 'routine', 'evaluation'])

  // Check which timepoints have data
  const timepointsWithData = TIMEPOINT_ORDER.filter(tp => tpData[tp] && tpData[tp].n > 0)

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
              <h1 style={{ margin: 0, fontSize: '1.4rem' }}>
                {team.agencyName}
                {team.displayName !== team.teamName && team.displayName !== team.agencyName && (
                  <span style={{ fontWeight: '400', fontSize: '1rem', opacity: 0.85 }}> — "{team.displayName}"</span>
                )}
              </h1>
              <p style={{ margin: '0.2rem 0 0', opacity: 0.8, fontSize: '0.85rem' }}>
                {team.collaborativeName} — Team Report
                {team.motto && <span style={{ fontStyle: 'italic' }}> · "{team.motto}"</span>}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {report && (
              <>
                <button onClick={() => exportTeamReportExcel(report)} style={{ padding: '0.5rem 1rem', background: COLORS.green, color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '500', fontSize: '0.85rem' }}>
                  Export Excel
                </button>
                <button onClick={() => exportTeamReportPdf(report)} style={{ padding: '0.5rem 1rem', background: COLORS.blue, color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '500', fontSize: '0.85rem' }}>
                  Export PDF
                </button>
              </>
            )}
            <button onClick={handleSignOut} style={{ padding: '0.5rem 1rem', background: COLORS.teal, color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '500' }}>
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>
        {timepointsWithData.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
            <h2 style={{ color: COLORS.navy }}>No Data Available</h2>
            <p style={{ color: 'var(--text-muted)' }}>No assessment responses have been submitted for this team yet.</p>
          </div>
        ) : (
          <>
            {/* Completion Status */}
            <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
              <div style={cardHeaderStyle}>Completion Status</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Timepoint</th>
                    <th style={{ textAlign: 'center', padding: '0.5rem' }}>Responses</th>
                    <th style={{ textAlign: 'center', padding: '0.5rem' }}>Demographics</th>
                    <th style={{ textAlign: 'center', padding: '0.5rem' }}>STSS</th>
                    <th style={{ textAlign: 'center', padding: '0.5rem' }}>ProQOL</th>
                    <th style={{ textAlign: 'center', padding: '0.5rem' }}>STSI-OA</th>
                  </tr>
                </thead>
                <tbody>
                  {TIMEPOINT_ORDER.map(tp => {
                    const d = tpData[tp]
                    if (!d) return (
                      <tr key={tp} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.5rem', fontWeight: '500' }}>{TIMEPOINT_LABELS[tp]}</td>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--text-faint)' }}>No team code</td>
                      </tr>
                    )
                    return (
                      <tr key={tp} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.5rem', fontWeight: '500' }}>{TIMEPOINT_LABELS[tp]}</td>
                        <td style={{ textAlign: 'center', padding: '0.5rem' }}>{d.completion.responses}</td>
                        <td style={{ textAlign: 'center', padding: '0.5rem' }}>{d.completion.demographics}</td>
                        <td style={{ textAlign: 'center', padding: '0.5rem' }}>{d.completion.stss}</td>
                        <td style={{ textAlign: 'center', padding: '0.5rem' }}>{d.completion.proqol}</td>
                        <td style={{ textAlign: 'center', padding: '0.5rem' }}>{d.completion.stsioa}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Demographics Summary — suppressed when below k-anonymity threshold */}
            {(() => {
              const baselineDemos = tpData[timepointsWithData[0]]?.demographics
              if (!baselineDemos) return null
              if (baselineDemos.n < K_ANONYMITY_THRESHOLD) {
                return (
                  <div style={{ ...cardStyle, marginBottom: '1.5rem', textAlign: 'center', padding: '1.5rem' }}>
                    <div style={cardHeaderStyle}>Demographics ({TIMEPOINT_LABELS[timepointsWithData[0]]})</div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.5rem 0 0' }}>
                      Demographic details are hidden when fewer than {K_ANONYMITY_THRESHOLD} responses are available to protect respondent privacy (n={baselineDemos.n}).
                    </p>
                  </div>
                )
              }
              return (
                <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
                  <div style={cardHeaderStyle}>Demographics ({TIMEPOINT_LABELS[timepointsWithData[0]]})</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', fontSize: '0.9rem' }}>
                    <div><strong>N:</strong> {baselineDemos.n}</div>
                    <div><strong>Female:</strong> {baselineDemos.femalePercent}%</div>
                    <div><strong>Male:</strong> {baselineDemos.malePercent}%</div>
                    <div><strong>Avg Age:</strong> {baselineDemos.avgAge}</div>
                    <div><strong>Avg Years Service:</strong> {baselineDemos.avgYearsService}</div>
                    <div><strong>Exposure:</strong> M={baselineDemos.exposureMean}, SD={baselineDemos.exposureSD}</div>
                  </div>
                </div>
              )
            })()}

            {/* STSS Longitudinal */}
            {stssLineData.length > 0 && (
              <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
                <div style={cardHeaderStyle}>Secondary Traumatic Stress Scale (STSS) — Longitudinal</div>
                <div style={subtitleStyle}>DSM-5 4-Factor Model • Higher scores = more STS</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  {/* Total Score Line Chart */}
                  <div>
                    <div style={subtitleStyle}>Total Score (17–85)</div>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={stssLineData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="timepoint" tick={{ fontSize: 11 }} />
                        <YAxis domain={[17, 85]} tick={{ fontSize: 11 }} />
                        <Tooltip content={<ReportTooltip />} />
                        <Line type="monotone" dataKey="total" name="Total" stroke={COLORS.navy} strokeWidth={2} dot={{ r: 5 }} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Subscales Line Chart */}
                  <div>
                    <div style={subtitleStyle}>Subscale Scores</div>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={stssLineData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="timepoint" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 25]} tick={{ fontSize: 11 }} />
                        <Tooltip content={<ReportTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                        <Line type="monotone" dataKey="intrusion" name="Intrusion" stroke={COLORS.navy} strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
                        <Line type="monotone" dataKey="avoidance" name="Avoidance" stroke={COLORS.teal} strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
                        <Line type="monotone" dataKey="negCognitions" name="Neg. Cognitions" stroke={COLORS.amber} strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
                        <Line type="monotone" dataKey="arousal" name="Arousal" stroke={COLORS.purple} strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Data Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginTop: '1rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-card-alt)' }}>
                      <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Timepoint</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>n</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>Total M (SD)</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>Intrusion M (SD)</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>Avoidance M (SD)</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>Neg. Cog. M (SD)</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>Arousal M (SD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TIMEPOINT_ORDER.map(tp => {
                      const d = tpData[tp]?.stss
                      if (!d) return null
                      return (
                        <tr key={tp} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.4rem 0.5rem', fontWeight: '500' }}>{TIMEPOINT_LABELS[tp]}</td>
                          <td style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>{d.n}</td>
                          <td style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>{formatMSD(d.total)}</td>
                          <td style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>{formatMSD(d.intrusion)}</td>
                          <td style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>{formatMSD(d.avoidance)}</td>
                          <td style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>{formatMSD(d.negCognitions)}</td>
                          <td style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>{formatMSD(d.arousal)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ProQOL Longitudinal */}
            {proqolLineData.length > 0 && (
              <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
                <div style={cardHeaderStyle}>Professional Quality of Life (ProQOL 5) — Longitudinal</div>
                <div style={subtitleStyle}>Three subscales • CS: higher = better • Burnout/STS: lower = better</div>

                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={proqolLineData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timepoint" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 50]} tick={{ fontSize: 11 }} />
                    <Tooltip content={<ReportTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                    <Line type="monotone" dataKey="cs" name="Compassion Satisfaction" stroke={COLORS.green} strokeWidth={2} dot={{ r: 5 }} connectNulls={false} />
                    <Line type="monotone" dataKey="burnout" name="Burnout" stroke={COLORS.amber} strokeWidth={2} dot={{ r: 5 }} connectNulls={false} />
                    <Line type="monotone" dataKey="sts" name="Secondary Traumatic Stress" stroke={COLORS.red} strokeWidth={2} dot={{ r: 5 }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>

                {/* Data Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginTop: '1rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-card-alt)' }}>
                      <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Timepoint</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>n</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>CS M (SD)</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>Burnout M (SD)</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>STS M (SD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TIMEPOINT_ORDER.map(tp => {
                      const d = tpData[tp]?.proqol
                      if (!d) return null
                      return (
                        <tr key={tp} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.4rem 0.5rem', fontWeight: '500' }}>{TIMEPOINT_LABELS[tp]}</td>
                          <td style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>{d.n}</td>
                          <td style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>{formatMSD(d.cs)}</td>
                          <td style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>{formatMSD(d.burnout)}</td>
                          <td style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>{formatMSD(d.sts)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* STSI-OA Longitudinal */}
            {stsioaLineData.length > 0 && (
              <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
                <div style={cardHeaderStyle}>STS-Informed Organizational Assessment (STSI-OA) — Longitudinal</div>
                <div style={subtitleStyle}>Higher scores = more STS-informed (better) • Total range: 0–{STSIOA_TOTAL_MAX}</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  {/* Total Score */}
                  <div>
                    <div style={subtitleStyle}>Total Score (0–{STSIOA_TOTAL_MAX})</div>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={stsioaLineData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="timepoint" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, STSIOA_TOTAL_MAX]} tick={{ fontSize: 11 }} />
                        <Tooltip content={<ReportTooltip />} />
                        <Line type="monotone" dataKey="total" name="Total" stroke={COLORS.navy} strokeWidth={2} dot={{ r: 5 }} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Domain Scores */}
                  <div>
                    <div style={subtitleStyle}>Domain Scores</div>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={stsioaLineData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="timepoint" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 44]} tick={{ fontSize: 11 }} />
                        <Tooltip content={<ReportTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '0.7rem' }} />
                        <Line type="monotone" dataKey="resilience" name={`Resilience (0-${STSIOA_DOMAIN_MAX.resilience})`} stroke={COLORS.navy} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                        <Line type="monotone" dataKey="safety" name={`Safety (0-${STSIOA_DOMAIN_MAX.safety})`} stroke={COLORS.teal} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                        <Line type="monotone" dataKey="policies" name={`Policies (0-${STSIOA_DOMAIN_MAX.policies})`} stroke={COLORS.blue} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                        <Line type="monotone" dataKey="leadership" name={`Leadership (0-${STSIOA_DOMAIN_MAX.leadership})`} stroke={COLORS.amber} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                        <Line type="monotone" dataKey="routine" name={`Routine (0-${STSIOA_DOMAIN_MAX.routine})`} stroke={COLORS.purple} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                        <Line type="monotone" dataKey="evaluation" name={`Evaluation (0-${STSIOA_DOMAIN_MAX.evaluation})`} stroke={COLORS.green} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Data Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', marginTop: '1rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-card-alt)' }}>
                      <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Timepoint</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>n</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>Total</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>Resilience</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>Safety</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>Policies</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>Leadership</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>Routine</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>Evaluation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TIMEPOINT_ORDER.map(tp => {
                      const d = tpData[tp]?.stsioa
                      if (!d) return null
                      return (
                        <tr key={tp} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.4rem 0.5rem', fontWeight: '500' }}>{TIMEPOINT_LABELS[tp]}</td>
                          <td style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>{d.n}</td>
                          <td style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>{formatMSD(d.total)}</td>
                          <td style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>{formatMSD(d.resilience)}</td>
                          <td style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>{formatMSD(d.safety)}</td>
                          <td style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>{formatMSD(d.policies)}</td>
                          <td style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>{formatMSD(d.leadership)}</td>
                          <td style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>{formatMSD(d.routine)}</td>
                          <td style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>{formatMSD(d.evaluation)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* SMARTIE Goals */}
            {smartieGoals.length > 0 && (
              <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={cardHeaderStyle}>SMARTIE Goals ({smartieGoals.length})</div>
                  <button
                    onClick={() => navigate(`/admin/smartie-goals/${teamId}`)}
                    style={{ padding: '0.4rem 0.75rem', background: COLORS.teal, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500' }}
                  >
                    Manage Goals
                  </button>
                </div>
                {smartieGoals.map(goal => (
                  <div key={goal.id} style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg-card-alt)', borderRadius: '8px', borderLeft: `3px solid ${goal.status === 'completed' ? COLORS.green : goal.status === 'archived' ? '#9ca3af' : COLORS.teal}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <strong style={{ color: COLORS.navy, fontSize: '0.95rem' }}>{goal.goal_title}</strong>
                      <span style={{
                        padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: '600',
                        background: goal.status === 'completed' ? '#dcfce7' : goal.status === 'archived' ? '#f3f4f6' : '#dbeafe',
                        color: goal.status === 'completed' ? '#166534' : goal.status === 'archived' ? '#6b7280' : '#1e40af'
                      }}>
                        {goal.status.charAt(0).toUpperCase() + goal.status.slice(1)}
                      </span>
                    </div>
                    {goal.stsioa_domain && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Domain: {goal.stsioa_domain}</div>}
                    {goal.strategic && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}><strong>Strategic:</strong> {goal.strategic}</div>}
                    {goal.progress_notes && (
                      <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#fffbeb', borderRadius: '4px', fontSize: '0.8rem' }}>
                        <strong style={{ color: '#92400e' }}>Progress:</strong> {goal.progress_notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Link to goals page even if none exist yet */}
            {smartieGoals.length === 0 && (
              <div style={{ ...cardStyle, marginBottom: '1.5rem', textAlign: 'center', padding: '2rem' }}>
                <div style={cardHeaderStyle}>SMARTIE Goals</div>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No SMARTIE goals have been created for this team yet.</p>
                <button
                  onClick={() => navigate(`/admin/smartie-goals/${teamId}`)}
                  style={{ padding: '0.5rem 1.5rem', background: COLORS.teal, color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                >
                  Create Goals
                </button>
              </div>
            )}

            {/* Admin Reviews */}
            {Object.keys(reviews).length > 0 && (
              <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
                <div style={cardHeaderStyle}>Expert Review & Recommendations</div>
                {TIMEPOINT_ORDER.map(tp => {
                  const review = reviews[tp]
                  if (!review) return null
                  return (
                    <div key={tp} style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                      <h3 style={{ color: COLORS.navy, marginBottom: '0.75rem', fontSize: '1rem' }}>
                        {TIMEPOINT_LABELS[tp]}
                        {review.released_to_agency && <span style={{ fontSize: '0.75rem', color: COLORS.green, marginLeft: '0.5rem' }}>Published</span>}
                        {!review.released_to_agency && <span style={{ fontSize: '0.75rem', color: COLORS.amber, marginLeft: '0.5rem' }}>Draft</span>}
                      </h3>
                      {review.overall_comments && (
                        <div style={{ marginBottom: '0.75rem' }}>
                          <strong style={{ fontSize: '0.85rem' }}>Overall Comments:</strong>
                          <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{review.overall_comments}</p>
                        </div>
                      )}
                      {review.strengths && (
                        <div style={{ marginBottom: '0.75rem' }}>
                          <strong style={{ fontSize: '0.85rem', color: COLORS.green }}>Strengths:</strong>
                          <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{review.strengths}</p>
                        </div>
                      )}
                      {review.areas_for_improvement && (
                        <div style={{ marginBottom: '0.75rem' }}>
                          <strong style={{ fontSize: '0.85rem', color: COLORS.amber }}>Areas for Improvement:</strong>
                          <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{review.areas_for_improvement}</p>
                        </div>
                      )}
                      {review.recommended_actions && (
                        <div style={{ marginBottom: '0.75rem' }}>
                          <strong style={{ fontSize: '0.85rem', color: COLORS.teal }}>Recommended Actions:</strong>
                          <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{review.recommended_actions}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
