import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import { COLORS, cardStyle, TIMEPOINTS } from '../utils/constants'
import { STS_PAT_INFO } from '../config/stspat'

export default function StsPatOverview() {
  const navigate = useNavigate()
  const { isSuperAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [teamResults, setTeamResults] = useState([])
  const [sortField, setSortField] = useState('total_score')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    // Load all completed assessments with team info
    const { data } = await supabase
      .from('sts_pat_assessments')
      .select('*, teams(id, team_name, agency_name)')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })

    if (data) {
      // Group by team, take most recent per team
      const byTeam = {}
      data.forEach(a => {
        if (!byTeam[a.team_id]) byTeam[a.team_id] = a
      })
      setTeamResults(Object.values(byTeam))
    }
    setLoading(false)
  }

  const sorted = [...teamResults].sort((a, b) => {
    const aVal = a[sortField] ?? 0
    const bVal = b[sortField] ?? 0
    return sortDir === 'desc' ? bVal - aVal : aVal - bVal
  })

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'desc' ? 'asc' : 'desc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const scoreColor = pct => pct >= 70 ? COLORS.green : pct >= 40 ? COLORS.amber : COLORS.red
  const sortIcon = (field) => sortField === field ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ''

  if (loading) return <div style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p>Loading...</p></div>

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      <div style={{ background: COLORS.navy, color: 'white', padding: '1.5rem 2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>STS-PAT Results Overview</h1>
            <p style={{ margin: '0.25rem 0 0 0', opacity: 0.9, fontSize: '0.875rem' }}>Policy analysis results across all teams</p>
          </div>
          <button onClick={() => navigate('/admin')} style={{ padding: '0.5rem 1rem', background: COLORS.teal, color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '500' }}>
            Back to Dashboard
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        {teamResults.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>No teams have completed an STS-PAT assessment yet.</p>
          </div>
        ) : (
          <div style={cardStyle}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-light)' }}>
                    <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => handleSort('teams.team_name')}>Team</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>Timepoint</th>
                    <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => handleSort('total_score')}>Total{sortIcon('total_score')}</th>
                    <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => handleSort('part1_score')}>Part 1{sortIcon('part1_score')}</th>
                    <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => handleSort('part2_score')}>Part 2{sortIcon('part2_score')}</th>
                    <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => handleSort('part3_score')}>Part 3{sortIcon('part3_score')}</th>
                    <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => handleSort('part4_score')}>Part 4{sortIcon('part4_score')}</th>
                    <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>Date</th>
                    <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(a => {
                    const pct = Math.round((a.total_score / 150) * 100)
                    return (
                      <tr key={a.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)', fontWeight: '500' }}>{a.teams?.team_name || '—'}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)' }}>{TIMEPOINTS.find(t => t.value === a.timepoint)?.label || a.timepoint || '—'}</td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontWeight: '700', color: scoreColor(pct) }}>{a.total_score}/150 ({pct}%)</td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: scoreColor((a.part1_score / 65) * 100) }}>{a.part1_score}/65</td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: scoreColor((a.part2_score / 20) * 100) }}>{a.part2_score}/20</td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: scoreColor((a.part3_score / 25) * 100) }}>{a.part3_score}/25</td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: scoreColor((a.part4_score / 40) * 100) }}>{a.part4_score}/40</td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>{a.completed_at ? new Date(a.completed_at).toLocaleDateString() : '—'}</td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                          <button onClick={() => navigate(`/admin/sts-pat/${a.team_id}`)} style={{ padding: '0.25rem 0.5rem', background: COLORS.navy, color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                            View
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
