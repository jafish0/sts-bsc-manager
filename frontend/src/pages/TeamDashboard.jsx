import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import { COLORS, cardStyle, cardHeaderStyle } from '../utils/constants'

export default function TeamDashboard() {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [motto, setMotto] = useState('')
  const [goalCount, setGoalCount] = useState(0)

  useEffect(() => {
    if (profile?.team_id) {
      loadTeam()
    } else {
      setLoading(false)
    }
  }, [profile])

  const loadTeam = async () => {
    try {
      const { data: teamData, error } = await supabase
        .from('teams')
        .select('*, collaboratives (name)')
        .eq('id', profile.team_id)
        .single()

      if (error) throw error
      setTeam(teamData)
      setDisplayName(teamData.display_name || teamData.team_name)
      setMotto(teamData.motto || '')

      // Count active goals
      const { count } = await supabase
        .from('smartie_goals')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', profile.team_id)
        .eq('status', 'active')
      setGoalCount(count || 0)
    } catch (err) {
      console.error('Error loading team:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveTeamInfo = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('teams')
        .update({
          display_name: displayName.trim() || team.team_name,
          motto: motto.trim() || null
        })
        .eq('id', team.id)

      if (error) throw error
      setTeam(prev => ({ ...prev, display_name: displayName.trim() || prev.team_name, motto: motto.trim() || null }))
      setEditing(false)
    } catch (err) {
      console.error('Error saving team info:', err)
      alert('Error saving: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', color: COLORS.navy, fontSize: '1.25rem' }}>Loading your dashboard...</div>
      </div>
    )
  }

  if (!team) {
    return (
      <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '2rem' }}>
        <div style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center' }}>
          <h2 style={{ color: COLORS.navy }}>No Team Assigned</h2>
          <p style={{ color: '#6b7280' }}>Your account is not linked to a team yet. Please contact CTAC for assistance.</p>
          <button onClick={handleSignOut} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: COLORS.teal, color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  const teamDisplayName = team.display_name || team.team_name

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      {/* Hero Header */}
      <div style={{
        background: `linear-gradient(135deg, ${COLORS.navy} 0%, ${COLORS.teal} 100%)`,
        color: 'white',
        padding: '2.5rem 2rem 2rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '0.25rem' }}>
                {team.agency_name} — {team.collaboratives?.name}
              </div>
              <h1 style={{ margin: '0 0 0.5rem', fontSize: '2rem' }}>
                {editing ? (
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      border: '2px solid rgba(255,255,255,0.4)',
                      borderRadius: '6px',
                      color: 'white',
                      fontSize: '1.8rem',
                      fontWeight: '700',
                      padding: '0.25rem 0.5rem',
                      width: '100%',
                      maxWidth: '400px'
                    }}
                    placeholder={team.team_name}
                  />
                ) : teamDisplayName}
              </h1>
              {editing ? (
                <input
                  type="text"
                  value={motto}
                  onChange={(e) => setMotto(e.target.value)}
                  placeholder="Add a team motto..."
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '4px',
                    color: 'white',
                    fontSize: '1rem',
                    fontStyle: 'italic',
                    padding: '0.3rem 0.5rem',
                    width: '100%',
                    maxWidth: '400px'
                  }}
                />
              ) : (
                team.motto && (
                  <p style={{ margin: 0, fontSize: '1.1rem', fontStyle: 'italic', opacity: 0.9 }}>
                    "{team.motto}"
                  </p>
                )
              )}
              {editing && (
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={handleSaveTeamInfo}
                    disabled={saving}
                    style={{ padding: '0.4rem 1rem', background: 'white', color: COLORS.navy, border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditing(false); setDisplayName(team.display_name || team.team_name); setMotto(team.motto || '') }}
                    style={{ padding: '0.4rem 1rem', background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
              <button onClick={handleSignOut} style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '500' }}>
                Sign Out
              </button>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  style={{ padding: '0.2rem 0.5rem', background: 'transparent', color: 'rgba(255,255,255,0.6)', border: 'none', cursor: 'pointer', fontSize: '0.7rem', textDecoration: 'underline' }}
                >
                  Edit Name/Motto
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div style={{ maxWidth: '1000px', margin: '2rem auto', padding: '0 1rem' }}>
        {/* Action Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* Team Report */}
          <button
            onClick={() => navigate(`/admin/team-report/${team.id}`)}
            style={{
              padding: '2rem',
              background: 'white',
              border: '2px solid #d1d5db',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = COLORS.teal
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
            <div style={{ color: COLORS.navy, fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Assessment Results
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              View your team's STSS, ProQOL, and STSI-OA results across timepoints
            </div>
          </button>

          {/* SMARTIE Goals */}
          <button
            onClick={() => navigate(`/admin/smartie-goals/${team.id}`)}
            style={{
              padding: '2rem',
              background: 'white',
              border: '2px solid #d1d5db',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = COLORS.navy
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎯</div>
            <div style={{ color: COLORS.navy, fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              SMARTIE Goals
              {goalCount > 0 && (
                <span style={{ fontSize: '0.85rem', fontWeight: '400', color: COLORS.teal, marginLeft: '0.5rem' }}>
                  ({goalCount} active)
                </span>
              )}
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              Set and track your team's improvement goals
            </div>
          </button>

          {/* Data Visualization */}
          <button
            onClick={() => navigate('/admin/data-visualization')}
            style={{
              padding: '2rem',
              background: 'white',
              border: '2px solid #d1d5db',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = COLORS.teal
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
            <div style={{ color: COLORS.navy, fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Data Visualization
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              View detailed charts and graphs of assessment results
            </div>
          </button>

          {/* Resources */}
          <button
            onClick={() => navigate('/admin/resources')}
            style={{
              padding: '2rem',
              background: 'white',
              border: '2px solid #d1d5db',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = COLORS.teal
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
            <div style={{ color: COLORS.navy, fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Resources
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              Browse guides, tools, and videos by STSI-OA domain
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
