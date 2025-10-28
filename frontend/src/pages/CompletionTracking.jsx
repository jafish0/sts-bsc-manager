import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { useNavigate } from 'react-router-dom'

export default function CompletionTracking() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [collaboratives, setCollaboratives] = useState([])
  const [selectedCollaborative, setSelectedCollaborative] = useState(null)
  const [selectedTimepoint, setSelectedTimepoint] = useState('baseline')
  const [completionData, setCompletionData] = useState([])

  const timepoints = [
    { value: 'baseline', label: 'Baseline' },
    { value: 'endline', label: 'Endline' },
    { value: '6_month', label: '6-Month Follow-up' },
    { value: '12_month', label: '12-Month Follow-up' }
  ]

  // Load collaboratives on mount
  useEffect(() => {
    loadCollaboratives()
  }, [])

  // Load completion data when collaborative or timepoint changes
  useEffect(() => {
    if (selectedCollaborative) {
      loadCompletionData()
    }
  }, [selectedCollaborative, selectedTimepoint])

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

  const loadCompletionData = async () => {
    setLoading(true)
    try {
      // Get all teams for this collaborative
      const { data: teams, error: teamsError } = await supabase
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
        .order('team_name')

      if (teamsError) throw teamsError

      // For each team, check if they have completed assessments at this timepoint
      const completionPromises = teams.map(async (team) => {
        const teamCode = team.team_codes.find(tc => tc.timepoint === selectedTimepoint)
        
        if (!teamCode) {
          return {
            ...team,
            codeId: null,
            completed: false,
            responseCount: 0,
            lastSubmission: null
          }
        }

        // Check for assessment responses using this code
        const { data: responses, error: responsesError } = await supabase
          .from('assessment_responses')
          .select('id, completed_at')
          .eq('team_code_id', teamCode.id)
          .order('completed_at', { ascending: false })

        if (responsesError) throw responsesError

        return {
          ...team,
          codeId: teamCode.id,
          code: teamCode.code,
          completed: responses && responses.length > 0,
          responseCount: responses ? responses.length : 0,
          lastSubmission: responses && responses.length > 0 ? responses[0].completed_at : null
        }
      })

      const completionResults = await Promise.all(completionPromises)
      setCompletionData(completionResults)

    } catch (error) {
      console.error('Error loading completion data:', error)
      alert('Error loading completion data')
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = () => {
    const total = completionData.length
    const completed = completionData.filter(t => t.completed).length
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
    const totalResponses = completionData.reduce((sum, t) => sum + t.responseCount, 0)

    return { total, completed, percentage, totalResponses }
  }

  const stats = calculateStats()

  const formatDate = (dateString) => {
    if (!dateString) return 'Not started'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading && collaboratives.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    )
  }

  if (collaboratives.length === 0) {
    return (
      <div style={{ padding: '2rem' }}>
        <button
          onClick={() => navigate('/admin')}
          style={{
            marginBottom: '2rem',
            padding: '0.5rem 1rem',
            background: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            cursor: 'pointer'
          }}
        >
          ← Back to Dashboard
        </button>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <h2 style={{ color: '#0E1F56', marginBottom: '1rem' }}>No Collaboratives Found</h2>
          <p style={{ color: '#6b7280' }}>Create a collaborative first to track completion.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={() => navigate('/admin')}
          style={{
            marginBottom: '1rem',
            padding: '0.5rem 1rem',
            background: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            cursor: 'pointer'
          }}
        >
          ← Back to Dashboard
        </button>
        <h1 style={{ color: '#0E1F56', marginBottom: '0.5rem' }}>Completion Tracking</h1>
        <p style={{ color: '#6b7280' }}>Monitor assessment completion across teams and timepoints</p>
      </div>

      {/* Collaborative Selector */}
      <div style={{ 
        background: 'white', 
        padding: '1.5rem', 
        borderRadius: '0.5rem', 
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '2rem'
      }}>
        <label style={{ 
          display: 'block', 
          fontWeight: '500', 
          color: '#0E1F56', 
          marginBottom: '0.5rem' 
        }}>
          Select Collaborative
        </label>
        <select
          value={selectedCollaborative || ''}
          onChange={(e) => setSelectedCollaborative(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            fontSize: '1rem'
          }}
        >
          {collaboratives.map(collab => (
            <option key={collab.id} value={collab.id}>
              {collab.name}
            </option>
          ))}
        </select>
      </div>

      {/* Timepoint Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        marginBottom: '2rem',
        flexWrap: 'wrap'
      }}>
        {timepoints.map(tp => (
          <button
            key={tp.value}
            onClick={() => setSelectedTimepoint(tp.value)}
            style={{
              padding: '0.75rem 1.5rem',
              background: selectedTimepoint === tp.value ? '#0E1F56' : 'white',
              color: selectedTimepoint === tp.value ? 'white' : '#0E1F56',
              border: `2px solid ${selectedTimepoint === tp.value ? '#0E1F56' : '#d1d5db'}`,
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
          >
            {tp.label}
          </button>
        ))}
      </div>

      {/* Statistics Summary */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{ 
          background: 'white', 
          padding: '1.5rem', 
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            Completion Rate
          </div>
          <div style={{ color: '#0E1F56', fontSize: '2rem', fontWeight: 'bold' }}>
            {stats.percentage}%
          </div>
          <div style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {stats.completed} of {stats.total} teams
          </div>
        </div>

        <div style={{ 
          background: 'white', 
          padding: '1.5rem', 
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            Total Responses
          </div>
          <div style={{ color: '#00A79D', fontSize: '2rem', fontWeight: 'bold' }}>
            {stats.totalResponses}
          </div>
          <div style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Individual assessments
          </div>
        </div>

        <div style={{ 
          background: 'white', 
          padding: '1.5rem', 
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            Pending
          </div>
          <div style={{ color: '#f59e0b', fontSize: '2rem', fontWeight: 'bold' }}>
            {stats.total - stats.completed}
          </div>
          <div style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Teams not started
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ 
        background: 'white', 
        padding: '1.5rem', 
        borderRadius: '0.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '2rem'
      }}>
        <div style={{ marginBottom: '0.5rem', fontWeight: '500', color: '#0E1F56' }}>
          Overall Progress
        </div>
        <div style={{ 
          width: '100%', 
          height: '2rem', 
          background: '#e5e7eb', 
          borderRadius: '9999px',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: `${stats.percentage}%`,
            background: 'linear-gradient(90deg, #0E1F56 0%, #00A79D 100%)',
            transition: 'width 0.5s ease-in-out',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold'
          }}>
            {stats.percentage > 10 && `${stats.percentage}%`}
          </div>
        </div>
      </div>

      {/* Team Completion Cards */}
      <div style={{ 
        display: 'grid', 
        gap: '1rem'
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
            Loading completion data...
          </div>
        ) : completionData.length === 0 ? (
          <div style={{ 
            background: 'white', 
            padding: '2rem', 
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <p style={{ color: '#6b7280' }}>No teams found for this collaborative.</p>
          </div>
        ) : (
          completionData.map(team => (
            <div 
              key={team.id}
              style={{ 
                background: 'white', 
                padding: '1.5rem', 
                borderRadius: '0.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                borderLeft: `4px solid ${team.completed ? '#00A79D' : '#f59e0b'}`
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <h3 style={{ color: '#0E1F56', marginBottom: '0.25rem', fontSize: '1.125rem' }}>
                    {team.team_name}
                  </h3>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                    {team.agency_name}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                      Status
                    </div>
                    <div style={{ 
                      display: 'inline-block',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      background: team.completed ? '#d1fae5' : '#fef3c7',
                      color: team.completed ? '#065f46' : '#92400e',
                      fontSize: '0.875rem',
                      fontWeight: '500'
                    }}>
                      {team.completed ? '✓ Complete' : 'Pending'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                      Responses
                    </div>
                    <div style={{ color: '#0E1F56', fontSize: '1.5rem', fontWeight: 'bold' }}>
                      {team.responseCount}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', minWidth: '150px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                      Last Submission
                    </div>
                    <div style={{ color: '#0E1F56', fontSize: '0.875rem' }}>
                      {formatDate(team.lastSubmission)}
                    </div>
                  </div>
                </div>
              </div>

              {team.code && (
                <div style={{ 
                  marginTop: '1rem', 
                  paddingTop: '1rem', 
                  borderTop: '1px solid #e5e7eb',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280', marginRight: '0.5rem' }}>
                      Team Code:
                    </span>
                    <code style={{ 
                      background: '#f3f4f6', 
                      padding: '0.25rem 0.5rem', 
                      borderRadius: '0.25rem',
                      fontSize: '0.875rem',
                      color: '#0E1F56',
                      fontFamily: 'monospace'
                    }}>
                      {team.code}
                    </code>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}