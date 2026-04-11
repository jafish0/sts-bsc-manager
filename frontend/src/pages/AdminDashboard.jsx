import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../utils/supabase'
import { PROGRAM_TYPE_COLORS } from '../config/programConfig'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [selfRatingCount, setSelfRatingCount] = useState(0)
  const [unmatchedCount, setUnmatchedCount] = useState(0)
  const [unmatchedList, setUnmatchedList] = useState([])
  const [showUnmatched, setShowUnmatched] = useState(false)

  useEffect(() => {
    loadSelfRatingStats()
    loadUnmatchedAttendees()
  }, [])

  const loadSelfRatingStats = async () => {
    const { data } = await supabase.rpc('get_self_rating_completion_stats')
    const total = (data || []).reduce((sum, row) => sum + (row.users_completed || 0), 0)
    setSelfRatingCount(total)
  }

  const loadUnmatchedAttendees = async () => {
    const { data, count } = await supabase
      .from('unmatched_attendees')
      .select('*, teams:suggested_team_id(team_name)', { count: 'exact' })
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setUnmatchedCount(count || 0)
    setUnmatchedList(data || [])
  }

  const handleDismissUnmatched = async (id) => {
    await supabase
      .from('unmatched_attendees')
      .update({ status: 'dismissed', resolved_by: user.id, resolved_at: new Date().toISOString() })
      .eq('id', id)
    setUnmatchedList(prev => prev.filter(u => u.id !== id))
    setUnmatchedCount(prev => prev - 1)
  }

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error logging out:', error)
      alert('Error logging out')
    } else {
      navigate('/login')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      {/* Header */}
      <div style={{ 
        background: '#0E1F56', 
        color: 'white', 
        padding: '1.5rem 2rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.875rem' }}>BSC Platform Manager</h1>
            <p style={{ margin: '0.25rem 0 0 0', opacity: 0.9, fontSize: '0.875rem' }}>
              Admin Dashboard
            </p>
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
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        {/* Program Tiles */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#0E1F56', marginBottom: '1rem' }}>Programs</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {[
              { key: 'sts_bsc', name: 'STS-BSC', full: 'Secondary Traumatic Stress Breakthrough Series Collaborative', active: true },
              { key: 'tic_lc', name: 'TIC LC', full: 'Trauma-Informed Care Learning Collaborative', active: true },
              { key: 'fourc', name: 'FourC', full: 'FourC Occupational Trauma', active: false },
              { key: 'tipe_lc', name: 'TIPE LC', full: 'Trauma-Informed Practices for Educators LC', active: false },
            ].map(prog => {
              const colors = PROGRAM_TYPE_COLORS[prog.key]
              return (
                <button
                  key={prog.key}
                  onClick={prog.active ? () => navigate('/admin/collaboratives') : undefined}
                  style={{
                    padding: '1.5rem',
                    background: prog.active ? 'var(--bg-card)' : '#f9fafb',
                    border: `2px solid ${prog.active ? colors.color : '#d1d5db'}`,
                    borderRadius: '0.75rem',
                    cursor: prog.active ? 'pointer' : 'default',
                    textAlign: 'left',
                    opacity: prog.active ? 1 : 0.6,
                    transition: 'all 0.2s',
                    position: 'relative',
                  }}
                  onMouseOver={prog.active ? (e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
                  } : undefined}
                  onMouseOut={prog.active ? (e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  } : undefined}
                >
                  {!prog.active && (
                    <span style={{
                      position: 'absolute', top: '0.75rem', right: '0.75rem',
                      background: '#9ca3af', color: 'white', fontSize: '0.65rem',
                      padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: '600'
                    }}>
                      Coming Soon
                    </span>
                  )}
                  <span style={{
                    display: 'inline-block',
                    background: colors.bg, color: colors.color,
                    padding: '0.2rem 0.6rem', borderRadius: '4px',
                    fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem'
                  }}>
                    {colors.label}
                  </span>
                  <div style={{ color: '#0E1F56', fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                    {prog.name}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: '1.3' }}>
                    {prog.full}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Admin Tools */}
        <h2 style={{ color: '#0E1F56', marginBottom: '1rem' }}>Admin Tools</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          <button
            onClick={() => navigate('/admin/collaboratives')}
            style={{
              padding: '2rem',
              background: 'var(--bg-card)',
              border: '2px solid var(--border-light)',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#0E1F56'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
            <div style={{ color: '#0E1F56', fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Manage Collaboratives
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Create and manage breakthrough series collaboratives
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/completion')}
            style={{
              padding: '2rem',
              background: 'var(--bg-card)',
              border: '2px solid var(--border-light)',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#00A79D'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
            <div style={{ color: '#0E1F56', fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Completion Tracking
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Monitor assessment completion across teams
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/data-visualization')}
            style={{
              padding: '2rem',
              background: 'var(--bg-card)',
              border: '2px solid var(--border-light)',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#00A79D'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📈</div>
            <div style={{ color: '#0E1F56', fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Data Visualization
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              View charts and graphs of assessment results
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/collaboratives')}
            style={{
              padding: '2rem',
              background: 'var(--bg-card)',
              border: '2px solid var(--border-light)',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#0E1F56'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
            <div style={{ color: '#0E1F56', fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Team Reports
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              View longitudinal reports by team with export options
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/resources')}
            style={{
              padding: '2rem',
              background: 'var(--bg-card)',
              border: '2px solid var(--border-light)',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#00A79D'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📚</div>
            <div style={{ color: '#0E1F56', fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Resources
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Manage the resource library for all teams
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/forum')}
            style={{
              padding: '2rem',
              background: 'var(--bg-card)',
              border: '2px solid var(--border-light)',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#0E1F56'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💬</div>
            <div style={{ color: '#0E1F56', fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Community Forum
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Discuss strategies and share experiences with teams
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/change-framework')}
            style={{
              padding: '2rem',
              background: 'var(--bg-card)',
              border: '2px solid var(--border-light)',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#00A79D'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏗️</div>
            <div style={{ color: '#0E1F56', fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Change Framework
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              View the collaborative improvement framework by domain
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/strategies')}
            style={{
              padding: '2rem',
              background: 'var(--bg-card)',
              border: '2px solid var(--border-light)',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#00A79D'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💡</div>
            <div style={{ color: '#0E1F56', fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Strategy Ideas
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Browse improvement strategies by domain
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/sts-pat-overview')}
            style={{
              padding: '2rem',
              background: 'var(--bg-card)',
              border: '2px solid var(--border-light)',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#0E1F56'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📜</div>
            <div style={{ color: '#0E1F56', fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              STS-PAT Results
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              View policy analysis results across all teams
            </div>
          </button>

          <button
            style={{
              padding: '2rem',
              background: 'var(--bg-card)',
              border: '2px solid var(--border-light)',
              borderRadius: '0.75rem',
              cursor: 'default',
              textAlign: 'left'
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>&#128203;</div>
            <div style={{ color: '#0E1F56', fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Self-Rating Engagement
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {selfRatingCount} team member{selfRatingCount !== 1 ? 's' : ''} completed the supervisor self-rating
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/staff')}
            style={{
              padding: '2rem',
              background: 'var(--bg-card)',
              border: '2px solid var(--border-light)',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#0E1F56'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👥</div>
            <div style={{ color: '#0E1F56', fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Project Staff
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Meet the BSC faculty and support team
            </div>
          </button>
          {unmatchedCount > 0 && (
            <button
              onClick={() => setShowUnmatched(!showUnmatched)}
              style={{
                padding: '2rem',
                background: 'var(--bg-card)',
                border: '2px solid #f59e0b',
                borderRadius: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'left'
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>&#9888;&#65039;</div>
              <div style={{ color: '#0E1F56', fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                Unmatched Attendees
                <span style={{ background: '#f59e0b', color: 'white', borderRadius: '999px', padding: '0.15rem 0.5rem', fontSize: '0.8rem', marginLeft: '0.5rem' }}>{unmatchedCount}</span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Session attendees not matched to a team member profile
              </div>
            </button>
          )}
        </div>

        {/* Unmatched Attendees Panel */}
        {showUnmatched && unmatchedList.length > 0 && (
          <div style={{ marginTop: '1.5rem', background: 'var(--bg-card)', borderRadius: '0.75rem', padding: '1.5rem', border: '2px solid #f59e0b' }}>
            <h3 style={{ margin: '0 0 1rem', color: '#0E1F56', fontSize: '1.1rem' }}>Unmatched Attendees</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#0E1F56', color: 'white' }}>
                    {['Name', 'Email', 'Role', 'Suggested Team', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: '600', fontSize: '0.8rem' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {unmatchedList.map((u, i) => (
                    <tr key={u.id} style={{ background: i % 2 === 0 ? '#f9fafb' : 'white', borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: '500' }}>{u.attendee_name}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{u.attendee_email}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{u.attendee_role || '—'}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        {u.teams?.team_name || <span style={{ color: '#9ca3af' }}>No suggestion</span>}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <button onClick={() => handleDismissUnmatched(u.id)} style={{
                          padding: '0.2rem 0.5rem', background: '#e5e7eb', color: '#374151',
                          border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem'
                        }}>Dismiss</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}